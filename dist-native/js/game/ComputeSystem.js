import { BALANCE } from '../data/balance.js';
import { BENCHMARKS, MARKET_EXPECTATIONS, DATA_TYPES, MODEL_ARCHITECTURES, PARAMETER_SCALES } from '../data/models.js';
import { GPU_CATALOG } from '../data/gpus.js';

const DATA_TYPE_IDS = Object.keys(DATA_TYPES || {});
const DEFAULT_DATA_WEIGHTS = {
    web_text: 0.5,
    books: 0.2,
    code: 0.2,
    scientific: 0.05,
    images: 0.03,
    audio: 0.01,
    video: 0.01,
    synthetic: 0
};

const GPU_SOURCE_ORDER = {
    owned: 0,
    cloud: 1
};

const GPU_LOCATION_ORDER = {
    cloud: 0,
    colocation: 1,
    datacenter: 2,
    warehouse: 3
};

const REFERENCE_FLEET_TFLOPS = 64;
const LEGACY_CUSTOM_GPU_FALLBACKS = {
    custom_asic_1: {
        id: 'custom_asic_1',
        name: 'Custom AI Chip v1',
        manufacturer: 'Player',
        releaseYear: 2022,
        tflops: 200,
        vram: 64,
        price: 5000,
        powerWatt: 150,
        quarterlySupply: 100,
        waitTimeMonths: 1,
        ownedOnly: true,
        legacyOnly: true
    },
    custom_asic_2: {
        id: 'custom_asic_2',
        name: 'Custom AI Chip v2',
        manufacturer: 'Player',
        releaseYear: 2024,
        tflops: 800,
        vram: 128,
        price: 8000,
        powerWatt: 200,
        quarterlySupply: 120,
        waitTimeMonths: 1,
        ownedOnly: true,
        legacyOnly: true
    }
};

function _safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function _clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
}

function _getCountryModifiers(options = {}) {
    return options.countryModifiers || options.countryBonuses || {};
}

function _bonusMultiplier(value, strength = 0.75) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 1;
    if (numeric === 1) return 1;
    return 1 + ((numeric - 1) * strength);
}

function _catalog(options = {}) {
    const catalog = Array.isArray(GPU_CATALOG) ? [...GPU_CATALOG] : [];
    if (Array.isArray(options.customGpus) && options.customGpus.length > 0) {
        catalog.push(...options.customGpus);
    } else if (Array.isArray(options.completedChipPrograms) && options.completedChipPrograms.length > 0) {
        catalog.push(...getCompletedChipProgramGPUs(options.completedChipPrograms, options));
    } else if (Array.isArray(options.customSiliconCatalog) && options.customSiliconCatalog.length > 0) {
        catalog.push(...options.customSiliconCatalog);
    }
    return catalog;
}

function _normalizeTechIds(completedTechs = []) {
    if (!Array.isArray(completedTechs)) return new Set();
    return new Set(completedTechs.filter(Boolean).map(String));
}

function _gpuMeetsTechRequirements(gpu, completedTechs = []) {
    if (!gpu || !gpu.requiresTech) return true;
    const techIds = _normalizeTechIds(completedTechs);
    if (Array.isArray(gpu.requiresTech)) return gpu.requiresTech.every(req => techIds.has(String(req)));
    return techIds.has(String(gpu.requiresTech));
}

function _normalizeBonusMultiplier(value, fallback = 1) {
    const n = _safeNumber(value, fallback);
    return n > 0 ? n : fallback;
}

function _resolveModelList(input) {
    if (Array.isArray(input)) return input;
    if (!input || typeof input !== 'object') return [];
    if (Array.isArray(input.models)) return input.models;
    if (Array.isArray(input.deployedModels)) return input.deployedModels;
    return [];
}

function _getActiveServiceChannels(model) {
    return Array.isArray(model?.serviceChannels)
        ? model.serviceChannels.filter(channel => channel && channel.active)
        : [];
}

function _extractCustomSiliconBonusSource(input) {
    if (!input || typeof input !== 'object') return null;
    if (input.trainingSpeedMult != null || input.inferenceCostMult != null || input.powerCostMult != null || input.computeMult != null) {
        return input;
    }
    return input.bonuses || input.expectedBenefits || input.effects || input.customSiliconBonuses || input.siliconBonuses || null;
}

function _normalizeCustomSiliconBonusObject(source) {
    const normalized = {
        trainingSpeedMult: _normalizeBonusMultiplier(source?.trainingSpeedMult ?? source?.trainingMult ?? source?.training ?? source?.trainingSpeed, 1),
        inferenceCostMult: _normalizeBonusMultiplier(source?.inferenceCostMult ?? source?.inferenceMult ?? source?.inference, 1),
        powerCostMult: _normalizeBonusMultiplier(source?.powerCostMult ?? source?.powerMult ?? source?.power, 1),
        computeMult: _normalizeBonusMultiplier(source?.computeMult ?? source?.computeEfficiencyMult ?? source?.compute, 1)
    };
    return normalized;
}

