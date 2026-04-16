import { COMPETITORS } from '../data/companies.js';
import { BALANCE } from '../data/balance.js';
import { t } from '../i18n.js';
import {
    clampServicePriceMult,
    getAggregateServicePriceCompetitiveness,
    getServiceDemandMultiplier,
    resolveCompetitorPriceMult
} from './ServicePricing.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function cloneModel(model, fallbackName = 'Model') {
    if (model && typeof model === 'object') return { ...model };
    return {
        name: fallbackName,
        performance: 0
    };
}

function resolveCompetitorModel(competitor, model = null) {
    if (model && typeof model === 'object') return model;
    if (competitor?.currentModel && typeof competitor.currentModel === 'object') return competitor.currentModel;
    const released = Array.isArray(competitor?.modelsReleased) ? competitor.modelsReleased : [];
    return released.length > 0 ? released[released.length - 1] : null;
}

function resolveRelation(competitor, relationOverride = null) {
    const relation = relationOverride == null ? competitor?.relation ?? 0 : relationOverride;
    return clamp(toNumber(relation, 0), -100, 100);
}

function resolvePerformance(competitor, model = null) {
    const resolvedModel = resolveCompetitorModel(competitor, model);
    const performance = toNumber(resolvedModel?.performance ?? competitor?.aiLevel ?? 0, 0);
    return Math.max(0, performance);
}

const DEFAULT_DOCTRINE = {
    type: 'balanced',
    label: { ko: '균형형', en: 'Balanced' },
    description: { ko: '연구와 사업을 균형 있게 추구합니다.', en: 'Balances research and business execution.' },
    behavior: { releaseThreshold: 0.75, safetyInvestment: 0.25, expansionRate: 1, diplomacyStyle: 'neutral', hiringAggression: 0.5, prSensitivity: 0.5 }
};

function getDoctrinePreset(competitor) {
    return competitor?.doctrine || DEFAULT_DOCTRINE;
}

function resolveResearchQueue(profile, fallbackName) {
    const queue = Array.isArray(profile?.simulation?.pipeline?.researchQueue)
        ? [...profile.simulation.pipeline.researchQueue]
        : [];
    if (queue.length > 0) return queue;
    return [
        `${fallbackName} frontier`,
        `${fallbackName} refinement`
    ];
}

function resolveDeployedServices(profile) {
    const services = Array.isArray(profile?.simulation?.pipeline?.deployedServices)
        ? [...profile.simulation.pipeline.deployedServices]
        : [];
    return services.length > 0 ? services : ['api'];
}

const COMPETITOR_SERVICE_TYPE_MAP = Object.freeze({
    consumer: 'consumer_chat',
    'consumer-chat': 'consumer_chat',
    platform: 'enterprise',
    'open-source': 'open_source',
    opensource: 'open_source'
});

function normalizeCompetitorServiceType(serviceType = 'api') {
    return COMPETITOR_SERVICE_TYPE_MAP[serviceType] || serviceType || 'api';
}

function resolveCompetitorServiceTypes(profileOrPipeline = {}) {
    const rawServices = Array.isArray(profileOrPipeline?.pipeline?.deployedServices)
        ? profileOrPipeline.pipeline.deployedServices
        : Array.isArray(profileOrPipeline?.deployedServices)
            ? profileOrPipeline.deployedServices
            : resolveDeployedServices(profileOrPipeline);
    const normalized = rawServices
        .map(service => normalizeCompetitorServiceType(String(service || 'api').trim()))
        .filter(Boolean);
    return normalized.length > 0 ? normalized : ['api'];
}

function buildCompetitorPricingSignals(serviceTypes = ['api'], priceMult = 1) {
    const normalizedServices = resolveCompetitorServiceTypes({ deployedServices: serviceTypes });
    const demandTotal = normalizedServices.reduce((sum, serviceType) => sum + getServiceDemandMultiplier(priceMult, serviceType), 0);
    const competitiveness = getAggregateServicePriceCompetitiveness(
        normalizedServices.map(serviceType => ({
            type: serviceType,
            active: true,
            allocatedTFLOPS: 1,
            priceMult
        })),
        0.6
    );
    return {
        serviceTypes: normalizedServices,
        demandMult: demandTotal / normalizedServices.length,
        competitiveness
    };
}

function resolveMarketShareByRegion(profile) {
    const provided = profile?.simulation?.marketShareByRegion;
    if (provided && typeof provided === 'object') return { ...provided };

    const marketShare = Math.max(1, toNumber(profile?.marketShare, 0));
    const na = Math.max(1, Math.round(marketShare * 0.45));
    const eu = Math.max(1, Math.round(marketShare * 0.25));
    const apac = Math.max(1, marketShare - na - eu);
    return { na, eu, apac };
}

