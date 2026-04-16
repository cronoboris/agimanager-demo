import { getInternalAIBonus } from './InternalAISystem.js';
const CHIP_PROGRAM_PHASES = ['taskforce', 'workload', 'prototype', 'pilot', 'deployed'];
const DEFAULT_CUSTOM_SILICON_BONUSES = {
    trainingSpeedMult: 1,
    inferenceCostMult: 1,
    powerCostMult: 1,
    computeMult: 1,
    gpuPriceShockMult: 1
};
const DEFAULT_EXPECTED_BENEFITS = {
    trainingSpeedMult: 1,
    inferenceCostMult: 1,
    powerCostMult: 1,
    computeMult: 1,
    gpuPriceShockMult: 1
};
const DEFAULT_RISK_PROFILE = {
    delay: 0.2,
    underperform: 0.15,
    respin: 0.1
};
const PHASE_BASE_PROGRESS = {
    taskforce: 20,
    workload: 16,
    prototype: 12,
    pilot: 14,
    deployed: 0
};
const FOUNDRY_REQUIREMENTS = {
    external: 'foundry_external',
    partner: 'foundry_partnership',
    own: 'own_fab'
};
const GENERATION_RULES = {
    1: {
        requiredTech: 'custom_ai_chip',
        requiredHwTalents: 2,
        requiredPreviousCompletion: false,
        defaultFoundryMode: 'external',
        baseStartCost: 500_000,
        monthlyCost: 100_000,
        durationMultiplier: 1,
        bonusMultiplier: 1
    },
    2: {
        requiredTech: 'custom_asic',
        requiredHwTalents: 4,
        requiredPreviousCompletion: true,
        defaultFoundryMode: 'partner',
        baseStartCost: 2_000_000,
        monthlyCost: 200_000,
        durationMultiplier: 1.5,
        bonusMultiplier: 2
    }
};
const CHIP_PROGRAM_TEMPLATES = [
    {
        id: 'inference_accelerator_v1',
        generation: 1,
        type: 'inference_accelerator',
        targetWorkload: 'llm_inference',
        defaultFoundryMode: 'external',
        defaultTargetTFLOPS: 200,
        minTargetTFLOPS: 100,
        maxTargetTFLOPS: 500,
        defaultTargetVRAM: 96,
        minTargetVRAM: 32,
        maxTargetVRAM: 128
    },
    {
        id: 'balanced_accelerator_v1',
        generation: 1,
        type: 'balanced_internal',
        targetWorkload: 'balanced_internal',
        defaultFoundryMode: 'external',
        defaultTargetTFLOPS: 180,
        minTargetTFLOPS: 100,
        maxTargetTFLOPS: 420,
        defaultTargetVRAM: 80,
        minTargetVRAM: 32,
        maxTargetVRAM: 128
    },
    {
        id: 'training_accelerator_v1',
        generation: 1,
        type: 'training_accelerator',
        targetWorkload: 'llm_training',
        defaultFoundryMode: 'partner',
        defaultTargetTFLOPS: 260,
        minTargetTFLOPS: 120,
        maxTargetTFLOPS: 550,
        defaultTargetVRAM: 128,
        minTargetVRAM: 64,
        maxTargetVRAM: 160
    },
    {
        id: 'inference_accelerator_v2',
        generation: 2,
        type: 'inference_accelerator',
        targetWorkload: 'llm_inference',
        defaultFoundryMode: 'partner',
        defaultTargetTFLOPS: 600,
        minTargetTFLOPS: 300,
        maxTargetTFLOPS: 1200,
        defaultTargetVRAM: 128,
        minTargetVRAM: 64,
        maxTargetVRAM: 192
    }
];
const CHIP_PHASE_MONTHS = {
    taskforce: 1,
    workload: 2,
    prototype: 6,
    pilot: 3
};
const CHIP_PHASE_BURN_MULT = {
    taskforce: 0.7,
    workload: 1,
    prototype: 1.35,
    pilot: 1.1
};
const FOUNDRY_PROGRESS_MULT = {
    external: 1,
    partner: 1.12,
    own: 1.2
};
const FOUNDRY_RISK_MOD = {
    external: { delay: 0.1, underperform: 0.02, respin: 0.03 },
    partner: { delay: 0, underperform: -0.02, respin: -0.02 },
    own: { delay: -0.1, underperform: -0.03, respin: -0.03 }
};

function _safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function _round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function _normalizeList(input) {
    if (!Array.isArray(input)) return [];
    return [...new Set(input.map(value => String(value)).filter(Boolean))];
}

function _normalizeBonuses(input = {}, fallback = DEFAULT_EXPECTED_BENEFITS) {
    return {
        trainingSpeedMult: _safeNumber(input.trainingSpeedMult, fallback.trainingSpeedMult ?? 1),
        inferenceCostMult: _safeNumber(input.inferenceCostMult, fallback.inferenceCostMult ?? 1),
        powerCostMult: _safeNumber(input.powerCostMult, fallback.powerCostMult ?? 1),
        computeMult: _safeNumber(input.computeMult, fallback.computeMult ?? 1),
        gpuPriceShockMult: _safeNumber(input.gpuPriceShockMult, fallback.gpuPriceShockMult ?? 1)
    };
}