export function normalizeCustomSiliconBonuses(input = {}) {
    const defaults = {
        trainingSpeedMult: 1,
        inferenceCostMult: 1,
        powerCostMult: 1,
        computeMult: 1
    };

    if (input == null) return { ...defaults };

    const programList = Array.isArray(input)
        ? input
        : (Array.isArray(input.completedChipPrograms)
            ? input.completedChipPrograms
            : Array.isArray(input.completedPrograms)
                ? input.completedPrograms
                : Array.isArray(input.chipPrograms)
                    ? input.chipPrograms
                    : null);

    if (programList) {
        return programList.reduce((acc, entry) => {
            const source = _extractCustomSiliconBonusSource(entry);
            if (!source) return acc;
            const normalized = _normalizeCustomSiliconBonusObject(source);
            acc.trainingSpeedMult *= normalized.trainingSpeedMult;
            acc.inferenceCostMult *= normalized.inferenceCostMult;
            acc.powerCostMult *= normalized.powerCostMult;
            acc.computeMult *= normalized.computeMult;
            return acc;
        }, { ...defaults });
    }

    const explicitSource = _extractCustomSiliconBonusSource(input);
    if (explicitSource) {
        return {
            ...defaults,
            ..._normalizeCustomSiliconBonusObject(explicitSource)
        };
    }

    return { ...defaults };
}

export function getParameterScaleRequirements(scale = {}) {
    const minGPU = Math.max(0, Math.round(_safeNumber(scale.minGPU, 0)));
    const minTFLOPS = Math.max(0, _safeNumber(scale.minTFLOPS, 0));
    const minVRAM = Math.max(0, _safeNumber(scale.minVRAM, 0));
    const requiredPFLOPS = Math.max(0, _safeNumber(scale.requiredPFLOPS, 0));
    const requiresTech = Array.isArray(scale.requiresTech)
        ? [...new Set(scale.requiresTech.map(String).filter(Boolean))]
        : scale.requiresTech
            ? [String(scale.requiresTech)]
            : [];

    return {
        ...scale,
        minGPU,
        minTFLOPS,
        minVRAM,
        requiredPFLOPS,
        requiresTech
    };
}

export function getModelComputeQualityBonus({ scale, fleetStats, customSiliconBonuses = null } = {}) {
    if (!scale) return 1;
    const requirements = getParameterScaleRequirements(scale);
    const fleet = fleetStats || getFleetStats([]);
    const minTFLOPS = Math.max(0.01, _safeNumber(requirements.minTFLOPS, 0) || _safeNumber(requirements.computeReq, 0) || 0.01);
    const computeRatio = Math.max(0, _safeNumber(fleet.totalTFLOPS, 0)) / minTFLOPS;
    const qualityBonus = computeRatio >= 2
        ? 1.05 + Math.min(0.1, (computeRatio - 2) * 0.02)
        : 1.0;
    return qualityBonus;
}

function _getBenchmarkDefinition(benchmarkId) {
    return (BENCHMARKS || []).find(benchmark => benchmark.id === benchmarkId) || null;
}

function _getOrderedExpectationYears() {
    return Object.keys(MARKET_EXPECTATIONS || {})
        .map(year => Number(year))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
}

function _getMarketExpectationForYear(year, benchmarkId) {
    const years = _getOrderedExpectationYears();
    if (years.length === 0) return 0;

    const resolvedYear = Number.isFinite(Number(year)) ? Number(year) : years[0];
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const clampedYear = Math.min(maxYear, Math.max(minYear, resolvedYear));
    const exact = MARKET_EXPECTATIONS?.[String(clampedYear)]?.[benchmarkId];
    if (exact != null) return Number(exact) || 0;

    let lowerYear = minYear;
    let upperYear = maxYear;
    for (let index = 0; index < years.length - 1; index++) {
        const current = years[index];
        const next = years[index + 1];
        if (clampedYear >= current && clampedYear <= next) {
            lowerYear = current;
            upperYear = next;
            break;
        }
    }

    const lowerValue = Number(MARKET_EXPECTATIONS?.[String(lowerYear)]?.[benchmarkId] || 0);
    const upperValue = Number(MARKET_EXPECTATIONS?.[String(upperYear)]?.[benchmarkId] || lowerValue);
    if (lowerYear === upperYear) return lowerValue;

    const progress = (clampedYear - lowerYear) / (upperYear - lowerYear);
    return lowerValue + ((upperValue - lowerValue) * progress);
}

export function calculateBenchmarkScore(model, benchmarkId) {
    const benchmark = _getBenchmarkDefinition(benchmarkId);
    if (!benchmark) {
        return Math.max(0, Math.round(_safeNumber(model?.performance ?? model?.compositeScore ?? 0, 0)));
    }

    const capabilities = model?.capabilities || {};
    let score = 0;
    for (const [capabilityId, weight] of Object.entries(benchmark.capWeights || {})) {
        score += _safeNumber(capabilities[capabilityId], 0) * _safeNumber(weight, 0);
    }

    if (score <= 0) {
        return Math.max(0, Math.round(_safeNumber(model?.performance ?? model?.compositeScore ?? 0, 0)));
    }

    return Math.round(score);
}

export function getModelBenchmarks(model) {
    return (BENCHMARKS || []).map(benchmark => ({
        id: benchmark.id,
        name: benchmark.name,
        nameKo: benchmark.nameKo || benchmark.name,
        description: benchmark.description || '',
        score: calculateBenchmarkScore(model, benchmark.id)
    }));
}

export function getMarketExpectations(year) {
    const expectations = {};
    for (const benchmark of BENCHMARKS || []) {
        expectations[benchmark.id] = Math.round(_getMarketExpectationForYear(year, benchmark.id));
    }
    return expectations;
}

export function getRelativePerformance(model, year) {
    const benchmarks = getModelBenchmarks(model);
    const expectations = getMarketExpectations(year);

    let totalRelative = 0;
    let count = 0;
    for (const benchmark of benchmarks) {
        const expected = Number(expectations[benchmark.id] || 0);
        if (expected > 0) {
            totalRelative += benchmark.score / expected;
            count++;
        }
    }

    return count > 0 ? totalRelative / count : 0;
}