export function getCompetitorSubscriptionPricing(competitor, model = null, relationOverride = null) {
    const performance = resolvePerformance(competitor, model);
    const relation = resolveRelation(competitor, relationOverride);
    const monthlyCost = Math.max(0, Math.round(performance * 500 * (1 - relation / 200)));
    const aggression = toNumber(competitor?.stats?.aggression, 0);
    const refusalChance = Math.min(0.5, Math.max(0, (aggression - 50) / 200));

    return {
        performance,
        relation,
        monthlyCost,
        refusalChance
    };
}

export function canSubscribeToCompetitorModel(competitor, model = null, relationOverride = null) {
    const resolvedModel = resolveCompetitorModel(competitor, model);
    const pricing = getCompetitorSubscriptionPricing(competitor, resolvedModel, relationOverride);
    const eligible = Boolean(resolvedModel)
        && pricing.performance > 0
        && pricing.relation > -30
        && Boolean(competitor?.currentModel || resolvedModel);

    return {
        eligible,
        reason: eligible ? null : (resolvedModel ? 'relation_too_low' : 'model_unavailable'),
        ...pricing
    };
}

export function createCompetitorInternalState(profile = {}) {
    const stats = profile.stats || {};
    const simulation = profile.simulation || {};
    const model = cloneModel(resolveCompetitorModel(profile), `${profile.name || 'Competitor'}-1`);
    const fundingSeed = Number.isFinite(Number(profile.initialFunds))
        ? Number(profile.initialFunds)
        : Number.isFinite(Number(simulation.funds))
            ? Number(simulation.funds)
            : Math.round((toNumber(stats.funding, 0) * 3_000_000) + (toNumber(profile.marketShare, 0) * 120_000));
    const talentSeed = simulation.talent || {};
    const gpuSeed = simulation.gpu || {};
    const dataSeed = simulation.data || {};
    const pipelineSeed = simulation.pipeline || {};
    const headcount = Number.isFinite(Number(talentSeed.headcount))
        ? Number(talentSeed.headcount)
        : Math.max(20, Math.round(60 + toNumber(stats.researchPower, 0) * 8 + toNumber(stats.aggression, 0) * 4 + toNumber(profile.marketShare, 0)));
    const talentQuality = Number.isFinite(Number(talentSeed.quality))
        ? Number(talentSeed.quality)
        : clamp(Math.round(45 + toNumber(stats.researchPower, 0) * 3 + toNumber(stats.safetyFocus, 0) * 2), 30, 95);
    const gpuOwned = Number.isFinite(Number(gpuSeed.owned))
        ? Number(gpuSeed.owned)
        : Math.max(20, Math.round(50 + toNumber(stats.researchPower, 0) * 12 + toNumber(stats.funding, 0) * 8));
    const gpuCloud = Number.isFinite(Number(gpuSeed.cloud))
        ? Number(gpuSeed.cloud)
        : Math.max(0, Math.round(toNumber(stats.funding, 0) * 3));
    const dataTB = Number.isFinite(Number(dataSeed.tb))
        ? Number(dataSeed.tb)
        : Math.max(10, Math.round(20 + toNumber(stats.researchPower, 0) * 2 + toNumber(profile.marketShare, 0)));
    const revenueMonthly = Number.isFinite(Number(simulation.revenueMonthly))
        ? Number(simulation.revenueMonthly)
        : Math.round(
            250_000
            + toNumber(profile.marketShare, 0) * 90_000
            + toNumber(stats.researchPower, 0) * 120_000
            + toNumber(stats.funding, 0) * 90_000
        );
    const payroll = Number.isFinite(Number(simulation.payrollMonthly))
        ? Number(simulation.payrollMonthly)
        : Math.round(headcount * (15_000 + talentQuality * 220));
    const compute = Number.isFinite(Number(simulation.computeMonthly))
        ? Number(simulation.computeMonthly)
        : Math.round((gpuOwned * 1_800 + gpuCloud * 2_400) * (1 + clamp(toNumber(simulation.risk?.supplyRisk, 0), 0, 100) / 250));
    const data = Number.isFinite(Number(simulation.dataMonthly))
        ? Number(simulation.dataMonthly)
        : Math.round(dataTB * 8_000 + clamp(toNumber(simulation.risk?.legalPressure, 0), 0, 100) * 800);
    const overhead = Number.isFinite(Number(simulation.overheadMonthly))
        ? Number(simulation.overheadMonthly)
        : Math.round(120_000 + toNumber(stats.safetyFocus, 0) * 8_000 + toNumber(stats.aggression, 0) * 5_000);
    const monthlyExpenses = payroll + compute + data + overhead;
    const runwayMonths = revenueMonthly >= monthlyExpenses
        ? Infinity
        : Math.max(1, Math.round(fundingSeed / Math.max(1, monthlyExpenses - revenueMonthly)));
    const currentMarketShare = Math.max(1, toNumber(profile.marketShare, 0));
    const modelPipeline = Array.isArray(pipelineSeed.modelPipeline) && pipelineSeed.modelPipeline.length > 0
        ? pipelineSeed.modelPipeline.map(entry => cloneModel(entry, model.name))
        : [{ ...model, stage: 'deployed' }];
    const relations = {
        player: 0,
        competitors: {},
        countries: {},
        ...(simulation.relations || {})
    };
    const doctrineType = profile?.doctrine?.type || 'balanced';
    const serviceTypes = resolveCompetitorServiceTypes({ deployedServices: resolveDeployedServices(profile) });
    const priceMult = Number.isFinite(Number(simulation.pricing?.priceMult))
        ? clampServicePriceMult(simulation.pricing.priceMult)
        : resolveCompetitorPriceMult(doctrineType, 0.5);
    const pricingSignals = buildCompetitorPricingSignals(serviceTypes, priceMult);

    return {
        finances: {
            funds: fundingSeed,
            revenue: {
                monthly: revenueMonthly,
                trailing: revenueMonthly
            },
            expenses: {
                monthly: monthlyExpenses,
                payroll,
                compute,
                data,
                overhead
            },
            runwayMonths,
            valuation: Number.isFinite(Number(simulation.valuation))
                ? Number(simulation.valuation)
                : Math.max(500_000, Math.round(fundingSeed * 3.5 + currentMarketShare * 250_000 + resolvePerformance(profile) * 450_000)),
            investorSupport: Number.isFinite(Number(simulation.investorSupport))
                ? Number(simulation.investorSupport)
                : clamp(Math.round(45 + currentMarketShare * 1.2 + Math.min(20, runwayMonths === Infinity ? 20 : runwayMonths) + toNumber(stats.funding, 0) * 2), 0, 100),
            burnRate: Math.max(0, monthlyExpenses - revenueMonthly)
        },
        talent: {
            headcount,
            quality: talentQuality,
            hiringPlan: Number.isFinite(Number(talentSeed.hiringPlan)) ? Number(talentSeed.hiringPlan) : Math.max(0, Math.round(toNumber(stats.funding, 0) + toNumber(stats.aggression, 0) * 2)),
            morale: Number.isFinite(Number(talentSeed.morale)) ? Number(talentSeed.morale) : clamp(Math.round(55 + toNumber(stats.safetyFocus, 0) * 2), 0, 100)
        },
        gpu: {
            owned: gpuOwned,
            cloud: gpuCloud,
            utilization: Number.isFinite(Number(gpuSeed.utilization)) ? Number(gpuSeed.utilization) : clamp(Math.round(55 + toNumber(stats.researchPower, 0) * 3 + toNumber(stats.funding, 0) * 2), 20, 98)
        },
        data: {
            tb: dataTB,
            quality: Number.isFinite(Number(dataSeed.quality)) ? Number(dataSeed.quality) : clamp(Math.round(50 + toNumber(stats.researchPower, 0) * 2 + toNumber(stats.safetyFocus, 0) * 2), 20, 100),
            acquisitionPlan: Number.isFinite(Number(dataSeed.acquisitionPlan)) ? Number(dataSeed.acquisitionPlan) : 0
        },
        pipeline: {
            researchQueue: resolveResearchQueue(profile, profile.name || 'Competitor'),
            modelPipeline,
            deployedServices: serviceTypes
        },
        pricing: {
            strategy: doctrineType,
            priceMult,
            serviceTypes,
            demandMult: pricingSignals.demandMult,
            competitiveness: pricingSignals.competitiveness,
            monthlyUsers: 0,
            monthlyRevenue: revenueMonthly
        },
        relations,
        risk: {
            safetyDebt: Number.isFinite(Number(simulation.risk?.safetyDebt)) ? Number(simulation.risk.safetyDebt) : Math.max(0, Math.round(15 - toNumber(stats.safetyFocus, 0) * 1.2)),
            prPressure: Number.isFinite(Number(simulation.risk?.prPressure)) ? Number(simulation.risk.prPressure) : Math.max(0, Math.round(10 - toNumber(stats.funding, 0) * 0.2 + toNumber(stats.aggression, 0))),
            legalPressure: Number.isFinite(Number(simulation.risk?.legalPressure)) ? Number(simulation.risk.legalPressure) : Math.max(0, Math.round(8 - toNumber(stats.safetyFocus, 0) * 0.3)),
            supplyRisk: Number.isFinite(Number(simulation.risk?.supplyRisk)) ? Number(simulation.risk.supplyRisk) : Math.max(0, Math.round(10 - toNumber(stats.funding, 0) * 0.1))
        },
        marketShareByRegion: resolveMarketShareByRegion(profile),
        lastUpdatedMonth: 0
    };
}