function _normalizeRiskProfile(input = {}) {
    return {
        delay: _safeNumber(input.delay, DEFAULT_RISK_PROFILE.delay),
        underperform: _safeNumber(input.underperform, DEFAULT_RISK_PROFILE.underperform),
        respin: _safeNumber(input.respin, DEFAULT_RISK_PROFILE.respin)
    };
}

function _normalizeProgramStatus(value) {
    const status = String(value || 'active');
    return ['draft', 'active', 'paused', 'completed', 'failed'].includes(status) ? status : 'active';
}

function _normalizeGeneration(value) {
    const generation = Math.max(1, Math.round(_safeNumber(value, 1)));
    return generation > 1 ? 2 : 1;
}

function _resolveFoundryMode(generation, inputMode) {
    if (inputMode && FOUNDRY_REQUIREMENTS[inputMode]) return inputMode;
    return GENERATION_RULES[generation]?.defaultFoundryMode || 'external';
}

function _getRequirementRule(generation = 1) {
    return GENERATION_RULES[_normalizeGeneration(generation)] || GENERATION_RULES[1];
}

function _getTemplate(templateId) {
    return CHIP_PROGRAM_TEMPLATES.find(template => template.id === templateId) || null;
}

function _pickBestHwTalents(state, count) {
    const talents = Array.isArray(state?.talents) ? state.talents : [];
    return talents
        .filter(talent => Array.isArray(talent?.specialty) && talent.specialty.includes('hw') && !talent.assignment)
        .sort((a, b) => (_safeNumber(b?.stats?.research, 0) + _safeNumber(b?.level, 0)) - (_safeNumber(a?.stats?.research, 0) + _safeNumber(a?.level, 0)))
        .slice(0, Math.max(0, count));
}

function _getFoundryRequirement(foundryMode = 'external') {
    return FOUNDRY_REQUIREMENTS[foundryMode] || FOUNDRY_REQUIREMENTS.external;
}

function _getTalentHwCount(talents = []) {
    return countChipProgramHwTalents(talents);
}

function _getCompletedGenerationCount(state, generation) {
    const completed = Array.isArray(state?.economy?.completedChipPrograms)
        ? state.economy.completedChipPrograms
        : [];
    return completed.filter(program => {
        const programGeneration = _normalizeGeneration(program?.generation);
        const status = String(program?.status || program?.deploymentStatus || '');
        return programGeneration < generation && (status === 'completed' || status === 'deployed' || status === 'pilot' || status === 'active');
    }).length;
}

function _getProgramCount(state) {
    return Array.isArray(state?.economy?.chipPrograms) ? state.economy.chipPrograms.length : 0;
}

function _getActiveProgramCount(state) {
    const chipPrograms = Array.isArray(state?.economy?.chipPrograms) ? state.economy.chipPrograms : [];
    return chipPrograms.filter(program => _normalizeProgramStatus(program?.status) === 'active').length;
}

function _clampProgress(value) {
    return Math.min(100, Math.max(0, _safeNumber(value, 0)));
}

function _phaseFactor(phase) {
    return PHASE_BASE_PROGRESS[phase] ?? PHASE_BASE_PROGRESS.taskforce;
}

function _getCountryModifiers(context = {}) {
    return context.countryModifiers
        || context.state?.player?.countryModifiers
        || globalThis.window?.game?.state?.player?.countryModifiers
        || {};
}

function _getBenefitQualityBoost(context = {}) {
    const countryMods = _getCountryModifiers(context);
    const lithography = Math.max(1, _safeNumber(countryMods.lithography, 1));
    const semiconductor = Math.max(1, _safeNumber(countryMods.semiconductor, 1));
    return Math.max(1, 1 + ((lithography - 1) + (semiconductor - 1)) / 2);
}

function _boostChipProgramBenefits(benefits, qualityBoost = 1) {
    const boost = Math.max(1, _safeNumber(qualityBoost, 1));
    return _normalizeBonuses({
        trainingSpeedMult: _round(1 - ((1 - benefits.trainingSpeedMult) * boost), 3),
        inferenceCostMult: _round(1 - ((1 - benefits.inferenceCostMult) * boost), 3),
        powerCostMult: _round(1 - ((1 - benefits.powerCostMult) * boost), 3),
        computeMult: _round(1 + ((benefits.computeMult - 1) * boost), 3),
        gpuPriceShockMult: _round(1 - ((1 - benefits.gpuPriceShockMult) * boost), 3)
    }, DEFAULT_EXPECTED_BENEFITS);
}