export function getRelativePerformanceTier(relativePerformance) {
    const rel = _safeNumber(relativePerformance, 0);
    if (rel < 0.5) return { id: 'obsolete', key: 'benchmark.tier.obsolete', fallback: '구식' };
    if (rel < 0.9) return { id: 'lagging', key: 'benchmark.tier.lagging', fallback: '뒤처짐' };
    if (rel < 1.15) return { id: 'market_fit', key: 'benchmark.tier.market_fit', fallback: '시장 수준' };
    return { id: 'innovative', key: 'benchmark.tier.innovative', fallback: '혁신적' };
}

export function getRelativePerformancePercent(relativePerformance) {
    return Math.max(0, Math.round(_safeNumber(relativePerformance, 0) * 100));
}

export function getServiceRevenueMultiplier(relativePerformance) {
    const rel = _safeNumber(relativePerformance, 0);
    if (rel < 0.5) return rel * 0.1;
    if (rel < 1.0) return 0.2 + ((rel - 0.5) * 1.6);
    if (rel < 1.5) return 1.0 + ((rel - 1.0) * 1.5);
    return 1.75 + ((rel - 1.5) * 0.5);
}

export function getTeamResearchPower(talents = []) {
    return talents.reduce((sum, talent) => sum + _safeNumber(talent?.stats?.research, 0), 0);
}

export function getBestDeployedModel(modelsOrState = [], year = null) {
    const models = _resolveModelList(modelsOrState).filter(model => model?.deployed);
    if (models.length === 0) return null;

    const resolvedYear = Number.isFinite(Number(year))
        ? Number(year)
        : Number(globalThis.window?.game?.time?.currentDate?.year || 2017);

    return models.reduce((best, model) => {
        if (!best) return model;
        return getRelativePerformance(model, resolvedYear) > getRelativePerformance(best, resolvedYear)
            ? model
            : best;
    }, null);
}

export function getModelServiceTFLOPS(model) {
    if (!model || typeof model !== 'object') return 0;
    return _getActiveServiceChannels(model)
        .reduce((sum, channel) => sum + Math.max(0, _safeNumber(channel.allocatedTFLOPS, 0)), 0);
}

export function getServiceTFLOPS(modelsOrState = []) {
    return _resolveModelList(modelsOrState)
        .reduce((sum, model) => sum + getModelServiceTFLOPS(model), 0);
}

export function getTrainingTFLOPS(modelsOrState = []) {
    return _resolveModelList(modelsOrState)
        .reduce((sum, model) => {
            if (!model || typeof model !== 'object') return sum;
            const explicit = _safeNumber(model.trainingTFLOPS ?? model.trainingAllocatedTFLOPS ?? model.computeAllocation, 0);
            if (explicit > 0) return sum + explicit;
            if (model.status === 'training' || model.training === true) {
                return sum + Math.max(0, _safeNumber(model.allocatedTFLOPS ?? model.trainingBudget ?? model.computeBudget, 0));
            }
            return sum;
        }, 0);
}

export function getComputeBudget({ fleetStats, models = [], trainingUsed = null, serviceUsed = null } = {}) {
    const resolvedFleet = fleetStats || getFleetStats([]);
    const resolvedTraining = trainingUsed == null ? getTrainingTFLOPS(models) : Math.max(0, _safeNumber(trainingUsed, 0));
    const resolvedService = serviceUsed == null ? getServiceTFLOPS(models) : Math.max(0, _safeNumber(serviceUsed, 0));
    const totalTFLOPS = Math.max(0, _safeNumber(resolvedFleet.totalTFLOPS, 0));
    const availableTFLOPS = Math.max(0, totalTFLOPS - resolvedTraining - resolvedService);

    return {
        totalTFLOPS,
        trainingUsed: resolvedTraining,
        serviceUsed: resolvedService,
        availableTFLOPS
    };
}

export function getCompletedChipProgramGPUs(completedChipPrograms = [], options = {}) {
    if (!Array.isArray(completedChipPrograms) || completedChipPrograms.length === 0) return [];
    const currentYear = _safeNumber(options.currentYear, 2017);

    return completedChipPrograms
        .map(program => {
            if (!program || typeof program !== 'object') return null;
            const gpuSource = program.gpu || program.gpuSpec || program.spec || program.output || program.result || {};
            const id = gpuSource.id || program.gpuId || program.chipId || (program.generation != null ? `custom_asic_${program.generation}` : null) || program.id;
            if (!id) return null;
            const resolvedPrice = gpuSource.price ?? program.price ?? (program.totalCost != null ? Math.round(_safeNumber(program.totalCost, 0) / 100) : 0);
            const bonuses = normalizeCustomSiliconBonuses(program);
            return {
                id: String(id),
                name: gpuSource.name || program.name || program.chipName || `Custom GPU ${program.generation || ''}`.trim() || String(id),
                manufacturer: gpuSource.manufacturer || program.manufacturer || 'Player',
                releaseYear: gpuSource.releaseYear ?? program.releaseYear ?? currentYear,
                tflops: Math.max(0, _safeNumber(gpuSource.tflops ?? program.tflops ?? program.achievedTFLOPS ?? program.targetTFLOPS, 0)),
                vram: Math.max(0, _safeNumber(gpuSource.vram ?? program.vram ?? program.achievedVRAM ?? program.targetVRAM, 0)),
                price: Math.max(0, _safeNumber(resolvedPrice, 0)),
                powerWatt: Math.max(0, _safeNumber(gpuSource.powerWatt ?? program.powerWatt ?? program.achievedPowerWatt ?? program.targetPowerWatt, 0)),
                cloudMonthly: gpuSource.cloudMonthly ?? program.cloudMonthly ?? null,
                cloudHourly: gpuSource.cloudHourly ?? program.cloudHourly ?? null,
                quarterlySupply: gpuSource.quarterlySupply ?? program.quarterlySupply ?? null,
                waitTimeMonths: Math.max(0, _safeNumber(gpuSource.waitTimeMonths ?? program.waitTimeMonths, 0)),
                supplyHint: gpuSource.supplyHint || program.supplyHint || 'Custom silicon available from completed chip programs.',
                description: gpuSource.description || program.description || 'Internal custom silicon output from a completed chip program.',
                requiresTech: gpuSource.requiresTech || program.requiresTech || null,
                cloudOnly: false,
                ownedOnly: true,
                customSilicon: true,
                chipProgramId: program.id || null,
                chipId: program.chipId || program.id || null,
                generation: Number.isFinite(Number(program.generation)) ? Number(program.generation) : null,
                bonuses
            };
        })
        .filter(Boolean);
}

