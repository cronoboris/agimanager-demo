import { t } from '../i18n.js';
import { getInternalAIBonus } from './InternalAISystem.js';

const AUDIT_TYPES = {
    internal: { cost: 50_000, durationMonths: 1, thoroughness: 0.5, requiresSafetyTalent: 1 },
    external: { cost: 200_000, durationMonths: 2, thoroughness: 0.8, requiresSafetyTalent: 0 },
    government: { cost: 500_000, durationMonths: 3, thoroughness: 1.0, requiresSafetyTalent: 0 }
};

function _clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function _ensureSafetyState(state) {
    state.safety ||= {};
    state.safety.score = Number.isFinite(Number(state.safety.score))
        ? Number(state.safety.score)
        : Number(state.safety.posture || 50);
    state.safety.posture = Number.isFinite(Number(state.safety.posture))
        ? Number(state.safety.posture)
        : state.safety.score;
    state.safety.debt = Number(state.safety.debt || 0);
    state.safety.researchInvestment = Number(state.safety.researchInvestment || 0);
    state.safety.auditsCompleted = Number(state.safety.auditsCompleted || 0);
    state.safety.activeAudit = state.safety.activeAudit || null;
    state.safety.certifications = Array.isArray(state.safety.certifications) ? state.safety.certifications : [];
    state.safety.incidentHistory = Array.isArray(state.safety.incidentHistory) ? state.safety.incidentHistory : [];
    state.safety.boardConcern = Number(state.safety.boardConcern || 0);
    return state.safety;
}

function _getSafetyTalentCount(state) {
    return (state.talents || []).filter(talent =>
        talent?.specialty === 'safety' ||
        talent?.specialty === 'alignment' ||
        talent?.specialty === 'policy'
    ).length;
}

function _modelSafetyScore(model = {}) {
    return Number(model?.capabilities?.safety || model?.safetyScore || model?.performance || model?.compositeScore || 50);
}

export function evaluateReleaseGate(state, model = {}) {
    const safety = _ensureSafetyState(state);
    const modelScore = _modelSafetyScore(model);
    const requiredScore = 70 + Math.max(0, (modelScore - 70) * 0.4);
    const canDeploy = safety.score >= 30;
    const riskLevel = safety.score >= requiredScore
        ? 'safe'
        : safety.score >= 55
            ? 'warning'
            : safety.score >= 30
                ? 'danger'
                : 'blocked';
    const safetyDebtIncrease = canDeploy
        ? Math.max(0, Math.round((requiredScore - safety.score) * 0.35))
        : Math.max(0, Math.round((40 - safety.score) * 0.8));

    return {
        canDeploy,
        riskLevel,
        safetyDebtIncrease,
        requiredScore,
        warnings: riskLevel === 'safe'
            ? []
            : [t('safety.warning.risky', '안전 점수 미달')]
    };
}

export function applyReleaseGate(state, model = {}) {
    const result = evaluateReleaseGate(state, model);
    _ensureSafetyState(state);
    state.safety.debt += result.safetyDebtIncrease;
    return result;
}

export function investInSafetyResearch(state, amount = 0) {
    _ensureSafetyState(state);
    const cost = Math.max(0, Number(amount || 0));
    if (cost <= 0 || (state.resources?.funds || 0) < cost) {
        return { success: false, reason: 'insufficient_funds' };
    }

    state.resources.funds -= cost;
    state.safety.researchInvestment += cost;
    state.safety.score = _clamp(state.safety.score + Math.max(1, Math.round(cost / 50_000)), 0, 100);
    return { success: true, invested: cost, score: state.safety.score };
}

export function startSafetyAudit(state, auditTypeId = 'internal', targetModelId = null) {
    const safety = _ensureSafetyState(state);
    const auditType = AUDIT_TYPES[auditTypeId];
    if (!auditType) return { success: false, reason: 'invalid_audit_type' };
    if (safety.activeAudit) return { success: false, reason: 'audit_in_progress' };

    if ((state.resources?.funds || 0) < auditType.cost) {
        return { success: false, reason: 'insufficient_funds' };
    }
    if (auditType.requiresSafetyTalent > 0 && _getSafetyTalentCount(state) < auditType.requiresSafetyTalent) {
        return { success: false, reason: 'insufficient_safety_talent' };
    }

    state.resources.funds -= auditType.cost;
    safety.activeAudit = {
        type: auditTypeId,
        targetModelId,
        monthsRemaining: auditType.durationMonths,
        thoroughness: auditType.thoroughness,
        cost: auditType.cost
    };

    return { success: true, audit: safety.activeAudit };
}