function attachCompetitorRelations(competitors) {
    const ids = competitors.map(comp => comp.id);
    for (const competitor of competitors) {
        competitor.internalState ||= createCompetitorInternalState(competitor);
        const relations = competitor.internalState.relations ||= { player: 0, competitors: {}, countries: {} };
        relations.player = clamp(toNumber(relations.player, 0), -100, 100);
        relations.competitors ||= {};
        relations.countries ||= {};
        for (const id of ids) {
            if (id === competitor.id) continue;
            if (!Number.isFinite(Number(relations.competitors[id]))) {
                relations.competitors[id] = 0;
            }
        }
    }
}

export class CompetitorSimulationSystem {
    constructor(gameState) {
        this.state = gameState;
        if (!Array.isArray(this.state.competitors) || this.state.competitors.length === 0) {
            this.initCompetitors();
        }
    }

    processHourly(hours = 1) {
        const tickCount = Math.max(1, Math.floor(toNumber(hours, 1)));
        for (let tick = 0; tick < tickCount; tick++) {
            for (const comp of this.state.competitors || []) {
                const internal = this._ensureInternalState(comp);
                this._processOperationalTick(comp, internal, 1);
                this._syncSummaryState(comp, internal);
            }
        }
    }

    processSixHourly(hours = 6) {
        const tickCount = Math.max(1, Math.floor(toNumber(hours, 6)));
        for (let tick = 0; tick < tickCount; tick += 6) {
            this.processHourly(Math.min(6, tickCount - tick));
            for (const comp of this.state.competitors || []) {
                const internal = this._ensureInternalState(comp);
                this._processStrategicTick(comp, internal);
                this._syncSummaryState(comp, internal);
            }
        }
    }

