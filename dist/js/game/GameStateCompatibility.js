import { syncStateEconomyCompatibility } from './ComputeSystem.js';
import { syncStateChipProgramCompatibility } from './ChipProgramSystem.js';
import { normalizeDataStateCompatibility } from './DataSystem.js';
import { normalizeStateActorState } from './StateActorSystem.js';
import { clampServicePriceMult, resolveCompetitorPriceMult } from './ServicePricing.js';

function normalizeSerializedTimePayload(time) {
    if (!time || typeof time !== 'object') return;

    if (time.currentDate && typeof time.currentDate === 'object') {
        if (!Number.isFinite(Number(time.currentDate.hour))) {
            time.currentDate.hour = 0;
        }
        return;
    }

    if ('year' in time || 'month' in time || 'day' in time || 'hour' in time) {
        if (!Number.isFinite(Number(time.hour))) {
            time.hour = 0;
        }
    }
}

function normalizeCompetitorRuntimeState(competitor = {}, currentYear = 2017) {
    const stats = competitor.stats || {};
    const baseResearchPower = Number(stats.researchPower || 4) || 4;
    const baseFunding = Number(stats.funding || 5) || 5;
    const headcount = Math.max(6, Number(competitor.talentHeadcount || Math.round(baseResearchPower * 3)));
    const monthlyRevenue = Math.max(80_000, Number(competitor.revenue || competitor.monthlyRevenue || (baseFunding * 120_000)));
    const monthlyExpenses = Math.max(60_000, Number(competitor.expenses || competitor.monthlyExpenses || (headcount * 14_000)));
    const funds = Math.max(250_000, Number(competitor.funds || competitor.cash || (baseFunding * 1_500_000)));
    const runwayMonths = monthlyExpenses > 0 ? funds / Math.max(1, monthlyExpenses - monthlyRevenue + 20_000) : 24;
    const currentModel = competitor.currentModel && typeof competitor.currentModel === 'object'
        ? competitor.currentModel
        : { name: `${competitor.name || 'Competitor'}-1`, performance: Math.max(5, Number(competitor.aiLevel || 5)) };

    competitor.currentModel = currentModel;
    competitor.modelsReleased = Array.isArray(competitor.modelsReleased) ? competitor.modelsReleased : [];
    if (competitor.modelsReleased.length === 0) {
        competitor.modelsReleased = [{ ...currentModel, date: { year: currentYear, month: 1, day: 1, hour: 0 } }];
    }
    competitor.funds = funds;
    competitor.revenue = monthlyRevenue;
    competitor.expenses = monthlyExpenses;
    competitor.runwayMonths = Number.isFinite(runwayMonths) ? Math.max(1, Number(runwayMonths.toFixed(1))) : 24;
    competitor.valuation = Math.max(monthlyRevenue * 18, Number(competitor.valuation || monthlyRevenue * 24));
    competitor.investorSupport = Number(competitor.investorSupport || competitor.reputation || 50) || 50;
    competitor.talentHeadcount = headcount;
    competitor.talentQuality = Math.max(1, Number(competitor.talentQuality || baseResearchPower));
    competitor.hiringPlan ||= 'balanced';
    competitor.morale = Math.max(35, Number(competitor.morale || 65));
    competitor.gpuFleet = Array.isArray(competitor.gpuFleet) ? competitor.gpuFleet : [];
    competitor.cloudContracts = Array.isArray(competitor.cloudContracts) ? competitor.cloudContracts : [];
    competitor.dataAssets = competitor.dataAssets && typeof competitor.dataAssets === 'object'
        ? competitor.dataAssets
        : { proprietary: Math.max(2, Number(baseResearchPower * 2)), synthetic: 0, licensed: Math.max(1, Number(baseFunding)) };
    competitor.researchFocus ||= stats.specialty || competitor.doctrine?.behavior?.researchBias || 'algorithm';
    competitor.researchQueue = Array.isArray(competitor.researchQueue) ? competitor.researchQueue : [];
    competitor.modelPipeline = Array.isArray(competitor.modelPipeline) ? competitor.modelPipeline : [];
    competitor.deployedServices = Array.isArray(competitor.deployedServices) ? competitor.deployedServices : [];
    competitor.marketShareByRegion = competitor.marketShareByRegion && typeof competitor.marketShareByRegion === 'object'
        ? competitor.marketShareByRegion
        : {};
    const doctrineType = competitor.doctrine?.type || 'balanced';
    competitor.priceMult = clampServicePriceMult(
        Number.isFinite(Number(competitor.priceMult))
            ? Number(competitor.priceMult)
            : resolveCompetitorPriceMult(doctrineType, 0.5)
    );
    competitor.relations = competitor.relations && typeof competitor.relations === 'object'
        ? competitor.relations
        : {};
    competitor.relations.player = Number(competitor.relations.player ?? competitor.relation ?? 0) || 0;
    competitor.relations.competitors = competitor.relations.competitors && typeof competitor.relations.competitors === 'object'
        ? competitor.relations.competitors
        : {};
    competitor.relations.countries = competitor.relations.countries && typeof competitor.relations.countries === 'object'
        ? competitor.relations.countries
        : {};
    competitor.risk = competitor.risk && typeof competitor.risk === 'object'
        ? competitor.risk
        : {};
    competitor.risk.safetyDebt = Number(competitor.risk.safetyDebt || 0) || 0;
    competitor.risk.prPressure = Number(competitor.risk.prPressure || 0) || 0;
    competitor.risk.legalPressure = Number(competitor.risk.legalPressure || 0) || 0;
    competitor.risk.supplyRisk = Number(competitor.risk.supplyRisk || 0) || 0;
    competitor.operationClock = competitor.operationClock && typeof competitor.operationClock === 'object'
        ? competitor.operationClock
        : {};
    competitor.operationClock.hoursSinceStrategicReview = Number(competitor.operationClock.hoursSinceStrategicReview || 0) || 0;
    competitor.operationClock.hoursSinceLastRelease = Number(competitor.operationClock.hoursSinceLastRelease || 0) || 0;
    competitor.relation = competitor.relations.player;
    return competitor;
}

