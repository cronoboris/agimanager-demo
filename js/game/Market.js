import { t } from '../i18n.js';
import { COUNTRIES } from '../data/countries.js';
import { getRegionsData } from './GeopoliticsSystem.js';
import {
    getAggregateServicePriceCompetitiveness,
    getServicePriceCompetitiveness
} from './ServicePricing.js';

const REGION_FALLBACKS = {
    north_america: { marketSize: 35, entryBarrier: 3, regulationBase: 4, countries: ['us', 'ca'] },
    europe: { marketSize: 25, entryBarrier: 6, regulationBase: 7, countries: ['gb', 'de', 'fr'] },
    east_asia: { marketSize: 25, entryBarrier: 5, regulationBase: 5, countries: ['kr', 'jp', 'cn', 'tw'] },
    middle_east_africa: { marketSize: 8, entryBarrier: 4, regulationBase: 3, countries: ['il', 'ae', 'sa'] },
    south_global: { marketSize: 7, entryBarrier: 2, regulationBase: 3, countries: ['in', 'sg', 'br'] }
};

const REGION_ALIAS_MAP = {
    north_america: 'north_america',
    europe: 'europe',
    east_europe: 'europe',
    east_asia: 'east_asia',
    southeast_asia: 'south_global',
    south_asia: 'south_global',
    south_america: 'south_global',
    central_america: 'south_global',
    central_asia: 'south_global',
    oceania: 'south_global',
    middle_east: 'middle_east_africa',
    africa: 'middle_east_africa'
};

const COMPETITOR_REGION_ALIASES = {
    na: 'north_america',
    eu: 'europe',
    apac: 'east_asia'
};

function _getCountryModifiers(state) {
    return state?.player?.countryModifiers || state?.player?.countryBonuses || {};
}

function _bonusMultiplier(value, strength = 0.75) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 1;
    if (numeric === 1) return 1;
    return 1 + ((numeric - 1) * strength);
}

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));
}

function _getBestModelScore(state) {
    return Math.max(0, ...(state?.models || []).map(model => Number(model.compositeScore || model.performance || 0) || 0));
}

function _getCountry(countryId) {
    return COUNTRIES?.[countryId] || null;
}

function resolveMarketRegions() {
    const data = getRegionsData?.()?.REGIONS;
    return data && Object.keys(data).length > 0 ? data : REGION_FALLBACKS;
}

function toMarketRegion(regionId) {
    return REGION_ALIAS_MAP[regionId] || regionId || 'south_global';
}

function getRegionCountries(region) {
    return Array.isArray(region?.countries) ? region.countries : [];
}

function getRegionSize(region) {
    return Math.max(1, Number(region?.marketSize || 0) || 1);
}

function getCompetitorRegionalShare(internalState, regionId) {
    const shares = internalState?.marketShareByRegion || {};
    if (Number.isFinite(Number(shares[regionId]))) {
        return Number(shares[regionId]);
    }

    let total = 0;
    for (const [key, value] of Object.entries(shares)) {
        const resolved = COMPETITOR_REGION_ALIASES[key] || key;
        if (resolved === regionId) {
            total += Number(value || 0);
        }
    }
    return total;
}