    initCompetitors() {
        this.state.competitors = COMPETITORS.map(sourceCompetitor => {
            const competitor = {
                ...sourceCompetitor,
                doctrine: getDoctrinePreset(sourceCompetitor),
                techProgress: {},
                modelsReleased: [],
                monthsSinceLastRelease: 0,
                safetyScore: 0,
                releaseCooldown: 0,
                relation: 0,
                cooperating: false,
                cooperationTech: null,
                cooperationMonths: 0
            };

            competitor.internalState = createCompetitorInternalState(competitor);
            competitor.internalState.pipeline.modelPipeline = competitor.internalState.pipeline.modelPipeline.map(entry => ({
                ...entry,
                stage: entry.stage || 'deployed'
            }));
            return competitor;
        });

        attachCompetitorRelations(this.state.competitors);
        return this.state.competitors;
    }

    processMonthly() {
        for (const comp of this.state.competitors || []) {
            const doctrine = comp.doctrine?.behavior || {};
            const internal = this._ensureInternalState(comp);
            const B = BALANCE.COMPETITOR;

            this._updateInternalEconomy(comp, internal, doctrine);
            this._updateResearch(comp, internal, doctrine);
            this._updateOperations(comp, internal, doctrine);

            comp.monthsSinceLastRelease++;
            const cooldown = Math.max(1, B.MODEL_RELEASE_COOLDOWN || 12);
            const releaseThreshold = Number(doctrine.releaseThreshold || 0.75) * 100;
            const releaseChance = comp.monthsSinceLastRelease < cooldown || comp.releaseCooldown > 0
                ? 0
                : ((comp.monthsSinceLastRelease - cooldown + 1) / 70) * comp.stats.aggression / 15;

            if (Math.random() < releaseChance && comp.aiLevel > Math.max(B.MODEL_RELEASE_THRESHOLD, releaseThreshold)) {
                this._releaseModel(comp, internal);
            }

            comp.releaseCooldown = Math.max(0, Number(comp.releaseCooldown || 0) - 1);
            comp.safetyScore = Math.max(0, Number(comp.safetyScore || 0) + Number(doctrine.safetyInvestment || 0.2) * 0.5);

            if (Math.random() < Number(doctrine.hiringAggression || 0.5) * 0.08) {
                this._attemptPoaching(comp);
            }

            const pricingBoost = Number(internal.pricing?.competitiveness || 1);
            const shareChange = (((Math.random() - 0.5) * 2 * Number(doctrine.expansionRate || 1)) * pricingBoost)
                + (doctrine.diplomacyStyle === 'dominant' ? 0.3 : 0)
                - (doctrine.diplomacyStyle === 'cooperative' ? 0.1 : 0)
                + (internal.finances.runwayMonths === Infinity ? 0.15 : clamp(internal.finances.runwayMonths / 120, 0, 0.15));
            comp.marketShare = clamp(Number(comp.marketShare || 0) + shareChange, 1, 40);
            internal.marketShareByRegion = this._rebalanceRegionalShares(internal.marketShareByRegion, comp.marketShare);

            const relationDrift = doctrine.diplomacyStyle === 'competitive' || doctrine.diplomacyStyle === 'territorial' ? 0.8 : 0.4;
            if (comp.relation > 0) comp.relation = Math.max(0, comp.relation - relationDrift);
            else if (comp.relation < 0) comp.relation = Math.min(0, comp.relation + relationDrift * 0.6);

            if (comp.cooperating && comp.cooperationMonths > 0) {
                comp.cooperationMonths--;
                if (comp.cooperationMonths <= 0) {
                    comp.cooperating = false;
                    comp.cooperationTech = null;
                }
            }

            this._doctrineBasedDiplomacy(comp, doctrine);
            if (comp.policyPressure) {
                comp.policyPressure.total = Math.max(0, Number(comp.policyPressure.total || 0) * 0.72);
                comp.policyPressure.subsidy = Math.max(0, Number(comp.policyPressure.subsidy || 0) * 0.68);
                comp.policyPressure.exportControl = Math.max(0, Number(comp.policyPressure.exportControl || 0) * 0.74);
                comp.policyPressure.regulation = Math.max(0, Number(comp.policyPressure.regulation || 0) * 0.76);
                comp.policyPressure.diplomacy = Math.max(0, Number(comp.policyPressure.diplomacy || 0) * 0.7);
            }
            if (comp.statePressure) {
                comp.statePressure.total = Math.max(0, Number(comp.statePressure.total || 0) * 0.75);
            }
            this._syncSummaryState(comp, internal);
            internal.lastUpdatedMonth += 1;
        }

        this._normalizeMarketShares();
    }

