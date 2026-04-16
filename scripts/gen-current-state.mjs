#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EVENTS } from '../js/data/events.js';
import { HISTORICAL_EVENTS, RANDOM_EVENTS, TECH_MILESTONE_EVENTS } from '../js/data/historical_events.js';

const ROOT = process.cwd();
const load = (name) => JSON.parse(readFileSync(join(ROOT, 'data', 'json', name), 'utf8'));

const versionData = load('version.json');
const techs = load('technologies.json');
const countries = load('countries.json');
const companies = load('companies.json');
const gpus = load('gpus.json');
const models = load('models.json');

const techCount = Object.keys(techs.TECH_TREE || {}).length;
const techCategories = Object.keys(techs.TECH_CATEGORIES || {}).length;
const countryCount = Object.keys(countries.COUNTRIES || {}).length;
const playableCount = Object.values(countries.COUNTRIES || {}).filter(country => country.playable).length;
const compCount = (companies.COMPETITORS || []).length;
const gpuCount = (gpus.GPU_CATALOG || []).length;
const archCount = Object.keys(models.MODEL_ARCHITECTURES || {}).length;
const scaleCount = Object.keys(models.PARAMETER_SCALES || {}).length;
const deployCount = Object.keys(models.DEPLOYMENT_STRATEGIES || {}).length;
const benchCount = (models.BENCHMARKS || []).length;

const historicalEvents = HISTORICAL_EVENTS.length;
const randomEvents = RANDOM_EVENTS.length + EVENTS.length;
const milestoneEvents = TECH_MILESTONE_EVENTS.length;
const choiceEvents = [...HISTORICAL_EVENTS, ...RANDOM_EVENTS, ...TECH_MILESTONE_EVENTS, ...EVENTS]
    .filter(event => Array.isArray(event.choices) && event.choices.length > 0).length;

const testFiles = readdirSync(join(ROOT, 'tests')).filter(file => file.endsWith('.mjs')).sort();
const gameFiles = readdirSync(join(ROOT, 'js', 'game')).filter(file => file.endsWith('.js')).sort();
const uiFiles = readdirSync(join(ROOT, 'js', 'ui')).filter(file => file.endsWith('.js')).sort();
const dataFiles = readdirSync(join(ROOT, 'js', 'data')).filter(file => file.endsWith('.js')).sort();
const generatedDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date());

const md = `# AGI Manager — 현재 상태 (자동 생성)

**생성일**: ${generatedDate}
**버전**: ${versionData.version}
**생성 방법**: \`node scripts/gen-current-state.mjs\`

---

## 데이터 현황

| 항목 | 수량 |
|------|------|
| 기술 노드 | ${techCount}개 (${techCategories} 카테고리) |
| 국가 | ${countryCount}개 (${playableCount}개 플레이 가능) |
| 경쟁사 | ${compCount}개 |
| GPU 카탈로그 | ${gpuCount}종 |
| 모델 아키텍처 | ${archCount}종 |
| 파라미터 규모 | ${scaleCount}단계 |
| 배포 전략 | ${deployCount}종 |
| 벤치마크 | ${benchCount}종 |
| 역사 이벤트 | ${historicalEvents}개 |
| 랜덤/기타 이벤트 | ${randomEvents}개 |
| 기술 마일스톤 이벤트 | ${milestoneEvents}개 |
| 이벤트 총계 | ${historicalEvents + randomEvents + milestoneEvents}개 |
| 선택지 보유 이벤트 | ${choiceEvents}개 |

## 소스 현황

| 구분 | 파일 수 |
|------|--------|
| 게임 시스템 (js/game/) | ${gameFiles.length}개 |
| UI (js/ui/) | ${uiFiles.length}개 |
| 데이터 (js/data/) | ${dataFiles.length}개 |
| 데이터 JSON (data/json/) | 8개 |
| 테스트 (tests/) | ${testFiles.length}개 |

## 게임 시스템 파일 목록
${gameFiles.map(file => `- \`${file}\``).join('\n')}

## UI 파일 목록
${uiFiles.map(file => `- \`${file}\``).join('\n')}

## 테스트 파일 목록
${testFiles.map(file => `- \`${file}\``).join('\n')}
`;

writeFileSync(join(ROOT, 'docs', 'CURRENT_STATE.md'), md);
console.log('✓ docs/CURRENT_STATE.md generated');
console.log(`  Techs: ${techCount}, Countries: ${countryCount} (${playableCount} playable), Competitors: ${compCount}`);
console.log(`  Events: ${historicalEvents + randomEvents + milestoneEvents} (choices: ${choiceEvents})`);
console.log(`  Tests: ${testFiles.length}`);