function buildCompetitorStrength(comp, regionId, region, activeControls) {
    const internal = comp.internalState || {};
    const currentModel = comp.currentModel || {};
    const sameRegion = getRegionCountries(region).includes(comp.country);
    const regionalShare = getCompetitorRegionalShare(internal, regionId);
    const subsidyBoost = sameRegion ? (Number(comp.policyPressure?.subsidy || 0) * 0.35) : 0;
    const exportPenalty = activeControls.includes(regionId) && !sameRegion
        ? (Number(comp.policyPressure?.exportControl || 0) * 0.25) + (Number(comp.risk?.supplyRisk || 0) * 0.18)
        : Number(comp.policyPressure?.exportControl || 0) * 0.08;
    const legalPenalty = Number(comp.risk?.legalPressure || 0) * 0.08;
    const investorSupport = Number(internal.finances?.investorSupport || 50);
    const headcount = Number(internal.talent?.headcount || 0);
    const runway = Number(internal.finances?.runwayMonths || 0);
    const primaryService = Array.isArray(internal.pipeline?.deployedServices) && internal.pipeline.deployedServices.length > 0
        ? internal.pipeline.deployedServices[0]
        : 'api';
    const priceMult = Number.isFinite(Number(internal.pricing?.priceMult))
        ? Number(internal.pricing.priceMult)
        : Number(comp.priceMult || 1);
    const priceStrength = getServicePriceCompetitiveness(priceMult, {
        channelType: primaryService,
        exponent: primaryService === 'consumer_chat' ? 0.75 : primaryService === 'enterprise' ? 0.45 : 0.6
    });

    const baseStrength = 16
        + (Number(currentModel.performance || comp.aiLevel || 0) * 2.1)
        + (Number(comp.marketShare || 0) * 7)
        + (regionalShare * 4)
        + (headcount * 0.06)
        + (investorSupport * 0.4)
        + (runway === Infinity ? 8 : Math.min(8, runway * 0.35))
        + subsidyBoost
        - legalPenalty
        - exportPenalty;

    const homeBonus = sameRegion ? 1.12 : 0.95;
    const policyBonus = 1 + ((Number(comp.statePressure?.total || 0) > 0) ? -0.015 : 0);
    return Math.max(1, baseStrength * homeBonus * policyBonus * priceStrength);
}

function buildPlayerStrength(state, regionId, region, activeControls) {
    const countryMods = _getCountryModifiers(state);
    const competitionMult = _bonusMultiplier(countryMods.competition, 0.8);
    const africanMarketMult = _bonusMultiplier(countryMods.africanMarket, 1);
    const deployedModels = state.models.filter(model => model.deployed);
    const bestPerformance = _getBestModelScore(state);
    const policyPressure = Number(state.global?.geopoliticalTension || 0) * 0.04;
    const playerCountry = state.player?.country;
    const sameRegion = getRegionCountries(region).includes(playerCountry);
    const exportPenalty = activeControls.includes(regionId) && !sameRegion ? 8 : 0;
    const serviceCoverage = deployedModels.reduce((sum, model) => {
        const activeChannels = Array.isArray(model.serviceChannels)
            ? model.serviceChannels.filter(channel => channel?.active).length
            : 0;
        return sum + activeChannels;
    }, 0);
    const priceCompetitiveness = getAggregateServicePriceCompetitiveness(
        deployedModels.flatMap(model => (Array.isArray(model.serviceChannels) ? model.serviceChannels.filter(channel => channel?.active) : [])),
        0.65
    );
    const performanceLeadership = Math.pow(Math.max(1, bestPerformance), 1.08) * 0.15;
    const marketPresence = Math.pow(Math.max(1, Number(state.reputation?.marketShare || 0)), 1.05) * 0.65;

    const baseStrength = 8
        + (bestPerformance * 0.8)
        + performanceLeadership
        + (Number(state.reputation?.marketShare || 0) * 1.15)
        + marketPresence
        + (Number(state.reputation?.corporate || 0) * 0.1)
        + (serviceCoverage * 2.0)
        + (sameRegion ? 4 : 0)
        + (regionId === 'middle_east_africa' ? (africanMarketMult - 1) * 6 : 0)
        - exportPenalty
        - policyPressure;

    return Math.max(1, (baseStrength * priceCompetitiveness) / Math.max(0.9, competitionMult));
}

export class MarketSystem {
    constructor(gameState) {
        this.state = gameState;
    }

    processSixHourly(hours = 6) {
        const tickCount = Math.max(1, Math.floor(Number(hours) || 6));
        const activeControls = Array.isArray(this.state.geopolitics?.activeControls)
            ? this.state.geopolitics.activeControls
            : [];

        for (const comp of this.state.competitors || []) {
            const pressure = Number(comp.statePressure?.total || 0) + Number(comp.policyPressure?.total || 0);
            if (pressure <= 0) continue;
            const compRegion = toMarketRegion(_getCountry(comp.country)?.region);
            const inAffectedRegion = activeControls.includes(compRegion);
            if (!inAffectedRegion) continue;
            comp.risk ||= {};
            comp.risk.supplyRisk = clamp(Number(comp.risk.supplyRisk || 0) + (pressure * tickCount / 60), 0, 100);
            if (comp.internalState?.risk) {
                comp.internalState.risk.supplyRisk = clamp(
                    Number(comp.internalState.risk.supplyRisk || 0) + (pressure * tickCount / 50),
                    0,
                    100
                );
            }
        }
    }