    _processOperationalTick(comp, internal, hours = 1) {
        const hourScale = Math.max(1, toNumber(hours, 1));
        const pressureFromAggression = Number(comp.stats?.aggression || 0) * 0.01 * hourScale;
        const pressureFromSafetyDebt = Number(internal.risk.safetyDebt || 0) * 0.004 * hourScale;
        const supplyFromCloudMix = (internal.gpu.cloud > internal.gpu.owned ? 0.03 : 0.01) * hourScale;
        const prFromMarketShare = Number(comp.marketShare || 0) * 0.002 * hourScale;
        const policyPressure = Number(comp.policyPressure?.total || 0) * 0.012 * hourScale;
        const statePressure = Number(comp.statePressure?.total || 0) * 0.01 * hourScale;

        internal.risk.prPressure = clamp(
            Number(internal.risk.prPressure || 0) + pressureFromAggression + prFromMarketShare + policyPressure,
            0,
            100
        );
        internal.risk.supplyRisk = clamp(
            Number(internal.risk.supplyRisk || 0) + supplyFromCloudMix + pressureFromSafetyDebt + statePressure,
            0,
            100
        );
        internal.finances.burnRate = Math.max(0, Number(internal.finances.burnRate || 0) + (internal.risk.supplyRisk * 0.05) - (internal.risk.prPressure * 0.02));
        internal.finances.runwayMonths = internal.finances.burnRate > 0
            ? Math.max(1, Math.round(internal.finances.funds / Math.max(1, internal.finances.burnRate * 1.5)))
            : Infinity;
        internal.talent.morale = clamp(
            Number(internal.talent.morale || 0)
                - (internal.risk.prPressure * 0.01)
                - (policyPressure * 0.08)
                + (internal.risk.safetyDebt > 10 ? -0.05 : 0.05),
            0,
            100
        );
    }

    _processStrategicTick(comp, internal) {
        internal.data.acquisitionPlan = clamp(Number(internal.data.acquisitionPlan || 0) + 1, 0, 100);
        internal.talent.hiringPlan = clamp(Number(internal.talent.hiringPlan || 0) + (comp.doctrine?.behavior?.hiringAggression || 0.5), 0, 100);
        internal.risk.legalPressure = clamp(Number(internal.risk.legalPressure || 0) + (internal.risk.prPressure > 20 ? 0.2 : 0.05), 0, 100);
    }

    _ensureInternalState(comp) {
        if (!comp.internalState) {
            comp.internalState = createCompetitorInternalState(comp);
        }
        comp.internalState.finances ||= {};
        comp.internalState.finances.revenue ||= { monthly: 0, trailing: 0 };
        comp.internalState.finances.expenses ||= { monthly: 0, payroll: 0, compute: 0, data: 0, overhead: 0 };
        comp.internalState.talent ||= { headcount: 0, quality: 0, hiringPlan: 0, morale: 0 };
        comp.internalState.gpu ||= { owned: 0, cloud: 0, utilization: 0 };
        comp.internalState.data ||= { tb: 0, quality: 0, acquisitionPlan: 0 };
        comp.internalState.pipeline ||= { researchQueue: [], modelPipeline: [], deployedServices: [] };
        comp.internalState.pipeline.deployedServices = resolveCompetitorServiceTypes(comp.internalState.pipeline);
        comp.internalState.pricing ||= {
            strategy: comp.doctrine?.type || 'balanced',
            priceMult: Number.isFinite(Number(comp.priceMult)) ? clampServicePriceMult(comp.priceMult) : 1,
            serviceTypes: comp.internalState.pipeline.deployedServices,
            demandMult: 1,
            competitiveness: 1,
            monthlyUsers: 0,
            monthlyRevenue: 0
        };
        const pricingSignals = buildCompetitorPricingSignals(
            comp.internalState.pipeline.deployedServices,
            comp.internalState.pricing.priceMult
        );
        comp.internalState.pricing.serviceTypes = comp.internalState.pipeline.deployedServices;
        comp.internalState.pricing.demandMult = pricingSignals.demandMult;
        comp.internalState.pricing.competitiveness = pricingSignals.competitiveness;
        comp.internalState.relations ||= { player: 0, competitors: {}, countries: {} };
        comp.internalState.risk ||= { safetyDebt: 0, prPressure: 0, legalPressure: 0, supplyRisk: 0 };
        comp.internalState.marketShareByRegion ||= {};
        return comp.internalState;
    }

