import { t } from '../i18n.js';

function _clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

const DEFAULT_EFFECT_LABELS = {
    country_policy: { ko: '국가 정책 변동', en: 'Country Policy Change' },
    board_mood: { ko: '이사회 분위기', en: 'Board Mood Shift' },
    media_narrative: { ko: '미디어 내러티브', en: 'Media Narrative' },
    regulatory_scrutiny: { ko: '규제 감시 강화', en: 'Regulatory Scrutiny' },
    public_trust_debt: { ko: '공공 신뢰 부채', en: 'Public Trust Debt' },
    talent_bloc: { ko: '인재 파벌 결속', en: 'Talent Bloc Loyalty' }
};

const DEFAULT_EFFECT_ICONS = {
    country_policy: '🏛️',
    board_mood: '🎭',
    media_narrative: '📰',
    regulatory_scrutiny: '🔍',
    public_trust_debt: '💔',
    talent_bloc: '🤝'
};

export const PERSISTENT_EFFECT_TYPES = {
    country_policy: {
        applyMonthly(state, effect) {
            const mods = effect.modifiers || {};
            if (Number.isFinite(Number(mods.aiFavorabilityDelta))) {
                state.global.aiFavorability = _clamp((state.global.aiFavorability || 0) + Number(mods.aiFavorabilityDelta), 0, 100);
            }
        }
    },
    board_mood: {
        applyMonthly(state, effect) {
            const mods = effect.modifiers || {};
            if (Number.isFinite(Number(mods.confidenceDelta))) {
                state.board.confidence = _clamp((state.board.confidence || 0) + Number(mods.confidenceDelta), 0, 100);
            }
            if (Number.isFinite(Number(mods.pressureDelta))) {
                state.board.pressure = _clamp((state.board.pressure || 0) + Number(mods.pressureDelta), 0, 100);
            }
        }
    },
    media_narrative: {
        applyMonthly(state, effect) {
            const mods = effect.modifiers || {};
            if (Number.isFinite(Number(mods.publicImageDelta))) {
                state.reputation.publicImage = _clamp((state.reputation.publicImage || 0) + Number(mods.publicImageDelta), -100, 100);
            }
            if (Number.isFinite(Number(mods.corporateDelta))) {
                state.reputation.corporate = _clamp((state.reputation.corporate || 0) + Number(mods.corporateDelta), -100, 100);
            }
        }
    },
    regulatory_scrutiny: {
        applyMonthly(state, effect) {
            const mods = effect.modifiers || {};
            state._regulatoryScrutinyBonus = (state._regulatoryScrutinyBonus || 0) + Number(mods.auditChanceIncrease || 0);
            if (mods.fineAmount && Math.random() < Number(mods.fineRiskPerMonth || 0)) {
                const fine = Math.round(Number(mods.fineAmount));
                state.resources.funds -= fine;
                state.addNews(
                    t('persistent.regulatory_fine', '규제 벌금 -{amount}', { amount: `$${fine.toLocaleString()}` }),
                    'danger'
                );
            }
        }
    },
    public_trust_debt: {
        applyMonthly(state, effect) {
            const mods = effect.modifiers || {};
            if (Number.isFinite(Number(mods.monthlyDecay))) {
                state.reputation.publicImage = _clamp((state.reputation.publicImage || 0) - Number(mods.monthlyDecay), -100, 100);
            }
            if (Number.isFinite(Number(mods.reputationCap))) {
                state.reputation.publicImage = Math.min(state.reputation.publicImage, Number(mods.reputationCap));
            }
        }
    },
    talent_bloc: {
        applyMonthly(state, effect) {
            const mods = effect.modifiers || {};
            const targetIdeology = mods.ideology;
            for (const talent of state.talents || []) {
                const ideology = talent.ideologyProfile?.id || talent.ideology;
                if (targetIdeology && ideology !== targetIdeology) continue;
                if (Number.isFinite(Number(mods.loyaltyDelta))) {
                    talent.loyalty = _clamp((talent.loyalty || 50) + Number(mods.loyaltyDelta), 0, 100);
                }
                if (Number.isFinite(Number(mods.moraleDelta))) {
                    talent.morale = _clamp((talent.morale || 50) + Number(mods.moraleDelta), 0, 100);
                }
            }
        }
    }
};