    processMonthly() {
        this._updateUnemployment();
        this._updateAIFavorability();
        this._updateGeopoliticalTension();
        this._updateRegionalCompetition();
    }

    _updateUnemployment() {
        const deployedProducts = this.state.models.filter(model => model.deployed);
        for (const model of deployedProducts) {
            if (model.unemploymentImpact) {
                for (const [industry, impact] of Object.entries(model.unemploymentImpact)) {
                    if (this.state.global.unemploymentByIndustry[industry] !== undefined) {
                        this.state.global.unemploymentByIndustry[industry] =
                            Math.min(50, this.state.global.unemploymentByIndustry[industry] + impact * 0.05);
                    }
                }
            }
        }

        for (const comp of this.state.competitors) {
            if ((comp.currentModel?.performance || 0) > 30) {
                const factor = (comp.currentModel.performance || 0) / 500;
                for (const key of Object.keys(this.state.global.unemploymentByIndustry)) {
                    this.state.global.unemploymentByIndustry[key] =
                        Math.min(50, this.state.global.unemploymentByIndustry[key] + factor);
                }
            }
        }
    }

    _updateAIFavorability() {
        const avgUnemployment = Object.values(this.state.global.unemploymentByIndustry)
            .reduce((a, b) => a + b, 0) / Object.keys(this.state.global.unemploymentByIndustry).length;

        if (avgUnemployment > 10) {
            this.state.global.aiFavorability -= (avgUnemployment - 10) * 0.1;
        }

        if (avgUnemployment < 8) {
            this.state.global.aiFavorability += 0.1;
        }

        if (this.state.global.globalAILevel > 50) {
            this.state.global.aiFavorability -= 0.05;
        }

        this.state.global.aiFavorability = clamp(this.state.global.aiFavorability);

        if (this.state.global.aiFavorability < 30 && Math.random() < 0.1) {
            this.state.addNews(t('market.ai_backlash_warning', '전 세계적으로 AI에 대한 반감이 고조되고 있습니다.'), 'warning');
            window.game?.triggerGlitch?.('warning');
        }
    }

    _updateGeopoliticalTension() {
        const s = this.state;
        const playerAILevel = _getBestModelScore(s);
        const globalAILevel = Number(s.global.globalAILevel || 0);
        const currentTension = (globalAILevel * 0.3) + (playerAILevel * 0.5);
        let tension = currentTension;

        if (s.karma?.militaryContract) tension += 10;
        if (s.karma?.aiManipulation) tension += 15;
        if (s.karma?.privacyViolation) tension += 4;
        if (s.karma?.safetyCorner) tension += 6;
        if (s.karma?.monopolyAbuse) tension += 5;
        const karmaCount = Object.values(s.karma || {}).filter(Boolean).length;
        tension += Math.min(6, karmaCount * 3);
        tension += Number(s.stateActors?.tensionIndex || 0) * 0.25;

        s.global.geopoliticalTension = clamp(Math.round(tension));

        for (const [countryId, fav] of Object.entries(s.global.countryFavorability || {})) {
            if (tension <= 60) continue;
            const country = _getCountry(countryId);
            if (!country?.penalties?.regulationPenalty) continue;
            const penalty = Math.max(0.2, Number(country.penalties.regulationPenalty) || 0.2);
            s.global.countryFavorability[countryId] = Math.max(0, fav - (0.5 * penalty));
        }

        if (s.global.geopoliticalTension >= 80) {
            window.game?.triggerGlitch?.('danger');
        }
    }

