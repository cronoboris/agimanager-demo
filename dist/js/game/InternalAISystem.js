const SLOT_DEFINITIONS = {
    research_assist: {
        id: 'research_assist',
        name: '연구 지원',
        capabilityWeights: { reasoning: 0.4, math: 0.3, coding: 0.3 },
        maxBonus: 0.25
    },
    coding_assist: {
        id: 'coding_assist',
        name: '코딩 지원',
        capabilityWeights: { coding: 0.6, reasoning: 0.4 },
        maxBonus: 0.2
    },
    data_refine: {
        id: 'data_refine',
        name: '데이터 정제',
        capabilityWeights: { language: 0.5, reasoning: 0.5 },
        maxBonus: 0.15
    },
    business_assist: {
        id: 'business_assist',
        name: '경영 지원',
        capabilityWeights: { language: 0.5, reasoning: 0.5 },
        maxBonus: 0.15
    },
    safety_audit: {
        id: 'safety_audit',
        name: '안전 감사',
        capabilityWeights: { safety: 0.6, reasoning: 0.4 },
        maxBonus: 0.2
    }
};

const SOURCE_MULTIPLIERS = {
    own: 1,
    competitor: 0.8,
    opensource: 0.7,
    none: 0
};

const SOURCE_ALIASES = {
    open_source: 'opensource',
    competitor_api: 'competitor',
    openSource: 'opensource',
    api: 'competitor'
};

function _clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function _normalizeSource(source, fallback = 'none') {
    const raw = typeof source === 'string' ? source.trim() : '';
    if (!raw) return fallback;
    const lower = raw.toLowerCase();
    return SOURCE_ALIASES[lower] || lower;
}

function _getCapabilityScore(model = {}, weights = {}) {
    const caps = model.capabilities || {};
    const keys = Object.keys(weights);
    if (keys.length === 0) {
        return Number(model.performance ?? model.compositeScore ?? 0) || 0;
    }

    let total = 0;
    for (const capId of keys) {
        total += Number(caps[capId]) || 0;
    }

    if (keys.length <= 0) {
        return Number(model.performance ?? model.compositeScore ?? 0) || 0;
    }

    const capabilityScore = total / keys.length;
    if (capabilityScore > 0) return capabilityScore;
    return Number(model.performance ?? model.compositeScore ?? 0) || 0;
}

function _defaultSlotState(slotId) {
    return {
        slotId,
        modelId: null,
        modelName: null,
        source: 'none',
        monthlyCost: 0,
        bonus: 0,
        model: null
    };
}

function _normalizeSlotEntry(slotId, entry = {}) {
    const base = _defaultSlotState(slotId);
    const model = entry.model ? resolveInternalAIModelSource(entry.model, entry.modelContext) : null;
    const source = model?.source || _normalizeSource(entry.source, 'none');
    return {
        ...base,
        ..._clone(entry),
        slotId,
        source,
        model,
        modelId: entry.modelId ?? model?.id ?? null,
        modelName: entry.modelName ?? model?.name ?? null,
        monthlyCost: Number.isFinite(Number(entry.monthlyCost)) ? Number(entry.monthlyCost) : 0,
        bonus: Number.isFinite(Number(entry.bonus)) ? Number(entry.bonus) : 0
    };
}

export const INTERNAL_AI_SLOTS = Object.freeze([
    SLOT_DEFINITIONS.research_assist,
    SLOT_DEFINITIONS.coding_assist,
    SLOT_DEFINITIONS.data_refine,
    SLOT_DEFINITIONS.business_assist,
    SLOT_DEFINITIONS.safety_audit
]);

export { SLOT_DEFINITIONS as INTERNAL_AI_SLOT_DEFS };

export const INTERNAL_AI_SOURCES = Object.freeze({
    OWN: 'own',
    COMPETITOR: 'competitor',
    OPENSOURCE: 'opensource',
    NONE: 'none'
});