    _updateInternalEconomy(comp, internal, doctrine) {
        const currentModel = resolveCompetitorModel(comp);
        const modelPerformance = Math.max(0, resolvePerformance(comp, currentModel));
        const marketShare = Math.max(0, Number(comp.marketShare || 0));
        const doctrineType = comp.doctrine?.type || 'balanced';
        const serviceTypes = resolveCompetitorServiceTypes(internal.pipeline);
        internal.pipeline.deployedServices = serviceTypes;
        const previousPrice = Number(internal.pricing?.priceMult || comp.priceMult || 1);
        const targetPrice = resolveCompetitorPriceMult(doctrineType, Math.random());
        const priceMult = clampServicePriceMult((previousPrice * 0.55) + (targetPrice * 0.45));
        const pricingSignals = buildCompetitorPricingSignals(serviceTypes, priceMult);
        const demandMult = pricingSignals.demandMult;
        const baseUsers = Math.max(
            1,
            (
                6_000
                + (marketShare * 700)
                + (modelPerformance * 90)
                + (internal.talent.headcount * 25)
            ) * (1 + Math.max(0, serviceTypes.length - 1) * 0.16)
        );
        const monthlyUsers = Math.round(baseUsers * demandMult);
        const pricingArpu = 12 + (priceMult * 8) + (modelPerformance * 0.85);
        const revenue = Math.round(monthlyUsers * pricingArpu);
        const pricingCompetitiveness = pricingSignals.competitiveness;

        const payroll = Math.round(internal.talent.headcount * (15_000 + internal.talent.quality * 220));
        const computeTrafficCost = Math.round(monthlyUsers * Math.max(4, modelPerformance * 0.06));
        const compute = Math.round(
            ((internal.gpu.owned * 1_800 + internal.gpu.cloud * 2_400) * (1 + internal.risk.supplyRisk / 250))
            + computeTrafficCost
        );
        const data = Math.round(internal.data.tb * 8_000 + internal.risk.legalPressure * 800);
        const overhead = Math.round(120_000 + Number(comp.stats?.safetyFocus || 0) * 8_000 + Number(comp.stats?.aggression || 0) * 5_000);
        const expenses = payroll + compute + data + overhead;

        internal.pricing.strategy = doctrineType;
        internal.pricing.serviceTypes = serviceTypes;
        internal.pricing.priceMult = priceMult;
        internal.pricing.demandMult = demandMult;
        internal.pricing.competitiveness = pricingCompetitiveness;
        internal.pricing.monthlyUsers = monthlyUsers;
        internal.pricing.monthlyRevenue = revenue;
        comp.priceMult = priceMult;
        comp.monthlyUsers = monthlyUsers;

        internal.finances.revenue.monthly = revenue;
        internal.finances.revenue.trailing = Math.round((internal.finances.revenue.trailing * 0.75) + (revenue * 0.25));
        internal.finances.expenses.monthly = expenses;
        internal.finances.expenses.payroll = payroll;
        internal.finances.expenses.compute = compute;
        internal.finances.expenses.data = data;
        internal.finances.expenses.overhead = overhead;
        internal.finances.funds = Math.max(0, Math.round(internal.finances.funds + revenue - expenses));
        internal.finances.burnRate = Math.max(0, expenses - revenue);
        internal.finances.runwayMonths = revenue >= expenses
            ? Infinity
            : Math.max(1, Math.round(internal.finances.funds / Math.max(1, expenses - revenue)));
        internal.finances.valuation = Math.max(
            500_000,
            Math.round(internal.finances.funds * 3.5 + modelPerformance * 450_000 + marketShare * 250_000)
        );
        internal.finances.investorSupport = clamp(
            Math.round(45 + marketShare * 1.2 + Math.min(20, internal.finances.runwayMonths === Infinity ? 20 : internal.finances.runwayMonths) + Number(comp.stats?.funding || 0) * 2 - internal.risk.prPressure),
            0,
            100
        );

        internal.risk.safetyDebt = clamp(
            Math.round(internal.risk.safetyDebt + (Number(comp.stats?.aggression || 0) > Number(comp.stats?.safetyFocus || 0) ? 1 : 0) - (Number(doctrine.safetyInvestment || 0.2) * 0.5)),
            0,
            100
        );
        internal.risk.prPressure = clamp(
            Math.round(internal.risk.prPressure + (marketShare > 20 ? 0.5 : 0) + (Number(comp.stats?.aggression || 0) > 7 ? 0.2 : 0) - (Number(doctrine.prSensitivity || 0.5) * 0.3)),
            0,
            100
        );
        internal.risk.legalPressure = clamp(
            Math.round(internal.risk.legalPressure + (revenue > expenses ? 0.1 : 0.3) - (Number(doctrine.safetyInvestment || 0.2) * 0.2)),
            0,
            100
        );
        internal.risk.supplyRisk = clamp(
            Math.round(internal.risk.supplyRisk + (internal.gpu.cloud > internal.gpu.owned ? 0.2 : -0.1)),
            0,
            100
        );

        internal.marketShareByRegion = this._rebalanceRegionalShares(internal.marketShareByRegion, marketShare);
    }