export function normalizeChipProgram(input = {}, options = {}) {
    const generation = _normalizeGeneration(input.generation ?? options.generation ?? 1);
    const targetWorkload = String(input.targetWorkload || options.targetWorkload || (generation === 1 ? 'llm_inference' : 'balanced_internal'));
    const type = String(input.type || options.type || (targetWorkload.includes('training') ? 'training_accelerator' : targetWorkload === 'balanced_internal' ? 'balanced_internal' : 'inference_accelerator'));
    const foundryMode = _resolveFoundryMode(generation, input.foundryMode || options.foundryMode);
    const template = _getTemplate(input.templateId || options.templateId || '');
    const targetTFLOPS = Math.max(0, _safeNumber(input.targetTFLOPS ?? options.targetTFLOPS ?? template?.defaultTargetTFLOPS, 0));
    const targetVRAM = Math.max(0, _safeNumber(input.targetVRAM ?? options.targetVRAM ?? template?.defaultTargetVRAM, 0));
    const powerEfficiency = String(input.powerEfficiency || options.powerEfficiency || 'balanced');
    const assignedTalents = _normalizeList(input.assignedTalents);
    const phase = CHIP_PROGRAM_PHASES.includes(input.phase) ? input.phase : 'taskforce';
    const phaseProgress = _clampProgress(input.phaseProgress ?? input.progress ?? 0);
    const phaseIndex = Math.max(0, CHIP_PROGRAM_PHASES.indexOf(phase));
    const phaseDurationMonths = Math.max(1, Math.round(_safeNumber(input.phaseDurationMonths, options.phaseDurationMonths ?? CHIP_PHASE_MONTHS[phase] ?? 1)));
    const monthlyBurn = Math.max(0, Math.round(_safeNumber(input.monthlyBurn ?? options.monthlyBurn ?? 0)));

    return {
        ...input,
        id: String(input.id || options.id || `chip_prog_${generation}`),
        templateId: String(input.templateId || options.templateId || template?.id || ''),
        generation,
        type,
        targetWorkload,
        phase,
        phaseIndex,
        phaseProgress,
        progress: _clampProgress(input.progress ?? phaseProgress),
        assignedTalents,
        assignedTalentCount: Math.max(assignedTalents.length, Math.round(_safeNumber(input.assignedTalentCount, assignedTalents.length))),
        monthlyBurn,
        startCost: Math.max(0, Math.round(_safeNumber(input.startCost ?? options.startCost, 0))),
        totalSpent: Math.max(0, Math.round(_safeNumber(input.totalSpent ?? options.totalSpent, 0))),
        expectedBenefits: _normalizeBonuses(input.expectedBenefits, DEFAULT_EXPECTED_BENEFITS),
        currentBenefits: _normalizeBonuses(input.currentBenefits ?? input.expectedBenefits, DEFAULT_EXPECTED_BENEFITS),
        riskProfile: _normalizeRiskProfile(input.riskProfile),
        foundryMode,
        targetTFLOPS,
        targetVRAM,
        powerEfficiency,
        phaseDurationMonths,
        monthsElapsed: Math.max(0, Math.round(_safeNumber(input.monthsElapsed, 0))),
        phaseMonthsElapsed: Math.max(0, Math.round(_safeNumber(input.phaseMonthsElapsed, 0))),
        checkpoints: {
            delayChecked: Boolean(input.checkpoints?.delayChecked),
            underperformChecked: Boolean(input.checkpoints?.underperformChecked),
            respinChecked: Boolean(input.checkpoints?.respinChecked)
        },
        notes: Array.isArray(input.notes) ? [...input.notes] : [],
        outcomeTier: String(input.outcomeTier || 'expected'),
        status: _normalizeProgramStatus(input.status ?? 'active')
    };
}

export function createChipProgram(input = {}, options = {}) {
    const generation = _normalizeGeneration(input.generation ?? options.generation ?? 1);
    const phase = input.phase || 'taskforce';
    return normalizeChipProgram({
        ...input,
        generation,
        phase,
        status: input.status || 'active',
        foundryMode: input.foundryMode || _resolveFoundryMode(generation, options.foundryMode)
    }, options);
}

export function countChipProgramHwTalents(talents = []) {
    if (!Array.isArray(talents)) return 0;
    return talents.filter(talent => Array.isArray(talent?.specialty) && talent.specialty.includes('hw')).length;
}

export function getChipProgramUnlockStatus(state, generation = 1, options = {}) {
    const template = options.templateId ? _getTemplate(options.templateId) : null;
    if (template) generation = template.generation;
    const rule = _getRequirementRule(generation);
    const foundryMode = _resolveFoundryMode(generation, options.foundryMode || template?.defaultFoundryMode);
    const requiredFoundryTech = _getFoundryRequirement(foundryMode);
    const resolvedTemplate = template || CHIP_PROGRAM_TEMPLATES.find(entry => entry.generation === generation) || CHIP_PROGRAM_TEMPLATES[0];
    const techState = state?.technologies || {};
    const talentCount = _getTalentHwCount(state?.talents);
    const completedGenerationCount = _getCompletedGenerationCount(state, generation);
    const activePrograms = _getActiveProgramCount(state);
    const chipProgramLimit = Math.max(1, Math.round(_safeNumber(state?.economy?.chipProgramLimit, 1)));
    const availableFunds = Math.max(0, _safeNumber(state?.resources?.funds, 0));
    const estimatedStartCost = resolvedTemplate
        ? _estimateStartCost(resolvedTemplate, {
            ...options,
            foundryMode,
            templateId: resolvedTemplate.id
        })
        : rule.baseStartCost;

    const blockers = [];

    if (activePrograms >= chipProgramLimit) blockers.push('chip_program_limit');
    if (!techState[rule.requiredTech]?.completed) blockers.push(`tech.${rule.requiredTech}`);
    if (!techState[requiredFoundryTech]?.completed) blockers.push(`tech.${requiredFoundryTech}`);
    if (talentCount < rule.requiredHwTalents) blockers.push('hw_talent_count');
    if (rule.requiredPreviousCompletion && completedGenerationCount === 0) blockers.push('previous_completion');
    if (availableFunds < estimatedStartCost) blockers.push('insufficient_funds');

    return {
        ok: blockers.length === 0,
        blockers,
        generation: _normalizeGeneration(generation),
        foundryMode,
        requiredTechs: [rule.requiredTech, requiredFoundryTech],
        requiredHwTalents: rule.requiredHwTalents,
        requiresPreviousCompletion: rule.requiredPreviousCompletion,
        startCost: estimatedStartCost,
        availableFunds
    };
}

