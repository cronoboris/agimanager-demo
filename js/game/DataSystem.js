import { DATA_ACQUISITION_TYPES, DATA_METHODS } from '../data/dataAcquisition.js';
import { DATA_TYPES as MODEL_DATA_TYPES } from '../data/models.js';
import { getTotalDataTB, normalizeDataInventory, syncStateEconomyCompatibility } from './ComputeSystem.js';

const BRIDGE_FLAG = Symbol('dataSystemBridgeAttached');
const SYNC_FLAG = Symbol('dataSystemSyncing');

const DATA_TYPE_IDS = Object.keys(MODEL_DATA_TYPES || DATA_ACQUISITION_TYPES || {});
const DEFAULT_PASSIVE_DISTRIBUTION = {
    web_text: 0.55,
    code: 0.2,
    images: 0.15,
    audio: 0.05,
    video: 0.05
};

const DATA_TYPE_BASELINES = {
    web_text: { quality: 72, freshness: 85, bias: 18, legal: 8 },
    books: { quality: 84, freshness: 62, bias: 10, legal: 4 },
    code: { quality: 82, freshness: 75, bias: 10, legal: 6 },
    scientific: { quality: 90, freshness: 70, bias: 8, legal: 10 },
    images: { quality: 74, freshness: 80, bias: 22, legal: 12 },
    audio: { quality: 70, freshness: 82, bias: 18, legal: 12 },
    video: { quality: 76, freshness: 78, bias: 24, legal: 14 },
    synthetic: { quality: 60, freshness: 95, bias: 28, legal: 4 }
};

const DATA_TYPE_ALIASES = {
    text: 'web_text',
    web: 'web_text',
    web_text: 'web_text',
    books: 'books',
    book: 'books',
    code: 'code',
    scientific: 'scientific',
    science: 'scientific',
    image: 'images',
    images: 'images',
    audio: 'audio',
    sound: 'audio',
    video: 'video',
    synthetic: 'synthetic'
};

function clamp(value, min = 0, max = 100) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
}

function safeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeMonthMarker(value) {
    const numeric = safeNumber(value, null);
    return numeric == null ? null : Math.max(0, Math.round(numeric));
}

function resolveTypeId(typeId) {
    if (!typeId) return null;
    const normalized = String(typeId).trim();
    return DATA_TYPE_ALIASES[normalized] || (DATA_TYPE_IDS.includes(normalized) ? normalized : null);
}

function getDataTypeBaseline(typeId) {
    return DATA_TYPE_BASELINES[typeId] || { quality: 70, freshness: 80, bias: 15, legal: 8 };
}

function createEmptyAsset(typeId) {
    return {
        type: typeId,
        tb: 0,
        quality: 0,
        freshness: 100,
        bias: 0,
        legal: 0,
        source: ''
    };
}

function createAssetWithBaseline(typeId, tb = 0, source = 'legacy') {
    const baseline = getDataTypeBaseline(typeId);
    return {
        ...createEmptyAsset(typeId),
        tb: Math.max(0, safeNumber(tb, 0)),
        quality: baseline.quality,
        freshness: baseline.freshness,
        bias: baseline.bias,
        legal: baseline.legal,
        source
    };
}

function normalizeAsset(input, typeId) {
    if (!input || typeof input !== 'object') return createEmptyAsset(typeId);
    return {
        type: typeId,
        tb: Math.max(0, safeNumber(input.tb, 0)),
        quality: clamp(input.quality, 0, 100),
        freshness: clamp(input.freshness, 0, 100),
        bias: clamp(input.bias, 0, 100),
        legal: clamp(input.legal, 0, 100),
        source: typeof input.source === 'string' ? input.source : ''
    };
}

function getStateDataTotal(dataState) {
    if (!dataState?.assets || typeof dataState.assets !== 'object') return 0;
    return DATA_TYPE_IDS.reduce((sum, typeId) => sum + Math.max(0, safeNumber(dataState.assets[typeId]?.tb, 0)), 0);
}