export function createDefaultInternalAIState() {
    return {
        slots: Object.fromEntries(
            INTERNAL_AI_SLOTS.map(slot => [slot.id, _defaultSlotState(slot.id)])
        ),
        competitorSubscriptions: [],
        totalMonthlyCost: 0
    };
}

export function resolveInternalAIModelSource(model = {}, context = {}) {
    const rawSource = _normalizeSource(
        model.source ?? context.source ?? '',
        'none'
    );

    let source = rawSource;
    if (source === 'none') {
        if (model.deploymentStrategy === 'open_source' || model.isOpenSource || model.license || model.openSource) {
            source = 'opensource';
        } else if (
            model.competitorId != null ||
            model.provider === 'competitor' ||
            model.apiProvider ||
            model.competitorModel
        ) {
            source = 'competitor';
        } else if (
            model.deployed === true ||
            model.deploymentStrategy ||
            model.isPlayerModel ||
            model.owner === 'player' ||
            model.source === 'own'
        ) {
            source = 'own';
        }
    }

    const normalizedCapabilities = _clone(model.capabilities) || {};
    const performance = Number(model.performance ?? model.compositeScore ?? context.performance ?? 0) || 0;
    const inferenceCost = Number(model.inferenceCost ?? context.inferenceCost ?? 0) || 0;
    const relation = Number(context.relation ?? model.relation ?? 0) || 0;

    return {
        id: model.id ?? context.modelId ?? null,
        name: model.name ?? context.modelName ?? model.id ?? 'Unknown Model',
        source,
        capabilities: normalizedCapabilities,
        performance,
        inferenceCost,
        relation,
        license: model.license ?? null,
        competitorId: model.competitorId ?? context.competitorId ?? null,
        monthlyCost: Number(model.monthlyCost ?? context.monthlyCost ?? 0) || 0,
        raw: _clone(model)
    };
}

export function calculateSlotBonus(slotId, model = {}, context = {}) {
    const slot = SLOT_DEFINITIONS[slotId];
    if (!slot || !model) return 0;

    const normalized = model.source ? model : resolveInternalAIModelSource(model, context);
    const capabilityScore = _getCapabilityScore(normalized, slot.capabilityWeights);
    const sourceMultiplier = SOURCE_MULTIPLIERS[normalized.source] ?? 1;
    const maxBonus = slot.maxBonus ?? 0.25;
    const bonus = (capabilityScore / 100) * maxBonus * sourceMultiplier;
    return Math.max(0, Math.min(maxBonus, Number(bonus.toFixed(6))));
}

export function calculateSlotMonthlyCost(slotId, model = {}, context = {}) {
    const slot = SLOT_DEFINITIONS[slotId];
    if (!slot || !model) return 0;

    const normalized = model.source ? model : resolveInternalAIModelSource(model, context);
    if (normalized.source === 'competitor') {
        const relation = Number(context.relation ?? normalized.relation ?? 0) || 0;
        const performance = Number(normalized.performance || 0);
        return Math.max(0, Math.round(performance * 500 * (1 - relation / 200)));
    }

    const baseInferenceCost = Number(normalized.inferenceCost || normalized.monthlyCost || 0);
    if (baseInferenceCost > 0) {
        return Math.max(0, Math.round(baseInferenceCost * 0.3));
    }

    const performanceFallback = Number(normalized.performance || 0);
    if (performanceFallback > 0) {
        return Math.max(0, Math.round(performanceFallback * 150 * 0.3));
    }

    return 0;
}