export function normalizePersistentEffects(state) {
    if (!state) return [];
    const modern = Array.isArray(state.persistentEffects) ? state.persistentEffects : [];
    const legacy = Array.isArray(state.activeEffects) && state.activeEffects !== state.persistentEffects ? state.activeEffects : [];
    const merged = [...modern];

    for (const effect of legacy) {
        if (!effect || typeof effect !== 'object') continue;
        merged.push({
            id: effect.id || `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: effect.type || 'media_narrative',
            sourceEvent: effect.sourceEvent || effect.id || 'legacy',
            sourceChoice: effect.sourceChoice ?? 0,
            startDate: effect.startDate || null,
            duration: effect.duration ?? effect.remainingMonths ?? null,
            remainingMonths: effect.remainingMonths ?? effect.duration ?? null,
            modifiers: effect.modifiers || {},
            label: effect.label || DEFAULT_EFFECT_LABELS[effect.type] || { ko: '지속 효과', en: 'Persistent Effect' },
            icon: effect.icon || DEFAULT_EFFECT_ICONS[effect.type] || '🔄',
            description: effect.description || { ko: '', en: '' }
        });
    }

    state.persistentEffects = merged.filter(Boolean);
    state.activeEffects = state.persistentEffects;
    return state.persistentEffects;
}

export function addPersistentEffect(state, effectDef, sourceEventId = 'event', choiceIndex = 0) {
    if (!state || !effectDef) return null;
    normalizePersistentEffects(state);
    const effect = {
        id: `${sourceEventId}_${effectDef.type || 'effect'}_${Date.now()}`,
        type: effectDef.type || 'media_narrative',
        sourceEvent: sourceEventId,
        sourceChoice: choiceIndex,
        startDate: globalThis.window?.game?.time?.currentDate ? { ...globalThis.window.game.time.currentDate } : null,
        duration: effectDef.duration ?? effectDef.remainingMonths ?? null,
        remainingMonths: effectDef.remainingMonths ?? effectDef.duration ?? null,
        modifiers: effectDef.modifiers || {},
        label: effectDef.label || DEFAULT_EFFECT_LABELS[effectDef.type] || { ko: '지속 효과', en: 'Persistent Effect' },
        icon: effectDef.icon || DEFAULT_EFFECT_ICONS[effectDef.type] || '🔄',
        description: effectDef.description || { ko: '', en: '' }
    };
    state.persistentEffects.push(effect);
    state.activeEffects = state.persistentEffects;
    return effect;
}

export function processPersistentEffects(state) {
    normalizePersistentEffects(state);
    state._regulatoryScrutinyBonus = 0;
    const expired = [];

    for (const effect of state.persistentEffects) {
        const typeDef = PERSISTENT_EFFECT_TYPES[effect.type];
        typeDef?.applyMonthly?.(state, effect);
        if (effect.duration != null) {
            effect.duration = Math.max(0, Number(effect.duration || 0) - 1);
            effect.remainingMonths = effect.duration;
            if (effect.duration === 0) expired.push(effect);
        }
    }

    if (expired.length > 0) {
        for (const effect of expired) {
            const label = effect.label?.ko || effect.label?.en || t('persistent.effect', '지속 효과');
            state.addNews?.(t('persistent.expired', '[{label}] 효과 종료', { label }), 'info');
        }
    }

    state.persistentEffects = state.persistentEffects.filter(effect => effect.duration !== 0);
    state.activeEffects = state.persistentEffects;
    return state.persistentEffects;
}

export function localizeNarrativeText(value, fallback = '') {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        return value.ko || value.en || Object.values(value)[0] || fallback;
    }
    return fallback;
}

export function getPersistentEffectLabel(effect) {
    if (!effect) return t('persistent.effect', '지속 효과');
    return localizeNarrativeText(effect.label, PERSISTENT_EFFECT_TYPES[effect.type]?.label?.ko || t('persistent.effect', '지속 효과'));
}

export function getPersistentEffectDurationText(effect) {
    if (!effect) return '';
    const duration = effect.duration ?? effect.remainingMonths ?? null;
    if (duration == null) return t('persistent.duration_permanent', '영구');
    return t('persistent.duration_months', '{months}개월', { months: Math.max(0, Number(duration || 0)) });
}