export function canStartChipProgram(state, generationOrOptions = 1, maybeOptions = {}) {
    if (typeof generationOrOptions === 'object' && generationOrOptions !== null) {
        return getChipProgramUnlockStatus(state, generationOrOptions.generation ?? 1, generationOrOptions);
    }
    return getChipProgramUnlockStatus(state, generationOrOptions, maybeOptions);
}

export function getChipProgramCatalog() {
    return CHIP_PROGRAM_TEMPLATES.map(template => ({ ...template }));
}

export function previewChipProgram(templateId, options = {}) {
    const template = _getTemplate(templateId);
    if (!template) return null;
    const phaseMonths = _estimatePhaseMonths(template, options);
    const expectedBenefits = _estimateBenefits(template, options);
    const riskProfile = _estimateRiskProfile(template, options);
    return {
        template,
        generation: template.generation,
        foundryMode: options.foundryMode || template.defaultFoundryMode,
        targetTFLOPS: options.targetTFLOPS || template.defaultTargetTFLOPS,
        targetVRAM: options.targetVRAM || template.defaultTargetVRAM,
        powerEfficiency: options.powerEfficiency || 'balanced',
        phaseMonths,
        estimatedDurationMonths: Object.values(phaseMonths).reduce((sum, value) => sum + value, 0),
        estimatedCost: _estimateStartCost(template, options) + Object.entries(phaseMonths).reduce((sum, [phase, months]) => (
            sum + _estimateMonthlyBurn(template, phase, options) * months
        ), 0),
        startCost: _estimateStartCost(template, options),
        expectedBenefits,
        riskProfile
    };
}

function _estimateDifficulty(template, options = {}) {
    const tfBase = Math.max(1, _safeNumber(template?.defaultTargetTFLOPS, 200));
    const targetTFLOPS = Math.max(tfBase * 0.5, _safeNumber(options.targetTFLOPS, tfBase));
    const targetVRAM = Math.max(16, _safeNumber(options.targetVRAM, template?.defaultTargetVRAM || 64));
    const tfDifficulty = targetTFLOPS / tfBase;
    const vramDifficulty = targetVRAM / Math.max(16, _safeNumber(template?.defaultTargetVRAM, 64));
    const efficiencyPenalty = options.powerEfficiency === 'efficient'
        ? 1.08
        : options.powerEfficiency === 'performance'
            ? 1.15
            : 1;
    return Math.max(0.7, (tfDifficulty * 0.7 + vramDifficulty * 0.3) * efficiencyPenalty);
}

function _estimateBenefits(template, options = {}) {
    const difficulty = _estimateDifficulty(template, options);
    const generationMult = _getRequirementRule(template.generation).bonusMultiplier || 1;
    const performanceBias = options.powerEfficiency === 'performance' ? 1.08 : options.powerEfficiency === 'efficient' ? 0.92 : 1;
    const powerBias = options.powerEfficiency === 'efficient' ? 0.88 : options.powerEfficiency === 'performance' ? 1 : 0.94;
    const qualityBoost = _getBenefitQualityBoost(options);
    let benefits;

    if (template.type === 'training_accelerator') {
        benefits = _normalizeBonuses({
            trainingSpeedMult: _round(Math.max(0.72, 0.92 - (difficulty - 1) * 0.08) * performanceBias, 3),
            inferenceCostMult: _round(0.97 - (difficulty - 1) * 0.02, 3),
            powerCostMult: _round(Math.max(0.78, powerBias - (difficulty - 1) * 0.05), 3),
            computeMult: _round(1.03 + (difficulty - 1) * 0.06 * generationMult, 3)
        });
    } else if (template.type === 'balanced_internal') {
        benefits = _normalizeBonuses({
            trainingSpeedMult: _round(Math.max(0.82, 0.97 - (difficulty - 1) * 0.05), 3),
            inferenceCostMult: _round(Math.max(0.76, 0.92 - (difficulty - 1) * 0.06), 3),
            powerCostMult: _round(Math.max(0.74, powerBias - (difficulty - 1) * 0.06), 3),
            computeMult: _round(1.02 + (difficulty - 1) * 0.04 * generationMult, 3)
        });
    } else {
        benefits = _normalizeBonuses({
            trainingSpeedMult: _round(Math.max(0.86, 0.98 - (difficulty - 1) * 0.04), 3),
            inferenceCostMult: _round(Math.max(0.68, 0.86 - (difficulty - 1) * 0.08) * performanceBias, 3),
            powerCostMult: _round(Math.max(0.7, powerBias - (difficulty - 1) * 0.07), 3),
            computeMult: _round(1.01 + (difficulty - 1) * 0.03 * generationMult, 3),
            gpuPriceShockMult: _round(Math.max(0.8, 0.96 - (difficulty - 1) * 0.04), 3)
        });
    }

    return _boostChipProgramBenefits(benefits, qualityBoost);
}

