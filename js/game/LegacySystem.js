import { t } from '../i18n.js';

const LEGACY_PERKS = [
    {
        id: 'research_lab',
        titleKey: 'legacy.bonus.research.title',
        titleFallback: '전설의 연구소',
        descriptionKey: 'legacy.bonus.research.desc',
        descriptionFallback: '연구 속도 +5%',
        apply(state) {
            _ensureModifiers(state).researchSpeed = Math.max(
                Number(state.player?.modifiers?.researchSpeed || 1),
                1.05
            );
        }
    },
    {
        id: 'open_source_pioneer',
        titleKey: 'legacy.bonus.open_source.title',
        titleFallback: '오픈소스 유산',
        descriptionKey: 'legacy.bonus.open_source.desc',
        descriptionFallback: '오픈소스 수익 +15%, 공개 신뢰 +5',
        apply(state) {
            const mods = _ensureModifiers(state);
            mods.openSourceRevenue = Math.max(Number(mods.openSourceRevenue || 1), 1.15);
            state.reputation ||= {};
            state.reputation.publicImage = _clamp(Number(state.reputation.publicImage || 0) + 5, -100, 100);
        }
    },
    {
        id: 'investor_trust',
        titleKey: 'legacy.bonus.investor.title',
        titleFallback: '투자자 신뢰',
        descriptionKey: 'legacy.bonus.investor.desc',
        descriptionFallback: '투자자 신뢰 +10',
        apply(state) {
            state.reputation ||= {};
            state.reputation.investorTrust = _clamp(Number(state.reputation.investorTrust || 50) + 10, 0, 100);
        }
    },
    {
        id: 'ai_legacy',
        titleKey: 'legacy.bonus.ai.title',
        titleFallback: 'AI 유산',
        descriptionKey: 'legacy.bonus.ai.desc',
        descriptionFallback: '안전 연구 +10%, 연구 속도 +3%',
        apply(state) {
            const mods = _ensureModifiers(state);
            mods.safetyResearch = Math.max(Number(mods.safetyResearch || 1), 1.1);
            mods.researchSpeed = Math.max(Number(mods.researchSpeed || 1), 1.03);
        }
    }
];

export function getLegacyPerkOptions(previousRuns = []) {
    if (!Array.isArray(previousRuns) || previousRuns.length === 0) return [];
    return LEGACY_PERKS.map(perk => ({
        ...perk,
        title: t(perk.titleKey, perk.titleFallback),
        description: t(perk.descriptionKey, perk.descriptionFallback)
    }));
}

export function applyLegacyPerk(state, perkId) {
    const perk = LEGACY_PERKS.find(entry => entry.id === perkId);
    if (!perk || !state) return false;
    perk.apply(state);
    return true;
}

export function summarizeLegacyRuns(previousRuns = []) {
    return (Array.isArray(previousRuns) ? previousRuns : []).slice(0, 4).map(run => ({
        companyName: run?.companyName || 'Unknown',
        result: run?.result || 'unknown',
        grade: run?.grade || 'F',
        year: run?.year || null,
        legacy: run?.legacy || 'balanced_builder'
    }));
}

function _ensureModifiers(state) {
    state.player ||= {};
    state.player.modifiers ||= {};
    return state.player.modifiers;
}

function _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