export function getGpuById(gpuId, options = {}) {
    if (!gpuId) return null;
    return _catalog(options).find(gpu => gpu.id === gpuId)
        || LEGACY_CUSTOM_GPU_FALLBACKS[gpuId]
        || null;
}

export function getAvailableGPUs({ year, cloud = false, completedTechs = [], completedChipPrograms = [], customGpus = [] } = {}) {
    const currentYear = _safeNumber(year, 2017);
    const catalog = _catalog({ completedChipPrograms, customGpus });
    return catalog.filter(gpu => {
        if (gpu.releaseYear != null && gpu.releaseYear > currentYear) return false;
        if (cloud) return !gpu.ownedOnly;
        if (gpu.cloudOnly) return false;
        return _gpuMeetsTechRequirements(gpu, completedTechs);
    });
}

export function getBestAvailableGpu({ year, completedTechs = [], cloud = false, completedChipPrograms = [], customGpus = [] } = {}) {
    const available = getAvailableGPUs({ year, cloud, completedTechs, completedChipPrograms, customGpus });
    if (available.length === 0) return null;

    return available.slice().sort((a, b) => {
        const byTflops = _safeNumber(b.tflops, 0) - _safeNumber(a.tflops, 0);
        if (byTflops !== 0) return byTflops;
        const byYear = _safeNumber(b.releaseYear, -Infinity) - _safeNumber(a.releaseYear, -Infinity);
        if (byYear !== 0) return byYear;
        return _safeNumber(a.price, Infinity) - _safeNumber(b.price, Infinity);
    })[0] || null;
}

function _resolveGpuEntry(gpuId, { source, currentYear, completedChipPrograms = [], customGpus = [] } = {}) {
    const catalog = _catalog({ completedChipPrograms, customGpus });
    if (catalog.length === 0) return null;

    if (gpuId) {
        const direct = getGpuById(gpuId, { completedChipPrograms, customGpus });
        if (direct) return direct;
    }

    const year = _safeNumber(currentYear, 2017);
    const yearCandidates = catalog.filter(gpu => gpu.releaseYear == null || gpu.releaseYear <= year);
    const candidates = yearCandidates.length > 0 ? yearCandidates : catalog;

    const sourceFiltered = source === 'owned'
        ? candidates.filter(gpu => !gpu.cloudOnly)
        : candidates;
    const pool = sourceFiltered.length > 0 ? sourceFiltered : candidates;

    return pool.slice().sort((a, b) => {
        const byYear = _safeNumber(b.releaseYear, -Infinity) - _safeNumber(a.releaseYear, -Infinity);
        if (byYear !== 0) return byYear;
        const byTflops = _safeNumber(b.tflops, 0) - _safeNumber(a.tflops, 0);
        if (byTflops !== 0) return byTflops;
        return _safeNumber(a.price, Infinity) - _safeNumber(b.price, Infinity);
    })[0] || null;
}

function _knownDataTypes(preferredTypes) {
    const ids = Array.isArray(preferredTypes) && preferredTypes.length > 0 ? preferredTypes : DATA_TYPE_IDS;
    return ids.filter(id => DATA_TYPES[id]);
}

function _makeInventoryBase(ids) {
    const inventory = {};
    for (const id of ids) inventory[id] = 0;
    return inventory;
}

function _definePrimitiveCoercion(target, getTotal) {
    Object.defineProperty(target, Symbol.toPrimitive, {
        value: (hint) => (hint === 'string' ? String(getTotal()) : getTotal()),
        enumerable: false
    });
    Object.defineProperty(target, 'valueOf', {
        value: () => getTotal(),
        enumerable: false
    });
    Object.defineProperty(target, 'toString', {
        value: () => String(getTotal()),
        enumerable: false
    });
    return target;
}

function _normalizeLegacyMix(totalTB, ids = DATA_TYPE_IDS, weights = DEFAULT_DATA_WEIGHTS) {
    const normalizedIds = _knownDataTypes(ids);
    const base = _makeInventoryBase(normalizedIds);
    const total = Math.max(0, _safeNumber(totalTB, 0));
    if (total <= 0 || normalizedIds.length === 0) return base;

    const chosenWeights = normalizedIds.map(id => Math.max(0, _safeNumber(weights[id], 0)));
    const weightSum = chosenWeights.reduce((sum, value) => sum + value, 0) || 1;
    const raw = normalizedIds.map((id, index) => total * (chosenWeights[index] / weightSum));
    const counts = raw.map(value => Math.floor(value));
    let remainder = Math.round(total - counts.reduce((sum, value) => sum + value, 0));

    const ranked = raw
        .map((value, index) => ({ index, fraction: value - Math.floor(value), weight: chosenWeights[index] }))
        .sort((a, b) => b.fraction - a.fraction || b.weight - a.weight || a.index - b.index);

    let cursor = 0;
    while (remainder > 0 && ranked.length > 0) {
        counts[ranked[cursor % ranked.length].index] += 1;
        remainder -= 1;
        cursor += 1;
    }

    normalizedIds.forEach((id, index) => {
        base[id] = counts[index];
    });
    return base;
}