function _estimateRiskProfile(template, options = {}) {
    const foundryMode = _resolveFoundryMode(template.generation, options.foundryMode || template.defaultFoundryMode);
    const difficulty = _estimateDifficulty(template, options);
    const foundryRisk = FOUNDRY_RISK_MOD[foundryMode] || FOUNDRY_RISK_MOD.external;
    return _normalizeRiskProfile({
        delay: _round(Math.max(0.05, 0.2 + (difficulty - 1) * 0.08 + foundryRisk.delay), 3),
        underperform: _round(Math.max(0.05, 0.15 + (difficulty - 1) * 0.06 + foundryRisk.underperform), 3),
        respin: _round(Math.max(0.03, 0.1 + (difficulty - 1) * 0.04 + foundryRisk.respin), 3)
    });
}

function _estimatePhaseMonths(template, options = {}) {
    const difficulty = _estimateDifficulty(template, options);
    const generationRule = _getRequirementRule(template.generation);
    const countryMods = _getCountryModifiers(options);
    const foundryAccess = Math.max(1, _safeNumber(countryMods.foundryAccess, 1));
    const chipAssembly = Math.max(1, _safeNumber(countryMods.chipAssembly, 1));
    return {
        taskforce: Math.max(1, Math.round(CHIP_PHASE_MONTHS.taskforce / foundryAccess)),
        workload: Math.max(1, Math.round((CHIP_PHASE_MONTHS.workload * difficulty * 0.8) / foundryAccess)),
        prototype: Math.max(2, Math.round((CHIP_PHASE_MONTHS.prototype * difficulty * generationRule.durationMultiplier) / foundryAccess)),
        pilot: Math.max(1, Math.round((CHIP_PHASE_MONTHS.pilot * Math.max(0.85, difficulty * 0.9)) / (foundryAccess * chipAssembly)))
    };
}

function _estimateMonthlyBurn(template, phase, options = {}) {
    const difficulty = _estimateDifficulty(template, options);
    const generationRule = _getRequirementRule(template.generation);
    return Math.round(generationRule.monthlyCost * (CHIP_PHASE_BURN_MULT[phase] || 1) * Math.max(0.8, difficulty));
}

function _estimateStartCost(template, options = {}) {
    const difficulty = _estimateDifficulty(template, options);
    const generationRule = _getRequirementRule(template.generation);
    const foundryMode = _resolveFoundryMode(template.generation, options.foundryMode || template.defaultFoundryMode);
    const foundryPremium = foundryMode === 'partner' ? 1.15 : foundryMode === 'own' ? 1.4 : 1;
    return Math.round(generationRule.baseStartCost * Math.max(0.8, difficulty) * foundryPremium);
}

function _recomputeProgress(program) {
    const phaseIndex = Math.max(0, CHIP_PROGRAM_PHASES.indexOf(program.phase));
    if (phaseIndex >= CHIP_PROGRAM_PHASES.length - 1) return 100;
    const normalizedPhaseProgress = _clampProgress(program.phaseProgress);
    return _round(((phaseIndex + normalizedPhaseProgress / 100) / (CHIP_PROGRAM_PHASES.length - 1)) * 100, 1);
}

function _findProgram(state, programId) {
    return Array.isArray(state?.economy?.chipPrograms)
        ? state.economy.chipPrograms.find(program => program.id === programId)
        : null;
}

function _clearTalentAssignments(state, programId) {
    for (const talent of state?.talents || []) {
        if (talent.assignment === programId) talent.assignment = null;
    }
}

function _recomputeAggregateBonuses(state) {
    const completed = Array.isArray(state?.economy?.completedChipPrograms) ? state.economy.completedChipPrograms : [];
    const next = { ...DEFAULT_CUSTOM_SILICON_BONUSES };
    for (const program of completed) {
        const bonuses = _normalizeBonuses(program.bonuses || program.expectedBenefits || program.currentBenefits, DEFAULT_CUSTOM_SILICON_BONUSES);
        next.trainingSpeedMult *= bonuses.trainingSpeedMult;
        next.inferenceCostMult *= bonuses.inferenceCostMult;
        next.powerCostMult *= bonuses.powerCostMult;
        next.computeMult *= bonuses.computeMult;
        next.gpuPriceShockMult *= bonuses.gpuPriceShockMult;
    }
    state.economy.customSiliconBonuses = next;
    return next;
}

