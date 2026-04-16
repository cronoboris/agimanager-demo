import { t } from '../i18n.js';
import { normalizeDataInventory, normalizeGpuFleet } from './ComputeSystem.js';
import { createDefaultInternalAIState, normalizeInternalAIState } from './InternalAISystem.js';
import { normalizeGameStateCompatibility } from './GameStateCompatibility.js';

function _resolveNewsParam(value) {
    if (Array.isArray(value)) return value.map(_resolveNewsParam);
    if (value && typeof value === 'object' && value.__i18nKey) {
        return t(value.__i18nKey, value.fallback || '', value.params || {});
    }
    return value;
}

function _resolveNewsParams(params = {}) {
    return Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, _resolveNewsParam(value)])
    );
}

function createDefaultServiceState() {
    return {
        totalUsers: 0,
        totalApiUsers: 0,
        totalConsumerUsers: 0,
        totalEnterpriseClients: 0,
        totalGovernmentContracts: 0,
        totalOpenSourceUsers: 0,
        totalInternalUsers: 0,
        totalB2BClients: 0,
        totalAllocatedTFLOPS: 0,
        totalMonthlyRevenue: 0,
        satisfaction: 0
    };
}

export class GameState {
    constructor() {
        this.resources = {
            funds: 500000,
            computing: 10,    // total GPUs (owned + cloud)
            power: 100,
            data: 5,          // TB
            totalData: 5,
            monthlyIncome: 0,
            monthlyExpense: 0
        };

        this.reputation = {
            corporate: 0,
            marketShare: 0,
            investorTrust: 50,
            publicImage: 0
        };

        this.global = {
            aiFavorability: 65,
            globalAILevel: 5,
            geopoliticalTension: 0,
            countryFavorability: {},
            unemploymentByIndustry: {
                office: 5,
                transport: 3,
                manufacturing: 4,
                design: 2,
                development: 3
            }
        };

        this.player = {
            ceoName: '',
            ceoAvatar: '👨‍💼',
            companyName: '',
            country: '',
            techRoute: 'llm',
            foundedDate: null,
            modifiers: {},
            countryModifiers: {},
            countryBonuses: {}
        };
        this.internalAI = createDefaultInternalAIState();
        this.service = createDefaultServiceState();
        this.openSourceModels = [];
        this.karma = createDefaultKarmaState();
        this.eventChains = {};
        this.legacy = {
            previousRuns: [],
            activeBonus: null
        };

        // Economy (initialized by EconomySystem, but declare structure here)
        this.economy = {
            fundingStage: 0,
            fundingHistory: [],
            totalRaised: 0,
            ownershipPct: 100,
            valuation: 500_000,
            lastValuation: 500_000,

            ownedGPUs: 0,
            cloudGPUs: 10,
            gpuFleet: normalizeGpuFleet({ ownedGPUs: 0, cloudGPUs: 10, currentYear: 2017 }),
            gpuMarketPrice: 8000,
            gpuPriceHistory: [8000],
            gpuMarketShockMult: 1,
            cloudCostShockMult: 1,
            gpuSupplyShutdownMonths: 0,

            revenue: { api: 0, b2b: 0, consumer: 0, licensing: 0 },
            expenses: {
                salaries: 0, cloudCompute: 0, ownedGPUPower: 0,
                dataAcquisition: 0, overhead: 5000, marketing: 0
            },

            burnRate: 0,
            runway: Infinity,
            revenueGrowthRate: 0,

            dataAssets: normalizeDataInventory(5),
            totalDataTB: 5,
            dataCostPerTB: 10_000,
            pendingGpuOrders: [],
            colocation: {
                racks: 0,
                monthlyPerRack: 2000,
                capacityPerRack: 50
            },
            chipPrograms: [],
            completedChipPrograms: [],
            chipProgramLimit: 1,
            customSiliconBonuses: {
                trainingSpeedMult: 1,
                inferenceCostMult: 1,
                powerCostMult: 1,
                computeMult: 1,
                gpuPriceShockMult: 1
            },

            fundraisingActive: false,
            fundraisingProgress: 0,
            fundraisingTarget: null
        };

        this.talents = [];
        this.models = [];
        this.technologies = {};
        this.competitors = [];
        this.newsLog = [];
        this.activeResearch = [];

        this.gameStarted = false;
        this.gameOver = false;
        this.gameResult = null;
        this.marketDominanceMonths = 0;

        normalizeGameStateCompatibility(this, 2017);
    }

    localizeNewsEntry(entry) {
        if (!entry) return '';
        if (entry.messageKey) {
            return t(
                entry.messageKey,
                entry.messageFallback || entry.message || '',
                _resolveNewsParams(entry.messageParams || {})
            );
        }
        return entry.message || '';
    }

    refreshNewsLocale() {
        this.newsLog = (this.newsLog || []).map(entry => ({
            ...entry,
            message: this.localizeNewsEntry(entry)
        }));
    }