function weightedAverage(currentValue, currentWeight, nextValue, nextWeight) {
    const totalWeight = currentWeight + nextWeight;
    if (totalWeight <= 0) return 0;
    return ((currentValue * currentWeight) + (nextValue * nextWeight)) / totalWeight;
}

function mergeSource(currentSource, nextSource) {
    const existing = String(currentSource || '').trim();
    const incoming = String(nextSource || '').trim();
    if (!existing) return incoming;
    if (!incoming || existing === incoming) return existing;
    return 'mixed';
}

function hasCompletedTech(state, techId) {
    if (!techId) return true;
    return Boolean(state?.technologies?.[techId]?.completed);
}

function countDeployedModels(state) {
    return (state?.models || []).filter(model => model?.deployed || model?.trained).length;
}

function countActiveServices(state) {
    const serviceTotals = [
        safeNumber(state?.service?.totalUsers, 0),
        safeNumber(state?.service?.totalApiUsers, 0),
        safeNumber(state?.service?.totalConsumerUsers, 0),
        safeNumber(state?.service?.totalEnterpriseClients, 0),
        safeNumber(state?.service?.totalGovernmentContracts, 0),
        safeNumber(state?.service?.totalOpenSourceUsers, 0),
        safeNumber(state?.service?.totalInternalUsers, 0),
        safeNumber(state?.service?.totalB2BClients, 0)
    ];
    if (serviceTotals.some(value => value > 0)) return 1;
    return (state?.models || []).some(model => (model?.serviceChannels || []).some(channel => channel?.active)) ? 1 : 0;
}

function buildAcquisitionProfile(typeId, methodId = 'legacy', overrides = {}) {
    const method = methodId === 'legacy' ? null : DATA_METHODS[methodId];
    const baseline = getDataTypeBaseline(typeId);
    const quality = clamp(
        overrides.quality ?? (method ? ((method.qualityBase * 0.7) + (baseline.quality * 0.3)) : baseline.quality),
        0,
        100
    );
    const freshness = clamp(
        overrides.freshness ?? (method ? ((method.freshnessBase * 0.75) + (baseline.freshness * 0.25)) : baseline.freshness),
        0,
        100
    );
    const bias = clamp(
        overrides.bias ?? (method ? ((method.biasRisk * 0.8) + (baseline.bias * 0.2)) : baseline.bias),
        0,
        100
    );
    const legal = clamp(
        overrides.legal ?? (method ? Math.max(method.legalSensitivity, baseline.legal) : baseline.legal),
        0,
        100
    );

    return {
        quality,
        freshness,
        bias,
        legal,
        source: overrides.source ?? (method?.id || 'legacy')
    };
}