    _updateResearch(comp, internal, doctrine) {
        const B = BALANCE.COMPETITOR;
        const researchGain = Number(comp.stats?.researchPower || 0) * (B.RESEARCH_VARIANCE_MIN + Math.random() * B.RESEARCH_VARIANCE_RANGE);
        const talentBoost = clamp(0.94 + ((internal.talent.quality - 50) / 450), 0.88, 1.1);
        const runwayBoost = internal.finances.runwayMonths === Infinity
            ? 1.05
            : clamp(0.92 + internal.finances.runwayMonths / 100, 0.92, 1.06);
        const dataBoost = clamp(0.97 + internal.data.quality / 900, 0.96, 1.06);
        const computeBoost = clamp(0.97 + (internal.gpu.owned + internal.gpu.cloud) / 4500, 0.96, 1.05);
        const investorBoost = clamp(0.9 + (Number(internal.finances.investorSupport || 50) / 250), 0.88, 1.12);
        const externalPressurePenalty = clamp(1 - ((Number(comp.policyPressure?.total || 0) + Number(comp.statePressure?.total || 0)) / 300), 0.7, 1);

        comp.aiLevel += (researchGain * B.AI_GROWTH_RATE * Number(doctrine.expansionRate || 1) * talentBoost * runwayBoost * dataBoost * computeBoost * investorBoost * externalPressurePenalty)
            / (1 + Number(comp.aiLevel || 0) * B.AI_GROWTH_DIMINISH);
    }

    _updateOperations(comp, internal, doctrine) {
        if (internal.finances.runwayMonths === Infinity || internal.finances.runwayMonths > 12) {
            internal.talent.hiringPlan = Math.min(40, Number(internal.talent.hiringPlan || 0) + Math.max(1, Math.round(Number(doctrine.hiringAggression || 0.5) * 2)));
            if (Math.random() < Number(doctrine.hiringAggression || 0.5) * 0.15) {
                internal.talent.headcount += 1;
            }
        } else if (internal.finances.runwayMonths < 4) {
            internal.talent.headcount = Math.max(10, internal.talent.headcount - 1);
        }

        internal.talent.morale = clamp(
            Math.round(internal.talent.morale + (internal.finances.runwayMonths > 6 ? 1 : -1) - internal.risk.prPressure * 0.05),
            0,
            100
        );
        internal.gpu.utilization = clamp(
            Math.round(50 + Number(comp.aiLevel || 0) * 0.4 + Number(comp.marketShare || 0) * 0.5 - internal.risk.supplyRisk * 1.5),
            20,
            98
        );
        internal.data.tb = Math.max(1, Math.round(internal.data.tb + Math.max(0, Number(comp.marketShare || 0) * 0.02 + Number(comp.stats?.researchPower || 0) * 0.1 - internal.risk.legalPressure * 0.03)));
        internal.data.quality = clamp(
            Math.round(internal.data.quality + (Number(doctrine.safetyInvestment || 0.2) * 0.4) - (internal.risk.legalPressure * 0.02)),
            20,
            100
        );
    }

    _releaseModel(comp, internal) {
        const version = comp.modelsReleased.length + 2;
        const baseModel = resolveCompetitorModel(comp);
        const baseName = (baseModel?.name || comp.name || 'Model').split('-')[0];
        const B = BALANCE.COMPETITOR;
        const financeBoost = internal.finances.runwayMonths === Infinity
            ? 1.05
            : clamp(0.94 + internal.finances.runwayMonths / 100, 0.94, 1.05);
        const talentBoost = clamp(0.96 + (internal.talent.quality - 50) / 800, 0.92, 1.06);
        const performance = Math.min(
            B.PERFORMANCE_CAP,
            ((Number(comp.aiLevel || 0) * 1.02 * financeBoost) + (internal.talent.quality * 0.055) + (internal.gpu.utilization * 0.025) + Math.random() * 3.5) * talentBoost
        );

        comp.currentModel = {
            name: `${baseName}-${version}`,
            performance: Math.round(performance)
        };
        comp.modelsReleased.push({ ...comp.currentModel, date: { ...window.game?.time?.currentDate } });
        internal.pipeline.modelPipeline.push({ ...comp.currentModel, stage: 'released', releasedAt: { ...window.game?.time?.currentDate } });
        internal.pipeline.researchQueue.shift();
        internal.pipeline.researchQueue.push(`${comp.name} frontier ${version}`);
        comp.monthsSinceLastRelease = 0;
        comp.releaseCooldown = Math.max(8, Math.round((B.MODEL_RELEASE_COOLDOWN || 12) * 0.75));
        comp.marketShare = Math.min(40, Number(comp.marketShare || 0) + 3);
        internal.marketShareByRegion = this._rebalanceRegionalShares(internal.marketShareByRegion, comp.marketShare);

        this.state.addNews(
            t('company.competitor_model_release', '{company}이(가) \'{model}\' 발표! (성능: {score}점)', {
                company: comp.name,
                model: comp.currentModel.name,
                score: comp.currentModel.performance
            }),
            'warning'
        );

        if (window.game?.time) {
            window.game.time.requestAutoPause();
        }

        if (comp.stats.aggression > B.SCANDAL_AGGRESSION_THRESHOLD && comp.stats.safetyFocus < B.SCANDAL_SAFETY_THRESHOLD && Math.random() < B.SCANDAL_CHANCE) {
            this.state.global.aiFavorability -= 3;
            this.state.addNews(
                t('company.competitor_safety_issue', '{company}의 {model}에서 안전 문제 발견!', {
                    company: comp.name,
                    model: comp.currentModel.name
                }),
                'danger'
            );
        }

        if (comp.currentModel.performance >= B.AGI_NEAR_THRESHOLD) {
            this.state.addNews(t('company.competitor_near_agi', '⚠️ {company}이(가) AGI에 근접하고 있습니다!', {
                company: comp.name
            }), 'danger');
        }
        if (comp.currentModel.performance >= B.AGI_THRESHOLD) {
            this.state.gameOver = true;
            this.state.gameResult = 'competitor_agi';
            this.state.addNews(t('company.competitor_agi', '{company}이(가) AGI를 달성했습니다. 게임 오버.', {
                company: comp.name
            }), 'danger');
        }
    }