export function advanceSafetyAudit(state) {
    const safety = _ensureSafetyState(state);
    if (!safety.activeAudit) return null;
    safety.activeAudit.monthsRemaining = Math.max(0, Number(safety.activeAudit.monthsRemaining || 0) - 1);
    if (safety.activeAudit.monthsRemaining > 0) return null;
    return _completeSafetyAudit(state);
}

function _completeSafetyAudit(state) {
    const safety = _ensureSafetyState(state);
    const audit = safety.activeAudit;
    if (!audit) return null;

    const model = (state.models || []).find(entry => entry?.id === audit.targetModelId) || null;
    const baseScore = _modelSafetyScore(model);
    const issueCount = Math.max(0, Math.round((100 - safety.score) * audit.thoroughness * 0.05));
    const scoreBoost = Math.round(audit.thoroughness * 15 + issueCount * 2);

    safety.score = _clamp(safety.score + scoreBoost, 0, 100);
    safety.posture = safety.score;
    safety.auditsCompleted += 1;
    safety.activeAudit = null;
    safety.lastAuditResult = {
        modelId: audit.targetModelId,
        modelName: model?.name || 'Unknown',
        auditType: audit.type,
        score: safety.score,
        issuesFound: issueCount,
        baseScore,
        date: globalThis.window?.game?.time?.currentDate
            ? { ...globalThis.window.game.time.currentDate }
            : null
    };

    if (audit.type === 'government' && safety.score >= 70 && !safety.certifications.includes('government_certified')) {
        safety.certifications.push('government_certified');
    }

    state.addNews?.(
        t('safety.audit_completed', '안전 감사가 완료되었습니다.'),
        'success'
    );

    return safety.lastAuditResult;
}

export function processMonthlySafety(state) {
    const safety = _ensureSafetyState(state);
    state.board ||= { confidence: 55, pressure: 0, seats: 1 };
    state.culture ||= { mission: 50, speed: 50, discipline: 50, safety: 50 };

    const completedTechs = Object.values(state.technologies || {}).filter(tech => tech?.completed);
    const safetyTechs = completedTechs.filter(tech => tech.category === 'safety').length;
    const safetyRatio = completedTechs.length > 0 ? safetyTechs / completedTechs.length : 0;
    const averageModelSafety = (state.models || []).length > 0
        ? (state.models || []).reduce((sum, model) => sum + _modelSafetyScore(model), 0) / state.models.length
        : 0;
    const auditBonus = getInternalAIBonus(state.internalAI, 'safety_audit') * 10;

    const posture = Math.max(0, Math.min(
        100,
        35 + safetyRatio * 40 + averageModelSafety * 0.15 + (Number(state.culture.safety || 50) - 50) * 0.4 + auditBonus
    ));
    safety.posture = Math.round(posture);
    safety.score = safety.posture;

    const opsPenalty = (100 - Number(state.serviceOps?.reliability || 80)) * 0.2;
    state.board.pressure = Math.max(0, Math.round(opsPenalty + Math.max(0, 55 - posture) * 0.4));
    state.board.confidence = Math.max(0, Math.min(100, Math.round(70 - state.board.pressure + (state.reputation?.investorTrust || 50) * 0.2)));
    safety.boardConcern = Math.max(0, 100 - state.board.confidence);

    if (safety.activeAudit) {
        const result = advanceSafetyAudit(state);
        if (result) {
            return {
                posture: safety.posture,
                boardPressure: state.board.pressure,
                boardConfidence: state.board.confidence,
                audit: result
            };
        }
    }

    if (safety.debt > 0) {
        safety.debt = Math.max(0, safety.debt - 0.5);
    }

    return {
        posture: safety.posture,
        boardPressure: state.board.pressure,
        boardConfidence: state.board.confidence
    };
}