function _coerceInventory(input, ids = DATA_TYPE_IDS) {
    const normalizedIds = _knownDataTypes(ids);
    const inventory = _makeInventoryBase(normalizedIds);

    if (input == null) return inventory;

    if (typeof input === 'number') {
        return _normalizeLegacyMix(input, normalizedIds);
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
        return inventory;
    }

    const hasExplicitCounts = normalizedIds.some(id => input[id] != null);
    if (!hasExplicitCounts) {
        const legacyTotal = _safeNumber(input.totalTB ?? input.totalDataTB ?? input.totalData ?? input.amount ?? input.value, 0);
        if (legacyTotal > 0) {
            return _normalizeLegacyMix(legacyTotal, normalizedIds);
        }
        return inventory;
    }

    for (const id of normalizedIds) {
        inventory[id] = Math.max(0, _safeNumber(input[id], 0));
    }
    return inventory;
}

export function normalizeDataInventory(input, options = {}) {
    const ids = _knownDataTypes(options.dataTypes);
    const inventory = _coerceInventory(input, ids);
    const totalTB = getTotalDataTB(inventory);

    Object.defineProperties(inventory, {
        totalTB: {
            enumerable: false,
            configurable: true,
            get: () => getTotalDataTB(inventory)
        },
        totalDataTB: {
            enumerable: false,
            configurable: true,
            get: () => getTotalDataTB(inventory)
        }
    });

    return _definePrimitiveCoercion(inventory, () => getTotalDataTB(inventory));
}

export function normalizeLegacyDataInventory(input, options = {}) {
    return normalizeDataInventory(input, options);
}

export function getTotalDataTB(inventory) {
    if (inventory == null) return 0;
    if (typeof inventory === 'number') return Math.max(0, inventory);
    if (typeof inventory !== 'object') return 0;

    let total = 0;
    for (const id of DATA_TYPE_IDS) {
        total += Math.max(0, _safeNumber(inventory[id], 0));
    }
    return total;
}

function _normalizeGpuSlot(slot, options = {}) {
    if (!slot || typeof slot !== 'object') return null;
    const count = Math.max(0, Math.round(_safeNumber(slot.count, 0)));
    if (count <= 0) return null;

    let source = slot.source || 'owned';
    let location = slot.location || null;
    if (source === 'colocation') {
        source = 'owned';
        location ||= 'colocation';
    } else if (source === 'datacenter') {
        source = 'owned';
        location ||= 'datacenter';
    } else if (source === 'cloud') {
        location = 'cloud';
    } else if (!location) {
        location = options.defaultOwnedLocation || 'datacenter';
    }
    if (!['cloud', 'colocation', 'datacenter', 'warehouse'].includes(location)) {
        location = source === 'cloud' ? 'cloud' : (options.defaultOwnedLocation || 'datacenter');
    }
    const resolved = _resolveGpuEntry(slot.gpuId, {
        source,
        currentYear: options.currentYear,
        completedChipPrograms: options.completedChipPrograms,
        customGpus: options.customGpus
    });
    const {
        gpuId: _ignoredGpuId,
        count: _ignoredCount,
        source: _ignoredSource,
        location: _ignoredLocation,
        name: _ignoredName,
        releaseYear: _ignoredReleaseYear,
        ...rest
    } = slot;

    return {
        gpuId: resolved?.id || slot.gpuId || 'unknown',
        count,
        source,
        location,
        name: resolved?.name || slot.name || null,
        releaseYear: resolved?.releaseYear ?? slot.releaseYear ?? null,
        ...rest
    };
}

function _mergeGpuSlots(slots) {
    const merged = new Map();
    for (const slot of slots) {
        const key = [
            slot.source,
            slot.location || '',
            slot.gpuId,
            slot.provider || '',
            slot.rackId || '',
            slot.datacenterId || '',
            Number(slot.monthlyUnitCost || 0)
        ].join(':');
        const current = merged.get(key);
        if (current) {
            current.count += slot.count;
        } else {
            merged.set(key, { ...slot });
        }
    }
    return [...merged.values()];
}

export function normalizeGpuFleet(input, options = {}) {
    const currentYear = _safeNumber(options.currentYear, 2017);
    let slots = [];

    if (Array.isArray(input)) {
        slots = input;
    } else if (input && typeof input === 'object') {
        if (Array.isArray(input.gpuFleet)) {
            slots = input.gpuFleet;
        } else {
            const ownedGPUs = Math.max(0, Math.round(_safeNumber(input.ownedGPUs ?? input.owned ?? input.gpusOwned, 0)));
            const cloudGPUs = Math.max(0, Math.round(_safeNumber(input.cloudGPUs ?? input.cloud ?? input.rentedGPUs, 0)));
            const colocationGPUs = Math.max(0, Math.round(_safeNumber(input.colocationGPUs ?? input.colocation ?? 0, 0)));

            if (ownedGPUs > 0) slots.push({ gpuId: input.ownedGpuId, count: ownedGPUs, source: 'owned' });
            if (cloudGPUs > 0) slots.push({ gpuId: input.cloudGpuId, count: cloudGPUs, source: 'cloud' });
            if (colocationGPUs > 0) slots.push({ gpuId: input.colocationGpuId, count: colocationGPUs, source: 'owned', location: 'colocation' });
        }
    }

    const normalized = slots
        .map(slot => _normalizeGpuSlot(slot, {
            currentYear,
            completedChipPrograms: options.completedChipPrograms,
            customGpus: options.customGpus,
            defaultOwnedLocation: options.defaultOwnedLocation
        }))
        .filter(Boolean);

    return _mergeGpuSlots(normalized).sort((a, b) => {
        const sourceOrder = (GPU_SOURCE_ORDER[a.source] ?? 99) - (GPU_SOURCE_ORDER[b.source] ?? 99);
        if (sourceOrder !== 0) return sourceOrder;
        const locationOrder = (GPU_LOCATION_ORDER[a.location] ?? 99) - (GPU_LOCATION_ORDER[b.location] ?? 99);
        if (locationOrder !== 0) return locationOrder;
        const byYear = _safeNumber(b.releaseYear, -Infinity) - _safeNumber(a.releaseYear, -Infinity);
        if (byYear !== 0) return byYear;
        return String(a.gpuId).localeCompare(String(b.gpuId));
    });
}