export function normalizeGameStateCompatibility(state, currentYear = 2017) {
    if (!state) return state;
    if (!state.eventChains || typeof state.eventChains !== 'object') {
        state.eventChains = {};
    }
    if (!state.campaign || typeof state.campaign !== 'object') {
        state.campaign = {
            currentAct: 'startup',
            actHistory: [],
            actTransitionCount: 0
        };
    } else {
        state.campaign.currentAct ||= 'startup';
        state.campaign.actHistory = Array.isArray(state.campaign.actHistory) ? state.campaign.actHistory : [];
        state.campaign.actTransitionCount = Number(state.campaign.actTransitionCount || 0);
    }
    if (!state.monthlyReport || typeof state.monthlyReport !== 'object') {
        state.monthlyReport = null;
    }
    state.geopolitics ||= {
        tensionIndex: 0,
        regionalMarket: {},
        policyHistory: [],
        activeControls: [],
        stateActors: {},
        blocs: {},
        supplyPressure: 0,
        diplomacyLog: []
    };
    state.geopolitics.stateActors = state.geopolitics.stateActors && typeof state.geopolitics.stateActors === 'object'
        ? state.geopolitics.stateActors
        : {};
    state.geopolitics.blocs = state.geopolitics.blocs && typeof state.geopolitics.blocs === 'object'
        ? state.geopolitics.blocs
        : {};
    state.geopolitics.policyHistory = Array.isArray(state.geopolitics.policyHistory) ? state.geopolitics.policyHistory : [];
    state.geopolitics.activeControls = Array.isArray(state.geopolitics.activeControls) ? state.geopolitics.activeControls : [];
    state.geopolitics.diplomacyLog = Array.isArray(state.geopolitics.diplomacyLog) ? state.geopolitics.diplomacyLog : [];
    state.geopolitics.supplyPressure = Number(state.geopolitics.supplyPressure || 0) || 0;
    state.stateActors ||= {
        countries: {},
        blocs: {},
        lastProcessedMonth: null
    };
    state.stateActors.countries = state.stateActors.countries && typeof state.stateActors.countries === 'object'
        ? state.stateActors.countries
        : {};
    state.stateActors.blocs = state.stateActors.blocs && typeof state.stateActors.blocs === 'object'
        ? state.stateActors.blocs
        : {};
    state.simulation ||= {
        baseStepHours: 6,
        processedHours: 0,
        lastHourlyTick: null,
        lastStepTick: null,
        lastDailyTick: null,
        lastMonthlyTick: null,
        lastQuarterlyTick: null
    };
    state.simulation.baseStepHours = Math.max(1, Number(state.simulation.baseStepHours || 6));
    state.simulation.processedHours = Math.max(0, Number(state.simulation.processedHours || 0));
    state.culture ||= {
        mission: 50,
        speed: 50,
        discipline: 50,
        safety: 50,
        academic: 50,
        secrecy: 50,
        accountability: 50
    };
    state.board ||= {
        confidence: 55,
        pressure: 0,
        seats: 1,
        members: [],
        nextMeetingMonth: 3,
        resolutions: []
    };
    state.board.members = Array.isArray(state.board.members) ? state.board.members : [];
    state.board.resolutions = Array.isArray(state.board.resolutions) ? state.board.resolutions : [];
    state.serviceOps ||= {
        reliability: 80,
        incidents: [],
        incidentHistory: [],
        activeIncidents: [],
        lastIncidentMonth: null
    };
    state.serviceOps.incidents = Array.isArray(state.serviceOps.incidents) ? state.serviceOps.incidents : [];
    state.serviceOps.incidentHistory = Array.isArray(state.serviceOps.incidentHistory) ? state.serviceOps.incidentHistory : [];
    state.serviceOps.activeIncidents = Array.isArray(state.serviceOps.activeIncidents) ? state.serviceOps.activeIncidents : [];
    state.safety ||= {
        score: 50,
        posture: 50,
        debt: 0,
        researchInvestment: 0,
        auditsCompleted: 0,
        activeAudit: null,
        certifications: [],
        incidentHistory: [],
        lastAuditResult: null,
        incidents: 0,
        boardConcern: 0
    };
    state.safety.score = Number(state.safety.score ?? state.safety.posture ?? 50) || 50;
    state.safety.posture = Number(state.safety.posture ?? state.safety.score ?? 50) || 50;
    state.safety.debt = Number(state.safety.debt || 0) || 0;
    state.safety.researchInvestment = Number(state.safety.researchInvestment || 0) || 0;
    state.safety.auditsCompleted = Number(state.safety.auditsCompleted || 0) || 0;
    state.safety.certifications = Array.isArray(state.safety.certifications) ? state.safety.certifications : [];
    state.safety.incidentHistory = Array.isArray(state.safety.incidentHistory) ? state.safety.incidentHistory : [];
    state.persistentEffects = Array.isArray(state.persistentEffects) ? state.persistentEffects : [];
    state.activeEffects = Array.isArray(state.activeEffects) ? state.activeEffects : [];
    if (state.persistentEffects.length === 0 && state.activeEffects.length > 0) {
        state.persistentEffects = state.activeEffects;
    }
    state.activeEffects = state.persistentEffects;
    state.devLog = Array.isArray(state.devLog) ? state.devLog : [];
    state.devMode = Boolean(state.devMode);
    state.randomSeed = Number.isFinite(Number(state.randomSeed)) ? Number(state.randomSeed) : currentYear * 1000 + 1;
    state.technologies ||= {};
    state.technologies.transformer ||= {
        id: 'transformer',
        progress: 0,
        completed: false,
        researching: false,
        assignedTalents: []
    };
    state.competitors = Array.isArray(state.competitors) ? state.competitors : [];
    state.competitors = state.competitors.map((competitor) => normalizeCompetitorRuntimeState(competitor, currentYear));
    normalizeStateActorState(state);
    for (const model of state.models || []) {
        if (!Array.isArray(model?.serviceChannels)) continue;
        for (const channel of model.serviceChannels) {
            channel.priceMult = clampServicePriceMult(channel.priceMult, channel.type);
            if (!channel?.active) continue;
            channel.ops = {
                sla: 95,
                latencyTier: 2,
                hallucinationRate: 0.05,
                moderationLoad: 20,
                enterpriseChurn: 0,
                infraSaturation: 30,
                ...(channel.ops || {})
            };
        }
    }
    syncStateEconomyCompatibility(state, currentYear);
    normalizeDataStateCompatibility(state);
    syncStateChipProgramCompatibility(state);
    return state;
}

export function normalizeSerializedGamePayload(payload) {
    if (!payload?.state) return payload;
    const currentYear = payload.time?.currentDate?.year || 2017;
    normalizeGameStateCompatibility(payload.state, currentYear);
    normalizeSerializedTimePayload(payload.time);
    return payload;
}
