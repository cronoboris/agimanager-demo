import { t } from '../i18n.js';
import { COUNTRIES } from '../data/countries.js';

function _getCountryModifiers(state) {
    return state?.player?.countryModifiers || state?.player?.countryBonuses || {};
}

function _bonusMultiplier(value, strength = 0.75) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 1;
    if (numeric === 1) return 1;
    return 1 + ((numeric - 1) * strength);
}

export class MarketSystem {
    constructor(gameState) {
        this.state = gameState;
    }

    processMonthly() {
        this._updateUnemployment();
        this._updateAIFavorability();
        this._updateGeopoliticalTension();
        this._updatePlayerMarketShare();
    }

    _updateUnemployment() {
        // AI products increase unemployment in related industries
        const deployedProducts = this.state.models.filter(m => m.deployed);
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

        // Competitor products also affect unemployment
        for (const comp of this.state.competitors) {
            if (comp.currentModel.performance > 30) {
                const factor = comp.currentModel.performance / 500;
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

        // High unemployment decreases favorability
        if (avgUnemployment > 10) {
            this.state.global.aiFavorability -= (avgUnemployment - 10) * 0.1;
        }

        // Natural recovery if low unemployment
        if (avgUnemployment < 8) {
            this.state.global.aiFavorability += 0.1;
        }

        // Global AI level advancement slightly decreases favorability (fear)
        if (this.state.global.globalAILevel > 50) {
            this.state.global.aiFavorability -= 0.05;
        }

        // Clamp
        this.state.global.aiFavorability = Math.max(0, Math.min(100, this.state.global.aiFavorability));

        // Warnings
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

        s.global.geopoliticalTension = Math.max(0, Math.min(100, Math.round(tension)));

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

    _updatePlayerMarketShare() {
        const countryMods = _getCountryModifiers(this.state);
        const competitionMult = _bonusMultiplier(countryMods.competition, 0.8);
        const africanMarketMult = _bonusMultiplier(countryMods.africanMarket, 1);
        const deployedModels = this.state.models.filter(m => m.deployed);
        if (deployedModels.length === 0) {
            this.state.reputation.marketShare = Math.max(0, this.state.reputation.marketShare - (0.1 * competitionMult));
            return;
        }

        const bestPerformance = Math.max(...deployedModels.map(m => m.performance || 0));
        const competitorBest = Math.max(...this.state.competitors.map(c => c.currentModel.performance));

        if (bestPerformance > competitorBest) {
            const gain = 0.5 * africanMarketMult;
            this.state.reputation.marketShare = Math.min(50, this.state.reputation.marketShare + gain);
        } else {
            this.state.reputation.marketShare = Math.max(0, this.state.reputation.marketShare - (0.2 * competitionMult));
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

function _getBestModelScore(state) {
    return Math.max(0, ...(state?.models || []).map(model => Number(model.compositeScore || model.performance || 0) || 0));
}

function _getCountry(countryId) {
    return COUNTRIES?.[countryId] || null;
}
