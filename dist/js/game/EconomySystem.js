/**
 * Economy System — AI 스타트업 경제 엔진
 *
 * Investment rounds: Bootstrap → Seed → A → B → C → D → IPO
 * Revenue: API, B2B licensing, consumer products
 * Costs: Salaries, compute (own+cloud), data, overhead
 * Valuation: multi-factor (tech, revenue, team, market, hype)
 * Compute market: GPU price fluctuation, buy/rent
 */

// ─── Funding Round Definitions ───
export const FUNDING_ROUNDS = [
    {
        id: 'bootstrap', name: '부트스트랩', stage: 0,
        raiseRange: [0, 0], valuationRange: [0, 0], dilution: [0, 0],
        requirements: {}
    },
    {
        id: 'seed', name: '시드', stage: 1,
        raiseRange: [750_000, 3_500_000],
        valuationRange: [3_000_000, 15_000_000],
        dilution: [14, 24],
        requirements: { teamResearchPower: 8, investorTrust: 30 }
    },
    {
        id: 'series_a', name: '시리즈 A', stage: 2,
        raiseRange: [6_000_000, 22_000_000],
        valuationRange: [15_000_000, 100_000_000],
        dilution: [14, 22],
        requirements: { teamResearchPower: 16, investorTrust: 38, techCompleted: 3, monthlyRevenue: 3_000 }
    },
    {
        id: 'series_b', name: '시리즈 B', stage: 3,
        raiseRange: [20_000_000, 80_000_000],
        valuationRange: [80_000_000, 500_000_000],
        dilution: [12, 20],
        requirements: { teamResearchPower: 55, investorTrust: 50, techCompleted: 7, monthlyRevenue: 60_000 }
    },
    {
        id: 'series_c', name: '시리즈 C', stage: 4,
        raiseRange: [50_000_000, 300_000_000],
        valuationRange: [300_000_000, 3_000_000_000],
        dilution: [8, 15],
        requirements: { teamResearchPower: 120, investorTrust: 55, techCompleted: 11, monthlyRevenue: 300_000 }
    },
    {
        id: 'series_d', name: '시리즈 D+', stage: 5,
        raiseRange: [200_000_000, 2_000_000_000],
        valuationRange: [2_000_000_000, 20_000_000_000],
        dilution: [5, 12],
        requirements: { teamResearchPower: 300, investorTrust: 65, techCompleted: 18, monthlyRevenue: 2_500_000, deployedModels: 2 }
    },
    {
        id: 'ipo', name: 'IPO', stage: 6,
        raiseRange: [1_000_000_000, 15_000_000_000],
        valuationRange: [10_000_000_000, 150_000_000_000],
        dilution: [10, 20],
        requirements: { teamResearchPower: 650, investorTrust: 75, techCompleted: 28, monthlyRevenue: 12_000_000, deployedModels: 3, marketShare: 4 }
    }
];

import { t } from '../i18n.js';
import { BALANCE } from '../data/balance.js';
import { DATA_TYPES } from '../data/models.js';
import { addBoardMemberOnFunding } from './BoardSystem.js';
import {
    getBestAvailableGpu,
    getBestDeployedModel,
    getFleetStats,
    getGpuById,
    getRelativePerformance,
    getServiceChannelFitScore,
    getServiceRevenueMultiplier,
    getTeamResearchPower,
    normalizeCustomSiliconBonuses,
    normalizeGpuFleet,
    syncStateEconomyCompatibility
} from './ComputeSystem.js';
import { startDataAcquisition } from './DataSystem.js';
import { getInternalAIBonus } from './InternalAISystem.js';
import {
    clampServicePriceMult,
    getServiceDemandMultiplier,
    isFreeServiceChannel
} from './ServicePricing.js';

function _safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number(value) || 0));
}

function _getCountryModifiers(state) {
    return state?.player?.countryModifiers || state?.player?.countryBonuses || {};
}

function _bonusMultiplier(value, strength = 0.75) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 1;
    if (numeric === 1) return 1;
    return 1 + ((numeric - 1) * strength);
}

function _reductionMultiplier(value, strength = 0.75) {
    return 1 / Math.max(1, _bonusMultiplier(value, strength));
}

const SERVICE_CHANNEL_REVENUE_MULTIPLIERS = {
    api: 1.0,
    consumer_chat: 1.8,
    enterprise: 2.5,
    government: 3.5,
    open_source: 0,
    internal: 0,
    b2b_license: 1.5
};

const SERVICE_CHANNEL_USER_BASE = {
    api: 100,
    consumer_chat: 5000,
    enterprise: 5,
    government: 1,
    open_source: 2000,
    internal: 1,
    b2b_license: 1
};