function _normalizeInternalAIShape(input = {}) {
    const base = createDefaultInternalAIState();
    const source = input && typeof input === 'object' ? input : {};

    if (source.slots && typeof source.slots === 'object') {
        for (const slotId of Object.keys(base.slots)) {
            if (source.slots[slotId]) {
                base.slots[slotId] = _normalizeSlotEntry(slotId, source.slots[slotId]);
            }
        }
    }

    if (Array.isArray(source.competitorSubscriptions)) {
        base.competitorSubscriptions = source.competitorSubscriptions.map(entry => ({
            ..._clone(entry),
            source: 'competitor',
            monthlyCost: Number(entry?.monthlyCost || 0) || 0
        }));
    }

    if (Number.isFinite(Number(source.totalMonthlyCost))) {
        base.totalMonthlyCost = Number(source.totalMonthlyCost);
    }

    return base;
}

export function assignInternalAISlot(internalAI, slotId, model, context = {}) {
    const state = normalizeInternalAIState(internalAI);
    const slot = state.slots[slotId];
    if (!slot) return state;

    const normalizedModel = resolveInternalAIModelSource(model, context);
    slot.model = normalizedModel;
    slot.modelId = normalizedModel.id;
    slot.modelName = normalizedModel.name;
    slot.source = normalizedModel.source;
    slot.bonus = calculateSlotBonus(slotId, normalizedModel, context);
    slot.monthlyCost = calculateSlotMonthlyCost(slotId, normalizedModel, context);
    recalculateInternalAITotalMonthlyCost(state);
    if (internalAI && typeof internalAI === 'object') {
        internalAI.slots = state.slots;
        internalAI.competitorSubscriptions = state.competitorSubscriptions;
        internalAI.totalMonthlyCost = state.totalMonthlyCost;
        return internalAI;
    }
    return state;
}

export function clearInternalAISlot(internalAI, slotId) {
    const state = normalizeInternalAIState(internalAI);
    const slot = state.slots[slotId];
    if (!slot) return state;

    state.slots[slotId] = _defaultSlotState(slotId);
    recalculateInternalAITotalMonthlyCost(state);
    if (internalAI && typeof internalAI === 'object') {
        internalAI.slots = state.slots;
        internalAI.competitorSubscriptions = state.competitorSubscriptions;
        internalAI.totalMonthlyCost = state.totalMonthlyCost;
        return internalAI;
    }
    return state;
}

export function recalculateInternalAITotalMonthlyCost(internalAI) {
    const state = internalAI && typeof internalAI === 'object' ? internalAI : _normalizeInternalAIShape(internalAI);
    if (!state.slots || typeof state.slots !== 'object' || !Array.isArray(state.competitorSubscriptions)) {
        const shaped = _normalizeInternalAIShape(state);
        state.slots = shaped.slots;
        state.competitorSubscriptions = shaped.competitorSubscriptions;
        state.totalMonthlyCost = shaped.totalMonthlyCost;
    }

    let total = 0;

    for (const slotId of Object.keys(state.slots)) {
        const slot = state.slots[slotId];
        if (slot.model) {
            slot.model = resolveInternalAIModelSource(slot.model, slot.modelContext || {});
            slot.source = slot.model.source;
            slot.modelId = slot.model.id;
            slot.modelName = slot.model.name;
            slot.bonus = calculateSlotBonus(slotId, slot.model, slot.modelContext || {});
            slot.monthlyCost = calculateSlotMonthlyCost(slotId, slot.model, slot.modelContext || {});
        }
        total += Number(slot.monthlyCost || 0);
    }

    for (const sub of state.competitorSubscriptions) {
        total += Number(sub?.monthlyCost || 0);
    }

    state.totalMonthlyCost = Math.max(0, Math.round(total));
    return state.totalMonthlyCost;
}

export function normalizeInternalAIState(input = {}) {
    const base = _normalizeInternalAIShape(input);
    recalculateInternalAITotalMonthlyCost(base);
    return base;
}

export function getInternalAISlotState(internalAI, slotId) {
    const state = normalizeInternalAIState(internalAI);
    return state.slots?.[slotId] || _defaultSlotState(slotId);
}

export function getInternalAIBonus(internalAI, slotId) {
    return Math.max(0, Number(getInternalAISlotState(internalAI, slotId)?.bonus || 0));
}