    _attemptPoaching(comp) {
        const vulnerableTalent = this.state.talents
            .filter(talent => Number(talent.loyalty || 0) < 55)
            .sort((a, b) => Number(a.loyalty || 0) - Number(b.loyalty || 0))[0];
        if (!vulnerableTalent) return;

        vulnerableTalent.loyalty = Math.max(0, Number(vulnerableTalent.loyalty || 0) - 8);
        vulnerableTalent.morale = Math.max(0, Number(vulnerableTalent.morale || 0) - 5);
        this.state.addNews(
            t('company.competitor_poaching', '{company}이(가) {talent} 영입을 시도했습니다.', {
                company: comp.name,
                talent: vulnerableTalent.name
            }),
            'warning'
        );
    }

    _doctrineBasedDiplomacy(comp, doctrine) {
        const style = doctrine?.diplomacyStyle || 'neutral';
        if (style === 'competitive' && Math.random() < 0.08) {
            comp.relation = Math.max(-100, comp.relation - 2);
            comp.internalState.relations.player = Math.max(-100, Number(comp.internalState.relations.player || 0) - 1);
        } else if (style === 'cooperative' && Math.random() < 0.08) {
            comp.relation = Math.min(100, comp.relation + 2);
            comp.internalState.relations.player = Math.min(100, Number(comp.internalState.relations.player || 0) + 1);
        } else if (style === 'territorial' && Math.random() < 0.08) {
            this.state.global.geopoliticalTension = Math.min(100, (this.state.global.geopoliticalTension || 0) + 1);
            comp.internalState.risk.supplyRisk = clamp(Number(comp.internalState.risk.supplyRisk || 0) + 1, 0, 100);
        }
    }

    _syncSummaryState(comp, internal) {
        comp.currentModel ||= cloneModel(internal.pipeline.modelPipeline.at(-1), `${comp.name}-1`);
        const latestPipelineModel = internal.pipeline.modelPipeline.at(-1);
        if (latestPipelineModel) {
            comp.currentModel = {
                ...comp.currentModel,
                name: latestPipelineModel.name || comp.currentModel.name,
                performance: toNumber(latestPipelineModel.performance, comp.currentModel.performance || 0)
            };
        }
        comp.priceMult = Number.isFinite(Number(internal.pricing?.priceMult))
            ? Number(internal.pricing.priceMult)
            : Number(comp.priceMult || 1);
        comp.aiLevel = Math.max(0, Number(comp.aiLevel || 0));
    }

    _rebalanceRegionalShares(regionalShares, marketShare) {
        const base = regionalShares && typeof regionalShares === 'object' ? { ...regionalShares } : {};
        const total = Object.values(base).reduce((sum, value) => sum + Math.max(0, toNumber(value, 0)), 0);
        if (total <= 0) return base;
        const target = Math.max(1, Number(marketShare || 0));
        for (const [region, share] of Object.entries(base)) {
            base[region] = Math.max(1, Math.round((Math.max(0, toNumber(share, 0)) / total) * target));
        }
        return base;
    }

    _normalizeMarketShares() {
        const playerShare = this.state.reputation.marketShare;
        const totalCompShare = (this.state.competitors || []).reduce((s, c) => s + Number(c.marketShare || 0), 0);
        const total = totalCompShare + playerShare;

        if (total > 0) {
            for (const comp of this.state.competitors) {
                comp.marketShare = (comp.marketShare / total) * (100 - playerShare);
            }
        }
    }
}

export { DEFAULT_DOCTRINE, resolveCompetitorModel, resolveRelation, resolvePerformance };