    addNews(message, type = 'info') {
        const currentDate = typeof window !== 'undefined'
            ? { ...window.game?.time?.currentDate }
            : undefined;
        const entry = {
            type,
            date: currentDate
        };

        if (message && typeof message === 'object' && !Array.isArray(message)) {
            entry.type = message.type || type;
            if (message.key) {
                entry.messageKey = message.key;
                entry.messageFallback = message.fallback || message.message || '';
                entry.messageParams = message.params || {};
                entry.message = this.localizeNewsEntry(entry);
            } else {
                entry.message = String(message.message || '');
            }
        } else {
            entry.message = String(message || '');
        }

        this.newsLog.unshift(entry);
        if (this.newsLog.length > 200) this.newsLog.pop();
        return entry;
    }

    getMonthlyBalance() {
        return this.resources.monthlyIncome - this.resources.monthlyExpense;
    }

    // Legacy compatibility — now handled by EconomySystem
    calculateMonthlyExpense() {
        return this.resources.monthlyExpense;
    }

    calculateMonthlyIncome() {
        return this.resources.monthlyIncome;
    }

    applyMonthlyFinances() {
        // Now delegated to EconomySystem.processMonthly()
        // This is kept as a no-op for backward compatibility
    }

    toJSON() {
        normalizeGameStateCompatibility(this);
        return {
            resources: this.resources,
            reputation: this.reputation,
            global: this.global,
            player: this.player,
            internalAI: this.internalAI,
            service: this.service,
            openSourceModels: this.openSourceModels,
            karma: this.karma,
            eventChains: this.eventChains,
            legacy: this.legacy,
            economy: this.economy,
            talents: this.talents,
            models: this.models,
            technologies: this.technologies,
            competitors: this.competitors,
            newsLog: this.newsLog,
            activeResearch: this.activeResearch,
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            gameResult: this.gameResult,
            marketDominanceMonths: this.marketDominanceMonths || 0
        };
    }

    fromJSON(data) {
        Object.assign(this.resources, data.resources);
        Object.assign(this.reputation, data.reputation);
        Object.assign(this.global, data.global);
        Object.assign(this.player, data.player);
        this.karma = {
            ...createDefaultKarmaState(),
            ...(data.karma || {})
        };
        this.eventChains = { ...(data.eventChains || {}) };
        if (data.economy) {
            const incomingFleet = Array.isArray(data.economy.gpuFleet) ? data.economy.gpuFleet : null;
            const explicitOwned = Number.isFinite(Number(data.economy.ownedGPUs)) ? Number(data.economy.ownedGPUs) : null;
            const explicitCloud = Number.isFinite(Number(data.economy.cloudGPUs)) ? Number(data.economy.cloudGPUs) : null;
            const incomingFleetTotal = incomingFleet?.reduce((sum, slot) => sum + Number(slot?.count || 0), 0) ?? null;
            const explicitFleetTotal = explicitOwned != null || explicitCloud != null
                ? Math.max(0, (explicitOwned || 0) + (explicitCloud || 0))
                : null;

            // Deep merge economy
            for (const key of Object.keys(this.economy)) {
                if (data.economy[key] !== undefined) {
                    if (key === 'gpuFleet' && incomingFleet && explicitFleetTotal != null && incomingFleetTotal !== explicitFleetTotal) {
                        continue;
                    }
                    if (typeof this.economy[key] === 'object' && !Array.isArray(this.economy[key]) && this.economy[key] !== null) {
                        Object.assign(this.economy[key], data.economy[key]);
                    } else {
                        this.economy[key] = data.economy[key];
                    }
                }
            }
        }
        this.talents = data.talents || [];
        this.models = data.models || [];
        this.technologies = data.technologies || {};
        this.competitors = data.competitors || [];
        this.newsLog = data.newsLog || [];
        this.refreshNewsLocale();
        this.activeResearch = data.activeResearch || [];
        this.internalAI = normalizeInternalAIState(data.internalAI || this.internalAI);
        this.service = {
            ...createDefaultServiceState(),
            ...(data.service || {})
        };
        this.openSourceModels = Array.isArray(data.openSourceModels) ? data.openSourceModels : [];
        this.legacy = {
            previousRuns: [],
            activeBonus: null,
            ...(data.legacy || {})
        };
        if (data.gameStarted !== undefined) this.gameStarted = data.gameStarted;
        if (data.gameOver !== undefined) this.gameOver = data.gameOver;
        if (data.gameResult !== undefined) this.gameResult = data.gameResult;
        this.marketDominanceMonths = data.marketDominanceMonths || 0;
        normalizeGameStateCompatibility(this);
    }
}

function createDefaultKarmaState() {
    return {
        privacyViolation: false,
        safetyCorner: false,
        militaryContract: false,
        openSourceBetrayal: false,
        talentExploitation: false,
        dataTheft: false,
        lobbyCorruption: false,
        aiManipulation: false,
        environmentalDamage: false,
        monopolyAbuse: false
    };
}