function _makeCompletedProgram(program, qualityMultiplier = 1) {
    const template = _getTemplate(program.templateId) || { type: program.type, generation: program.generation };
    const benefits = _normalizeBonuses({
        trainingSpeedMult: _round(1 - (1 - program.expectedBenefits.trainingSpeedMult) * qualityMultiplier, 3),
        inferenceCostMult: _round(1 - (1 - program.expectedBenefits.inferenceCostMult) * qualityMultiplier, 3),
        powerCostMult: _round(1 - (1 - program.expectedBenefits.powerCostMult) * qualityMultiplier, 3),
        computeMult: _round(1 + (program.expectedBenefits.computeMult - 1) * qualityMultiplier, 3),
        gpuPriceShockMult: _round(1 - (1 - program.expectedBenefits.gpuPriceShockMult) * qualityMultiplier, 3)
    }, DEFAULT_CUSTOM_SILICON_BONUSES);
    const achievedTFLOPS = Math.max(40, Math.round(program.targetTFLOPS * qualityMultiplier));
    const achievedVRAM = Math.max(24, Math.round(program.targetVRAM * Math.max(0.85, qualityMultiplier)));

    return {
        id: program.id,
        templateId: program.templateId,
        generation: program.generation,
        chipId: `custom_${program.id}`,
        deploymentStatus: 'deployed',
        status: 'completed',
        type: template.type,
        bonuses: benefits,
        gpu: {
            id: `custom_${program.id}`,
            name: `${template.type === 'training_accelerator' ? 'Internal Training' : template.type === 'balanced_internal' ? 'Internal Balanced' : 'Internal Inference'} v${program.generation}`,
            manufacturer: 'Player',
            tflops: achievedTFLOPS,
            vram: achievedVRAM,
            price: Math.max(10_000, Math.round(program.totalSpent / Math.max(16, program.targetTFLOPS / 20))),
            powerWatt: Math.max(120, Math.round((program.targetTFLOPS / Math.max(1, program.targetVRAM)) * 45)),
            quarterlySupply: Math.max(8, Math.round(24 * Math.max(0.7, qualityMultiplier))),
            waitTimeMonths: 1,
            description: 'Internal custom silicon produced after a successful chip program.',
            ownedOnly: true
        }
    };
}

function _advanceToNextPhase(program, template, options = {}) {
    const phaseIndex = CHIP_PROGRAM_PHASES.indexOf(program.phase);
    if (phaseIndex < 0 || phaseIndex >= CHIP_PROGRAM_PHASES.length - 2) {
        program.phase = 'pilot';
    } else {
        program.phase = CHIP_PROGRAM_PHASES[phaseIndex + 1];
    }
    program.phaseIndex = Math.max(0, CHIP_PROGRAM_PHASES.indexOf(program.phase));
    program.phaseProgress = 0;
    program.phaseMonthsElapsed = 0;
    const phaseMonths = _estimatePhaseMonths(template, options);
    program.phaseDurationMonths = phaseMonths[program.phase] || 1;
    program.monthlyBurn = _estimateMonthlyBurn(template, program.phase, options);
    program.progress = _recomputeProgress(program);
}

export function startChipProgram(state, options = {}) {
    const template = _getTemplate(options.templateId);
    if (!template) return { ok: false, reason: 'unknown_template' };

    const unlock = canStartChipProgram(state, { templateId: template.id, foundryMode: options.foundryMode });
    if (!unlock.ok) return { ok: false, reason: unlock.blockers[0] || 'locked', blockers: unlock.blockers };

    const assignedTalents = (options.assignedTalents?.length ? options.assignedTalents : _pickBestHwTalents(state, unlock.requiredHwTalents).map(talent => talent.id));
    if (assignedTalents.length < unlock.requiredHwTalents) {
        return { ok: false, reason: 'hw_talent_count', blockers: ['hw_talent_count'] };
    }

    const startCost = _estimateStartCost(template, options);
    if (_safeNumber(state?.resources?.funds, 0) < startCost) return { ok: false, reason: 'insufficient_funds' };

    state.resources.funds -= startCost;

    const phaseMonths = _estimatePhaseMonths(template, options);
    const program = normalizeChipProgram({
        id: options.id || `chip_prog_${Date.now()}`,
        templateId: template.id,
        generation: template.generation,
        type: template.type,
        targetWorkload: template.targetWorkload,
        phase: 'taskforce',
        phaseProgress: 0,
        progress: 0,
        assignedTalents,
        assignedTalentCount: assignedTalents.length,
        foundryMode: options.foundryMode || template.defaultFoundryMode,
        targetTFLOPS: options.targetTFLOPS || template.defaultTargetTFLOPS,
        targetVRAM: options.targetVRAM || template.defaultTargetVRAM,
        powerEfficiency: options.powerEfficiency || 'balanced',
        startCost,
        totalSpent: startCost,
        phaseDurationMonths: phaseMonths.taskforce,
        monthlyBurn: _estimateMonthlyBurn(template, 'taskforce', options),
        expectedBenefits: _estimateBenefits(template, { ...options, state }),
        currentBenefits: _estimateBenefits(template, { ...options, state }),
        riskProfile: _estimateRiskProfile(template, { ...options, state }),
        notes: []
    });

    state.economy.chipPrograms ||= [];
    state.economy.chipPrograms.push(program);
    for (const talentId of assignedTalents) {
        const talent = (state.talents || []).find(entry => entry.id === talentId);
        if (talent) talent.assignment = program.id;
    }

    return { ok: true, program };
}

