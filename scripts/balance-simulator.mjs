#!/usr/bin/env node

import { writeFileSync } from 'node:fs';

import { GameState } from '../js/game/GameState.js';
import { EconomySystem } from '../js/game/EconomySystem.js';
import { CompanySystem } from '../js/game/Company.js';
import { TechTree } from '../js/game/TechTree.js';
import { MarketSystem } from '../js/game/Market.js';
import { TECH_TREE } from '../js/data/technologies.js';

const STRATEGY_PRESETS = {
    conservative: {
        label: '보수적 경영',
        hiringRate: 1,
        researchAllocation: 0.5,
        deployTiming: 24,
        fundingAcceptance: 0.3,
        deploymentStrategy: 'api',
        preferredCategories: ['foundation', 'model_arch', 'data'],
        description: 'hire slowly, save money, research broadly'
    },
    research_heavy: {
        label: '연구 올인',
        hiringRate: 2,
        researchAllocation: 0.9,
        deployTiming: 36,
        fundingAcceptance: 0.8,
        deploymentStrategy: 'enterprise',
        preferredCategories: ['frontier_ai', 'advanced_ai', 'safety'],
        description: 'all resources to research, delay commercialization'
    },
    service_rush: {
        label: '서비스 러쉬',
        hiringRate: 3,
        researchAllocation: 0.3,
        deployTiming: 6,
        fundingAcceptance: 0.9,
        deploymentStrategy: 'consumer_chat',
        preferredCategories: ['generative', 'product', 'model_arch'],
        description: 'quick model + deploy, prioritize revenue'
    },
    safety_first: {
        label: '안전 우선',
        hiringRate: 1,
        researchAllocation: 0.6,
        deployTiming: 18,
        fundingAcceptance: 0.5,
        deploymentStrategy: 'government',
        preferredCategories: ['safety', 'data', 'foundation'],
        description: 'safety tech priority, government market focus'
    },
    chip_independent: {
        label: '칩 독립',
        hiringRate: 2,
        researchAllocation: 0.5,
        deployTiming: 18,
        fundingAcceptance: 0.7,
        deploymentStrategy: 'enterprise',
        preferredCategories: ['chip', 'infra', 'energy'],
        description: 'push chip program, reduce cloud dependency'
    },
    government_contract: {
        label: '정부 수주',
        hiringRate: 1,
        researchAllocation: 0.4,
        deployTiming: 12,
        fundingAcceptance: 0.6,
        deploymentStrategy: 'government',
        preferredCategories: ['safety', 'data', 'product'],
        description: 'government market focus, comply with regulations'
    }
};

const CSV_COLUMNS = [
    'run_id',
    'preset',
    'months_survived',
    'first_funding_month',
    'first_deploy_month',
    'final_funds',
    'final_ai_level',
    'competitor_max_ai',
    'ending_type',
    'score',
    'grade'
];

function parseArgs(argv) {
    const parsed = {
        runs: 50,
        preset: 'all',
        output: null,
        seed: null,
        months: 120
    };

    for (const arg of argv) {
        if (!arg.startsWith('--')) continue;
        const [key, rawValue = 'true'] = arg.slice(2).split('=');
        if (key === 'runs') parsed.runs = Math.max(1, Number(rawValue) || 1);
        if (key === 'preset') parsed.preset = rawValue || 'all';
        if (key === 'output') parsed.output = rawValue || null;
        if (key === 'seed') parsed.seed = rawValue === 'true' ? Date.now() : Number(rawValue);
        if (key === 'months') parsed.months = Math.max(1, Number(rawValue) || 120);
    }

    return parsed;
}

function withSeededRandom(state, fn) {
    const originalRandom = Math.random;
    const seeded = state.random.bind(state);
    Math.random = seeded;
    try {
        return fn(seeded);
    } finally {
        Math.random = originalRandom;
    }
}

function createTalent(id, skill, salaryMultiplier = 1) {
    const level = 3 + Math.floor(skill / 4);
    return {
        id,
        name: `Talent ${id}`,
        country: 'us',
        specialty: ['ml', 'nlp', 'data', 'safety'].slice(0, 1 + (skill % 2)),
        stats: {
            research: skill,
            creativity: Math.max(1, skill - 1),
            collaboration: Math.max(1, skill - 2)
        },
        salary: Math.round((3000 + (skill * 700)) * salaryMultiplier),
        morale: 75,
        loyalty: 70,
        trait: 'balanced',
        assignment: null,
        monthsWorked: 0,
        level
    };
}