export function normalizeLegacyGpuFleet(input, options = {}) {
    return normalizeGpuFleet(input, options);
}

export function getFleetStats(fleet, options = {}) {
    const normalizedFleet = normalizeGpuFleet(fleet, options);
    const currentYear = _safeNumber(options.currentYear, 2017);
    const electricityCostPerKwh = _safeNumber(options.electricityCostPerKwh, 0);
    const colocationMonthlyPerRack = _safeNumber(options.colocationMonthlyPerRack, 2000);
    const siliconBonuses = normalizeCustomSiliconBonuses(options.customSiliconBonuses || options.completedChipPrograms || []);
    const countryMods = _getCountryModifiers(options);
    const hardwareIntegrationMult = _bonusMultiplier(countryMods.hardwareIntegration, 0.8);
    const colocationCapacityPerRack = _safeNumber(options.colocation?.capacityPerRack, 50) || 50;
    const colocationMonthly = _safeNumber(options.colocation?.monthlyPerRack, colocationMonthlyPerRack);

    const stats = {
        fleet: normalizedFleet,
        ownedCount: 0,
        cloudCount: 0,
        colocationCount: 0,
        datacenterCount: 0,
        warehouseCount: 0,
        activeCount: 0,
        totalCount: 0,
        totalTFLOPS: 0,
        maxVRAM: 0,
        minVRAM: 0,
        monthlyCloudCost: 0,
        monthlyOwnedCost: 0,
        monthlyOwnedPowerCost: 0,
        monthlyColocationCost: 0,
        monthlyCost: 0,
        monthlyTotalCost: 0,
        gpuIds: [],
        bySource: {}
    };

    let minVRAM = Number.POSITIVE_INFINITY;
    const gpuIds = new Set();

    for (const slot of normalizedFleet) {
        const resolved = _resolveGpuEntry(slot.gpuId, {
            source: slot.source,
            currentYear,
            completedChipPrograms: options.completedChipPrograms,
            customGpus: options.customGpus
        });
        if (!resolved) continue;

        const count = Math.max(0, Math.round(_safeNumber(slot.count, 0)));
        if (count <= 0) continue;

        gpuIds.add(resolved.id);
        const locationKey = slot.location || (slot.source === 'cloud' ? 'cloud' : 'warehouse');
        stats.bySource[slot.source] = (stats.bySource[slot.source] || 0) + count;
        stats.bySource[locationKey] = (stats.bySource[locationKey] || 0) + count;
        stats.totalCount += count;
        const isActive = locationKey === 'cloud' || locationKey === 'colocation' || locationKey === 'datacenter';
        if (isActive) {
            stats.activeCount += count;
            stats.totalTFLOPS += _safeNumber(resolved.tflops, 0) * count;
            minVRAM = Math.min(minVRAM, _safeNumber(resolved.vram, 0));
            stats.maxVRAM = Math.max(stats.maxVRAM, _safeNumber(resolved.vram, 0));
        }

        if (slot.source === 'owned') {
            stats.ownedCount += count;
            if (locationKey === 'warehouse') {
                stats.warehouseCount += count;
            } else {
                if (resolved.monthlyOwnedCost != null) {
                    stats.monthlyOwnedCost += _safeNumber(resolved.monthlyOwnedCost, 0) * count;
                } else if (electricityCostPerKwh > 0 && resolved.powerWatt != null) {
                    stats.monthlyOwnedCost += (resolved.powerWatt / 1000) * 24 * 30 * electricityCostPerKwh * count;
                } else {
                    stats.monthlyOwnedCost += BALANCE.ECONOMY.GPU_POWER_COST * count;
                }
                if (locationKey === 'colocation') stats.colocationCount += count;
                if (locationKey === 'datacenter') stats.datacenterCount += count;
            }
        } else if (slot.source === 'cloud' || locationKey === 'cloud') {
            stats.cloudCount += count;
            if (resolved.monthlyCloudCost != null) {
                stats.monthlyCloudCost += _safeNumber(resolved.monthlyCloudCost, 0) * count;
            } else if (resolved.cloudCostPerHour != null) {
                stats.monthlyCloudCost += _safeNumber(resolved.cloudCostPerHour, 0) * 24 * 30 * count;
            } else {
                stats.monthlyCloudCost += BALANCE.ECONOMY.GPU_CLOUD_MONTHLY * count;
            }
        }
    }

    stats.minVRAM = minVRAM === Number.POSITIVE_INFINITY ? 0 : minVRAM;
    stats.totalTFLOPS *= siliconBonuses.computeMult * hardwareIntegrationMult;
    stats.monthlyColocationCost = Math.ceil(stats.colocationCount / colocationCapacityPerRack) * colocationMonthly;
    stats.monthlyOwnedCost = Math.round(stats.monthlyOwnedCost * siliconBonuses.powerCostMult);
    stats.monthlyColocationCost = Math.round(stats.monthlyColocationCost * siliconBonuses.powerCostMult);
    stats.monthlyOwnedPowerCost = stats.monthlyOwnedCost;
    stats.monthlyCost = Math.round(stats.monthlyCloudCost + stats.monthlyOwnedCost + stats.monthlyColocationCost);
    stats.monthlyTotalCost = stats.monthlyCost;
    stats.gpuIds = [...gpuIds];
    return stats;
}

