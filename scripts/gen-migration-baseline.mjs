#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EVENTS } from '../js/data/events.js';
import { HISTORICAL_EVENTS, RANDOM_EVENTS, TECH_MILESTONE_EVENTS } from '../js/data/historical_events.js';
import { TECH_TREE } from '../js/data/technologies.js';
import { GameState } from '../js/game/GameState.js';
import { EconomySystem } from '../js/game/EconomySystem.js';
import { CompanySystem } from '../js/game/Company.js';
import { TechTree } from '../js/game/TechTree.js';
import { MarketSystem } from '../js/game/Market.js';
import { processGeopoliticsCycle } from '../js/game/GeopoliticsSystem.js';

const ROOT = process.cwd();
const CURRENT_STATE_PATH = join(ROOT, 'docs', 'CURRENT_STATE.md');
const BASELINE_PATH = join(ROOT, 'docs', 'MIGRATION_BASELINE.md');

const args = new Set(process.argv.slice(2));
const writeToStdout = args.has('--stdout');

function loadJson(name) {
    return JSON.parse(readFileSync(join(ROOT, 'data', 'json', name), 'utf8'));
}

function formatDateForDocs() {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function formatNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return String(value ?? 'n/a');
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function withSeededRandom(state, callback) {
    const originalRandom = Math.random;
    Math.random = state.random.bind(state);
    try {
        return callback();
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

const STRATEGY_PRESETS = {
    conservative: {
        label: '보수 운영',
        startingCountry: 'us',
        hiringRate: 1,
        researchAllocation: 0.5,
        deployTiming: 24,
        fundingAcceptance: 0.3,
        deploymentStrategy: 'api',
        preferredCategories: ['foundation', 'model_arch', 'data'],
        allowedActionScope: 'slow hiring, broad research, avoid rushed deployment',
        route: 'foundation/model_arch/data'
    },
    service_rush: {
        label: '공격 운영',
        startingCountry: 'us',
        hiringRate: 3,
        researchAllocation: 0.3,
        deployTiming: 6,
        fundingAcceptance: 0.9,
        deploymentStrategy: 'consumer_chat',
        preferredCategories: ['generative', 'product', 'model_arch'],
        allowedActionScope: 'fast hiring, early deployment, revenue priority',
        route: 'generative/product/model_arch'
    }
};

function buildBalanceScenarioState(seed, country) {
    const state = new GameState();
    state.player.ceoName = 'Codex';
    state.player.companyName = 'AGI Manager Labs';
    state.player.country = country;
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

    globalThis.requestAnimationFrame ||= () => 0;
    globalThis.cancelAnimationFrame ||= () => {};
    globalThis.window ||= {};
    globalThis.window.game = {
        time: {
            currentDate: { year: 2017, month: 1, day: 1, hour: 0 },
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

function pickNextTech(state, preset) {
    const available = Object.entries(TECH_TREE)
        .filter(([id]) => !state.technologies[id]?.completed && !state.technologies[id]?.researching)
        .filter(([, tech]) => {
            const categories = preset.preferredCategories || [];
            return categories.length === 0 || categories.includes(tech.category);
        })
        .sort((left, right) => left[1].cost - right[1].cost);

    if (available.length > 0) {
        return available[0][0];
    }

    const fallback = Object.entries(TECH_TREE)
        .filter(([id]) => !state.technologies[id]?.completed && !state.technologies[id]?.researching)
        .sort((left, right) => left[1].cost - right[1].cost);

    return fallback[0]?.[0] || null;
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

function hireTalent(state, preset, month, rng) {
    const maxTeamSize = 3 + (preset.hiringRate * 3);
    if (state.talents.length >= maxTeamSize) {
        return;
    }

    const hireChance = Math.min(0.9, 0.2 + (preset.hiringRate * 0.12) + (month / 240));
    if (rng() > hireChance) {
        return;
    }

    const baseSkill = 4 + Math.floor(rng() * 4);
    const talent = createTalent(
        `tal_${preset.hiringRate}_${month}_${state.talents.length + 1}`,
        baseSkill,
        preset.researchAllocation > 0.7 ? 1.15 : 1
    );
    state.talents.push(talent);
}

function maybeStartResearch(context, preset) {
    const { state, techTree } = context;
    const activeResearch = Object.values(state.technologies).filter(tech => tech.researching);
    if (activeResearch.length > 0) {
        return;
    }

    const nextTech = pickNextTech(state, preset);
    if (!nextTech) {
        return;
    }

    const talentIds = state.talents
        .map(talent => talent.id)
        .slice(0, Math.max(1, Math.round(state.talents.length * preset.researchAllocation)));
    techTree.startResearch(nextTech, talentIds);
}

function advanceBalanceMonth(context, presetName, preset, month, rng) {
    const { state, techTree, economy, market, companies } = context;
    const currentDate = globalThis.window.game.time.currentDate;

    hireTalent(state, preset, month, rng);
    maybeStartResearch(context, preset);

    for (let day = 0; day < 30; day += 1) {
        techTree.processDailyResearch();
    }

    if (!state.models.some(model => model.deployed) && month >= preset.deployTiming && state.talents.length > 0) {
        state.models.push(createModel(state, presetName, preset, month));
        state.models[state.models.length - 1].deployedMonth = month;
    }

    if (month >= preset.deployTiming && state.models.some(model => model.deployed) && rng() < 0.12) {
        const deployedCount = state.models.filter(model => model.deployed).length;
        if (deployedCount < 3) {
            state.models.push(createModel(state, presetName, preset, month, deployedCount * 4));
            state.models[state.models.length - 1].deployedMonth = month;
        }
    }

    if (!state.economy.fundraisingActive && economy.getNextRound() && rng() < preset.fundingAcceptance) {
        const check = economy.canRaise();
        if (check.canRaise) {
            economy.startFundraising();
        }
    }

    economy.processMonthly();
    companies.processMonthly();
    processGeopoliticsCycle(state);
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

function buildScenarioMetrics({
    label,
    family,
    state,
    seed,
    route,
    allowedActionScope,
    startingCountry,
    caveats,
    deterministicRule
}) {
    const completedResearch = Object.values(state.technologies).filter(tech => tech.completed).length;
    const deployedModels = state.models.filter(model => model.deployed).length;
    const leadingCompetitor = [...state.competitors].sort((left, right) => Number(right.aiLevel || 0) - Number(left.aiLevel || 0))[0];
    const eastAsiaShare = Number(state.geopolitics?.regionalMarket?.east_asia?.playerShare || 0);
    const newsCount = Array.isArray(state.newsLog) ? state.newsLog.length : 0;

    return {
        label,
        family,
        startingCountry,
        route,
        allowedActionScope,
        seed,
        deterministicRule,
        finalDate: `${globalThis.window.game.time.currentDate.year}-${String(globalThis.window.game.time.currentDate.month).padStart(2, '0')}`,
        funds: Math.round(state.resources.funds || 0),
        monthlyRevenue: Math.round(state.resources.monthlyIncome || 0),
        monthlyExpense: Math.round(state.resources.monthlyExpense || 0),
        completedResearch,
        deployedModels,
        overallShare: Number((state.reputation.marketShare || 0).toFixed(2)),
        eastAsiaShare: Number(eastAsiaShare.toFixed(2)),
        leadingCompetitorAi: Number((leadingCompetitor?.aiLevel || 0).toFixed(2)),
        eventCount: 'n/a',
        newsCount,
        endingType: state.gameResult || 'timeout',
        caveats
    };
}

function runBalancePresetScenario(key, seed, months) {
    const preset = STRATEGY_PRESETS[key];
    const context = buildBalanceScenarioState(seed, preset.startingCountry);

    return withSeededRandom(context.state, () => {
        for (let month = 1; month <= months && !context.state.gameOver; month += 1) {
            advanceBalanceMonth(context, key, preset, month, context.state.random.bind(context.state));
        }

        return buildScenarioMetrics({
            label: `${months}개월 / ${preset.label}`,
            family: 'economic harness',
            state: context.state,
            seed,
            route: preset.route,
            allowedActionScope: preset.allowedActionScope,
            startingCountry: preset.startingCountry,
            deterministicRule: `mulberry32 seed ${seed}`,
            caveats: '경제/연구/시장 루프 중심 하네스라 이벤트 카운트는 아직 parity 기준선에 포함하지 않음'
        });
    });
}

function runDeterministicShareScenario({ label, score, share, seed, months }) {
    const state = new GameState();
    state.player.companyName = 'Interaction Labs';
    state.player.country = 'kr';
    state.reputation.marketShare = share;
    state.reputation.corporate = 15;
    state.models = [
        {
            id: 'player_model',
            name: 'Player-1',
            deployed: true,
            compositeScore: score,
            performance: score,
            serviceChannels: [{ type: 'api', active: true }]
        }
    ];

    const companies = new CompanySystem(state);
    const market = new MarketSystem(state);
    const originalRandom = Math.random;
    Math.random = mulberry32(seed);

    globalThis.requestAnimationFrame ||= () => 0;
    globalThis.cancelAnimationFrame ||= () => {};
    globalThis.window ||= {};
    globalThis.window.game = {
        triggerGlitch() {},
        time: {
            currentDate: { year: 2017, month: 1, day: 1, hour: 0 },
            requestAutoPause() {}
        }
    };

    try {
        for (let month = 0; month < months; month += 1) {
            companies.processSixHourly(24 * 30);
            companies.processMonthly();
            processGeopoliticsCycle(state);
            market.processMonthly();

            globalThis.window.game.time.currentDate.month += 1;
            if (globalThis.window.game.time.currentDate.month > 12) {
                globalThis.window.game.time.currentDate.month = 1;
                globalThis.window.game.time.currentDate.year += 1;
            }
        }
    } finally {
        Math.random = originalRandom;
    }

    return buildScenarioMetrics({
        label,
        family: 'deterministic interaction harness',
        state,
        seed,
        route: score < 10 ? 'weak pressure reference' : 'strong pressure reference',
        allowedActionScope: score < 10 ? 'low-performance deployed model, minimal starting share' : 'high-performance deployed model, strong starting share',
        startingCountry: 'kr',
        deterministicRule: `mulberry32 seed ${seed}`,
        caveats: '시장/지정학 상호작용 parity 기준선용 하네스이며 이벤트/뉴스 루프는 별도 검증 대상'
    });
}

function collectCurrentStateSummary() {
    const versionData = loadJson('version.json');
    const techs = loadJson('technologies.json');
    const countries = loadJson('countries.json');
    const companies = loadJson('companies.json');
    const testFiles = readdirSync(join(ROOT, 'tests')).filter(file => file.endsWith('.mjs')).sort();

    return {
        version: versionData.version,
        saveVersion: versionData.saveVersion,
        techCount: Object.keys(techs.TECH_TREE || {}).length,
        countryCount: Object.keys(countries.COUNTRIES || {}).length,
        playableCountryCount: Object.values(countries.COUNTRIES || {}).filter(country => country.playable).length,
        competitorCount: (companies.COMPETITORS || []).length,
        eventCount: HISTORICAL_EVENTS.length + RANDOM_EVENTS.length + TECH_MILESTONE_EVENTS.length + EVENTS.length,
        testCount: testFiles.length,
        generatedDate: formatDateForDocs()
    };
}

function renderScenarioTable(rows) {
    return [
        '| 시나리오 | 시작 국가 | seed | 최종 시점 | 현금 | 월매출 | 월지출 | 연구 완료 | 배포 모델 | 전체 점유율 | 동아시아 점유율 | 선두 경쟁사 AI 레벨 | 이벤트 수 | 뉴스 수 | 종료 상태 |',
        '|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|',
        ...rows.map(row => [
            row.label,
            row.startingCountry.toUpperCase(),
            row.seed,
            row.finalDate,
            formatNumber(row.funds),
            formatNumber(row.monthlyRevenue),
            formatNumber(row.monthlyExpense),
            formatNumber(row.completedResearch),
            formatNumber(row.deployedModels),
            formatNumber(row.overallShare),
            formatNumber(row.eastAsiaShare),
            formatNumber(row.leadingCompetitorAi),
            row.eventCount,
            formatNumber(row.newsCount),
            row.endingType
        ].join(' | ') + ' |')
    ].join('\n');
}

function renderScenarioDefinitions(rows) {
    return rows.map(row => `### ${row.label}

- 시작 국가: \`${row.startingCountry}\`
- 실행 계열: \`${row.family}\`
- 모델/연구 루트: ${row.route}
- 허용 액션 범위: ${row.allowedActionScope}
- deterministic 조건: ${row.deterministicRule}
- caveat: ${row.caveats}
`).join('\n');
}

function buildMarkdown() {
    const currentState = collectCurrentStateSummary();
    const rows = [
        runBalancePresetScenario('conservative', 101, 12),
        runBalancePresetScenario('service_rush', 202, 12),
        runDeterministicShareScenario({ label: '72개월 / weak deterministic', score: 5, share: 1, seed: 11, months: 72 }),
        runDeterministicShareScenario({ label: '72개월 / strong deterministic', score: 80, share: 15, seed: 11, months: 72 })
    ];

    return `# AGI Manager — Unity Migration Baseline

**생성일**: ${currentState.generatedDate}
**생성 방법**: \`node scripts/gen-migration-baseline.mjs\`
**웹판 기준 버전**: \`${currentState.version}\`
**세이브 버전**: \`${currentState.saveVersion}\`
**현재 상태 참고 문서**: [CURRENT_STATE.md](/Users/sonjuwon/Library/CloudStorage/Dropbox/agimanager/docs/CURRENT_STATE.md)

---

## 목적

이 문서는 Unity 이식 중 parity 비교 기준을 고정하기 위한 웹판 기준선이다.
현재 값은 전부 2026-04-14 기준 코드와 데이터에서 재생성할 수 있는 수치만 기록한다.

## 핵심 수치

| 항목 | 값 |
|---|---:|
| 기술 노드 | ${currentState.techCount} |
| 국가 | ${currentState.countryCount} |
| 플레이 가능 국가 | ${currentState.playableCountryCount} |
| 경쟁사 | ${currentState.competitorCount} |
| 이벤트 총계 | ${currentState.eventCount} |
| 테스트 수 | ${currentState.testCount} |
| 세이브 버전 | ${currentState.saveVersion} |

## 시나리오 정의

${renderScenarioDefinitions(rows)}

## 시나리오 결과표

${renderScenarioTable(rows)}

## 비교 시 주의점

- \`12개월 / 보수 운영\`, \`12개월 / 공격 운영\`은 기존 경제/연구/시장 하네스를 사용한 재현 가능한 기준선이다.
- \`72개월 / weak deterministic\`, \`72개월 / strong deterministic\`은 경쟁사/시장/지정학 pressure 차이를 보는 deterministic interaction 하네스다.
- 이벤트 수는 각 하네스가 이벤트 시스템을 완전히 구동하지 않기 때문에 현재는 \`n/a\`로 둔다. 이 값은 Unity parity가 이벤트 시스템 페이즈에 들어가면 별도 replay 기준으로 보강한다.
- 전체 점유율과 동아시아 점유율은 현재 \`MarketSystem\`과 \`GeopoliticsSystem\` 기준 값이다.

## Known Caveats

- 이 기준선은 “실제 플레이 세션 녹화”가 아니라 코드 기반 하네스 결과다.
- 12개월 하네스는 연구/자금/모델 배포 기조를 비교하기 위한 기준이라 이벤트/뉴스 기준선은 약하다.
- 72개월 하네스는 약한 플레이어 압박과 강한 플레이어 압박의 상대 차이를 고정하는 목적이므로, 완전한 캠페인 플레이스루와 동일하지 않다.

## 재생성 명령

\`\`\`bash
node scripts/gen-current-state.mjs
node tests/time-hourly-test.mjs
node tests/competitor-simulation-test.mjs
node tests/state-actor-system-test.mjs
node tests/market-interaction-test.mjs
node tests/save-load-test.mjs
node tests/balance-test.mjs
node tests/migration-baseline-test.mjs
node scripts/gen-migration-baseline.mjs
\`\`\`
`;
}

const markdown = buildMarkdown();

if (writeToStdout) {
    process.stdout.write(markdown);
} else {
    writeFileSync(BASELINE_PATH, markdown, 'utf8');
    if (!readFileSync(CURRENT_STATE_PATH, 'utf8').includes('AGI Manager — 현재 상태')) {
        throw new Error('docs/CURRENT_STATE.md appears to be missing the generated current-state header.');
    }
    console.log('✓ docs/MIGRATION_BASELINE.md generated');
}