function _ensureServiceState(state) {
    state.service ||= {
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

    state.service.totalUsers = 0;
    state.service.totalApiUsers = 0;
    state.service.totalConsumerUsers = 0;
    state.service.totalEnterpriseClients = 0;
    state.service.totalGovernmentContracts = 0;
    state.service.totalOpenSourceUsers = 0;
    state.service.totalInternalUsers = 0;
    state.service.totalB2BClients = 0;
    state.service.totalAllocatedTFLOPS = 0;
    state.service.totalMonthlyRevenue = 0;
    state.service.satisfaction = 0;

    return state.service;
}

function _getServiceMonths(model) {
    return Math.max(0, Math.floor(_safeNumber(model?.serviceMonths ?? model?.monthsSinceDeployment ?? 0, 0)));
}

function _getServiceQuality(channel) {
    const required = Math.max(1, _safeNumber(channel?.requiredTFLOPS, 0));
    const allocated = Math.max(0, _safeNumber(channel?.allocatedTFLOPS, 0));
    return required > 0 ? allocated / required : 1;
}

function _getServiceQualityMultiplier(quality) {
    if (quality >= 0.8) return 1.0;
    if (quality >= 0.5) return 0.6;
    return 0.2;
}

function _getServiceSatisfactionWeight(quality) {
    if (quality >= 0.8) return 1;
    if (quality >= 0.5) return 0.5;
    return 0;
}

function _getServiceGrowthMultiplier(model) {
    return Math.min(3, 1 + _getServiceMonths(model) * 0.1);
}

function _getServiceTechState(state) {
    return state?.technologies || {};
}

function _defaultChannelOps(channelType = 'api') {
    const enterpriseLike = channelType === 'enterprise' || channelType === 'government' || channelType === 'b2b_license';
    return {
        sla: 95,
        latencyTier: enterpriseLike ? 3 : 2,
        hallucinationRate: 0.05,
        moderationLoad: channelType === 'consumer_chat' ? 30 : 20,
        enterpriseChurn: enterpriseLike ? 0.02 : 0,
        infraSaturation: 30
    };
}

function _initChannelOpsMetrics(channel) {
    channel.ops = {
        ..._defaultChannelOps(channel?.type),
        ...(channel?.ops || {})
    };
    return channel.ops;
}

function _updateChannelOpsMetrics(model, channel, state) {
    const ops = _initChannelOpsMetrics(channel);
    const quality = _getServiceQuality(channel);
    const teamSize = state.talents?.length || 0;
    const techState = _getServiceTechState(state);
    const safetyCap = Number(model?.capabilities?.safety || model?.safetyScore || 40);
    const required = Math.max(1, _safeNumber(channel?.requiredTFLOPS, 1));
    const allocated = Math.max(0, _safeNumber(channel?.allocatedTFLOPS, 0));
    const deficitRatio = Math.max(0, (required - allocated) / required);
    const modelScale = model?.parameterScale || model?.scale || 'medium';

    const latencyBase = { tiny: 1, small: 1, medium: 2, large: 3, xlarge: 4, custom: 2 }[modelScale] ?? 2;
    let latencyTier = latencyBase;
    if (techState.model_optimization?.completed) latencyTier -= 1;
    if (techState.serving_infrastructure?.completed) latencyTier -= 1;
    if (quality < 0.6) latencyTier += 1;
    ops.latencyTier = Math.max(1, Math.min(5, Math.round(latencyTier)));

    const slaDelta = (quality >= 0.9 ? 2 : quality >= 0.7 ? 0 : -4)
        + (teamSize >= 10 ? 1 : -1)
        - (deficitRatio > 0.8 ? 4 : deficitRatio > 0.5 ? 2 : 0);
    ops.sla = clamp(ops.sla + slaDelta, 0, 100);

    let hallucinationRate = Math.max(0.01, 0.28 - (safetyCap / 100) * 0.22);
    if (techState.safety_alignment?.completed) hallucinationRate *= 0.65;
    if (techState.content_moderation?.completed) hallucinationRate *= 0.85;
    ops.hallucinationRate = Math.min(1, Number(hallucinationRate.toFixed(3)));

    let moderationLoad = Math.min(100, Math.round((_safeNumber(channel?.estimatedUsers, 0) / 500) + (ops.hallucinationRate * 100 * 0.4)));
    if (techState.content_moderation?.completed) moderationLoad = Math.round(moderationLoad * 0.7);
    ops.moderationLoad = Math.max(0, moderationLoad);

    const enterpriseLike = channel?.type === 'enterprise' || channel?.type === 'government' || channel?.type === 'b2b_license';
    ops.enterpriseChurn = enterpriseLike
        ? Number((ops.sla >= 90 ? 0.01 : ops.sla >= 70 ? 0.05 : ops.sla >= 50 ? 0.12 : 0.25).toFixed(2))
        : 0;

    ops.infraSaturation = Math.max(0, Math.min(100, Math.round((deficitRatio * 100) + 30)));
    return ops;
}

function _inferServiceRequiredTFLOPS(model, channel, state) {
    const performance = Math.max(1, _safeNumber(model?.compositeScore ?? model?.performance ?? 0, 0));
    const base = {
        api: performance * 2.0,
        consumer_chat: performance * 1.5,
        enterprise: performance * 1.2,
        government: performance * 1.0,
        open_source: 0,
        internal: performance * 0.4,
        b2b_license: performance * 1.0
    };

    let required = base[channel?.type] ?? performance;
    const techState = _getServiceTechState(state);
    if (techState.model_optimization?.completed) required *= 0.8;
    if (techState.multi_tenant?.completed) required *= 0.7;
    if (techState.edge_deployment?.completed && (channel?.type === 'api' || channel?.type === 'consumer_chat')) required *= 0.7;
    if (techState.serving_infrastructure?.completed) required *= 0.9;
    return Math.max(1, Math.round(required));
}

function _calculateServiceChannelRevenue(model, channel, state) {
    const currentYear = window.game?.time?.currentDate?.year || 2017;
    const performance = Math.max(1, _safeNumber(model?.compositeScore ?? model?.performance ?? 0, 0));
    const relativePerformance = getRelativePerformance(model, currentYear);
    const quality = _getServiceQuality(channel);
    const qualityMod = Math.min(1, quality);
    const fitScore = getServiceChannelFitScore(model, channel?.type || 'api');
    const fitMod = 0.9 + (fitScore * 0.25);
    const techState = _getServiceTechState(state);
    let techMult = 1;

    if (channel?.type === 'api' && techState.api_platform?.completed) techMult *= 1.2;
    if (channel?.type === 'consumer_chat' && techState.consumer_ux?.completed) techMult *= 1.25;
    if ((channel?.type === 'enterprise' || channel?.type === 'b2b_license') && techState.enterprise_integration?.completed) techMult *= 1.3;
    if (channel?.type === 'government' && techState.digital_gov?.completed) techMult *= 1.2;
    if (channel?.type === 'internal' && techState.serving_infrastructure?.completed) techMult *= 1.1;
    if (channel?.type === 'open_source' && techState.model_distillation?.completed) techMult *= 1.1;

    const basePerfRevenue = performance * 200;
    const channelMult = SERVICE_CHANNEL_REVENUE_MULTIPLIERS[channel?.type] ?? 1;
    const revenueMultiplier = getServiceRevenueMultiplier(relativePerformance);
    const priceMult = isFreeServiceChannel(channel?.type)
        ? 0
        : clampServicePriceMult(channel?.priceMult, channel?.type);
    const demandMult = getServiceDemandMultiplier(priceMult, channel?.type);
    return Math.round(basePerfRevenue * channelMult * qualityMod * fitMod * techMult * revenueMultiplier * demandMult * priceMult);
}

function _estimateServiceChannelUsers(model, channel, state, options = {}) {
    const performance = Math.max(1, _safeNumber(model?.compositeScore ?? model?.performance ?? 0, 0));
    const currentYear = window.game?.time?.currentDate?.year || 2017;
    const relativePerformance = getRelativePerformance(model, currentYear);
    const growthMod = _getServiceGrowthMultiplier(model);
    const quality = _getServiceQuality(channel);
    const qualityMod = quality >= 0.8 ? 1.0 : quality >= 0.5 ? 0.6 : 0.2;
    const fitScore = getServiceChannelFitScore(model, channel?.type || 'api');
    const fitMod = 0.9 + (fitScore * 0.25);
    const techState = _getServiceTechState(state);

    let baseUsers;
    switch (channel?.type) {
        case 'api':
            baseUsers = performance * SERVICE_CHANNEL_USER_BASE.api;
            break;
        case 'consumer_chat':
            baseUsers = performance * SERVICE_CHANNEL_USER_BASE.consumer_chat;
            break;
        case 'enterprise':
            baseUsers = performance * SERVICE_CHANNEL_USER_BASE.enterprise;
            break;
        case 'government':
            baseUsers = SERVICE_CHANNEL_USER_BASE.government;
            break;
        case 'open_source':
            baseUsers = performance * SERVICE_CHANNEL_USER_BASE.open_source;
            break;
        case 'internal':
            baseUsers = Math.max(1, state?.talents?.length || 0);
            if (techState.serving_infrastructure?.completed) baseUsers *= 1.1;
            break;
        case 'b2b_license':
            baseUsers = SERVICE_CHANNEL_USER_BASE.b2b_license;
            break;
        default:
            baseUsers = performance;
    }

    const relevanceMult = Math.max(0.1, Math.min(2.5, relativePerformance));
    const baseDemand = baseUsers * qualityMod * fitMod * growthMod * relevanceMult;
    const demandMult = options.ignorePrice
        ? 1
        : getServiceDemandMultiplier(channel?.priceMult, channel?.type);
    return Math.max(0, Math.round(baseDemand * demandMult));
}

// ─── GPU Market ───
const BASE_GPU_PRICE = BALANCE.ECONOMY.BASE_GPU_PRICE;
const GPU_CLOUD_MONTHLY = BALANCE.ECONOMY.GPU_CLOUD_MONTHLY;

export function getFundingRoundName(roundOrId) {
    const round = typeof roundOrId === 'string'
        ? FUNDING_ROUNDS.find(entry => entry.id === roundOrId)
        : roundOrId;
    if (!round) return '?';
    return t(`funding.${round.id}`, round.name);
}

export class EconomySystem {
    constructor(gameState) {
        this.state = gameState;

        // Initialize economy state if not present
        if (!this.state.economy) {
            this.state.economy = {
                fundingStage: 0,        // 현재 단계 (0=bootstrap)
                fundingHistory: [],     // 투자 이력
                totalRaised: 0,
                ownershipPct: 100,      // 창업자 지분(%)
                valuation: 500_000,     // 현재 기업가치
                lastValuation: 500_000,

                // GPU fleet
                ownedGPUs: 0,           // 보유 GPU
                cloudGPUs: 10,          // 클라우드 임대 GPU
                gpuFleet: normalizeGpuFleet({ ownedGPUs: 0, cloudGPUs: 10, currentYear: 2017 }),
                gpuMarketPrice: BASE_GPU_PRICE,
                gpuPriceHistory: [BASE_GPU_PRICE],

                // Revenue breakdown (monthly)
                revenue: {
                    api: 0,
                    b2b: 0,
                    consumer: 0,
                    licensing: 0
                },

                // Expense breakdown (monthly)
                expenses: {
                    salaries: 0,
                    cloudCompute: 0,
                    ownedGPUPower: 0,
                dataAcquisition: 0,
                overhead: 5000,     // 기본 오버헤드 (오피스, 법무 등)
                marketing: 0
                },

                // Metrics
                burnRate: 0,
                runway: Infinity,
                revenueGrowthRate: 0,

                // Data market
                dataAssets: { web_text: 3, books: 1, code: 1, scientific: 0, images: 0, audio: 0, video: 0 },
                totalDataTB: 5,
                dataCostPerTB: 10_000,  // 2017 기준 TB당
                pendingGpuOrders: [],
                colocation: { racks: 0, monthlyPerRack: 2000, capacityPerRack: 50 },

                // Fundraising state
                fundraisingActive: false,
                fundraisingProgress: 0, // 0-100
                fundraisingTarget: null,
                pendingTermSheets: null,
                termSheetDeadline: 0
            };
        }

        syncStateEconomyCompatibility(this.state);
    }

    // ─── Monthly Processing ───
    processMonthly() {
        syncStateEconomyCompatibility(this.state);
        this._processPendingGpuOrders();
        this._calculateRevenue();
        this._calculateExpenses();
        this._applyFinances();
        this._updateValuation();
        this._updateGPUMarket();
        this._updateSupplyShockTimers();
        this._updateMetrics();
        this._processTermSheetDeadline();
        this._processFundraising();
    }

    // ─── Revenue Calculation ───
    _calculateRevenue() {
        const eco = this.state.economy;
        const deployed = this.state.models.filter(m => m.deployed);
        const countryMods = _getCountryModifiers(this.state);
        const stableFundingMod = _bonusMultiplier(countryMods.stableFunding, 0.65);
        const previousIncome = this.state.resources.monthlyIncome || 0;
        const serviceState = _ensureServiceState(this.state);

        // Reset
        eco.revenue.api = 0;
        eco.revenue.b2b = 0;
        eco.revenue.consumer = 0;
        eco.revenue.licensing = 0;

        for (const model of deployed) {
            if (Array.isArray(model.serviceChannels) && model.serviceChannels.some(channel => channel?.active)) {
                let totalRevenue = 0;
                let totalAllocated = 0;
                let totalUsers = 0;
                let satisfiedUsers = 0;

                for (const channel of model.serviceChannels.filter(channel => channel?.active)) {
                    const requiredTFLOPS = Math.max(1, _safeNumber(channel.requiredTFLOPS, _inferServiceRequiredTFLOPS(model, channel, this.state)));
                    channel.requiredTFLOPS = requiredTFLOPS;
                    const allocatedTFLOPS = Math.max(0, _safeNumber(channel.allocatedTFLOPS, 0));
                    const quality = requiredTFLOPS > 0 ? allocatedTFLOPS / requiredTFLOPS : 1;
                    channel.priceMult = clampServicePriceMult(channel.priceMult, channel.type);
                    const channelRevenue = _calculateServiceChannelRevenue(model, channel, this.state);
                    const channelBaseUsers = _estimateServiceChannelUsers(model, channel, this.state, { ignorePrice: true });
                    const channelUsers = _estimateServiceChannelUsers(model, channel, this.state);
                    const ops = _updateChannelOpsMetrics(model, channel, this.state);

                    channel.allocatedTFLOPS = allocatedTFLOPS;
                    channel.monthlyRevenue = channelRevenue;
                    channel.baseEstimatedUsers = channelBaseUsers;
                    channel.estimatedUsers = channelUsers;
                    channel.ops = ops;

                    totalRevenue += channelRevenue;
                    totalAllocated += allocatedTFLOPS;
                    totalUsers += channelUsers;
                    const effectiveQuality = Math.min(1, Math.max(0, (quality * 0.55) + ((ops.sla / 100) * 0.45)));
                    satisfiedUsers += Math.round(channelUsers * _getServiceSatisfactionWeight(effectiveQuality));

                    if (channel.type === 'api') eco.revenue.api += channelRevenue;
                    else if (channel.type === 'consumer_chat') eco.revenue.consumer += channelRevenue;
                    else if (channel.type === 'enterprise' || channel.type === 'government' || channel.type === 'b2b_license') eco.revenue.b2b += channelRevenue;
                    else if (channel.type === 'open_source') eco.revenue.licensing += channelRevenue;
                }

                model.totalAllocatedTFLOPS = totalAllocated;
                model.totalMonthlyRevenue = totalRevenue;
                model.monthlyRevenue = totalRevenue;
                model._baseUserEstimate = model.serviceChannels
                    .filter(channel => channel?.active)
                    .reduce((sum, channel) => sum + Math.max(0, Number(channel.baseEstimatedUsers || channel.estimatedUsers || 0)), 0);
                model.serviceQuality = totalAllocated > 0
                    ? model.serviceChannels
                        .filter(channel => channel?.active)
                        .reduce((sum, channel) => sum + _getServiceQuality(channel) * Math.max(0, _safeNumber(channel.allocatedTFLOPS, 0)), 0) / totalAllocated
                    : 0;

                serviceState.totalUsers += totalUsers;
                serviceState.totalAllocatedTFLOPS += totalAllocated;
                serviceState.totalMonthlyRevenue += totalRevenue;

                const typeCount = {
                    api: 'totalApiUsers',
                    consumer_chat: 'totalConsumerUsers',
                    enterprise: 'totalEnterpriseClients',
                    government: 'totalGovernmentContracts',
                    open_source: 'totalOpenSourceUsers',
                    internal: 'totalInternalUsers',
                    b2b_license: 'totalB2BClients'
                };
                for (const channel of model.serviceChannels.filter(channel => channel?.active)) {
                    const key = typeCount[channel.type];
                    if (key) serviceState[key] += channel.estimatedUsers || 0;
                }

                serviceState.satisfaction += totalUsers > 0 ? (satisfiedUsers / totalUsers) * totalUsers : 0;
                continue;
            }

            // New model system: use pre-calculated monthlyRevenue from deployment strategy
            const revenue = Math.max(model.monthlyRevenue || 0, BALANCE.ECONOMY.MIN_DEPLOY_REVENUE);

            // Distribute revenue across categories based on deployment strategy
            if (model.deploymentStrategy === 'api') {
                eco.revenue.api += revenue;
            } else if (model.deploymentStrategy === 'consumer_chat') {
                eco.revenue.consumer += revenue;
            } else if (model.deploymentStrategy === 'enterprise' || model.deploymentStrategy === 'government') {
                eco.revenue.b2b += revenue;
            } else if (model.deploymentStrategy === 'open_source') {
                eco.revenue.licensing += revenue;
            } else {
                // Legacy fallback for old save games without deploymentStrategy
                const perf = model.performance || 0;
                const sizeMultiplier = { small: 1, medium: 2.5, large: 6, xlarge: 15 }[model.size] || 1;
                const marketBonus = 1 + (this.state.reputation.marketShare / 100);
                const base = perf * sizeMultiplier * marketBonus;
                eco.revenue.api += Math.round(base * 400);
                eco.revenue.b2b += Math.round(base * 250);
                eco.revenue.consumer += Math.round(base * 150);
                eco.revenue.licensing += Math.round(base * 100);
                model.monthlyRevenue = Math.round(base * 900);
            }
        }

        // Total monthly income
        let totalRevenue = eco.revenue.api + eco.revenue.b2b + eco.revenue.consumer + eco.revenue.licensing;

        // Stable funding cushions downside months without inflating strong months.
        if (previousIncome > 0 && totalRevenue < previousIncome) {
            const cushion = Math.min(0.35, (stableFundingMod - 1) * 0.7);
            totalRevenue = Math.round(totalRevenue + ((previousIncome - totalRevenue) * cushion));
        }

        this.state.resources.monthlyIncome = totalRevenue;

        if (serviceState.totalUsers > 0) {
            serviceState.satisfaction = Math.max(0, Math.min(1, serviceState.satisfaction / serviceState.totalUsers));
            if (serviceState.satisfaction >= 0.9) {
                this.state.reputation.investorTrust = Math.min(100, this.state.reputation.investorTrust + 1);
                this.state.reputation.publicImage = (this.state.reputation.publicImage || 0) + 0.5;
            } else if (serviceState.satisfaction >= 0.8) {
                this.state.reputation.marketShare = Math.min(100, this.state.reputation.marketShare + 0.2);
            } else if (serviceState.satisfaction < 0.5) {
                this.state.reputation.investorTrust = Math.max(0, this.state.reputation.investorTrust - 2);
                this.state.reputation.publicImage = (this.state.reputation.publicImage || 0) - 1;
                this.state.reputation.marketShare = Math.max(0, this.state.reputation.marketShare - 0.15);
            }
        }

        const allActiveChannels = deployed.flatMap(model => (model.serviceChannels || []).filter(channel => channel?.active));
        this.state.serviceOps ||= { reliability: 80, incidents: [], incidentHistory: [], activeIncidents: [], lastIncidentMonth: null };
        if (allActiveChannels.length > 0) {
            const avgSla = allActiveChannels.reduce((sum, channel) => sum + Number(channel.ops?.sla || 95), 0) / allActiveChannels.length;
            this.state.serviceOps.reliability = Math.round(avgSla);
        } else {
            this.state.serviceOps.reliability = 80;
        }
    }

    // ─── Expense Calculation ───
    _calculateExpenses() {
        const eco = this.state.economy;
        const countryMods = _getCountryModifiers(this.state);
        const businessAIBonus = getInternalAIBonus(this.state.internalAI, 'business_assist');

        // Salaries
        eco.expenses.salaries = this.state.talents.reduce((sum, t) => sum + t.salary, 0);

        // Computing costs (with player modifier)
        const mods = this.state.player?.modifiers || {};
        const completedChipPrograms = eco.completedChipPrograms || eco.chipPrograms || [];
        const customSiliconBonuses = normalizeCustomSiliconBonuses(eco.customSiliconBonuses || completedChipPrograms);
        const fleetStats = getFleetStats(eco.gpuFleet, {
            countryModifiers: countryMods,
            colocation: eco.colocation,
            completedChipPrograms,
            customSiliconBonuses
        });
        eco.expenses.cloudCompute = Math.round(fleetStats.monthlyCloudCost * (mods.cloudCostReduction || 1.0) * Math.max(1, Number(eco.cloudCostShockMult || 1)));

        const energyEfficiencyMult = _reductionMultiplier(countryMods.energyEfficiency, 0.8);
        eco.expenses.ownedGPUPower = Math.round(fleetStats.monthlyOwnedPowerCost * energyEfficiencyMult) + fleetStats.monthlyColocationCost;

        // Overhead: tax benefit softens the fixed cost; BPO expertise softens the team-scaled portion.
        const taxBenefitMult = _reductionMultiplier(countryMods.taxBenefit, 0.8);
        const bpoExpertiseMult = _reductionMultiplier(countryMods.bpoExpertise, 0.7);
        const fixedOverhead = BALANCE.ECONOMY.OVERHEAD_BASE * taxBenefitMult;
        const teamOverhead = this.state.talents.length * BALANCE.ECONOMY.OVERHEAD_PER_TALENT * bpoExpertiseMult;
        eco.expenses.overhead = Math.round((fixedOverhead + teamOverhead) * (mods.overheadReduction || 1.0) * (1 - (businessAIBonus * 0.3)));

        // Model inference costs (deployed models)
        eco.expenses.modelInference = this.state.models
            .filter(m => m.deployed)
            .reduce((sum, m) => {
                const baseInference = Math.max(0, Number(m.inferenceCost || 0));
                const activeChannels = Array.isArray(m.serviceChannels)
                    ? m.serviceChannels.filter(channel => channel?.active)
                    : [];
                if (baseInference <= 0 || activeChannels.length === 0) return sum + baseInference;

                const totalUsers = activeChannels.reduce((channelSum, channel) => channelSum + Math.max(0, Number(channel.estimatedUsers || 0)), 0);
                const baseUsers = Math.max(
                    1,
                    Number(m._baseUserEstimate || 0) || activeChannels.reduce((channelSum, channel) => (
                        channelSum + Math.max(0, Number(channel.baseEstimatedUsers || channel.estimatedUsers || 0))
                    ), 0)
                );
                const trafficMult = Math.max(0.3, totalUsers / baseUsers);
                return sum + Math.round(baseInference * trafficMult);
            }, 0);
        eco.expenses.modelInference = Math.round(eco.expenses.modelInference * customSiliconBonuses.inferenceCostMult);

        eco.expenses.internalAI = Math.max(0, Math.round(this.state.internalAI?.totalMonthlyCost || 0));

        // Datacenter maintenance costs
        eco.expenses.datacenterMaintenance = (eco.datacenters || [])
            .filter(dc => dc.operational)
            .reduce((sum, dc) => sum + dc.monthlyCost, 0);

        // Total
        const totalExpense = eco.expenses.salaries + eco.expenses.cloudCompute
            + eco.expenses.ownedGPUPower + eco.expenses.dataAcquisition
            + eco.expenses.overhead + eco.expenses.marketing
            + (eco.expenses.modelInference || 0)
            + (eco.expenses.internalAI || 0)
            + (eco.expenses.datacenterMaintenance || 0);

        this.state.resources.monthlyExpense = totalExpense;
    }

    // ─── Apply Monthly Finances ───
    _applyFinances() {
        const income = this.state.resources.monthlyIncome;
        const expense = this.state.resources.monthlyExpense;
        const balance = income - expense;

        this.state.resources.funds += balance;

        // Update computing total
        const eco = this.state.economy;
        syncStateEconomyCompatibility(this.state);

        if (this.state.resources.funds < 0) {
            this.state.resources.funds = 0;
            this.state.addNews(t('economy.cash_crisis', '⚠️ 자금이 바닥났습니다! 파산 위기!'), 'danger');
        }
    }

    // ─── Valuation Engine ───
    _updateValuation() {
        const eco = this.state.economy;
        const s = this.state;

        // Factor 1: Revenue multiple (AI companies get 20-80x)
        const monthlyRev = s.resources.monthlyIncome;
        const annualRevenue = monthlyRev * 12;
        const revenueMultiple = monthlyRev > 0 ? Math.min(80, 20 + s.reputation.marketShare) : 0;
        const revenueVal = annualRevenue * revenueMultiple;

        // Factor 2: Tech progress
        const completedTechs = Object.values(s.technologies).filter(t => t.completed).length;
        const techVal = completedTechs * 2_000_000;

        // Factor 3: Team value
        const teamQuality = s.talents.reduce((sum, t) =>
            sum + (t.stats.research + t.stats.creativity) * 500, 0);
        const teamVal = teamQuality + s.talents.length * 100_000;

        // Factor 4: Market position
        const marketVal = s.reputation.marketShare * 5_000_000;

        // Factor 5: AI hype cycle (2017-2025 AI hype multiplier)
        const yearsIn = (window.game?.time?.currentDate?.year || 2017) - 2017;
        const hypeMultiplier = 1 + Math.min(3, yearsIn * 0.3); // Grows over years

        // Factor 6: Model relevance to the current market
        const currentYear = window.game?.time?.currentDate?.year || 2017;
        const bestModelRelative = Math.max(0, ...(s.models || []).map(model => getRelativePerformance(model, currentYear)));
        const modelVal = Math.max(0, bestModelRelative - 0.25) * 20_000_000;

        // Combine
        const rawValuation = (revenueVal + techVal + teamVal + marketVal + modelVal) * hypeMultiplier;

        // Minimum based on assets (cash + equipment)
        const hardwareAssetValue = (eco.gpuFleet || []).reduce((sum, slot) => {
            if (slot.source === 'cloud') return sum;
            const gpu = getGpuById(slot.gpuId);
            return sum + Math.round((gpu?.price || eco.gpuMarketPrice) * slot.count * 0.7);
        }, 0);
        const floorVal = s.resources.funds + hardwareAssetValue;

        // Smooth transitions (don't jump too much month-to-month)
        const prevVal = eco.valuation;
        const targetVal = Math.max(floorVal, rawValuation, 100_000);
        eco.lastValuation = prevVal;
        eco.valuation = Math.round(prevVal * 0.7 + targetVal * 0.3);
    }

    // ─── GPU Market ───
    _updateGPUMarket() {
        const eco = this.state.economy;
        const currentYear = window.game?.time?.currentDate?.year || 2017;
        const yearsIn = currentYear - 2017;

        // Base trend: GPUs get more expensive as AI demand grows, then new supply
        let trend = 1.0;
        if (yearsIn < 3) trend = 1.0 + yearsIn * 0.05;    // 2017-2019: slow growth
        else if (yearsIn < 5) trend = 1.15 + (yearsIn - 3) * 0.15; // 2020-2021: demand spike
        else if (yearsIn < 7) trend = 1.45 + (yearsIn - 5) * 0.2;  // 2022-2023: chip shortage
        else trend = 1.85 - (yearsIn - 7) * 0.05; // 2024+: supply catches up

        // Random fluctuation
        const noise = 0.95 + Math.random() * 0.1;

        if (currentYear >= 2020 && currentYear <= 2023) trend *= 1.45;
        eco.gpuMarketPrice = Math.round(BASE_GPU_PRICE * trend * noise * Math.max(1, Number(eco.gpuMarketShockMult || 1)));
        eco.gpuPriceHistory.push(eco.gpuMarketPrice);
        if (eco.gpuPriceHistory.length > 60) eco.gpuPriceHistory.shift();
    }

    _updateSupplyShockTimers() {
        const eco = this.state.economy;
        if (eco.gpuSupplyShutdownMonths > 0) {
            eco.gpuSupplyShutdownMonths = Math.max(0, eco.gpuSupplyShutdownMonths - 1);
            if (eco.gpuSupplyShutdownMonths === 0) {
                eco.gpuMarketShockMult = 1;
                eco.cloudCostShockMult = 1;
            }
        }
    }

    _processPendingGpuOrders() {
        const eco = this.state.economy;
        if (!Array.isArray(eco.pendingGpuOrders) || eco.pendingGpuOrders.length === 0) return;

        const remaining = [];
        for (const order of eco.pendingGpuOrders) {
            order.monthsRemaining = Math.max(0, Number(order.monthsRemaining || 0) - 1);
            if (order.monthsRemaining > 0) {
                remaining.push(order);
                continue;
            }

            this._addFleetSlot({
                gpuId: order.gpuId,
                count: order.count,
                source: order.source || 'owned',
                location: order.location || (order.source === 'cloud' ? 'cloud' : 'warehouse'),
                provider: order.provider || null,
                termMonths: order.termMonths || 0,
                monthlyUnitCost: order.monthlyUnitCost || 0,
                rackId: order.rackId || null,
                datacenterId: order.datacenterId || null,
                datacenterLocationId: order.datacenterLocationId || null,
                datacenterPowerCostMult: order.datacenterPowerCostMult ?? null
            });

            const gpu = getGpuById(order.gpuId);
            this.state.addNews(t('economy.gpu_delivery', '{gpu} {count}대가 도착했습니다.', {
                gpu: gpu?.name || order.gpuId,
                count: order.count
            }), 'success');
        }

        eco.pendingGpuOrders = remaining;
        syncStateEconomyCompatibility(this.state);
    }

    // ─── Metrics ───
    _updateMetrics() {
        const eco = this.state.economy;
        const balance = this.state.resources.monthlyIncome - this.state.resources.monthlyExpense;

        eco.burnRate = balance < 0 ? Math.abs(balance) : 0;
        eco.runway = balance < 0
            ? Math.max(0, Math.floor(this.state.resources.funds / Math.abs(balance)))
            : Infinity;

        // Revenue growth (compare to previous)
        const currentRev = this.state.resources.monthlyIncome;
        if (this._lastMonthRevenue > 0) {
            eco.revenueGrowthRate = ((currentRev - this._lastMonthRevenue) / this._lastMonthRevenue) * 100;
        }
        this._lastMonthRevenue = currentRev;

        // Low runway warning
        if (eco.runway < 6 && eco.runway > 0 && eco.runway !== Infinity) {
            this.state.addNews(
                t('economy.runway_warning', '⚠️ 런웨이 {months}개월! 자금 조달이 필요합니다.', { months: eco.runway }),
                eco.runway < 3 ? 'danger' : 'warning'
            );
        }
    }

    // ─── Fundraising ───
    _processFundraising() {
        const eco = this.state.economy;
        if (!eco.fundraisingActive) return;

        // Progress: ~2-4 months to close a round
        const fundraiseMod = this.state.player?.modifiers?.fundraisingSpeed || 1.0;
        const countryMods = _getCountryModifiers(this.state);
        const vcFundingMult = _bonusMultiplier(countryMods.vcFunding, 0.8);
        const targetStage = eco.fundraisingTarget?.stage ?? this.getNextRound()?.stage ?? 0;
        const governmentFundingMult = targetStage <= 1 ? _bonusMultiplier(countryMods.governmentFunding, 0.75) : 1;
        const trustBonus = this.state.reputation.investorTrust / 100;
        const businessAIBonus = getInternalAIBonus(this.state.internalAI, 'business_assist');
        const progress = (15 + trustBonus * 20 + Math.random() * 10) * fundraiseMod * vcFundingMult * governmentFundingMult * (1 + businessAIBonus);
        eco.fundraisingProgress += progress;

        if (eco.fundraisingProgress >= 100) {
            this._closeFundingRound();
        }
    }

    // ─── Public Methods ───

    /**
     * Get the next available funding round
     */
    getNextRound() {
        const nextStage = this.state.economy.fundingStage + 1;
        return FUNDING_ROUNDS[nextStage] || null;
    }

    /**
     * Check if requirements for the next round are met
     */
    canRaise() {
        const round = this.getNextRound();
        if (!round) return { canRaise: false, reason: t('funding.no_more_rounds', 'IPO 이후 추가 라운드 없음') };
        if (this.state.economy.fundraisingActive) return { canRaise: false, reason: t('funding.in_progress_reason', '투자 유치 진행 중') };

        const req = round.requirements;
        const s = this.state;
        const missingReqs = [];

        if (req.teamResearchPower) {
            const totalPower = getTeamResearchPower(s.talents);
            if (totalPower < req.teamResearchPower) {
                missingReqs.push(t('funding.require.team_research_power', '팀 연구력 {required} 이상 (현재: {current})', {
                    required: req.teamResearchPower,
                    current: totalPower
                }));
            }
        } else if (req.talents && s.talents.length < req.talents) {
            missingReqs.push(t('funding.require.talents', '인력 {required}명 이상 (현재: {current})', { required: req.talents, current: s.talents.length }));
        }
        if (req.investorTrust && s.reputation.investorTrust < req.investorTrust)
            missingReqs.push(t('funding.require.investor_trust', '투자자 신뢰도 {required} 이상 (현재: {current})', { required: req.investorTrust, current: s.reputation.investorTrust }));
        if (req.techCompleted) {
            const completed = Object.values(s.technologies).filter(t => t.completed).length;
            if (completed < req.techCompleted)
                missingReqs.push(t('funding.require.tech_completed', '기술 {required}개 이상 완료 (현재: {current})', { required: req.techCompleted, current: completed }));
        }
        if (req.monthlyRevenue && s.resources.monthlyIncome < req.monthlyRevenue)
            missingReqs.push(t('funding.require.monthly_revenue', '월 매출 {required} 이상 (현재: {current})', {
                required: `$${req.monthlyRevenue.toLocaleString()}`,
                current: `$${s.resources.monthlyIncome.toLocaleString()}`
            }));
        if (req.deployedModels) {
            const deployed = s.models.filter(m => m.deployed).length;
            if (deployed < req.deployedModels)
                missingReqs.push(t('funding.require.deployed_models', '배포 모델 {required}개 이상 (현재: {current})', { required: req.deployedModels, current: deployed }));
        }
        if (req.marketShare && s.reputation.marketShare < req.marketShare)
            missingReqs.push(t('funding.require.market_share', '시장 점유율 {required}% 이상 (현재: {current}%)', { required: req.marketShare, current: s.reputation.marketShare.toFixed(1) }));

        return {
            canRaise: missingReqs.length === 0,
            round,
            missingReqs
        };
    }

    /**
     * Calculate estimated terms for the next round
     */
    getEstimatedTerms() {
        const round = this.getNextRound();
        if (!round) return null;

        const eco = this.state.economy;
        const valuation = eco.valuation;

        // Valuation determines where in the range we land
        const [minVal, maxVal] = round.valuationRange;
        const valFactor = Math.min(1, Math.max(0, (valuation - minVal) / (maxVal - minVal)));

        // Trust affects terms
        const trustFactor = this.state.reputation.investorTrust / 100;
        const currentYear = window.game?.time?.currentDate?.year || 2017;
        const bestModel = getBestDeployedModel(this.state, currentYear);
        const bestModelRelative = bestModel ? getRelativePerformance(bestModel, currentYear) : 0;
        const performanceFactor = bestModel
            ? Math.max(0, Math.min(1, (bestModelRelative - 0.5) / 1.0))
            : 0.3;

        // Combined factor
        const termQuality = (valFactor * 0.45 + trustFactor * 0.3 + performanceFactor * 0.25);

        // Higher quality = more money, less dilution
        const [minRaise, maxRaise] = round.raiseRange;
        const [minDilute, maxDilute] = round.dilution;

        const estimatedRaise = Math.round(minRaise + ((maxRaise - minRaise) * performanceFactor));
        const estimatedDilution = Math.round(maxDilute - (maxDilute - minDilute) * termQuality);
        const preMoneyVal = Math.round(estimatedRaise / (estimatedDilution / 100) - estimatedRaise);

        return {
            round,
            estimatedRaise,
            estimatedDilution,
            preMoneyValuation: preMoneyVal,
            postMoneyValuation: preMoneyVal + estimatedRaise,
            termQuality: Math.round(termQuality * 100),
            bestModelRelativePerformance: bestModelRelative,
            bestModelName: bestModel?.name || null,
            modelRaiseBonusPct: Math.round((performanceFactor - 0.3) * 100)
        };
    }

    generateTermSheets() {
        const check = this.canRaise();
        if (!check.canRaise || !check.round) return [];

        const baseTerms = this.getEstimatedTerms();
        if (!baseTerms) return [];

        const variants = [
            { id: 'friendly', raiseMult: 0.95, dilutionDelta: -1, trustDelta: 2 },
            { id: 'balanced', raiseMult: 1.0, dilutionDelta: 0, trustDelta: 0 },
            { id: 'aggressive', raiseMult: 1.08, dilutionDelta: 1, trustDelta: -2 }
        ];

        const sheets = variants.map(variant => {
            const dilution = Math.max(0, Math.min(50, Math.round(baseTerms.estimatedDilution + variant.dilutionDelta)));
            const raise = Math.max(0, Math.round(baseTerms.estimatedRaise * variant.raiseMult));
            const preMoneyValuation = dilution > 0 ? Math.round((raise / (dilution / 100)) - raise) : 0;
            return {
                id: `${check.round.id}_${variant.id}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                roundId: check.round.id,
                roundName: getFundingRoundName(check.round),
                stage: check.round.stage,
                amount: raise,
                dilution,
                valuation: preMoneyValuation + raise,
                preMoneyValuation,
                trustDelta: variant.trustDelta,
                expiresInMonths: 3
            };
        });

        this.state.economy.pendingTermSheets = sheets;
        this.state.economy.termSheetDeadline = 3;
        return sheets;
    }

    acceptTermSheet(termSheetId) {
        const eco = this.state.economy;
        const sheets = Array.isArray(eco.pendingTermSheets) ? eco.pendingTermSheets : [];
        const chosen = sheets.find(sheet => sheet.id === termSheetId);
        if (!chosen) {
            return { success: false, reason: 'term_sheet_not_found' };
        }

        this.state.resources.funds += chosen.amount;
        eco.ownershipPct = Math.round(eco.ownershipPct * (1 - chosen.dilution / 100) * 10) / 10;
        eco.totalRaised += chosen.amount;
        eco.fundingStage = Math.max(eco.fundingStage, chosen.stage);
        eco.valuation = chosen.valuation;
        eco.fundingHistory.push({
            round: chosen.roundId,
            amount: chosen.amount,
            dilution: chosen.dilution,
            valuation: chosen.valuation,
            ownership: eco.ownershipPct,
            date: { ...window.game?.time?.currentDate }
        });
        addBoardMemberOnFunding(this.state, chosen.roundId, { boardSeat: true });
        eco.pendingTermSheets = null;
        eco.termSheetDeadline = 0;
        eco.fundraisingActive = false;
        eco.fundraisingProgress = 0;
        eco.fundraisingTarget = null;
        this.state.reputation.investorTrust = Math.min(100, this.state.reputation.investorTrust + (chosen.trustDelta || 0) + 3);
        return { success: true, termSheet: chosen };
    }

    /**
     * Start fundraising process
     */
    startFundraising() {
        const check = this.canRaise();
        if (!check.canRaise) return false;

        const eco = this.state.economy;
        eco.fundraisingActive = true;
        eco.fundraisingProgress = 0;
        eco.fundraisingTarget = check.round;

        this.state.addNews(
            t('funding.started', '💼 {round} 투자 유치를 시작합니다...', { round: getFundingRoundName(check.round) }),
            'info'
        );
        return true;
    }

    /**
     * Close funding round (called when progress hits 100)
     */
    _closeFundingRound() {
        const eco = this.state.economy;
        const terms = this.getEstimatedTerms();
        if (!terms) return;

        const currentYear = window.game?.time?.currentDate?.year || 2017;
        const bestModel = getBestDeployedModel(this.state, currentYear);
        const dilution = terms.estimatedDilution;
        const [minRaise, maxRaise] = terms.round.raiseRange;
        const raised = bestModel
            ? (() => {
                const relPerf = getRelativePerformance(bestModel, currentYear);
                const perfFactor = Math.max(0, Math.min(1, (relPerf - 0.5) / 1.0));
                return Math.round(minRaise + ((maxRaise - minRaise) * perfFactor));
            })()
            : Math.round(minRaise + ((maxRaise - minRaise) * 0.3));
        const preMoneyValuation = dilution > 0
            ? Math.round((raised / (dilution / 100)) - raised)
            : 0;
        const postMoneyValuation = preMoneyValuation + raised;

        this.state.resources.funds += raised;
        eco.ownershipPct = Math.round(eco.ownershipPct * (1 - dilution / 100) * 10) / 10;
        eco.totalRaised += raised;
        eco.fundingStage++;
        eco.valuation = postMoneyValuation;

        eco.fundingHistory.push({
            round: getFundingRoundName(terms.round),
            amount: raised,
            dilution,
            valuation: postMoneyValuation,
            ownership: eco.ownershipPct,
            date: { ...window.game?.time?.currentDate }
        });
        addBoardMemberOnFunding(this.state, terms.round.id || terms.round, { boardSeat: true });

        eco.fundraisingActive = false;
        eco.fundraisingProgress = 0;
        eco.fundraisingTarget = null;

        this.state.reputation.investorTrust = Math.min(100, this.state.reputation.investorTrust + 5);

        const ceoText = t('news.ceo_prefix', 'CEO {name}', {
            name: this.state.player?.ceoName || t('company.default_ceo_name', 'Alex Kim')
        });
        this.state.addNews(
            t('funding.closed', '🎉 {ceo}가 {round} 투자 유치를 완료했습니다! {raised} (기업가치 {valuation}, 지분 {ownership}%)', {
                ceo: ceoText,
                round: getFundingRoundName(terms.round),
                raised: this._fmtMoney(raised),
                valuation: this._fmtMoney(postMoneyValuation),
                ownership: eco.ownershipPct
            }),
            'success'
        );
        window.game?.triggerSuccessImpact?.('major', {
            soundId: 'funding_secured',
            countryId: this.state.player?.country,
            pulseType: 'success'
        });

        if (window.game?.time) {
            window.game.time.requestAutoPause();
        }
    }

    /**
     * Cancel ongoing fundraising
     */
    cancelFundraising() {
        const eco = this.state.economy;
        if (!eco.fundraisingActive) return;
        eco.fundraisingActive = false;
        eco.fundraisingProgress = 0;
        eco.fundraisingTarget = null;
        this.state.reputation.investorTrust = Math.max(0, this.state.reputation.investorTrust - 5);
        this.state.addNews(t('funding.cancelled', '투자 유치를 중단했습니다. (투자자 신뢰도 -5)'), 'warning');
    }

    _processTermSheetDeadline() {
        const eco = this.state.economy;
        if (!Array.isArray(eco.pendingTermSheets) || eco.pendingTermSheets.length === 0) return;
        eco.termSheetDeadline = Math.max(0, Number(eco.termSheetDeadline || 0) - 1);
        if (eco.termSheetDeadline <= 0) {
            this.rejectAllTermSheets();
            this.state.addNews(t('funding.deadline_expired', '투자 협상 기한 만료 — 라운드 실패'), 'warning');
        }
    }

    generateTermSheets() {
        const check = this.canRaise();
        if (!check.canRaise) return [];
        const eco = this.state.economy;
        const baseTerms = this.getEstimatedTerms();
        if (!baseTerms) return [];

        const investorProfiles = [
            {
                id: 'aggressive_vc',
                label: { ko: '공격적 VC', en: 'Aggressive VC' },
                valuationMod: 1.15,
                equityDemand: 1.2,
                liquidationPref: 2,
                boardSeat: true,
                growthKpi: 'revenue_3x_yoy',
                restrictions: []
            },
            {
                id: 'strategic_investor',
                label: { ko: '전략 투자자', en: 'Strategic Investor' },
                valuationMod: 1.0,
                equityDemand: 1.0,
                liquidationPref: 1,
                boardSeat: true,
                growthKpi: 'market_share',
                restrictions: ['country_hq_lock']
            },
            {
                id: 'government_fund',
                label: { ko: '정부 펀드', en: 'Government Fund' },
                valuationMod: 0.95,
                equityDemand: 0.9,
                liquidationPref: 1,
                boardSeat: false,
                growthKpi: 'compliance',
                restrictions: ['data_localization']
            }
        ];

        const pool = [...investorProfiles].sort(() => Math.random() - 0.5).slice(0, 3);
        const roundId = check.round?.id || 'seed';
        const termSheets = pool.map((investor, index) => {
            const equityPct = Math.max(5, Number((baseTerms.estimatedDilution * investor.equityDemand).toFixed(1)));
            const preMoneyValuation = Math.round(baseTerms.preMoneyValuation * investor.valuationMod);
            const raiseAmount = Math.max(250_000, Math.round(preMoneyValuation * (equityPct / 100) / Math.max(0.1, 1 - (equityPct / 100))));
            return {
                id: `ts_${roundId}_${investor.id}_${index}`,
                investorProfile: investor.id,
                investorName: this._generateInvestorFirmName(investor),
                investorLabel: investor.label,
                preMoneyValuation,
                postMoneyValuation: preMoneyValuation + raiseAmount,
                raiseAmount,
                equityPct,
                liquidationPreference: investor.liquidationPref,
                boardSeat: investor.boardSeat,
                growthKpi: investor.growthKpi,
                countryRestrictions: investor.restrictions,
                round: roundId
            };
        });

        eco.pendingTermSheets = termSheets;
        eco.termSheetDeadline = 3;
        return termSheets;
    }

    acceptTermSheet(termSheetId) {
        const eco = this.state.economy;
        const sheet = (eco.pendingTermSheets || []).find(entry => entry.id === termSheetId);
        if (!sheet) return { success: false, reason: 'term_sheet_not_found' };

        this.state.resources.funds += sheet.raiseAmount;
        eco.ownershipPct = Math.round(eco.ownershipPct * (1 - (sheet.equityPct / 100)) * 10) / 10;
        eco.totalRaised += sheet.raiseAmount;
        eco.fundingStage += 1;
        eco.lastValuation = sheet.preMoneyValuation;
        eco.valuation = sheet.postMoneyValuation;
        eco.fundingHistory.push({
            round: sheet.round,
            amount: sheet.raiseAmount,
            dilution: sheet.equityPct,
            valuation: sheet.postMoneyValuation,
            ownership: eco.ownershipPct,
            investor: sheet.investorName,
            investorProfile: sheet.investorProfile,
            liquidationPref: sheet.liquidationPreference,
            boardSeat: sheet.boardSeat,
            growthKpi: sheet.growthKpi,
            restrictions: sheet.countryRestrictions,
            date: { ...window.game?.time?.currentDate }
        });

        if (sheet.boardSeat) {
            addBoardMemberOnFunding(this.state, sheet.round, sheet);
        }
        if (sheet.countryRestrictions?.includes('country_hq_lock')) {
            this.state.player.modifiers.hqLocked = true;
        }
        if (sheet.countryRestrictions?.includes('data_localization')) {
            this.state.player.modifiers.dataLocalization = true;
        }

        eco.pendingTermSheets = null;
        eco.termSheetDeadline = 0;
        eco.fundraisingActive = false;
        eco.fundraisingProgress = 0;
        eco.fundraisingTarget = null;
        this.state.reputation.investorTrust = Math.min(100, this.state.reputation.investorTrust + 5);
        return { success: true, sheet };
    }

    rejectAllTermSheets() {
        const eco = this.state.economy;
        eco.pendingTermSheets = null;
        eco.termSheetDeadline = 0;
        eco.fundraisingActive = false;
        eco.fundraisingProgress = 0;
        eco.fundraisingTarget = null;
        this.state.reputation.investorTrust = Math.max(0, this.state.reputation.investorTrust - 10);
        eco.fundingHistory.push({
            round: this.getNextRound()?.id || 'unknown',
            amount: 0,
            dilution: 0,
            valuation: eco.valuation,
            ownership: eco.ownershipPct,
            failed: true,
            date: { ...window.game?.time?.currentDate }
        });
        return { success: true };
    }

    _generateInvestorFirmName(profile = {}) {
        const vcNames = ['Sequoia AI Ventures', 'Horizon Capital', 'Atlas Growth Partners', 'Summit Tech Fund', 'Nexus Ventures'];
        const govNames = ['National AI Investment Corp', 'Digital Innovation Fund', 'Sovereign Technology Fund'];
        const strategicNames = ['TechGiant Ventures', 'CloudCorp Strategic', 'MegaCorp Labs Investment'];
        if (profile.id === 'government_fund') return govNames[Math.floor(Math.random() * govNames.length)];
        if (profile.id === 'strategic_investor') return strategicNames[Math.floor(Math.random() * strategicNames.length)];
        return vcNames[Math.floor(Math.random() * vcNames.length)];
    }

    // ─── Compute Market Actions ───

    /**
     * Buy GPUs (one-time cost, lower monthly cost)
     */
    buyGPUs(count) {
        const currentYear = window.game?.time?.currentDate?.year || 2017;
        const completedChipPrograms = this.state.economy.completedChipPrograms || this.state.economy.chipPrograms || [];
        const completedTechs = Object.entries(this.state.technologies || {})
            .filter(([, techState]) => techState?.completed)
            .map(([techId]) => techId);
        const gpu = getBestAvailableGpu({ year: currentYear, completedTechs, cloud: false, completedChipPrograms });
        if (!gpu) return false;
        return this.orderGPUs(gpu.id, count, { source: 'owned' });
    }

    /**
     * Sell GPUs
     */
    sellGPUs(count) {
        const ownedSlot = (this.state.economy.gpuFleet || [])
            .filter(slot => slot.source === 'owned' && slot.count > 0)
            .sort((a, b) => {
                const locationOrder = { warehouse: 0, colocation: 1, datacenter: 2 };
                return (locationOrder[a.location] ?? 99) - (locationOrder[b.location] ?? 99);
            })
            .find(slot => slot.count >= count);
        if (!ownedSlot) return false;

        const gpu = getGpuById(ownedSlot.gpuId, {
            completedChipPrograms: this.state.economy.completedChipPrograms || this.state.economy.chipPrograms || []
        });
        const sellPrice = Math.round(count * (gpu?.price || this.state.economy.gpuMarketPrice) * 0.7);
        this.state.resources.funds += sellPrice;
        ownedSlot.count -= count;
        if (ownedSlot.count <= 0) {
            this.state.economy.gpuFleet = this.state.economy.gpuFleet.filter(slot => slot !== ownedSlot);
        } else {
            this.state.economy.gpuFleet = [...this.state.economy.gpuFleet];
        }
        syncStateEconomyCompatibility(this.state);
        this.state.addNews(t('economy.sell_gpus', 'GPU {count}대 매각 ({price})', { count, price: `$${this._fmtMoney(sellPrice)}` }), 'info');
        return true;
    }

    /**
     * Adjust cloud GPU rental
     */
    setCloudGPUs(count) {
        const eco = this.state.economy;
        const current = eco.cloudGPUs;
        if (count === current) return;
        if (count < current) {
            return this.adjustCloudGPUs({ delta: count - current });
        }

        return this.adjustCloudGPUs({ delta: count - current });
    }

    _getColocationCapacity() {
        const colocation = this.state.economy.colocation || {};
        return Math.max(0, (colocation.racks || 0) * (colocation.capacityPerRack || 50));
    }

    _getDatacenterCapacity() {
        const datacenters = this.state.economy.datacenters || [];
        return datacenters
            .filter(datacenter => datacenter?.operational)
            .reduce((sum, datacenter) => sum + Math.max(0, Number(datacenter.gpus || 0)), 0);
    }

    _getOperationalDatacenters() {
        return (this.state.economy.datacenters || [])
            .filter(datacenter => datacenter?.operational && Number(datacenter.gpus || 0) > 0)
            .sort((a, b) => Number(a.powerCostMult || 1) - Number(b.powerCostMult || 1) || Number(b.gpus || 0) - Number(a.gpus || 0));
    }

    _getDatacenterFreeCapacity(datacenterId) {
        if (!datacenterId) return 0;
        const datacenter = this._getOperationalDatacenters().find(entry => entry.id === datacenterId);
        if (!datacenter) return 0;
        const used = (this.state.economy.gpuFleet || [])
            .filter(slot => slot.source === 'owned' && (slot.location || 'warehouse') === 'datacenter' && slot.datacenterId === datacenterId)
            .reduce((sum, slot) => sum + Math.max(0, Number(slot.count || 0)), 0);
        return Math.max(0, Number(datacenter.gpus || 0) - used);
    }

    _resolveDatacenterInstallTarget(count = 1, preferredId = null) {
        const required = Math.max(1, Math.round(Number(count || 1)));
        const datacenters = this._getOperationalDatacenters();
        if (preferredId) {
            const preferred = datacenters.find(entry => entry.id === preferredId);
            if (preferred && this._getDatacenterFreeCapacity(preferred.id) >= required) {
                return preferred;
            }
        }
        return datacenters.find(entry => this._getDatacenterFreeCapacity(entry.id) >= required) || null;
    }

    _getFleetStatsForInfrastructure() {
        return getFleetStats(this.state.economy.gpuFleet, {
            currentYear: window.game?.time?.currentDate?.year || 2017,
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms || this.state.economy.chipPrograms || [],
            customSiliconBonuses: this.state.economy.customSiliconBonuses,
            datacenters: this.state.economy.datacenters
        });
    }

    _canInstallGpuLocation(location, count, datacenterId = null) {
        const fleetStats = this._getFleetStatsForInfrastructure();
        if (location === 'colocation') {
            return this._getColocationCapacity() - fleetStats.colocationCount >= count;
        }
        if (location === 'datacenter') {
            if (datacenterId) {
                return this._getDatacenterFreeCapacity(datacenterId) >= count;
            }
            return this._getDatacenterCapacity() - fleetStats.datacenterCount >= count;
        }
        return true;
    }

    adjustCloudGPUs({ gpuId = null, provider = 'aws', termMonths = 1, delta = 0 } = {}) {
        if (!delta) return true;
        if (delta > 0) {
            if (!gpuId) {
                const currentYear = window.game?.time?.currentDate?.year || 2017;
                const completedChipPrograms = this.state.economy.completedChipPrograms || this.state.economy.chipPrograms || [];
                const completedTechs = Object.entries(this.state.technologies || {})
                    .filter(([, techState]) => techState?.completed)
                    .map(([techId]) => techId);
                const gpu = getBestAvailableGpu({ year: currentYear, completedTechs, cloud: true, completedChipPrograms });
                if (!gpu) return false;
                gpuId = gpu.id;
            }
            return this.rentCloudGPUs({ gpuId, count: delta, provider, termMonths });
        }
        return this.removeCloudGPUs({ gpuId, provider, count: Math.abs(delta) });
    }

    removeCloudGPUs({ gpuId = null, provider = null, count = 1 } = {}) {
        if (count <= 0) return false;
        const eco = this.state.economy;
        const fleet = eco.gpuFleet || [];
        let remaining = count;
        for (const slot of fleet) {
            const isMatch = slot.source === 'cloud'
                && (!gpuId || slot.gpuId === gpuId)
                && (!provider || (slot.provider || 'aws') === provider);
            if (!isMatch || remaining <= 0) continue;
            const taken = Math.min(slot.count, remaining);
            slot.count -= taken;
            remaining -= taken;
        }
        eco.gpuFleet = fleet.filter(slot => slot.count > 0);
        if (remaining === count) return false;
        syncStateEconomyCompatibility(this.state);
        return true;
    }

    relocateGPUs({ gpuId, count, fromLocation = 'warehouse', toLocation = 'colocation', datacenterId = null } = {}) {
        const normalizedCount = Math.max(0, Math.round(Number(count || 0)));
        if (!gpuId || normalizedCount <= 0 || fromLocation === toLocation) return false;
        if (!['warehouse', 'colocation', 'datacenter'].includes(fromLocation)) return false;
        if (!['warehouse', 'colocation', 'datacenter'].includes(toLocation)) return false;
        const targetDatacenter = toLocation === 'datacenter'
            ? this._resolveDatacenterInstallTarget(normalizedCount, datacenterId)
            : null;
        if (toLocation !== 'warehouse' && !this._canInstallGpuLocation(toLocation, normalizedCount, targetDatacenter?.id || datacenterId)) return false;

        const eco = this.state.economy;
        const movableCount = (eco.gpuFleet || [])
            .filter(slot => slot.source === 'owned' && slot.gpuId === gpuId && (slot.location || 'warehouse') === fromLocation)
            .reduce((sum, slot) => sum + Math.max(0, Number(slot.count || 0)), 0);
        if (movableCount < normalizedCount) return false;

        let remaining = normalizedCount;
        for (const slot of eco.gpuFleet || []) {
            if (slot.source !== 'owned' || slot.gpuId !== gpuId || (slot.location || 'warehouse') !== fromLocation) continue;
            const taken = Math.min(slot.count, remaining);
            if (taken <= 0) continue;
            slot.count -= taken;
            remaining -= taken;
            this._addFleetSlot({
                gpuId,
                count: taken,
                source: 'owned',
                location: toLocation,
                provider: null,
                rackId: null,
                termMonths: 0,
                monthlyUnitCost: 0,
                datacenterId: targetDatacenter?.id || null,
                datacenterLocationId: targetDatacenter?.locationId || null,
                datacenterPowerCostMult: targetDatacenter?.powerCostMult ?? null
            });
            if (remaining <= 0) break;
        }
        eco.gpuFleet = (eco.gpuFleet || []).filter(slot => slot.count > 0);
        if (remaining > 0) return false;
        syncStateEconomyCompatibility(this.state);
        return true;
    }

    /**
     * Buy training data
     */
    buyData(amountTB) {
        return this.buyDataType('web_text', amountTB);
    }

    buyDataType(dataTypeId, amountTB) {
        const amount = Math.max(0, Number(amountTB || 0));
        const currentDate = typeof window !== 'undefined' ? window.game?.time?.currentDate : null;
        const result = startDataAcquisition(this.state, {
            method: 'purchase',
            type: dataTypeId,
            tb: amount,
            currentMonth: (Number(currentDate?.year || 2017) * 12)
                + Number(currentDate?.month || 1)
        });
        if (!result?.ok) return false;
        syncStateEconomyCompatibility(this.state);
        this.state.addNews(t('economy.buy_data', '학습 데이터 {amount}TB 확보 ({cost})', {
            amount,
            cost: `$${this._fmtMoney(result.cost || 0)}`
        }), 'info');
        return true;
    }

    leaseColocationRacks(count = 1) {
        const eco = this.state.economy;
        eco.colocation.racks += Math.max(0, count);
        syncStateEconomyCompatibility(this.state);
        return true;
    }

    rentCloudGPUs({ gpuId, count, provider = 'aws', termMonths = 1 }) {
        const gpu = getGpuById(gpuId, {
            completedChipPrograms: this.state.economy.completedChipPrograms || this.state.economy.chipPrograms || []
        });
        if (!gpu || count <= 0) return false;
        if (gpu.ownedOnly) return false;
        const completedTechs = Object.entries(this.state.technologies || {})
            .filter(([, techState]) => techState?.completed)
            .map(([techId]) => techId);
        if (gpu.requiresTech) {
            const techList = Array.isArray(gpu.requiresTech) ? gpu.requiresTech : [gpu.requiresTech];
            if (!techList.every(req => completedTechs.includes(req))) return false;
        }

        const providerDiscount = provider === 'azure' ? 0.9 : provider === 'gcp' ? 0.95 : 1;
        const termDiscount = termMonths >= 36 ? 0.6 : termMonths >= 12 ? 0.8 : 1;
        const monthlyUnitCost = Math.round((gpu.cloudMonthly || BALANCE.ECONOMY.GPU_CLOUD_MONTHLY) * providerDiscount * termDiscount * Math.max(1, Number(this.state.economy.cloudCostShockMult || 1)));

        this._addFleetSlot({
            gpuId,
            count,
            source: 'cloud',
            location: 'cloud',
            provider,
            termMonths,
            monthlyUnitCost,
            rackId: null
        });
        this.state.addNews(t('economy.cloud_contract', '{provider}에서 {gpu} {count}대 클라우드 계약 체결', {
            provider: provider.toUpperCase(),
            gpu: gpu.name,
            count
        }), 'info');
        return true;
    }

    orderGPUs(gpuId, count, { source = 'owned', location = null, rackId = null, datacenterId = null } = {}) {
        const completedChipPrograms = this.state.economy.completedChipPrograms || this.state.economy.chipPrograms || [];
        const gpu = getGpuById(gpuId, { completedChipPrograms });
        if (!gpu || count <= 0) return false;
        if (source === 'colocation') {
            source = 'owned';
            location = 'colocation';
        }
        if (source === 'datacenter') {
            source = 'owned';
            location = 'datacenter';
        }
        if (source === 'cloud') location = 'cloud';
        if (!location) location = source === 'cloud' ? 'cloud' : 'warehouse';
        if (gpu.cloudOnly && source !== 'cloud') return false;
        if (gpu.ownedOnly && source !== 'owned') return false;
        const completedTechs = Object.entries(this.state.technologies || {})
            .filter(([, techState]) => techState?.completed)
            .map(([techId]) => techId);
        if (gpu.requiresTech) {
            const techList = Array.isArray(gpu.requiresTech) ? gpu.requiresTech : [gpu.requiresTech];
            if (!techList.every(req => completedTechs.includes(req))) return false;
        }

        const eco = this.state.economy;
        if (eco.gpuSupplyShutdownMonths > 0 && source !== 'cloud') {
            this.state.addNews(t('economy.gpu_supply_shutdown', 'GPU 공급이 막혀 있습니다.'), 'warning');
            return false;
        }
        const targetDatacenter = location === 'datacenter'
            ? this._resolveDatacenterInstallTarget(count, datacenterId)
            : null;
        if ((location === 'colocation' || location === 'datacenter')
            && !this._canInstallGpuLocation(location, count, targetDatacenter?.id || datacenterId)) {
            return false;
        }
        const currentYear = window.game?.time?.currentDate?.year || 2017;
        const currentMonth = window.game?.time?.currentDate?.month || 1;
        const quarter = Math.ceil(currentMonth / 3);
        const supplyKey = `${gpu.id}:${currentYear}:Q${quarter}`;
        eco.gpuSupply = eco.gpuSupply || {};
        const used = eco.gpuSupply[supplyKey] || 0;
        const supply = gpu.quarterlySupply || Number.MAX_SAFE_INTEGER;
        if (used + count > supply) return false;

        const cost = Math.round((gpu.price || eco.gpuMarketPrice) * count * (currentYear >= 2020 && currentYear <= 2023 ? 2 : 1));
        if (this.state.resources.funds < cost) return false;

        this.state.resources.funds -= cost;
        eco.gpuSupply[supplyKey] = used + count;

        const waitTimeMonths = gpu.waitTimeMonths || 0;
        if (waitTimeMonths > 0) {
            eco.pendingGpuOrders.push({
                gpuId,
                count,
                source,
                location,
                monthsRemaining: waitTimeMonths,
                provider: null,
                rackId,
                termMonths: 0,
                monthlyUnitCost: 0,
                datacenterId: targetDatacenter?.id || null,
                datacenterLocationId: targetDatacenter?.locationId || null,
                datacenterPowerCostMult: targetDatacenter?.powerCostMult ?? null
            });
            this.state.addNews(t('economy.gpu_ordered', '{gpu} {count}대 주문 완료 ({months}개월 대기)', {
                gpu: gpu.name,
                count,
                months: waitTimeMonths
            }), 'info');
        } else {
            this._addFleetSlot({
                gpuId,
                count,
                source,
                location,
                provider: null,
                rackId,
                termMonths: 0,
                monthlyUnitCost: 0,
                datacenterId: targetDatacenter?.id || null,
                datacenterLocationId: targetDatacenter?.locationId || null,
                datacenterPowerCostMult: targetDatacenter?.powerCostMult ?? null
            });
            this.state.addNews(t('economy.buy_gpus', 'GPU {count}대 구입 ({cost})', { count, cost: `$${this._fmtMoney(cost)}` }), 'info');
        }
        syncStateEconomyCompatibility(this.state);
        return true;
    }

    _addFleetSlot(slot) {
        const eco = this.state.economy;
        const existing = (eco.gpuFleet || []).find(entry =>
            entry.gpuId === slot.gpuId
            && entry.source === slot.source
            && (entry.location || null) === (slot.location || null)
            && (entry.provider || null) === (slot.provider || null)
            && (entry.rackId || null) === (slot.rackId || null)
            && (entry.datacenterId || null) === (slot.datacenterId || null)
            && Number(entry.monthlyUnitCost || 0) === Number(slot.monthlyUnitCost || 0)
        );

        if (existing) {
            existing.count += slot.count;
            eco.gpuFleet = [...eco.gpuFleet];
        }
        else {
            eco.gpuFleet.push({
                gpuId: slot.gpuId,
                count: slot.count,
                source: slot.source || 'owned',
                location: slot.location || (slot.source === 'cloud' ? 'cloud' : 'warehouse'),
                provider: slot.provider || null,
                termMonths: slot.termMonths || 0,
                monthlyUnitCost: slot.monthlyUnitCost || 0,
                rackId: slot.rackId || null,
                datacenterId: slot.datacenterId || null,
                datacenterLocationId: slot.datacenterLocationId || null,
                datacenterPowerCostMult: slot.datacenterPowerCostMult ?? null
            });
            eco.gpuFleet = [...eco.gpuFleet];
        }
        syncStateEconomyCompatibility(this.state);
    }

    /**
     * Set marketing budget
     */
    setMarketingBudget(monthly) {
        this.state.economy.expenses.marketing = Math.max(0, monthly);
    }

    // ─── Helpers ───
    _fmtMoney(n) {
        if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
        if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
        return `${n}`;
    }

    getRunwayMonths() {
        return this.state.economy.runway;
    }

    getCurrentRoundName() {
        return getFundingRoundName(FUNDING_ROUNDS[this.state.economy.fundingStage]);
    }
}