function _normalizeMixMap(mix) {
    const entries = Object.entries(mix || {})
        .map(([key, value]) => [key, Math.max(0, _safeNumber(value, 0))])
        .filter(([, value]) => value > 0);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (total <= 0) return {};
    return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

export function calculateDataMixFit(architectureOrId, targetMixOrInventory, actualInventoryMaybe) {
    const architecture = typeof architectureOrId === 'string'
        ? (MODEL_ARCHITECTURES[architectureOrId] || {})
        : (architectureOrId || {});

    let targetMix = targetMixOrInventory;
    let actualInventory = actualInventoryMaybe;

    if (actualInventoryMaybe === undefined) {
        actualInventory = targetMixOrInventory;
        targetMix = architecture.optimalDataMix || architecture.dataMix || architecture.dataTypes || {};
    }

    if (Array.isArray(targetMix)) {
        targetMix = Object.fromEntries(targetMix.map(id => [id, 1]));
    } else if (Array.isArray(architecture.dataTypes) && (!targetMix || Object.keys(targetMix).length === 0)) {
        targetMix = Object.fromEntries(architecture.dataTypes.map(id => [id, 1]));
    } else if (!targetMix || typeof targetMix !== 'object') {
        targetMix = architecture.optimalDataMix || Object.fromEntries((architecture.dataTypes || []).map(id => [id, 1]));
    }

    const required = _normalizeMixMap(targetMix);
    const actual = normalizeDataInventory(actualInventory);
    const actualTotal = getTotalDataTB(actual);
    const requiredTotal = Object.values(required).reduce((sum, value) => sum + value, 0);

    if (actualTotal <= 0 || requiredTotal <= 0) return 0;

    const allKeys = new Set([...Object.keys(required), ...DATA_TYPE_IDS]);
    let deviation = 0;
    for (const key of allKeys) {
        const requiredShare = required[key] || 0;
        const actualShare = _safeNumber(actual[key], 0) / actualTotal;
        deviation += Math.abs(requiredShare - actualShare);
    }

    const alignment = _clamp(1 - deviation / 2, 0, 1);
    const coverage = _clamp(actualTotal / requiredTotal, 0, 1);
    return _clamp(alignment * coverage, 0, 1);
}

export function estimateTrainingDays({
    scale,
    architecture,
    fleetStats,
    dataFit = null,
    dataInventory = null,
    customSiliconBonuses = null,
    availableTFLOPS = null,
    computeBudget = null
} = {}) {
    if (!scale) return null;

    const fleet = fleetStats || getFleetStats([]);
    if (fleet.maxVRAM > 0 && scale.minVRAM && fleet.maxVRAM < scale.minVRAM) return null;

    const arch = architecture || {};
    const efficiency = Math.max(0.05, _safeNumber(arch.trainingEfficiency, 1));
    const scaleDays = Math.max(1, _safeNumber(scale.trainingDays, scale.computeReq || 1));
    const totalTFLOPS = Math.max(0.01, _safeNumber(fleet.totalTFLOPS, 0));
    const vramPenalty = scale.minVRAM && fleet.maxVRAM > 0
        ? Math.max(1, scale.minVRAM / fleet.maxVRAM)
        : 1;
    let resolvedDataFit = 1;
    if (dataFit != null) {
        resolvedDataFit = 1 / Math.max(0.25, _safeNumber(dataFit, 1));
    }
    if (dataFit == null && dataInventory) {
        const mixFit = calculateDataMixFit(arch, dataInventory);
        resolvedDataFit = 1 / Math.max(0.25, mixFit || 1);
    }

    const budgetedTFLOPS = Math.max(
        0.01,
        _safeNumber(
            availableTFLOPS
            ?? computeBudget?.availableTFLOPS
            ?? computeBudget?.totalTFLOPS
            ?? totalTFLOPS,
            totalTFLOPS
        )
    );
    const baselineFactor = REFERENCE_FLEET_TFLOPS / budgetedTFLOPS;
    const siliconBonuses = normalizeCustomSiliconBonuses(customSiliconBonuses);
    return Math.max(0.1, scaleDays * baselineFactor / efficiency * vramPenalty * resolvedDataFit * siliconBonuses.trainingSpeedMult);
}

function _ensureResourceAccessors(resources) {
    if (!resources || Object.getOwnPropertyDescriptor(resources, 'data')?.get) return;

    let totalData = _safeNumber(resources.data ?? resources.totalData, 0);
    Object.defineProperty(resources, 'data', {
        enumerable: true,
        configurable: true,
        get: () => totalData,
        set: (value) => {
            totalData = getTotalDataTB(value);
        }
    });
    Object.defineProperty(resources, 'totalData', {
        enumerable: true,
        configurable: true,
        get: () => totalData,
        set: (value) => {
            totalData = getTotalDataTB(value);
        }
    });
    totalData = getTotalDataTB(totalData);
}

function _ensureEconomyAccessors(economy, resources, currentYear = 2017) {
    if (!economy || Object.getOwnPropertyDescriptor(economy, 'dataAssets')?.get) return;

    let dataAssets = normalizeDataInventory(economy.dataAssets ?? resources?.data ?? 0);
    let ownedGPUs = Math.max(0, Math.round(_safeNumber(economy.ownedGPUs, 0)));
    let cloudGPUs = Math.max(0, Math.round(_safeNumber(economy.cloudGPUs, 0)));
    let gpuFleet = normalizeGpuFleet(economy.gpuFleet ?? {
        ownedGPUs,
        cloudGPUs,
        currentYear
    }, { currentYear, defaultOwnedLocation: 'datacenter' });

    const syncFleetFromCounts = () => {
        gpuFleet = normalizeGpuFleet({
            ownedGPUs,
            cloudGPUs,
            currentYear
        }, {
            currentYear,
            defaultOwnedLocation: 'datacenter',
            completedChipPrograms: economy.completedChipPrograms,
            customGpus: economy.customGpus
        });
        const stats = getFleetStats(gpuFleet, {
            currentYear,
            completedChipPrograms: economy.completedChipPrograms,
            customGpus: economy.customGpus,
            customSiliconBonuses: economy.customSiliconBonuses
        });
        if (resources) resources.computing = stats.totalCount;
    };

    Object.defineProperty(economy, 'dataAssets', {
        enumerable: true,
        configurable: true,
        get: () => dataAssets,
        set: (value) => {
            dataAssets = normalizeDataInventory(value);
            if (resources) {
                const total = getTotalDataTB(dataAssets);
                resources.data = total;
                resources.totalData = total;
            }
        }
    });

    Object.defineProperty(economy, 'totalDataTB', {
        enumerable: true,
        configurable: true,
        get: () => getTotalDataTB(dataAssets),
        set: (value) => {
            dataAssets = normalizeDataInventory(value);
            if (resources) {
                const total = getTotalDataTB(dataAssets);
                resources.data = total;
                resources.totalData = total;
            }
        }
    });

    Object.defineProperty(economy, 'ownedGPUs', {
        enumerable: true,
        configurable: true,
        get: () => ownedGPUs,
        set: (value) => {
            ownedGPUs = Math.max(0, Math.round(_safeNumber(value, 0)));
            syncFleetFromCounts();
        }
    });

    Object.defineProperty(economy, 'cloudGPUs', {
        enumerable: true,
        configurable: true,
        get: () => cloudGPUs,
        set: (value) => {
            cloudGPUs = Math.max(0, Math.round(_safeNumber(value, 0)));
            syncFleetFromCounts();
        }
    });

    Object.defineProperty(economy, 'gpuFleet', {
        enumerable: true,
        configurable: true,
        get: () => gpuFleet,
        set: (value) => {
            gpuFleet = normalizeGpuFleet(value, {
                currentYear,
                defaultOwnedLocation: 'datacenter',
                completedChipPrograms: economy.completedChipPrograms,
                customGpus: economy.customGpus
            });
            const stats = getFleetStats(gpuFleet, {
                currentYear,
                completedChipPrograms: economy.completedChipPrograms,
                customGpus: economy.customGpus,
                customSiliconBonuses: economy.customSiliconBonuses
            });
            ownedGPUs = stats.ownedCount;
            cloudGPUs = stats.cloudCount;
            if (resources) resources.computing = stats.totalCount;
        }
    });

    economy.dataAssets = dataAssets;
    economy.ownedGPUs = ownedGPUs;
    economy.cloudGPUs = cloudGPUs;
    economy.gpuFleet = gpuFleet;
}

export function syncStateEconomyCompatibility(state, currentYear = 2017) {
    if (!state || typeof state !== 'object') return state;
    state.resources ||= {};
    state.economy ||= {};

    _ensureResourceAccessors(state.resources);
    _ensureEconomyAccessors(state.economy, state.resources, currentYear);

    const completedChipPrograms = state.economy.completedChipPrograms || state.economy.chipPrograms || [];
    const customGpus = Array.isArray(state.economy.customGpus) ? state.economy.customGpus : [];
    const customSiliconBonuses = normalizeCustomSiliconBonuses(state.economy.customSiliconBonuses || completedChipPrograms);

    const dataSeed = state.economy.dataAssets ?? state.resources.data ?? 0;
    state.economy.dataAssets = dataSeed;

    const fleetStatsBeforeSync = getFleetStats(state.economy.gpuFleet, {
        currentYear,
        completedChipPrograms,
        customGpus,
        customSiliconBonuses
    });
    const hasLegacyFleetMismatch = fleetStatsBeforeSync.ownedCount !== state.economy.ownedGPUs
        || fleetStatsBeforeSync.cloudCount !== state.economy.cloudGPUs;

    const fleetSeed = hasLegacyFleetMismatch
        ? {
            ownedGPUs: state.economy.ownedGPUs ?? 0,
            cloudGPUs: state.economy.cloudGPUs ?? state.resources.computing ?? 0,
            currentYear
        }
        : (state.economy.gpuFleet ?? {
            ownedGPUs: state.economy.ownedGPUs ?? 0,
            cloudGPUs: state.economy.cloudGPUs ?? state.resources.computing ?? 0,
            currentYear
        });
    state.economy.gpuFleet = normalizeGpuFleet(fleetSeed, {
        currentYear,
        defaultOwnedLocation: 'datacenter',
        completedChipPrograms,
        customGpus
    });

    const totalData = getTotalDataTB(state.economy.dataAssets);
    state.resources.data = totalData;
    state.resources.totalData = totalData;

    const fleetStats = getFleetStats(state.economy.gpuFleet, {
        currentYear,
        completedChipPrograms,
        customGpus,
        customSiliconBonuses
    });
    state.resources.computing = fleetStats.totalCount;

    return state;
}