function createModel(state, presetName, preset, month, performanceBoost = 0) {
    const completedTechs = Object.values(state.technologies).filter(tech => tech.completed).length;
    const talentPower = state.talents.reduce((sum, talent) => sum + talent.stats.research + talent.stats.creativity, 0);
    const performance = Math.round(
        12
        + (completedTechs * 3.5)
        + (talentPower * 0.35)
        + (month * 0.25)
        + (preset.researchAllocation * 8)
        + performanceBoost
    );

    return {
        id: `${presetName}_${month}_${state.models.length + 1}`,
        name: `${preset.label} ${state.models.length + 1}`,
        performance,
        compositeScore: performance,
        deployed: true,
        deploymentStrategy: preset.deploymentStrategy,
        monthlyRevenue: Math.max(0, Math.round(performance * (600 + preset.hiringRate * 120))),
        size: performance >= 70 ? 'large' : 'medium',
        serviceChannels: [],
        serviceMonths: 0
    };
}

function pickNextTech(state, preset) {
    const available = Object.entries(TECH_TREE)
        .filter(([id]) => !state.technologies[id]?.completed && !state.technologies[id]?.researching)
        .filter(([id]) => {
            const tech = TECH_TREE[id];
            const categories = preset.preferredCategories || [];
            return categories.length === 0 || categories.includes(tech.category);
        })
        .sort((a, b) => a[1].cost - b[1].cost);

    if (available.length > 0) return available[0][0];

    const fallback = Object.entries(TECH_TREE)
        .filter(([id]) => !state.technologies[id]?.completed && !state.technologies[id]?.researching)
        .sort((a, b) => a[1].cost - b[1].cost);

    return fallback[0]?.[0] || null;
}

function buildState(seed) {
    const state = new GameState();
    state.player.ceoName = 'Codex';
    state.player.companyName = 'AGI Manager Labs';
    state.player.country = 'us';
    state.player.techRoute = 'balanced';
    state.reputation.investorTrust = 42;
    state.resources.funds = 300_000;
    state.resources.computing = 2;
    state.economy.cloudGPUs = 2;
    state.economy.ownedGPUs = 0;
    state.gameStarted = true;

    const techTree = new TechTree(state);
    const companies = new CompanySystem(state);
    const economy = new EconomySystem(state);
    const market = new MarketSystem(state);

    globalThis.window ||= {};
    globalThis.window.game = {
        time: {
            currentDate: { year: 2017, month: 1, day: 1 },
            requestAutoPause() {}
        },
        companies,
        events: null,
        triggerGlitch() {},
        triggerSuccessImpact() {}
    };

    state.randomSeed = seed;
    return { state, techTree, companies, economy, market };
}

function hireTalent(state, preset, month, rng) {
    const maxTeamSize = 3 + (preset.hiringRate * 3);
    if (state.talents.length >= maxTeamSize) return;

    const hireChance = Math.min(0.9, 0.2 + (preset.hiringRate * 0.12) + (month / 240));
    if (rng() > hireChance) return;

    const baseSkill = 4 + Math.floor(rng() * 4);
    const talent = createTalent(`tal_${preset.hiringRate}_${month}_${state.talents.length + 1}`, baseSkill, preset.researchAllocation > 0.7 ? 1.15 : 1);
    state.talents.push(talent);
}

function maybeStartResearch(context, preset) {
    const { state, techTree } = context;
    const activeTechs = Object.values(state.technologies).filter(tech => tech.researching);
    if (activeTechs.length > 0) return;

    const nextTech = pickNextTech(state, preset);
    if (!nextTech) return;

    const talentIds = state.talents.map(talent => talent.id).slice(0, Math.max(1, Math.round(state.talents.length * preset.researchAllocation)));
    techTree.startResearch(nextTech, talentIds);
}

function advanceMonth(context, preset, month, rng) {
    const { state, techTree, economy, market, companies } = context;
    const currentDate = globalThis.window.game.time.currentDate;

    hireTalent(state, preset, month, rng);
    maybeStartResearch(context, preset);

    for (let day = 0; day < 30; day += 1) {
        techTree.processDailyResearch();
    }

    if (!state.models.some(model => model.deployed) && month >= preset.deployTiming && state.talents.length > 0) {
        state.models.push(createModel(state, preset.label, preset, month));
        state.models[state.models.length - 1].deployedMonth = month;
    }

    if (month >= preset.deployTiming && state.models.some(model => model.deployed) && rng() < 0.12) {
        const deployedCount = state.models.filter(model => model.deployed).length;
        if (deployedCount < 3 && state.technologies) {
            state.models.push(createModel(state, preset.label, preset, month, deployedCount * 4));
            state.models[state.models.length - 1].deployedMonth = month;
        }
    }

    if (!state.economy.fundraisingActive && economy.getNextRound() && rng() < preset.fundingAcceptance) {
        const check = economy.canRaise();
        if (check.canRaise) economy.startFundraising();
    }

    economy.processMonthly();
    companies.processMonthly();
    market.processMonthly();

    if (state.resources.funds <= 0 && !state.gameOver) {
        state.gameOver = true;
        state.gameResult = 'bankruptcy';
    }

    const bestModel = Math.max(0, ...state.models.map(model => Number(model.performance || 0)));
    if (!state.gameOver && bestModel >= 95 && Object.values(state.technologies).filter(tech => tech.completed).length >= 12) {
        state.gameOver = true;
        state.gameResult = 'agi';
    }

    currentDate.month += 1;
    if (currentDate.month > 12) {
        currentDate.month = 1;
        currentDate.year += 1;
    }
}