function normalizePendingAcquisition(entry = {}) {
    const resolvedType = resolveTypeId(entry.type);
    const method = DATA_METHODS[entry.method] || null;
    const totalMonths = Math.max(0, Math.round(safeNumber(entry.totalMonths ?? entry.monthsToAcquire ?? method?.monthsToAcquire, 0)));
    const monthsRemaining = Math.max(0, Math.round(safeNumber(entry.monthsRemaining ?? totalMonths, totalMonths)));

    if (!resolvedType || !method) return null;

    return {
        id: entry.id || `data_acq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        method: method.id,
        type: resolvedType,
        tb: Math.max(0, safeNumber(entry.tb, 0)),
        totalMonths,
        monthsRemaining,
        startMonth: normalizeMonthMarker(entry.startMonth),
        completionMonth: normalizeMonthMarker(entry.completionMonth),
        cost: Math.max(0, Math.round(safeNumber(entry.cost, 0))),
        computeCost: Math.max(0, Math.round(safeNumber(entry.computeCost, 0))),
        quality: clamp(entry.quality ?? method.qualityBase, 0, 100),
        freshness: clamp(entry.freshness ?? method.freshnessBase, 0, 100),
        bias: clamp(entry.bias ?? method.biasRisk, 0, 100),
        legal: clamp(entry.legal ?? method.legalSensitivity, 0, 100)
    };
}

function ensureDataAssetsBag(dataState) {
    dataState.assets = dataState.assets && typeof dataState.assets === 'object' ? dataState.assets : {};
    for (const typeId of DATA_TYPE_IDS) {
        dataState.assets[typeId] = normalizeAsset(dataState.assets[typeId], typeId);
    }
}

export function createDefaultDataState(seedInventory = 0) {
    const dataState = {
        schemaVersion: 1,
        assets: {},
        pendingAcquisitions: [],
        eventQueue: [],
        eventFlags: {},
        totalTB: 0,
        avgQuality: 0,
        avgFreshness: 100,
        avgBias: 0,
        avgLegal: 0,
        legalRiskScore: 0,
        monthlyPassiveGain: 0
    };

    ensureDataAssetsBag(dataState);

    if (seedInventory != null && getTotalDataTB(seedInventory) > 0) {
        syncDataStateFromInventory(dataState, seedInventory, { source: 'legacy' });
    } else {
        recalculateDataTotals({ data: dataState }, { syncEconomy: false });
    }

    return dataState;
}

export function exportDataInventory(dataState) {
    const inventory = {};
    const assets = dataState?.assets || {};
    for (const typeId of DATA_TYPE_IDS) {
        inventory[typeId] = Math.max(0, safeNumber(assets[typeId]?.tb, 0));
    }
    return normalizeDataInventory(inventory);
}

export function normalizeDataState(input = null, options = {}) {
    const seedInventory = options.inventorySeed ?? null;
    const base = {
        schemaVersion: 1,
        pendingAcquisitions: [],
        eventQueue: [],
        eventFlags: {},
        totalTB: 0,
        avgQuality: 0,
        avgFreshness: 100,
        avgBias: 0,
        avgLegal: 0,
        legalRiskScore: 0,
        monthlyPassiveGain: 0,
        ...(input && typeof input === 'object' ? input : {})
    };

    ensureDataAssetsBag(base);
    base.pendingAcquisitions = (Array.isArray(base.pendingAcquisitions) ? base.pendingAcquisitions : [])
        .map(normalizePendingAcquisition)
        .filter(Boolean);
    base.eventQueue = Array.isArray(base.eventQueue) ? base.eventQueue.filter(Boolean) : [];
    base.eventFlags = base.eventFlags && typeof base.eventFlags === 'object' ? base.eventFlags : {};
    base.monthlyPassiveGain = Math.max(0, safeNumber(base.monthlyPassiveGain, 0));
    base.legalRiskScore = Math.max(0, safeNumber(base.legalRiskScore, 0));

    const explicitTotal = getStateDataTotal(base);
    if (explicitTotal <= 0 && seedInventory != null && getTotalDataTB(seedInventory) > 0) {
        syncDataStateFromInventory(base, seedInventory, { source: 'legacy' });
    } else {
        recalculateDataTotals({ data: base }, { syncEconomy: false });
    }

    return base;
}

export function syncDataStateFromInventory(dataState, inventory, options = {}) {
    if (!dataState) return dataState;
    ensureDataAssetsBag(dataState);
    const source = options.source || 'legacy';
    const normalized = normalizeDataInventory(inventory);

    for (const typeId of DATA_TYPE_IDS) {
        const targetTB = Math.max(0, safeNumber(normalized[typeId], 0));
        const current = normalizeAsset(dataState.assets[typeId], typeId);
        const currentTB = Math.max(0, safeNumber(current.tb, 0));

        if (targetTB <= 0) {
            dataState.assets[typeId] = createEmptyAsset(typeId);
            continue;
        }

        if (currentTB <= 0) {
            dataState.assets[typeId] = createAssetWithBaseline(typeId, targetTB, source);
            continue;
        }

        if (targetTB > currentTB) {
            const delta = targetTB - currentTB;
            const baseline = buildAcquisitionProfile(typeId, 'legacy', { source });
            dataState.assets[typeId] = {
                ...current,
                tb: targetTB,
                quality: weightedAverage(current.quality, currentTB, baseline.quality, delta),
                freshness: weightedAverage(current.freshness, currentTB, baseline.freshness, delta),
                bias: weightedAverage(current.bias, currentTB, baseline.bias, delta),
                legal: weightedAverage(current.legal, currentTB, baseline.legal, delta),
                source: mergeSource(current.source, source)
            };
            continue;
        }

        dataState.assets[typeId] = {
            ...current,
            tb: targetTB
        };
    }

    recalculateDataTotals({ data: dataState }, { syncEconomy: false });
    return dataState;
}

function attachEconomyDataBridge(state) {
    if (!state?.economy || state[BRIDGE_FLAG]) return;
    const dataAssetsDescriptor = Object.getOwnPropertyDescriptor(state.economy, 'dataAssets');
    const totalDataDescriptor = Object.getOwnPropertyDescriptor(state.economy, 'totalDataTB');

    if (dataAssetsDescriptor?.get && dataAssetsDescriptor?.set) {
        Object.defineProperty(state.economy, 'dataAssets', {
            enumerable: true,
            configurable: true,
            get: () => dataAssetsDescriptor.get.call(state.economy),
            set: (value) => {
                dataAssetsDescriptor.set.call(state.economy, value);
                if (state[SYNC_FLAG]) return;
                syncDataStateFromEconomy(state);
            }
        });
    }

    if (totalDataDescriptor?.get && totalDataDescriptor?.set) {
        Object.defineProperty(state.economy, 'totalDataTB', {
            enumerable: true,
            configurable: true,
            get: () => totalDataDescriptor.get.call(state.economy),
            set: (value) => {
                totalDataDescriptor.set.call(state.economy, value);
                if (state[SYNC_FLAG]) return;
                syncDataStateFromEconomy(state);
            }
        });
    }

    state[BRIDGE_FLAG] = true;
}

export function syncDataStateFromEconomy(state) {
    if (!state?.data) return state;
    const inventory = state.economy?.dataAssets ?? state.resources?.data ?? 0;
    syncDataStateFromInventory(state.data, inventory, { source: 'legacy' });
    recalculateDataTotals(state, { syncEconomy: false });
    return state;
}

export function syncDataStateToEconomy(state) {
    if (!state?.data || !state?.economy) return state;
    state[SYNC_FLAG] = true;
    try {
        state.economy.dataAssets = exportDataInventory(state.data);
        if (state.resources) {
            state.resources.data = getStateDataTotal(state.data);
            state.resources.totalData = getStateDataTotal(state.data);
        }
    } finally {
        state[SYNC_FLAG] = false;
    }
    return state;
}

export function normalizeDataStateCompatibility(state) {
    if (!state || typeof state !== 'object') return state;
    const inventorySeed = state.economy?.dataAssets ?? state.resources?.data ?? 0;
    const legacyDataState = state.economy?.dataState && typeof state.economy.dataState === 'object'
        ? state.economy.dataState
        : null;
    const seededDataState = getStateDataTotal(state.data) > 0
        ? state.data
        : (getStateDataTotal(legacyDataState) > 0 ? legacyDataState : state.data);
    const explicitDataTotal = getStateDataTotal(seededDataState);
    state.data = normalizeDataState(seededDataState, {
        inventorySeed: explicitDataTotal > 0 ? null : inventorySeed
    });
    if (state.economy && legacyDataState) {
        state.economy.dataState = state.data;
    }

    attachEconomyDataBridge(state);
    if (explicitDataTotal > 0) {
        syncDataStateToEconomy(state);
    } else {
        syncDataStateFromEconomy(state);
    }
    recalculateDataTotals(state);
    return state;
}

export function recalculateDataTotals(stateOrWrapper, options = {}) {
    const state = stateOrWrapper?.data ? stateOrWrapper : { data: stateOrWrapper };
    const dataState = state.data;
    if (!dataState) return null;

    ensureDataAssetsBag(dataState);
    let totalTB = 0;
    let totalQuality = 0;
    let totalFreshness = 0;
    let totalBias = 0;
    let totalLegal = 0;

    for (const typeId of DATA_TYPE_IDS) {
        const asset = normalizeAsset(dataState.assets[typeId], typeId);
        dataState.assets[typeId] = asset;
        const tb = Math.max(0, safeNumber(asset.tb, 0));
        if (tb <= 0) continue;
        totalTB += tb;
        totalQuality += asset.quality * tb;
        totalFreshness += asset.freshness * tb;
        totalBias += asset.bias * tb;
        totalLegal += asset.legal * tb;
    }

    dataState.totalTB = totalTB;
    dataState.avgQuality = totalTB > 0 ? totalQuality / totalTB : 0;
    dataState.avgFreshness = totalTB > 0 ? totalFreshness / totalTB : 100;
    dataState.avgBias = totalTB > 0 ? totalBias / totalTB : 0;
    dataState.avgLegal = totalTB > 0 ? totalLegal / totalTB : 0;

    if (options.syncEconomy !== false && state.economy) {
        syncDataStateToEconomy(state);
        syncStateEconomyCompatibility(state);
    }

    return dataState;
}

export function addDataAsset(state, typeId, amountTB, methodId = 'purchase', overrides = {}) {
    if (!state) return null;
    normalizeDataStateCompatibility(state);
    const resolvedType = resolveTypeId(typeId);
    const deltaTB = Math.max(0, safeNumber(amountTB, 0));
    if (!resolvedType || deltaTB <= 0) return state.data?.assets?.[resolvedType] || null;

    const asset = normalizeAsset(state.data.assets[resolvedType], resolvedType);
    const currentTB = Math.max(0, safeNumber(asset.tb, 0));
    const profile = buildAcquisitionProfile(resolvedType, methodId, overrides);
    const totalTB = currentTB + deltaTB;

    state.data.assets[resolvedType] = {
        ...asset,
        tb: totalTB,
        quality: weightedAverage(asset.quality, currentTB, profile.quality, deltaTB),
        freshness: weightedAverage(asset.freshness, currentTB, profile.freshness, deltaTB),
        bias: weightedAverage(asset.bias, currentTB, profile.bias, deltaTB),
        legal: weightedAverage(asset.legal, currentTB, profile.legal, deltaTB),
        source: mergeSource(asset.source, profile.source)
    };

    recalculateDataTotals(state);
    return state.data.assets[resolvedType];
}

function queueDataEvent(state, event) {
    if (!event) return null;
    normalizeDataStateCompatibility(state);
    state.data.eventQueue.push(event);
    if (!dispatchExternalEvent(event) && !state.pendingEvent) {
        state.pendingEvent = event;
    }
    return event;
}

function createDataEvent(id, config) {
    return {
        id,
        type: config.type || 'decision',
        title: config.title,
        description: config.description,
        icon: config.icon || '📊',
        newsType: config.newsType || 'warning',
        choices: config.choices || []
    };
}

function dispatchExternalEvent(event) {
    if (!event || typeof window === 'undefined') return false;
    const eventSystem = window.game?.events;
    if (!eventSystem || typeof eventSystem.enqueueExternalEvent !== 'function') return false;
    return Boolean(eventSystem.enqueueExternalEvent(event));
}

function createScrapingLawsuitEvent() {
    return createDataEvent('data_scraping_lawsuit', {
        title: '데이터 스크래핑 소송',
        description: '수집한 웹 데이터에 대해 권리자가 법적 대응을 시작했습니다.',
        icon: '⚖️',
        choices: [
            { text: '합의한다 ($100K)', effects: { funds: -100000, publicImage: -2 } },
            { text: '법정에서 싸운다', effects: { publicImage: -10 } },
            { text: '스크래핑을 중단한다', effects: { publicImage: -4 } }
        ]
    });
}

function createPrivacyScandalEvent() {
    return createDataEvent('data_privacy_scandal', {
        title: '개인정보 유출 스캔들',
        description: '사용자 로그 처리 과정에서 개인정보 보호 이슈가 제기되었습니다.',
        icon: '🛡️',
        choices: [
            { text: '공개 사과 및 보상', effects: { publicImage: -4, funds: -80000 } },
            { text: '조용히 조사한다', effects: { publicImage: -8 } },
            { text: '문제가 된 로그 수집을 중단한다', effects: { publicImage: -3 } }
        ]
    });
}

function createPartnershipOfferEvent() {
    return createDataEvent('data_partnership_offer', {
        title: '데이터 파트너십 제안',
        description: '우호적인 경쟁사가 공동 데이터 풀 구성을 제안했습니다.',
        icon: '🤝',
        choices: [
            {
                text: '제안을 수락한다',
                effects: {
                    reputation: 4,
                    investorTrust: 2,
                    dataMethod: 'partnership',
                    dataAssets: { books: 1.5, code: 1 }
                }
            },
            {
                text: '조건을 재협상한다',
                effects: {
                    reputation: 1,
                    dataMethod: 'partnership',
                    dataAssets: { books: 1, scientific: 0.5 }
                }
            },
            { text: '독자 노선을 유지한다', effects: { reputation: -2 } }
        ]
    });
}

function createGovernmentAccessEvent() {
    return createDataEvent('government_data_access', {
        title: '정부 데이터 접근권',
        description: '우호적인 정부가 과학 데이터 접근권을 제안했습니다.',
        icon: '🏛️',
        choices: [
            {
                text: '규정을 준수하며 수락한다',
                effects: {
                    reputation: 3,
                    publicImage: 2,
                    dataMethod: 'partnership',
                    dataAssets: { scientific: 4, books: 1 }
                }
            },
            {
                text: '조건을 더 요구한다',
                effects: {
                    reputation: -1,
                    dataMethod: 'partnership',
                    dataAssets: { scientific: 2 }
                }
            },
            { text: '민간 데이터에 집중한다', effects: {} }
        ]
    });
}

function createFreshnessWarningEvent() {
    return createDataEvent('data_freshness_warning', {
        type: 'world',
        title: '데이터 신선도 경고',
        description: '보유 데이터의 평균 신선도가 크게 떨어졌습니다. 재수집 또는 정제가 필요합니다.',
        icon: '⏳',
        choices: []
    });
}

function maybeQueueThresholdEvents(state, events) {
    const flags = state.data.eventFlags;
    const bestCompetitorRelation = Math.max(
        0,
        ...(state.competitors || []).map(competitor => safeNumber(competitor?.relations?.player ?? competitor?.relation, 0))
    );
    const playerCountry = state.player?.country || null;
    const countryFavorability = playerCountry ? safeNumber(state.global?.countryFavorability?.[playerCountry], 0) : 0;

    if (bestCompetitorRelation >= 50 && !flags.partnershipOfferQueued) {
        events.push(queueDataEvent(state, createPartnershipOfferEvent()));
        flags.partnershipOfferQueued = true;
    }

    if (countryFavorability >= 60 && !flags.governmentAccessQueued) {
        events.push(queueDataEvent(state, createGovernmentAccessEvent()));
        flags.governmentAccessQueued = true;
    }

    if (state.data.avgFreshness <= 40 && !flags.freshnessWarningQueued) {
        events.push(queueDataEvent(state, createFreshnessWarningEvent()));
        flags.freshnessWarningQueued = true;
    } else if (state.data.avgFreshness > 45) {
        flags.freshnessWarningQueued = false;
    }
}

export function checkAcquisitionRisk(state, acquisition, options = {}) {
    if (!state || !acquisition) return [];
    normalizeDataStateCompatibility(state);
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const events = [];
    const method = DATA_METHODS[acquisition.method];
    if (!method?.events) return events;

    if (method.events.legalChance && random() < method.events.legalChance) {
        state.data.legalRiskScore += Math.max(10, safeNumber(method.legalSensitivity, 0));
        state.reputation ||= {};
        state.reputation.publicImage = safeNumber(state.reputation.publicImage, 0) + safeNumber(method.events.reputationPenalty, 0);
        events.push(queueDataEvent(state, createScrapingLawsuitEvent()));
    }

    if (method.events.privacyChance && random() < method.events.privacyChance) {
        state.data.legalRiskScore += Math.max(8, Math.round(safeNumber(method.legalSensitivity, 0) * 0.75));
        state.reputation ||= {};
        state.reputation.publicImage = safeNumber(state.reputation.publicImage, 0) + safeNumber(method.events.reputationPenalty, 0);
        events.push(queueDataEvent(state, createPrivacyScandalEvent()));
    }

    return events.filter(Boolean);
}

export function calculateTrainingDataQuality(state, dataMix = null) {
    if (!state?.data?.assets) {
        return {
            totalTB: 0,
            avgQuality: 0,
            avgFreshness: 100,
            avgBias: 0,
            avgLegal: 0,
            effectiveQuality: 0,
            performanceMultiplier: 0.5,
            safetyPenalty: 0
        };
    }

    const mix = dataMix && typeof dataMix === 'object'
        ? Object.entries(dataMix).reduce((acc, [typeId, amount]) => {
            const resolved = resolveTypeId(typeId);
            if (!resolved) return acc;
            acc[resolved] = (acc[resolved] || 0) + Math.max(0, safeNumber(amount, 0));
            return acc;
        }, {})
        : exportDataInventory(state.data);

    let totalTB = 0;
    let totalQuality = 0;
    let totalFreshness = 0;
    let totalBias = 0;
    let totalLegal = 0;

    for (const [typeId, allocated] of Object.entries(mix)) {
        const resolved = resolveTypeId(typeId);
        if (!resolved) continue;
        const asset = normalizeAsset(state.data.assets[resolved], resolved);
        const usedTB = Math.max(0, Math.min(asset.tb, safeNumber(allocated, 0)));
        if (usedTB <= 0) continue;
        totalTB += usedTB;
        totalQuality += asset.quality * usedTB;
        totalFreshness += asset.freshness * usedTB;
        totalBias += asset.bias * usedTB;
        totalLegal += asset.legal * usedTB;
    }

    const avgQuality = totalTB > 0 ? totalQuality / totalTB : 0;
    const avgFreshness = totalTB > 0 ? totalFreshness / totalTB : 100;
    const avgBias = totalTB > 0 ? totalBias / totalTB : 0;
    const avgLegal = totalTB > 0 ? totalLegal / totalTB : 0;
    const effectiveQuality = totalTB > 0
        ? Math.max(0, (avgQuality / 100) * (avgFreshness / 100) * (1 - (avgBias / 200)))
        : 0;

    return {
        totalTB,
        avgQuality,
        avgFreshness,
        avgBias,
        avgLegal,
        effectiveQuality,
        performanceMultiplier: 0.5 + (0.5 * effectiveQuality),
        safetyPenalty: avgBias > 30 ? avgBias * 0.1 : 0
    };
}

function validateMethodRequirements(state, method) {
    const requirements = method?.requirements || {};

    if (requirements.minReputation != null) {
        const reputation = Math.max(
            safeNumber(state?.reputation?.corporate, 0),
            safeNumber(state?.reputation?.publicImage, 0)
        );
        if (reputation < Number(requirements.minReputation)) {
            return { ok: false, reason: 'min_reputation' };
        }
    }

    if (requirements.tech && !hasCompletedTech(state, requirements.tech)) {
        return { ok: false, reason: 'missing_tech' };
    }

    if (requirements.deployedModels && countDeployedModels(state) < Number(requirements.deployedModels)) {
        return { ok: false, reason: 'missing_deployed_models' };
    }

    if (requirements.activeServices && countActiveServices(state) < Number(requirements.activeServices)) {
        return { ok: false, reason: 'missing_active_services' };
    }

    return { ok: true };
}

export function startDataAcquisition(state, request = {}) {
    if (!state) return { ok: false, reason: 'missing_state' };
    normalizeDataStateCompatibility(state);

    const method = DATA_METHODS[request.method];
    const type = resolveTypeId(request.type);
    const tb = Math.max(0, safeNumber(request.tb, 0));
    if (!method) return { ok: false, reason: 'invalid_method' };
    if (!type) return { ok: false, reason: 'invalid_type' };
    if (tb <= 0) return { ok: false, reason: 'invalid_amount' };

    const requirementCheck = validateMethodRequirements(state, method);
    if (!requirementCheck.ok) return requirementCheck;

    const cost = Math.max(0, Math.round(tb * safeNumber(method.costPerTB, 0)));
    const computeCost = Math.max(0, Math.round(tb * safeNumber(method.computeCostPerTB, 0)));
    const totalCost = cost + computeCost;

    if (safeNumber(state.resources?.funds, 0) < totalCost) {
        return { ok: false, reason: 'insufficient_funds', cost: totalCost };
    }

    state.resources.funds -= totalCost;
    state.economy ||= {};
    state.economy.expenses ||= {};
    state.economy.expenses.dataAcquisition = Math.max(0, safeNumber(state.economy.expenses.dataAcquisition, 0)) + totalCost;

    if (method.id === 'userLogs') {
        state.data.monthlyPassiveGain += safeNumber(method.tbPerMonth, 0) * tb;
        recalculateDataTotals(state);
        return {
            ok: true,
            passive: true,
            monthlyPassiveGain: state.data.monthlyPassiveGain,
            cost: totalCost
        };
    }

    const profile = buildAcquisitionProfile(type, method.id, request);
    if (safeNumber(method.monthsToAcquire, 0) <= 0) {
        addDataAsset(state, type, tb, method.id, profile);
        const triggeredEvents = checkAcquisitionRisk(state, { method: method.id, type, tb }, request);
        return {
            ok: true,
            immediate: true,
            cost: totalCost,
            triggeredEvents
        };
    }

    const totalMonths = Math.max(1, Math.round(safeNumber(method.monthsToAcquire, 0)));
    const startMonth = normalizeMonthMarker(request.currentMonth);
    const acquisition = normalizePendingAcquisition({
        id: request.id,
        method: method.id,
        type,
        tb,
        totalMonths,
        monthsRemaining: totalMonths,
        startMonth,
        completionMonth: startMonth == null ? null : startMonth + totalMonths,
        cost: totalCost,
        computeCost,
        ...profile
    });

    state.data.pendingAcquisitions.push(acquisition);
    recalculateDataTotals(state);

    return {
        ok: true,
        immediate: false,
        acquisition,
        cost: totalCost
    };
}

export function processMonthlyData(state, options = {}) {
    if (!state) return { completed: [], triggeredEvents: [], passiveGainTB: 0 };
    normalizeDataStateCompatibility(state);

    const completed = [];
    const triggeredEvents = [];
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const nextPending = [];

    for (const rawEntry of state.data.pendingAcquisitions) {
        const entry = normalizePendingAcquisition(rawEntry);
        if (!entry) continue;
        entry.monthsRemaining = Math.max(0, entry.monthsRemaining - 1);
        if (entry.monthsRemaining <= 0) {
            addDataAsset(state, entry.type, entry.tb, entry.method, entry);
            completed.push(entry);
            triggeredEvents.push(...checkAcquisitionRisk(state, entry, { random }));
        } else {
            nextPending.push(entry);
        }
    }
    state.data.pendingAcquisitions = nextPending;

    let passiveGainTB = 0;
    if (state.data.monthlyPassiveGain > 0) {
        for (const [typeId, share] of Object.entries(DEFAULT_PASSIVE_DISTRIBUTION)) {
            const amount = state.data.monthlyPassiveGain * share;
            if (amount <= 0) continue;
            addDataAsset(state, typeId, amount, 'userLogs');
            passiveGainTB += amount;
        }
        triggeredEvents.push(...checkAcquisitionRisk(state, {
            method: 'userLogs',
            type: 'web_text',
            tb: state.data.monthlyPassiveGain
        }, { random }));
    }

    for (const typeId of DATA_TYPE_IDS) {
        const asset = normalizeAsset(state.data.assets[typeId], typeId);
        if (asset.tb <= 0) continue;
        asset.freshness = Math.max(10, asset.freshness - 1);
        state.data.assets[typeId] = asset;
    }

    recalculateDataTotals(state);
    maybeQueueThresholdEvents(state, triggeredEvents);

    return {
        completed,
        triggeredEvents: triggeredEvents.filter(Boolean),
        passiveGainTB
    };
}