    _updateRegionalCompetition() {
        const regions = resolveMarketRegions();
        const activeControls = Array.isArray(this.state.geopolitics?.activeControls)
            ? this.state.geopolitics.activeControls
            : [];
        const regionEntries = Object.entries(regions);
        const totalRegionSize = regionEntries.reduce((sum, [, region]) => sum + getRegionSize(region), 0);
        const competitorTotals = new Map();
        let playerWeightedShare = 0;

        for (const [regionId, region] of regionEntries) {
            const playerStrength = buildPlayerStrength(this.state, regionId, region, activeControls);
            const competitorStrengths = (this.state.competitors || []).map(comp => ({
                comp,
                strength: buildCompetitorStrength(comp, regionId, region, activeControls)
            }));
            const totalStrength = playerStrength + competitorStrengths.reduce((sum, entry) => sum + entry.strength, 0);
            const sizeWeight = getRegionSize(region) / totalRegionSize;
            const playerShare = totalStrength > 0 ? (playerStrength / totalStrength) * 100 : 0;
            playerWeightedShare += playerShare * sizeWeight;

            const leaderboard = [
                {
                    id: 'player',
                    name: this.state.player.companyName || t('company.default_name', 'My Company'),
                    share: Number(playerShare.toFixed(2)),
                    isPlayer: true
                }
            ];

            for (const { comp, strength } of competitorStrengths) {
                const targetShare = totalStrength > 0 ? (strength / totalStrength) * 100 : 0;
                const currentRegional = getCompetitorRegionalShare(comp.internalState, regionId);
                const smoothedRegional = (currentRegional * 0.7) + (targetShare * 0.3);
                comp.internalState.marketShareByRegion[regionId] = Number(smoothedRegional.toFixed(2));
                competitorTotals.set(comp.id, (competitorTotals.get(comp.id) || 0) + (targetShare * sizeWeight));

                const delta = targetShare - currentRegional;
                if (comp.internalState?.finances) {
                    comp.internalState.finances.investorSupport = clamp(
                        Number(comp.internalState.finances.investorSupport || 50) + (delta * 0.5),
                        0,
                        100
                    );
                }
                if (comp.internalState?.risk) {
                    comp.internalState.risk.prPressure = clamp(
                        Number(comp.internalState.risk.prPressure || 0) + Math.max(0, -delta) * 0.35,
                        0,
                        100
                    );
                }
                const sharePressure = Math.max(0, playerShare - targetShare);
                comp.aiLevel = Math.max(
                    0,
                    Number(comp.aiLevel || 0) + (delta * 0.015) - (sharePressure * 0.02)
                );

                leaderboard.push({
                    id: comp.id,
                    name: comp.name,
                    share: Number(targetShare.toFixed(2)),
                    isPlayer: false
                });
            }

            leaderboard.sort((a, b) => b.share - a.share);
            const previous = this.state.geopolitics.regionalMarket?.[regionId] || {};
            this.state.geopolitics.regionalMarket[regionId] = {
                ...previous,
                share: Number(playerShare.toFixed(2)),
                playerShare: Number(playerShare.toFixed(2)),
                size: getRegionSize(region),
                regulation: Number(region.regulationBase || 0),
                leaderboard,
                topCompetitor: leaderboard.find(entry => !entry.isPlayer)?.name || null,
                activeControls: activeControls.includes(regionId)
            };
        }

        this.state.reputation.marketShare = Number(playerWeightedShare.toFixed(2));
        for (const comp of this.state.competitors || []) {
            const targetShare = competitorTotals.get(comp.id) || 0;
            comp.marketShare = Number(targetShare.toFixed(2));
        }
    }

    getGlobalAILevel() {
        const techProgress = Object.values(this.state.technologies)
            .filter(t => t.completed).length;
        const totalTechs = Object.keys(this.state.technologies).length;
        const competitorLevel = this.state.competitors.reduce((max, c) => Math.max(max, c.aiLevel), 0);

        this.state.global.globalAILevel = Math.round(
            (techProgress / totalTechs * 50) + (competitorLevel * 0.5)
        );
        return this.state.global.globalAILevel;
    }
}