function gradeFromScore(score) {
    if (score >= 7000) return 'S';
    if (score >= 5500) return 'A';
    if (score >= 4000) return 'B';
    if (score >= 2500) return 'C';
    if (score >= 1200) return 'D';
    return 'F';
}

function collectResults(state, presetName, seed, monthCount) {
    const completedTechs = Object.values(state.technologies).filter(tech => tech.completed).length;
    const bestModel = Math.max(0, ...state.models.map(model => Number(model.performance || 0)));
    const competitorMax = Math.max(0, ...state.competitors.map(comp => Number(comp.currentModel?.performance || comp.aiLevel || 0)));
    const finalFunds = Math.round(state.resources.funds || 0);
    const score = Math.round(
        finalFunds / 1000
        + (completedTechs * 180)
        + (bestModel * 25)
        + (state.reputation.marketShare * 60)
        + (state.economy.fundingStage * 120)
        + (state.models.filter(model => model.deployed).length * 200)
    );

    return {
        run_id: `${presetName}_${seed}`,
        preset: presetName,
        months_survived: monthCount,
        first_funding_month: state.economy.fundingHistory[0]?.date
            ? ((state.economy.fundingHistory[0].date.year - 2017) * 12) + state.economy.fundingHistory[0].date.month
            : '',
        first_deploy_month: state.models.find(model => model.deployed)?.deployedMonth || '',
        final_funds: finalFunds,
        final_ai_level: bestModel,
        competitor_max_ai: competitorMax,
        ending_type: state.gameResult === 'competitor_agi' ? 'agi' : (state.gameResult || (state.resources.funds <= 0 ? 'bankruptcy' : 'timeout')),
        score,
        grade: gradeFromScore(score)
    };
}

function runSimulation(presetName, preset, seed, months) {
    const context = buildState(seed);
    return withSeededRandom(context.state, rng => {
        let month = 1;
        while (month <= months && !context.state.gameOver) {
            advanceMonth(context, preset, month, rng);
            month += 1;
        }

        if (!context.state.gameOver && month > months) {
            context.state.gameResult ||= 'timeout';
        }

        return collectResults(context.state, presetName, seed, Math.min(month - 1, months));
    });
}

function formatCsvValue(value) {
    if (value == null || value === '') return '';
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeCsv(rows) {
    const lines = [CSV_COLUMNS.join(',')];
    for (const row of rows) {
        lines.push(CSV_COLUMNS.map(column => formatCsvValue(row[column])).join(','));
    }
    return `${lines.join('\n')}\n`;
}

function mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

function stddev(values) {
    if (values.length === 0) return 0;
    const avg = mean(values);
    return Math.sqrt(mean(values.map(value => (value - avg) ** 2)));
}

function printSummary(rowsByPreset) {
    const lines = [];
    lines.push('=== Balance Simulation Summary ===');
    lines.push('Preset              | Runs | Mean Survived | Median | Std  | Win% | Avg Score');

    for (const [presetName, rows] of rowsByPreset) {
        const survived = rows.map(row => row.months_survived);
        const scores = rows.map(row => row.score);
        const wins = rows.filter(row => ['agi', 'ipo', 'acquisition'].includes(row.ending_type)).length;
        lines.push(
            `${presetName.padEnd(20)} | ${String(rows.length).padStart(4)} | ${mean(survived).toFixed(1).padStart(13)} | ${median(survived).toFixed(0).padStart(6)} | ${stddev(survived).toFixed(1).padStart(4)} | ${(wins / rows.length * 100).toFixed(0).padStart(3)}% | ${mean(scores).toFixed(0).padStart(8)}`
        );
    }

    process.stderr.write(`${lines.join('\n')}\n`);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const presetEntries = args.preset === 'all'
        ? Object.entries(STRATEGY_PRESETS)
        : [[args.preset, STRATEGY_PRESETS[args.preset]]];

    if (presetEntries.length === 0 || presetEntries.some(([, preset]) => !preset)) {
        console.error(`Unknown preset: ${args.preset}`);
        process.exit(1);
    }

    const allRows = [];
    const rowsByPreset = new Map();
    const baseSeed = Number.isFinite(args.seed) ? args.seed : Date.now();

    for (const [presetName, preset] of presetEntries) {
        const rows = [];
        for (let run = 0; run < args.runs; run += 1) {
            const seed = baseSeed + (run * 997) + presetName.length;
            const row = runSimulation(presetName, preset, seed, args.months);
            rows.push(row);
            allRows.push(row);
        }
        rowsByPreset.set(presetName, rows);
    }

    const csv = serializeCsv(allRows);
    if (args.output) {
        writeFileSync(args.output, csv, 'utf8');
    } else {
        process.stdout.write(csv);
    }

    printSummary(rowsByPreset);
}

main();