export function estimateChipProgramMonthlyProgress(program, context = {}) {
    const normalized = normalizeChipProgram(program);
    const phaseBase = _phaseFactor(normalized.phase);
    if (phaseBase <= 0) return 0;

    const talents = Array.isArray(context.talents) ? context.talents : Array.isArray(context.state?.talents) ? context.state.talents : [];
    const hwTalentCount = _getTalentHwCount(talents);
    const generationRule = _getRequirementRule(normalized.generation);
    const foundryBonus = {
        external: 1,
        partner: 1.1,
        own: 1.2
    }[normalized.foundryMode] || 1;
    const companyBonuses = context.state?.economy?.customSiliconBonuses || context.customSiliconBonuses || DEFAULT_CUSTOM_SILICON_BONUSES;
    const trainingSpeedMult = Math.max(0.5, _safeNumber(companyBonuses.trainingSpeedMult, 1));
    const previousCompletionBonus = 1 + (Math.max(0, _getCompletedGenerationCount(context.state, normalized.generation)) * 0.05);
    const generationBonus = 1 + ((generationRule.durationMultiplier || 1) - 1);
    const talentBonus = 1 + (hwTalentCount * 0.25);
    const progress = phaseBase * talentBonus * foundryBonus * generationBonus * previousCompletionBonus / trainingSpeedMult;

    return _round(progress, 1);
}

export function processChipProgramsMonthly(state, options = {}) {
    if (!Array.isArray(state?.economy?.chipPrograms) || state.economy.chipPrograms.length === 0) {
        return { progressed: 0, completed: 0 };
    }

    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    let completed = 0;
    let progressed = 0;

    state.economy.completedChipPrograms ||= [];

    for (const rawProgram of [...state.economy.chipPrograms]) {
        const program = _findProgram(state, rawProgram.id) || rawProgram;
        if (_normalizeProgramStatus(program.status) !== 'active') continue;
        const template = _getTemplate(program.templateId) || _getTemplate('inference_accelerator_v1');
        const phaseMonths = _estimatePhaseMonths(template, { ...program, state });
        const assignedTalents = (state.talents || []).filter(talent => program.assignedTalents.includes(talent.id));
        const hwTalents = assignedTalents.filter(talent => Array.isArray(talent.specialty) && talent.specialty.includes('hw'));

        if (hwTalents.length === 0) {
            program.status = 'paused';
            program.notes.push('no_hw_talent');
            continue;
        }

        program.monthlyBurn = _estimateMonthlyBurn(template, program.phase, program);
        program.totalSpent += program.monthlyBurn;
        state.resources.funds -= program.monthlyBurn;
        program.monthsElapsed += 1;
        program.phaseMonthsElapsed += 1;

        const requiredHwTalents = _getRequirementRule(program.generation).requiredHwTalents;
        const talentFactor = 1 + Math.max(0, hwTalents.length - requiredHwTalents) * 0.18;
        const foundryFactor = FOUNDRY_PROGRESS_MULT[program.foundryMode] || 1;
        const phaseDuration = Math.max(1, phaseMonths[program.phase] || program.phaseDurationMonths || 1);
        const codingAssistBonus = getInternalAIBonus(state.internalAI, 'coding_assist');
        const progressGain = Math.min(100, (100 / phaseDuration) * talentFactor * foundryFactor * (1 + (codingAssistBonus * 0.5)));
        program.phaseProgress = _clampProgress(program.phaseProgress + progressGain);
        program.progress = _recomputeProgress(program);
        progressed += 1;

        if (program.phase === 'prototype' && !program.checkpoints.delayChecked && program.phaseProgress >= 75) {
            program.checkpoints.delayChecked = true;
            if (rng() < program.riskProfile.delay) {
                program.phaseDurationMonths += 2;
                program.notes.push('delay');
            }
        }

        if (program.phase === 'prototype' && !program.checkpoints.underperformChecked && program.phaseProgress >= 100) {
            program.checkpoints.underperformChecked = true;
            if (rng() < program.riskProfile.underperform) {
                program.outcomeTier = 'underperform';
                program.currentBenefits = _normalizeBonuses({
                    trainingSpeedMult: 1 - ((1 - program.expectedBenefits.trainingSpeedMult) * 0.78),
                    inferenceCostMult: 1 - ((1 - program.expectedBenefits.inferenceCostMult) * 0.78),
                    powerCostMult: 1 - ((1 - program.expectedBenefits.powerCostMult) * 0.78),
                    computeMult: 1 + ((program.expectedBenefits.computeMult - 1) * 0.72),
                    gpuPriceShockMult: 1 - ((1 - program.expectedBenefits.gpuPriceShockMult) * 0.72)
                }, program.expectedBenefits);
            }
        }

        if (program.phase === 'pilot' && !program.checkpoints.respinChecked && program.phaseProgress >= 50) {
            program.checkpoints.respinChecked = true;
            if (rng() < program.riskProfile.respin) {
                program.phase = 'prototype';
                program.phaseIndex = CHIP_PROGRAM_PHASES.indexOf('prototype');
                program.phaseProgress = 50;
                program.phaseMonthsElapsed = 0;
                program.phaseDurationMonths = Math.max(2, Math.round((phaseMonths.prototype || 6) * 0.5));
                program.monthlyBurn = _estimateMonthlyBurn(template, 'prototype', program);
                program.totalSpent += 500_000;
                state.resources.funds -= 500_000;
                program.notes.push('respin');
                program.progress = _recomputeProgress(program);
                continue;
            }
        }

        if (program.phaseProgress < 100) continue;

        if (program.phase === 'pilot') {
            const qualityMultiplier = program.outcomeTier === 'underperform'
                ? 0.8
                : 0.7 + (rng() * 0.5);
            const completedProgram = _makeCompletedProgram(program, qualityMultiplier);
            state.economy.completedChipPrograms.push(completedProgram);
            state.economy.chipPrograms = state.economy.chipPrograms.filter(entry => entry.id !== program.id);
            _clearTalentAssignments(state, program.id);
            _recomputeAggregateBonuses(state);
            completed += 1;
            continue;
        }

        _advanceToNextPhase(program, template, program);
    }

    return { progressed, completed };
}

