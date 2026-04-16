import { loadDataJson } from '../data/jsonLoader.js';
import { COUNTRIES, COUNTRY_POLICY_OVERRIDES } from '../data/countries.js';
import { t } from '../i18n.js';
import { processStateActorCycle } from './StateActorSystem.js';

let regionsData = null;

const REGION_POLICY_DEFAULTS = {
    north_america: { type: 'permissive', regulationLevel: 4, subsidyChance: 0.08, dataRestriction: 3, exportControl: 3, gpuAccess: 9, aiTalentPool: 9, volatility: 0.08 },
    europe: { type: 'regulatory', regulationLevel: 7, subsidyChance: 0.1, dataRestriction: 7, exportControl: 4, gpuAccess: 7, aiTalentPool: 7, volatility: 0.12 },
    east_asia: { type: 'proactive', regulationLevel: 5, subsidyChance: 0.14, dataRestriction: 5, exportControl: 5, gpuAccess: 8, aiTalentPool: 8, volatility: 0.14 },
    middle_east: { type: 'proactive', regulationLevel: 3, subsidyChance: 0.16, dataRestriction: 3, exportControl: 2, gpuAccess: 7, aiTalentPool: 6, volatility: 0.1 },
    middle_east_africa: { type: 'proactive', regulationLevel: 3, subsidyChance: 0.16, dataRestriction: 3, exportControl: 2, gpuAccess: 7, aiTalentPool: 6, volatility: 0.1 },
    south_asia: { type: 'restrictive', regulationLevel: 6, subsidyChance: 0.06, dataRestriction: 6, exportControl: 4, gpuAccess: 5, aiTalentPool: 7, volatility: 0.16 },
    southeast_asia: { type: 'proactive', regulationLevel: 4, subsidyChance: 0.12, dataRestriction: 4, exportControl: 2, gpuAccess: 7, aiTalentPool: 7, volatility: 0.1 },
    south_america: { type: 'restrictive', regulationLevel: 5, subsidyChance: 0.05, dataRestriction: 5, exportControl: 3, gpuAccess: 4, aiTalentPool: 4, volatility: 0.14 },
    east_europe: { type: 'state_driven', regulationLevel: 6, subsidyChance: 0.04, dataRestriction: 7, exportControl: 5, gpuAccess: 4, aiTalentPool: 5, volatility: 0.16 }
};

export async function initGeopolitics() {
    regionsData = await loadDataJson('regions.json');
    return regionsData;
}

export function getRegionsData() {
    return regionsData;
}

export function getCountryPolicy(countryId) {
    const country = COUNTRIES[countryId];
    const regionDefault = REGION_POLICY_DEFAULTS[country?.region] || REGION_POLICY_DEFAULTS.north_america;
    return {
        label: { ko: '정책', en: 'Policy' },
        ...regionDefault,
        ...(COUNTRY_POLICY_OVERRIDES[countryId] || {})
    };
}

export function getCountryPolicyEffects(countryId) {
    const policy = getCountryPolicy(countryId);
    return {
        researchMod: 1.0 - (policy.regulationLevel - 5) * 0.02,
        costMod: 1.0 + (policy.regulationLevel - 5) * 0.03,
        gpuMod: policy.gpuAccess / 10,
        talentMod: policy.aiTalentPool / 10,
        subsidyChance: policy.subsidyChance || 0,
        exportControl: policy.exportControl || 1
    };
}

function addPlayerCountryMonthlyEvents(state, monthlyEvents = []) {
    const countryId = state.player?.country;
    const policy = getCountryPolicy(countryId);
    const events = [...monthlyEvents];

    if (Math.random() < (policy.subsidyChance || 0)) {
        events.push({
            type: 'subsidy',
            title: t('geo.subsidy', '정부 AI 보조금'),
            amount: 50000 + Math.floor(Math.random() * 100000),
            country: countryId
        });
    }

    if (Math.random() < (policy.volatility || 0.1) * 0.25) {
        const delta = Math.random() > 0.5 ? 1 : -1;
        events.push({
            type: 'policy_change',
            title: delta > 0 ? t('geo.regulation_up', '규제 강화') : t('geo.regulation_down', '규제 완화'),
            regulationDelta: delta,
            country: countryId
        });
    }

    if ((state.global?.globalAILevel || 0) > 50 && Math.random() < 0.05) {
        events.push({
            type: 'export_control',
            title: t('geo.export_control', 'GPU 수출 통제 강화'),
            affectedRegions: ['east_asia', 'middle_east_africa']
        });
    }

    return events;
}

export function processGeopoliticsCycle(state) {
    const { monthlyEvents, quarterlyEvents } = processStateActorCycle(state);
    return {
        monthlyEvents: addPlayerCountryMonthlyEvents(state, monthlyEvents),
        quarterlyEvents
    };
}

export function processMonthlyGeopolitics(state) {
    const { monthlyEvents, quarterlyEvents } = processGeopoliticsCycle(state);
    return [...monthlyEvents, ...quarterlyEvents];
}

export function calculateRegionalMarketShare(state) {
    const data = regionsData?.REGIONS || {};
    const result = {};

    for (const [regionId, region] of Object.entries(data)) {
        const isHome = (region.countries || []).includes(state.player?.country);
        const baseShare = Number(state.reputation?.marketShare || 0);
        const entryPenalty = (Number(region.entryBarrier || 3) - 3) * 2;
        const homeBonus = isHome ? 5 : 0;
        result[regionId] = {
            share: Math.max(0, Math.min(100, baseShare - entryPenalty + homeBonus)),
            size: region.marketSize,
            regulation: region.regulationBase
        };
    }

    return result;
}
