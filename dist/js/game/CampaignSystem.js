import { loadDataJson } from '../data/jsonLoader.js';

const DEFAULT_ACT_ORDER = ['startup', 'expansion', 'political', 'frontier'];
const FUNDING_ROUND_ORDER = ['bootstrap', 'seed', 'seriesA', 'seriesB', 'seriesC', 'seriesD', 'ipo', 'postIpo'];
const FUNDING_ROUND_ALIASES = {
    bootstrap: 'bootstrap',
    seed: 'seed',
    seriesa: 'seriesA',
    series_a: 'seriesA',
    seriesb: 'seriesB',
    series_b: 'seriesB',
    seriesc: 'seriesC',
    series_c: 'seriesC',
    seriesd: 'seriesD',
    series_d: 'seriesD',
    ipo: 'ipo',
    postipo: 'postIpo',
    post_ipo: 'postIpo'
};

let campaignData = null;
let campaignDataPromise = null;

export async function initCampaign() {
    if (!campaignDataPromise) {
        campaignDataPromise = loadDataJson('campaign.json').then(data => {
            campaignData = data;
            return campaignData;
        });
    }
    return campaignDataPromise;
}

export function getCampaignData() {
    return campaignData;
}

export function evaluateCurrentAct(state = {}) {
    const data = campaignData;
    const order = _getActOrder(data);

    if (!data?.ACTS || order.length === 0) {
        return { actId: 'startup', actIndex: 0, actData: null };
    }

    let currentAct = order[0] || 'startup';
    let currentIndex = 0;

    for (let i = order.length - 1; i >= 0; i -= 1) {
        const actId = order[i];
        const act = data.ACTS[actId];
        if (!act) continue;
        if (_checkActConditions(act.conditions, state)) {
            currentAct = actId;
            currentIndex = i;
            break;
        }
    }

    return {
        actId: currentAct,
        actIndex: currentIndex,
        actData: data.ACTS[currentAct] || null
    };
}

export function checkActTransition(state = {}) {
    const currentAct = state?.campaign?.currentAct || 'startup';
    const currentIndex = _getActIndex(currentAct);
    const evaluated = evaluateCurrentAct(state);

    if (evaluated.actIndex > currentIndex) {
        return {
            from: currentAct,
            to: evaluated.actId,
            actData: evaluated.actData
        };
    }

    return null;
}

function _getActOrder(data) {
    const order = Array.isArray(data?.ACT_ORDER) ? data.ACT_ORDER.filter(Boolean) : [];
    return order.length > 0 ? order : [...DEFAULT_ACT_ORDER];
}

function _getActIndex(actId) {
    return _getActOrder(campaignData).indexOf(actId);
}

function _checkActConditions(conditions = {}, state = {}) {
    if (conditions.always) return true;

    const checks = [];

    if (conditions.minTeamSize != null) {
        checks.push(_getTalentCount(state) >= Number(conditions.minTeamSize));
    }

    if (conditions.minModelPerformance != null) {
        checks.push(_getBestModelPerformance(state) >= Number(conditions.minModelPerformance));
    }

    if (conditions.minFundingRound != null) {
        const requiredIndex = FUNDING_ROUND_ORDER.indexOf(_normalizeFundingRoundId(conditions.minFundingRound));
        const currentIndex = FUNDING_ROUND_ORDER.indexOf(_getCurrentFundingRound(state));
        checks.push(requiredIndex >= 0 && currentIndex >= requiredIndex);
    }

    if (conditions.minTechCount != null) {
        checks.push(_getCompletedTechCount(state) >= Number(conditions.minTechCount));
    }

    if (conditions.globalAILevel != null) {
        checks.push(Number(state?.global?.globalAILevel || 0) >= Number(conditions.globalAILevel));
    }

    if (checks.length === 0) return false;
    return conditions.anyOf ? checks.some(Boolean) : checks.every(Boolean);
}

function _getTalentCount(state) {
    return Array.isArray(state?.talents) ? state.talents.length : 0;
}

function _getBestModelPerformance(state) {
    const models = Array.isArray(state?.models) ? state.models : [];
    let best = 0;

    for (const model of models) {
        if (!model || typeof model !== 'object') continue;
        const candidates = [model.performance, model.relativePerformance, model.score, model.rating]
            .map(value => Number(value))
            .filter(Number.isFinite);
        if (candidates.length > 0) {
            best = Math.max(best, Math.max(...candidates));
        }
    }

    return best;
}

function _getCompletedTechCount(state) {
    const technologies = state?.technologies;
    if (!technologies || typeof technologies !== 'object') return 0;

    return Object.values(technologies).filter(tech => {
        if (!tech || typeof tech !== 'object') return false;
        if (tech.completed === true) return true;

        const progress = Number(tech.progress);
        const cost = Number(tech.cost);
        return Number.isFinite(progress) && Number.isFinite(cost) && cost > 0 && progress >= cost;
    }).length;
}

function _getCurrentFundingRound(state) {
    const currentRound = state?.economy?.currentRound;
    if (currentRound != null) {
        return _normalizeFundingRoundId(currentRound);
    }

    const fundingStage = Number(state?.economy?.fundingStage);
    if (Number.isFinite(fundingStage)) {
        const stageIndex = Math.max(0, Math.min(FUNDING_ROUND_ORDER.length - 1, fundingStage));
        return FUNDING_ROUND_ORDER[stageIndex];
    }

    return 'bootstrap';
}

function _normalizeFundingRoundId(value) {
    if (value == null) return 'bootstrap';
    if (typeof value === 'number') {
        const stageIndex = Math.max(0, Math.min(FUNDING_ROUND_ORDER.length - 1, value));
        return FUNDING_ROUND_ORDER[stageIndex];
    }

    const normalized = String(value).trim();
    if (!normalized) return 'bootstrap';

    const lower = normalized.toLowerCase().replace(/-/g, '_');
    return FUNDING_ROUND_ALIASES[lower] || FUNDING_ROUND_ORDER.find(roundId => roundId.toLowerCase() === lower) || normalized;
}