export function getChipProgramResolutionWindow(input = {}) {
    const progress = _clampProgress(input.progress);
    let failureThreshold = _safeNumber(input.failureThreshold, 40);
    let successThreshold = _safeNumber(input.successThreshold, 70);

    if (failureThreshold > successThreshold) {
        const swap = failureThreshold;
        failureThreshold = successThreshold;
        successThreshold = swap;
    }

    const stage = progress >= successThreshold ? 'success' : progress <= failureThreshold ? 'failure' : 'window';

    return {
        progress,
        failureThreshold,
        successThreshold,
        stage,
        success: stage === 'success',
        failure: stage === 'failure'
    };
}

export function calculateChipProgramBonuses(program, context = {}) {
    const normalized = normalizeChipProgram(program);
    const companyBonuses = context.state?.economy?.customSiliconBonuses || context.customSiliconBonuses || DEFAULT_CUSTOM_SILICON_BONUSES;
    const combined = {
        trainingSpeedMult: _round(normalized.expectedBenefits.trainingSpeedMult * _safeNumber(companyBonuses.trainingSpeedMult, 1), 3),
        inferenceCostMult: _round(normalized.expectedBenefits.inferenceCostMult * _safeNumber(companyBonuses.inferenceCostMult, 1), 3),
        powerCostMult: _round(normalized.expectedBenefits.powerCostMult * _safeNumber(companyBonuses.powerCostMult, 1), 3)
    };

    return combined;
}

export function resolveChipProgramOutcome(program, context = {}) {
    const normalized = normalizeChipProgram(program);
    const resolution = getChipProgramResolutionWindow({
        progress: normalized.progress,
        failureThreshold: context.failureThreshold,
        successThreshold: context.successThreshold
    });

    let qualityMultiplier = 1;
    if (resolution.stage === 'failure') {
        qualityMultiplier = 0.5;
    } else if (resolution.stage === 'window') {
        qualityMultiplier = 0.85;
    } else {
        const spread = Math.max(1, 100 - resolution.successThreshold);
        const successSpan = Math.min(1, Math.max(0, (resolution.progress - resolution.successThreshold) / spread));
        qualityMultiplier = _round(0.7 + (successSpan * 0.3), 3);
    }

    return {
        outcome: resolution.stage,
        resolution,
        qualityMultiplier,
        bonuses: calculateChipProgramBonuses(normalized, context)
    };
}

export function syncStateChipProgramCompatibility(state) {
    if (!state || typeof state !== 'object') return state;
    state.economy ||= {};

    const economy = state.economy;
    economy.chipPrograms = Array.isArray(economy.chipPrograms)
        ? economy.chipPrograms.map(program => normalizeChipProgram(program))
        : [];
    economy.completedChipPrograms = Array.isArray(economy.completedChipPrograms)
        ? economy.completedChipPrograms.map(program => ({
            id: String(program?.id || ''),
            generation: _normalizeGeneration(program?.generation),
            chipId: String(program?.chipId || program?.id || ''),
            deploymentStatus: String(program?.deploymentStatus || program?.status || 'completed'),
            status: String(program?.status || 'completed'),
            bonuses: _normalizeBonuses(program?.bonuses || program?.expectedBenefits || program?.currentBenefits, DEFAULT_CUSTOM_SILICON_BONUSES),
            gpu: program?.gpu ? {
                ...program.gpu,
                id: String(program.gpu.id || program.chipId || program.id || '')
            } : undefined
        })).filter(program => program.id)
        : [];
    economy.chipProgramLimit = Math.max(1, Math.round(_safeNumber(economy.chipProgramLimit, 1)));
    economy.customSiliconBonuses = _normalizeBonuses(
        economy.customSiliconBonuses && Object.keys(economy.customSiliconBonuses).length > 0
            ? economy.customSiliconBonuses
            : _recomputeAggregateBonuses({ economy }),
        DEFAULT_CUSTOM_SILICON_BONUSES
    );

    return state;
}

export { CHIP_PROGRAM_PHASES, DEFAULT_CUSTOM_SILICON_BONUSES, DEFAULT_EXPECTED_BENEFITS, DEFAULT_RISK_PROFILE, CHIP_PROGRAM_TEMPLATES };
