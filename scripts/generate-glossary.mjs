import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function readJson(relativePath) {
    return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
    writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sentence(value = '', fallback = '') {
    const text = String(value || fallback || '').trim();
    if (!text) return fallback;
    return /[.!?]$/.test(text) ? text : `${text}.`;
}

function englishFromId(id = '') {
    return String(id)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function percentLabel(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
}

function createTerm(nameKo, nameEn, descriptionKo, descriptionEn, formulaKo = '', formulaEn = '') {
    const entry = {
        name: { ko: sentence(nameKo).replace(/\.$/, ''), en: sentence(nameEn).replace(/\.$/, '') },
        description: { ko: sentence(descriptionKo), en: sentence(descriptionEn) }
    };
    if (formulaKo || formulaEn) {
        entry.formula = {
            ko: sentence(formulaKo),
            en: sentence(formulaEn)
        };
    }
    return entry;
}

function localize(localeMap, key, fallback = '') {
    return localeMap[key] || fallback;
}

function addTerms(target, entries) {
    for (const [id, entry] of Object.entries(entries)) {
        target[id] = entry;
    }
}

const koLocale = readJson('locales/ko.json');
const enLocale = readJson('locales/en.json');
const technologyData = readJson('data/json/technologies.json');
const gpuData = readJson('data/json/gpus.json');
const modelData = readJson('data/json/models.json');
const namesData = readJson('data/json/names.json');
const competitorData = readJson('data/json/companies.json');
const campaignData = readJson('data/json/campaign.json');
const dataAcquisitionData = readJson('data/json/data_acquisition.json');

const glossary = {};

addTerms(glossary, {
    funds: createTerm(
        '자금',
        'Funds',
        '회사가 보유한 현금입니다. 월 수입에서 월 지출을 뺀 값만큼 변동하며, 바닥나면 파산 위기로 이어집니다',
        'Cash held by the company. It changes by monthly income minus monthly expenses, and hitting zero puts the company at bankruptcy risk',
        '자금 = 이전 자금 + 월 수입 - 월 지출',
        'Funds = Previous funds + Monthly income - Monthly expenses'
    ),
    runway: createTerm(
        '런웨이',
        'Runway',
        '현재 자금으로 버틸 수 있는 개월 수입니다. 적자가 없으면 사실상 무한대이며, 6개월 이하부터 경고 구간입니다',
        'Months the company can survive with current cash. It is effectively infinite if you are not losing money, and drops into warning territory below six months',
        '런웨이 = 자금 ÷ 월 적자',
        'Runway = Funds ÷ Monthly deficit'
    ),
    valuation: createTerm(
        '기업가치',
        'Valuation',
        '투자자와 시장이 평가한 회사의 총 가치입니다. 다음 투자 라운드, IPO 가능성, 지분 희석에 직접 영향을 줍니다',
        'The total value investors and the market assign to your company. It directly affects future funding rounds, IPO access, and dilution',
        '기업가치 = 기술력 × 수익 × 팀 역량 × 시장 기대 × 신뢰도',
        'Valuation = Technology × Revenue × Team strength × Market expectations × Trust'
    ),
    tflops: createTerm(
        'TFLOPS',
        'TFLOPS',
        '초당 1조 회의 부동소수점 연산 능력입니다. GPU와 데이터센터의 순수 연산력을 표현하는 핵심 단위입니다',
        'Trillions of floating-point operations per second. This is the core unit used to represent raw GPU and datacenter compute power',
        '총 TFLOPS = 각 GPU TFLOPS × 수량의 합',
        'Total TFLOPS = Sum of each GPU TFLOPS × count'
    ),
    vram: createTerm(
        'VRAM',
        'VRAM',
        'GPU 메모리 용량입니다. 큰 모델을 훈련하거나 서빙하려면 높은 VRAM이 필요합니다',
        'The GPU memory capacity. Larger models need higher VRAM for training and serving'
    ),
    aiLevel: createTerm(
        'AI 수준',
        'AI Level',
        '회사의 종합적인 AI 기술 수준입니다. 연구 진척, 모델 성능, 배포 결과를 함께 반영합니다',
        'The company overall AI capability level. It reflects research progress, model quality, and deployment results together'
    ),
    marketShare: createTerm(
        '시장 점유율',
        'Market Share',
        '글로벌 AI 시장에서 차지하는 비중입니다. 배포 서비스의 사용자 수와 수익, 브랜드 존재감이 함께 반영됩니다',
        'The portion of the global AI market you control. It reflects users, revenue, and brand presence across deployed services'
    ),
    reputation: createTerm(
        '평판',
        'Reputation',
        '업계와 대중이 회사를 바라보는 신뢰와 이미지입니다. 채용, 파트너십, 투자 유치, 규제 대응에 영향을 줍니다',
        'The trust and image the industry and public assign to your company. It affects hiring, partnerships, fundraising, and regulatory responses'
    ),
    safetyScore: createTerm(
        '안전 점수',
        'Safety Score',
        '정렬, 평가, 안전 공학 수준을 나타냅니다. 높을수록 사고 위험이 줄고 정부와 규제기관의 신뢰를 얻기 쉽습니다',
        'Represents your alignment, evaluation, and safety engineering maturity. Higher values reduce accident risk and improve trust with governments and regulators'
    ),
    aiFavorability: createTerm(
        'AI 호감도',
        'AI Favorability',
        '대중이 AI 기술을 얼마나 긍정적으로 보는지 나타냅니다. 낮아지면 규제 강화와 반AI 이벤트가 늘어납니다',
        'Measures how positively the public views AI technology. Lower values increase regulatory pressure and anti-AI events'
    ),
    investorTrust: createTerm(
        '투자자 신뢰',
        'Investor Trust',
        '투자자들이 현재 경영진과 성장 전략을 얼마나 신뢰하는지 나타냅니다. 투자 라운드의 성사 여부와 조건에 영향을 줍니다',
        'Shows how much investors trust the leadership team and growth strategy. It affects whether funding rounds succeed and on what terms'
    ),
    monthlyIncome: createTerm(
        '월 수입',
        'Monthly Income',
        '현재 달에 들어오는 총 현금 유입입니다. API, 라이선싱, 소비자 서비스, 정부 계약 등의 매출이 합산됩니다',
        'The total cash flowing in this month. It adds together API, licensing, consumer, and government service revenue',
        '월 수입 = 모든 서비스 채널 수익의 합',
        'Monthly income = Sum of revenue across all service channels'
    ),
    monthlyExpense: createTerm(
        '월 지출',
        'Monthly Expenses',
        '현재 달에 나가는 총 비용입니다. 인건비, 컴퓨트, 전력, 오버헤드, 내부 AI 비용이 포함됩니다',
        'The total cost going out this month. It includes salaries, compute, power, overhead, and internal AI costs',
        '월 지출 = 인건비 + 컴퓨트 + 전력 + 오버헤드 + 기타 유지비',
        'Monthly expenses = Salaries + Compute + Power + Overhead + upkeep'
    ),
    monthlyBalance: createTerm(
        '월 수지',
        'Monthly Balance',
        '월 수입과 월 지출의 차이입니다. 음수이면 런웨이가 줄어들고, 양수이면 현금이 쌓입니다',
        'The difference between monthly income and monthly expenses. Negative values burn runway, while positive values build cash',
        '월 수지 = 월 수입 - 월 지출',
        'Monthly balance = Monthly income - Monthly expenses'
    ),
    morale: createTerm(
        '사기',
        'Morale',
        '팀이 현재 일과 방향성에 얼마나 의욕을 느끼는지 나타냅니다. 낮아지면 생산성과 유지력이 떨어집니다',
        'Shows how motivated the team feels about its current work and direction. Lower morale hurts productivity and retention'
    ),
    loyalty: createTerm(
        '충성도',
        'Loyalty',
        '핵심 인재가 회사를 떠나지 않고 함께할 가능성입니다. 낮아질수록 갈등, 이탈, 스카우트 위험이 커집니다',
        'The likelihood that key talent stays with the company. Lower loyalty increases conflict, attrition, and poaching risk'
    ),
    researchSpeed: createTerm(
        '연구 속도',
        'Research Speed',
        '현재 팀과 보너스가 만들어내는 실효 연구 진행 속도입니다. 인재 배치, 특성, 내부 AI, 국가 보너스가 모두 영향을 줍니다',
        'The effective speed at which your team advances research. Talent assignments, traits, internal AI, and country modifiers all feed into it',
        '연구 속도 = 기본 연구력 × 인재/문화/도우미 보너스',
        'Research speed = Base research power × talent, culture, and helper modifiers'
    ),
    researchCost: createTerm(
        '연구 비용',
        'Research Cost',
        '기술 노드를 완료하는 데 필요한 연구 포인트 양입니다. 후반 기술일수록 비용이 크게 증가합니다',
        'The amount of research points required to finish a technology node. Later technologies become dramatically more expensive'
    ),
    researchPower: createTerm(
        '팀 연구력',
        'Research Power',
        '배치된 인재가 실제로 만들어내는 연구 포인트 생산량입니다. 투자 라운드 조건과 기술 해금 속도에 중요합니다',
        'The raw research point output created by your assigned team. It is important for both funding requirements and technology unlock speed'
    ),
    trainingQuality: createTerm(
        '훈련 품질',
        'Training Quality',
        '훈련 과정에서 확보한 데이터 적합도, 컴퓨트 초과 투입, 인재 배치가 최종 모델 품질에 미치는 결과입니다',
        'The resulting model quality contributed by data fit, compute overprovisioning, and talent during training'
    ),
    serviceUsers: createTerm(
        '서비스 사용자',
        'Service Users',
        '현재 운영 중인 모든 서비스 채널에서 활동하는 사용자 규모입니다. 시장 점유율과 월 매출의 핵심 입력값입니다',
        'The active user base across all live service channels. It is a core input to both market share and monthly revenue'
    ),
    salary: createTerm(
        '연봉/급여',
        'Salary',
        '인재 한 명을 유지하기 위해 매월 지불하는 보상입니다. 수준이 높은 인재일수록 급격히 증가합니다',
        'The monthly compensation paid to retain one talent member. Higher-level talent becomes much more expensive'
    ),
    dataQuality: createTerm(
        '데이터 품질',
        'Data Quality',
        '수집한 데이터가 학습에 얼마나 잘 맞는지 나타냅니다. 높을수록 모델 품질과 벤치마크 결과가 좋아집니다',
        'Measures how suitable your acquired data is for training. Higher quality improves model results and benchmark performance'
    ),
    dataFreshness: createTerm(
        '데이터 신선도',
        'Data Freshness',
        '데이터가 얼마나 최신 상태인지 나타냅니다. 신선도가 낮으면 현재 시장과 사용자 행동을 제대로 반영하지 못합니다',
        'Shows how current your data is. Lower freshness means your models stop reflecting the present market and user behavior'
    ),
    legalRisk: createTerm(
        '법적 리스크',
        'Legal Risk',
        '데이터와 서비스 운영이 규제, 개인정보, 저작권 문제를 일으킬 가능성입니다. 높을수록 사건과 제재 확률이 올라갑니다',
        'The chance that your data and service operations trigger regulatory, privacy, or copyright issues. Higher values increase the risk of incidents and penalties'
    ),
    boardConfidence: createTerm(
        '이사회 신뢰',
        'Board Confidence',
        '이사회가 CEO와 전략을 얼마나 신뢰하는지 나타냅니다. 너무 낮아지면 경영 압박과 쿠데타 위험이 커집니다',
        'Represents how much the board trusts the CEO and strategy. If it falls too low, management pressure and coup risk rise'
    ),
    boardPressure: createTerm(
        '이사회 압박',
        'Board Pressure',
        '이사회가 더 빠른 성장, 더 큰 수익, 혹은 더 안전한 전략을 요구하는 정도입니다',
        'The intensity with which the board demands faster growth, higher revenue, or safer strategy'
    ),
    chipProgram: createTerm(
        '칩 프로그램',
        'Chip Program',
        '자체 반도체와 가속기 로드맵입니다. 단기적으로는 비용이 크지만, 완성되면 TFLOPS 효율과 공급망 안정성이 크게 좋아집니다',
        'Your internal semiconductor and accelerator roadmap. It is expensive in the short term, but improves TFLOPS efficiency and supply-chain resilience once completed'
    ),
    internalAI: createTerm(
        '내부 AI',
        'Internal AI',
        '사내 운영에 배치하는 보조 모델 슬롯입니다. 연구, 코딩, 데이터, 경영, 안전 업무에 각각 보너스를 줍니다',
        'Slots for assistant models deployed inside the company. They provide bonuses to research, coding, data, business, and safety work'
    ),
    karma: createTerm(
        '카르마',
        'Karma',
        '이전 선택에서 쌓인 장기적 윤리적 흔적입니다. 특정 카르마 누적은 이벤트 체인과 엔딩 방향을 바꿉니다',
        'The long-tail ethical residue of earlier choices. Certain accumulations redirect event chains and endings'
    ),
    fundingRound: createTerm(
        '투자 라운드',
        'Funding Round',
        '회사가 외부 자본을 유치하는 단계입니다. 라운드가 높아질수록 큰 자금을 얻지만 더 많은 조건과 기대가 따라옵니다',
        'The stage at which the company raises outside capital. Higher rounds bring more money but also stricter expectations'
    ),
    colocation: createTerm(
        '코로케이션',
        'Colocation',
        '외부 시설의 랙을 빌려 직접 소유한 GPU를 운영하는 방식입니다. 자체 데이터센터보다 빠르지만 장기 확장성은 제한적입니다',
        'A model where you rent rack space in an external facility to operate owned GPUs. It is faster than building a datacenter but less scalable long term'
    ),
    datacenter: createTerm(
        '데이터센터',
        'Datacenter',
        '대규모 연산 인프라를 직접 운영하는 시설입니다. 장기적인 컴퓨트 우위를 제공하지만 자본 집약적입니다',
        'A facility used to run large-scale compute infrastructure directly. It offers long-term compute leverage but is highly capital intensive'
    ),
    gpuAccess: createTerm(
        'GPU 접근성',
        'GPU Access',
        '해당 국가나 지역에서 최신 가속기를 확보하기 쉬운 정도입니다. 지정학과 수출 통제의 영향을 크게 받습니다',
        'How easy it is to secure modern accelerators in a country or region. It is strongly shaped by geopolitics and export controls'
    ),
    aiTalentPool: createTerm(
        'AI 인재 풀',
        'AI Talent Pool',
        '해당 지역에서 채용 가능한 연구자와 엔지니어의 밀도입니다. 높을수록 채용 시장이 풍부합니다',
        'The density of hireable researchers and engineers in a region. Higher values mean a richer recruiting market'
    ),
    regulation: createTerm(
        '규제',
        'Regulation',
        '정부와 기관이 AI 기업에 적용하는 규칙과 제약입니다. 높은 규제는 비용을 늘리지만 안정성과 신뢰를 줄 수도 있습니다',
        'The rules and constraints governments place on AI firms. Heavier regulation raises costs but can also improve stability and trust'
    ),
    exportControl: createTerm(
        '수출 통제',
        'Export Control',
        '국가가 첨단 칩, 모델, 장비의 이전을 제한하는 수준입니다. 높을수록 공급망과 글로벌 확장이 어려워집니다',
        'The degree to which a state restricts transfers of advanced chips, models, and equipment. Higher levels make supply chains and global expansion harder'
    ),
    relation: createTerm(
        '관계도',
        'Relation',
        '경쟁사나 국가와의 외교적 관계 수준입니다. 높을수록 제휴와 라이선싱이 쉬워지고, 낮을수록 갈등이 커집니다',
        'The diplomatic relationship level with a rival or state actor. Higher values make partnerships and licensing easier, while lower values increase conflict'
    ),
    passiveCollection: createTerm(
        '자동 수집',
        'Passive Collection',
        '서비스 운영 과정에서 사용자 로그와 상호작용 데이터를 지속적으로 쌓는 방식입니다. 비용은 낮지만 프라이버시 민감도가 존재합니다',
        'A way of continuously accumulating user logs and interaction data while services run. It is cheap, but comes with privacy sensitivity'
    ),
    computeAllocation: createTerm(
        '연산 배분',
        'Compute Allocation',
        '한정된 TFLOPS를 훈련, 서빙, 내부 AI, 칩 개발 사이에 나누는 의사결정입니다',
        'The decision of how to split finite TFLOPS between training, serving, internal AI, and chip development'
    ),
    modelPerformance: createTerm(
        '모델 성능',
        'Model Performance',
        '모델이 실제 벤치마크와 시장 기대 대비 어느 수준에 도달했는지 나타내는 종합 성과입니다',
        'The overall result showing how a model performs against benchmarks and market expectations'
    ),
    benchmarkScore: createTerm(
        '벤치마크 점수',
        'Benchmark Score',
        '특정 평가셋에서 모델이 기록한 점수입니다. 모델의 강점과 약점을 비교하는 가장 직접적인 지표입니다',
        'The score a model records on a given evaluation set. It is the most direct way to compare strengths and weaknesses'
    ),
    geopoliticalTension: createTerm(
        '지정학 긴장도',
        'Geopolitical Tension',
        '글로벌 AI 경쟁으로 인한 국가 간 긴장 수준입니다. 높아질수록 수출 통제, 블록화, 외교 압박이 강해집니다',
        'The level of interstate tension produced by global AI competition. Higher values intensify export controls, bloc politics, and diplomatic pressure'
    ),
    eventChain: createTerm(
        '이벤트 체인',
        'Event Chain',
        '하나의 선택이 다음 사건을 연쇄적으로 부르는 장기 서사 구조입니다. 누적된 카르마와 조건에 따라 분기합니다',
        'A long-form narrative structure where one choice triggers later events in sequence. It branches based on accumulated karma and state conditions'
    ),
    campaignAct: createTerm(
        '캠페인 막',
        'Campaign Act',
        '캠페인의 시대 구간입니다. 막이 올라갈수록 더 높은 수준의 정치, 공급망, 안전, 세계 질서 이슈가 열립니다',
        'A historical phase of the campaign. Later acts unlock higher-order politics, supply-chain, safety, and world-order issues'
    ),
    speedCulture: createTerm(
        '속도 문화',
        'Speed Culture',
        '조직이 빠른 실험과 출시를 얼마나 중시하는지 나타냅니다. 속도는 올리지만 실수 가능성도 키웁니다',
        'Measures how strongly the organization prioritizes rapid experimentation and launch speed. It improves pace, but also raises mistake risk'
    ),
    academicCulture: createTerm(
        '학술 문화',
        'Academic Culture',
        '엄밀한 연구, 재현성, 논문 중심 접근을 얼마나 중시하는지 나타냅니다',
        'Represents how much the organization values rigorous research, reproducibility, and paper-driven work'
    ),
    missionCulture: createTerm(
        '미션 문화',
        'Mission Culture',
        '팀이 장기 비전과 사회적 목적에 얼마나 강하게 결속되어 있는지 나타냅니다',
        'Represents how strongly the team is bound together by long-term vision and social purpose'
    ),
    securityCulture: createTerm(
        '보안 문화',
        'Security Culture',
        '모델, 칩, 데이터, 인재 보호를 얼마나 체계적으로 수행하는지 나타냅니다',
        'Measures how systematically the company protects models, chips, data, and personnel'
    ),
    transparencyCulture: createTerm(
        '투명성 문화',
        'Transparency Culture',
        '실패와 의사결정을 얼마나 공개적으로 기록하고 공유하는지 나타냅니다. 신뢰를 높이지만 단기 마찰도 생깁니다',
        'Measures how openly the company records and shares failures and decisions. It raises trust but can create short-term friction'
    )
});

for (const personality of namesData.PERSONALITIES || []) {
    glossary[`personality_${personality.id}`] = createTerm(
        personality.label?.ko || personality.id,
        personality.label?.en || englishFromId(personality.id),
        `${personality.label?.ko || personality.id} 성향입니다. 연구 보너스 ${percentLabel(personality.effects?.researchBonus || 0)}, 충성도 변화 ${percentLabel(personality.effects?.loyaltyDecay || 0)}, 갈등 확률 ${percentLabel(personality.effects?.conflictChance || 0)} 영향을 가집니다`,
        `${personality.label?.en || englishFromId(personality.id)} personality. It influences research bonus ${percentLabel(personality.effects?.researchBonus || 0)}, loyalty drift ${percentLabel(personality.effects?.loyaltyDecay || 0)}, and conflict chance ${percentLabel(personality.effects?.conflictChance || 0)}`,
    );
}

const ideologyDescriptions = {
    open_source: {
        ko: '오픈소스 배포와 개방형 생태계를 선호합니다. 공개 전략과 커뮤니티 확장에 더 잘 맞습니다',
        en: 'Prefers open-source deployment and open ecosystems. Best aligned with public release and community expansion strategies'
    },
    safety: {
        ko: '정렬과 안전성을 가장 우선시합니다. 위험한 배포에는 반대하지만 장기 신뢰를 끌어올립니다',
        en: 'Prioritizes alignment and safety above all else. Resists risky deployment, but increases long-term trust'
    },
    accel: {
        ko: '빠른 연구와 공격적 확장을 선호합니다. 혁신 속도를 높이지만 충돌 가능성도 키웁니다',
        en: 'Prefers rapid research and aggressive expansion. Increases innovation speed, but also raises conflict potential'
    },
    profit_driven: {
        ko: '수익성과 시장 지배를 우선합니다. 제품화와 매출 최적화에 강점을 보입니다',
        en: 'Prioritizes profitability and market control. Strongly aligned with commercialization and revenue optimization'
    },
    academic: {
        ko: '장기적인 학술 기여와 엄밀한 연구를 우선합니다. 논문 중심 연구 조직과 잘 맞습니다',
        en: 'Prioritizes long-term scientific contribution and rigorous research. Fits paper-driven research organizations'
    },
    neutral: {
        ko: '상황에 맞게 실용적으로 판단합니다. 극단적 보너스는 적지만 충돌도 적습니다',
        en: 'Makes pragmatic, situational decisions. It has fewer extreme bonuses, but also fewer ideological clashes'
    }
};

for (const ideology of namesData.IDEOLOGIES || []) {
    const description = ideologyDescriptions[ideology.id] || {
        ko: `${ideology.label?.ko || ideology.id} 관점을 가진 인재입니다.`,
        en: `Talent aligned with the ${ideology.label?.en || englishFromId(ideology.id)} worldview.`
    };
    glossary[`ideology_${ideology.id}`] = createTerm(
        ideology.label?.ko || ideology.id,
        ideology.label?.en || englishFromId(ideology.id),
        description.ko,
        description.en
    );
}

const specialtyDescriptions = {
    ml: ['머신러닝 알고리즘과 학습 파이프라인 최적화에 강점을 가집니다', 'Strong in machine learning algorithms and training pipeline optimization'],
    nlp: ['언어 모델, 텍스트 데이터, 대화형 시스템에 특화되어 있습니다', 'Specialized in language models, text data, and conversational systems'],
    vision: ['이미지와 영상 이해, 멀티모달 지각 문제에 강합니다', 'Strong in image understanding, video systems, and multimodal perception'],
    rl: ['강화학습, 에이전트 학습, 장기 보상 구조 설계에 강합니다', 'Strong in reinforcement learning, agent training, and long-horizon reward design'],
    safety: ['정렬, 평가, 레드팀, 통제 문제 해결에 전문성을 가집니다', 'Specialized in alignment, evaluation, red teaming, and control problems'],
    infra: ['분산 시스템, 추론 서빙, 데이터센터 운영에 강합니다', 'Strong in distributed systems, inference serving, and datacenter operations'],
    hw: ['가속기, 메모리 병목, 칩 설계와 패키징 이해에 강합니다', 'Strong in accelerators, memory bottlenecks, and chip design tradeoffs'],
    data: ['데이터 수집, 정제, 라벨링, 품질 관리 체계에 강점을 가집니다', 'Strong in data acquisition, cleaning, labeling, and quality pipelines']
};

for (const specialty of namesData.SPECIALTIES || []) {
    const [koDesc, enDesc] = specialtyDescriptions[specialty.id] || [`${specialty.name} 전문 역량입니다`, `${englishFromId(specialty.id)} specialization`];
    glossary[`spec_${specialty.id}`] = createTerm(
        specialty.name,
        specialty.id === 'nlp' ? 'Natural Language Processing' : englishFromId(specialty.id),
        koDesc,
        enDesc
    );
}

for (const trait of namesData.PERSONALITY_TRAITS || []) {
    glossary[`trait_${trait.id}`] = createTerm(
        trait.name,
        englishFromId(trait.id),
        `${trait.effect}. 품질 계수 ${trait.qualityMod ?? 1}, 속도 계수 ${trait.speedMod ?? 1}에 반영됩니다`,
        `${englishFromId(trait.id)} trait. ${trait.effect}. It contributes quality multiplier ${trait.qualityMod ?? 1} and speed multiplier ${trait.speedMod ?? 1}`
    );
}

const techCategoryDescriptions = {
    foundation: ['AI 연구의 기초 원리와 학습 메커니즘을 다루는 계열입니다', 'This branch covers the core principles and learning mechanics that underpin AI research'],
    model_arch: ['모델 구조와 표현 방식을 바꾸는 아키텍처 기술군입니다', 'This branch focuses on architectures that change model structure and representation'],
    advanced_ai: ['추론, 계획, 도구 사용 같은 고급 능력을 높이는 기술군입니다', 'This branch improves advanced capabilities such as reasoning, planning, and tool use'],
    frontier_ai: ['최전선 성능과 AGI 경쟁에 직접 연결되는 기술군입니다', 'This branch is tied directly to frontier performance and the race toward AGI'],
    generative: ['생성형 모델과 멀티모달 창작 능력을 강화하는 기술군입니다', 'This branch strengthens generative models and multimodal creative capabilities'],
    data: ['데이터 확보, 정제, 거버넌스와 관련된 기술군입니다', 'This branch covers data acquisition, refinement, and governance'],
    chip: ['가속기, 반도체, 컴퓨트 효율을 높이는 하드웨어 기술군입니다', 'This branch covers accelerator, semiconductor, and compute-efficiency technology'],
    infra: ['서빙, 오케스트레이션, 플랫폼 운영을 담당하는 인프라 기술군입니다', 'This branch covers serving, orchestration, and platform operations'],
    energy: ['전력과 냉각, 효율 최적화에 관련된 인프라 기술군입니다', 'This branch focuses on power, cooling, and efficiency optimization'],
    product: ['시장에 직접 닿는 AI 제품과 상용 기능을 여는 기술군입니다', 'This branch unlocks user-facing AI products and commercial capabilities'],
    safety: ['정렬, 평가, 통제, 사고 예방을 담당하는 안전 기술군입니다', 'This branch is focused on alignment, evaluation, control, and accident prevention'],
    quantum: ['양자 컴퓨팅과 차세대 연산 패러다임을 탐색하는 기술군입니다', 'This branch explores quantum computing and next-generation compute paradigms'],
    integration: ['여러 능력을 통합해 AGI 수준 시스템을 만드는 기술군입니다', 'This branch integrates multiple capabilities into AGI-scale systems']
};

for (const [categoryId, category] of Object.entries(technologyData.TECH_CATEGORIES || {})) {
    const [koDesc, enDesc] = techCategoryDescriptions[categoryId] || [`${category.name} 연구 계열입니다`, `${category.name} research family`];
    glossary[`researchCategory_${categoryId}`] = createTerm(
        category.name,
        localize(enLocale, `research.category.${categoryId}`, englishFromId(categoryId)),
        koDesc,
        enDesc
    );
}

const researchGroupDescriptions = {
    research: ['기초 연구부터 프런티어 모델까지 직접 성능을 끌어올리는 계열입니다', 'This group drives core capability growth from fundamentals to frontier models'],
    service: ['사용자에게 닿는 제품과 생성형 기능을 확장하는 계열입니다', 'This group expands user-facing products and generative features'],
    infra: ['칩, 데이터센터, 연산 운영 기반을 강화하는 계열입니다', 'This group strengthens chips, datacenters, and compute operations'],
    governance: ['데이터, 안전, 정책 대응을 담당하는 거버넌스 계열입니다', 'This group handles data governance, safety, and policy response']
};

for (const groupId of ['research', 'service', 'infra', 'governance']) {
    const [koDesc, enDesc] = researchGroupDescriptions[groupId];
    glossary[`researchGroup_${groupId}`] = createTerm(
        localize(koLocale, `research.group_${groupId}`, englishFromId(groupId)),
        localize(enLocale, `research.group_${groupId}`, englishFromId(groupId)),
        koDesc,
        enDesc
    );
}

for (const [techId, tech] of Object.entries(technologyData.TECH_TREE || {})) {
    glossary[`tech_${techId}`] = createTerm(
        tech.name || techId,
        localize(enLocale, `tech.${techId}.name`, englishFromId(techId)),
        tech.historicalContext || tech.description || `${tech.name || techId} 기술입니다`,
        localize(enLocale, `tech.${techId}.description`, `Technology in the ${englishFromId(tech.category || 'research')} branch`)
    );
}

for (const [architectureId, architecture] of Object.entries(modelData.MODEL_ARCHITECTURES || {})) {
    const koName = architecture.nameKr || architecture.name || architectureId;
    const enName = architecture.name || englishFromId(architectureId);
    glossary[`architecture_${architectureId}`] = createTerm(
        koName,
        enName,
        `${sentence(architecture.description || `${koName} 아키텍처입니다`)} 데이터 적합: ${(architecture.dataTypes || []).join(', ') || '범용'}`,
        `${sentence(architecture.description || `${enName} architecture`)} Best fit data: ${(architecture.dataTypes || []).map(englishFromId).join(', ') || 'general-purpose'}`
    );
}

for (const [scaleId, scale] of Object.entries(modelData.PARAMETER_SCALES || {})) {
    glossary[`parameterScale_${scaleId}`] = createTerm(
        scale.name || scaleId,
        englishFromId(scaleId),
        `${scale.params} 규모입니다. 최소 ${scale.minTFLOPS} TFLOPS, ${scale.minVRAM}GB VRAM, ${scale.dataReqTB}TB 데이터가 권장됩니다`,
        `${scale.params} scale. It recommends at least ${scale.minTFLOPS} TFLOPS, ${scale.minVRAM}GB VRAM, and ${scale.dataReqTB}TB of data`
    );
}

for (const strategy of Object.values(modelData.DEPLOYMENT_STRATEGIES || {})) {
    glossary[`deployment_${strategy.id}`] = createTerm(
        strategy.name || strategy.id,
        englishFromId(strategy.id),
        strategy.description || `${strategy.name || strategy.id} 배포 전략입니다`,
        strategy.description || `${englishFromId(strategy.id)} deployment strategy`
    );
}

const serviceChannelTerms = {
    api: ['API 서비스', 'API Service', '개발자와 기업이 모델 기능을 API로 호출하는 채널입니다. 안정적 수익과 확장이 장점입니다', 'A channel where developers and firms call model capabilities via APIs. It offers stable revenue and scalable distribution'],
    consumer_chat: ['소비자 챗봇', 'Consumer Chat', '대중 사용자를 직접 상대하는 대화형 서비스 채널입니다. 성장 속도가 빠르지만 운영 변동성도 큽니다', 'A direct conversational channel for mass-market users. It grows quickly, but also carries high operating volatility'],
    enterprise: ['엔터프라이즈', 'Enterprise', '기업 고객 대상 맞춤형 배포 채널입니다. 사용자 수는 적지만 고객당 매출이 큽니다', 'A custom deployment channel for enterprise clients. It has fewer users, but high revenue per customer'],
    government: ['정부 계약', 'Government', '공공기관과 정부 계약을 통해 모델을 배포하는 채널입니다. 안전성과 신뢰가 중요합니다', 'A channel that deploys models through public-sector and government contracts. Safety and trust matter heavily'],
    open_source: ['오픈소스', 'Open Source', '모델을 공개해 커뮤니티와 생태계를 키우는 채널입니다. 직접 수익은 적지만 영향력은 큽니다', 'A channel that releases models publicly to grow community and ecosystem reach. Direct revenue is low, but influence can be large'],
    internal: ['내부 활용', 'Internal', '회사 내부 프로세스에 모델을 배치해 연구, 운영, 안전 효율을 높이는 채널입니다', 'A channel that deploys models into internal workflows to raise research, operations, and safety efficiency'],
    b2b_license: ['타사 제공', 'B2B Licensing', '외부 기업에 기술을 라이선싱하거나 화이트라벨 형태로 공급하는 채널입니다', 'A channel that licenses technology to outside firms or supplies it in a white-label form']
};

for (const [serviceId, [koName, enName, koDesc, enDesc]] of Object.entries(serviceChannelTerms)) {
    glossary[`service_${serviceId}`] = createTerm(koName, enName, koDesc, enDesc);
}

for (const gpu of gpuData.GPU_CATALOG || []) {
    const serverPrice = Number(gpu.serverPrice || gpu.purchasePrice || 0);
    glossary[`gpu_${gpu.id}`] = createTerm(
        gpu.name,
        gpu.name,
        `${gpu.year}년 출시. ${gpu.vram}GB VRAM, ${gpu.tflops} TFLOPS급 성능을 제공하는 가속기입니다${serverPrice ? `. 서버 단위 약 $${serverPrice.toLocaleString()}` : ''}`,
        `Released in ${gpu.year}. An accelerator with ${gpu.vram}GB VRAM and roughly ${gpu.tflops} TFLOPS of performance${serverPrice ? `. Approx. $${serverPrice.toLocaleString()} per server unit` : ''}`
    );
}

const dataTypeNameSource = dataAcquisitionData.DATA_TYPES || {};
for (const [typeId, typeDef] of Object.entries(modelData.DATA_TYPES || {})) {
    const localized = dataTypeNameSource[typeId]?.name || {};
    glossary[`data_${typeId}`] = createTerm(
        localized.ko || typeDef.name || typeId,
        localized.en || englishFromId(typeId),
        `${localized.ko || typeDef.name || typeId} 데이터입니다. 기본 단가 ${Number(typeDef.costPerTB || 0).toLocaleString()} / TB, 최대 확보량 ${Number(typeDef.availableTB || 0).toLocaleString()}TB 기준으로 설계되어 있습니다`,
        `${localized.en || englishFromId(typeId)} data. It is tuned around base cost ${Number(typeDef.costPerTB || 0).toLocaleString()} per TB and approximately ${Number(typeDef.availableTB || 0).toLocaleString()}TB of market availability`
    );
}

for (const method of Object.values(dataAcquisitionData.METHODS || {})) {
    glossary[`dataMethod_${method.id}`] = createTerm(
        method.name?.ko || method.id,
        method.name?.en || englishFromId(method.id),
        `${method.description?.ko || method.id}. 기본 품질 ${method.qualityBase}%, 신선도 ${method.freshnessBase}%, 법적 민감도 ${method.legalSensitivity}%`,
        `${method.description?.en || englishFromId(method.id)}. Base quality ${method.qualityBase}%, freshness ${method.freshnessBase}%, and legal sensitivity ${method.legalSensitivity}%`
    );
}

const doctrineByType = new Map();
for (const competitor of competitorData.COMPETITORS || []) {
    if (competitor?.doctrine?.type && !doctrineByType.has(competitor.doctrine.type)) {
        doctrineByType.set(competitor.doctrine.type, competitor.doctrine);
    }
}

for (const [doctrineType, doctrine] of doctrineByType.entries()) {
    glossary[`doctrine_${doctrineType}`] = createTerm(
        doctrine.label?.ko || doctrineType,
        doctrine.label?.en || englishFromId(doctrineType),
        doctrine.description?.ko || `${doctrine.label?.ko || doctrineType} 운영 교리입니다`,
        doctrine.description?.en || `${doctrine.label?.en || englishFromId(doctrineType)} operating doctrine`
    );
}

const benchmarkDescriptions = {
    mmlu: ['57개 과목에 걸친 종합 지식과 문제 해결 능력을 측정하는 벤치마크입니다', 'A benchmark that measures broad knowledge and problem solving across 57 subjects'],
    humaneval: ['코드 생성 정확도를 pass@k 형태로 평가하는 프로그래밍 벤치마크입니다', 'A programming benchmark that evaluates code generation accuracy with pass@k metrics'],
    gsm8k: ['수학 추론과 단계별 풀이 능력을 평가하는 벤치마크입니다', 'A benchmark for mathematical reasoning and step-by-step solution ability'],
    helm: ['다양한 시나리오에서 모델의 전반적 거동을 비교하는 종합 평가군입니다', 'A holistic benchmark suite that compares model behavior across many scenarios'],
    arena_elo: ['실제 사용자 선호 비교로 산출되는 대전식 순위 지표입니다', 'A ladder-style ranking derived from real user preference comparisons'],
    multimodal_bench: ['텍스트, 이미지, 복합 입력을 함께 평가하는 멀티모달 벤치마크입니다', 'A multimodal benchmark that evaluates text, image, and mixed-input performance together']
};

for (const benchmark of modelData.BENCHMARKS || []) {
    const [koDesc, enDesc] = benchmarkDescriptions[benchmark.id] || [benchmark.description || benchmark.id, benchmark.description || englishFromId(benchmark.id)];
    glossary[`bench_${benchmark.id}`] = createTerm(
        benchmark.nameKo || benchmark.name || benchmark.id,
        benchmark.name || benchmark.nameKo || englishFromId(benchmark.id),
        koDesc,
        enDesc
    );
}

const fundingRounds = [
    ['bootstrap', '부트스트랩', 'Bootstrap', '외부 투자 없이 창업자 자금과 초기 매출로 버티는 단계입니다', 'A stage where the company survives on founder capital and early revenue without outside investment'],
    ['seed', '시드', 'Seed', '첫 외부 자금을 받아 팀과 연구를 본격적으로 키우는 단계입니다', 'The first outside round used to expand the team and build real research momentum'],
    ['series_a', '시리즈 A', 'Series A', '제품과 연구가 시장 적합성을 증명하기 시작하는 성장 단계입니다', 'A growth round where product and research begin to prove market fit'],
    ['series_b', '시리즈 B', 'Series B', '운영 조직과 서비스 확장을 본격화하는 스케일링 단계입니다', 'A scaling round that professionalizes operations and expands live services'],
    ['series_c', '시리즈 C', 'Series C', '글로벌 영향력과 인프라 투자를 키우는 대형 성장 단계입니다', 'A large growth round focused on global reach and infrastructure expansion'],
    ['series_d', '시리즈 D+', 'Series D+', 'AGI 경쟁을 위한 초대형 자본과 정치적 영향력이 필요한 단계입니다', 'A late-stage round that supplies the massive capital and influence needed for the AGI race'],
    ['ipo', 'IPO', 'IPO', '상장을 통해 공개 시장 자금을 조달하는 최종 대형 자본 단계입니다', 'The final large-capital stage where the company raises money on public markets']
];

for (const [roundId, koName, enName, koDesc, enDesc] of fundingRounds) {
    glossary[`funding_${roundId}`] = createTerm(koName, enName, koDesc, enDesc);
}

for (const [actId, act] of Object.entries(campaignData.ACTS || {})) {
    glossary[`act_${actId}`] = createTerm(
        act.name?.ko || actId,
        act.name?.en || englishFromId(actId),
        act.description?.ko || `${act.name?.ko || actId} 시기입니다`,
        act.description?.en || `${act.name?.en || englishFromId(actId)} phase`
    );
}

const endings = {
    singularity: ['특이점 달성', 'Singularity', '인간 수준을 넘어서는 AI를 완성해 새로운 문명을 여는 엔딩입니다', 'An ending where you build an AI beyond human level and open a new civilization'],
    bankrupt: ['파산', 'Bankruptcy', '현금과 신뢰를 모두 잃고 회사가 해체되는 엔딩입니다', 'An ending where the company collapses after running out of cash and trust'],
    competitor_agi: ['경쟁사 AGI 달성', 'Rival Reaches AGI', '경쟁사가 먼저 AGI를 만들어 주도권을 가져가는 엔딩입니다', 'An ending where a rival reaches AGI first and takes control of the era'],
    ipo_success: ['IPO 성공', 'IPO Success', '상장을 통해 거대 AI 기업으로 자리 잡는 엔딩입니다', 'An ending where you become a major AI corporation through a successful IPO'],
    market_dominance: ['시장 지배', 'Market Dominance', 'AI 시장의 패권을 쥐고 생태계 기준을 재편하는 엔딩입니다', 'An ending where you seize AI market dominance and reshape the ecosystem standard'],
    safety_leader: ['안전 AI 리더', 'Safety Leader', '가장 신뢰받는 안전 AI 조직으로 남는 엔딩입니다', 'An ending where you become the most trusted safe-AI organization'],
    time_limit: ['2031년 — 시대의 끝', '2031 - End of an Era', '시간 제한까지 버틴 뒤 성과를 결산하는 엔딩입니다', 'An ending that resolves when you survive to the time limit and tally your legacy'],
    public_infra: ['공공 인프라형 AGI', 'Public Infrastructure AGI', 'AGI를 공공재처럼 배포해 모두가 혜택을 누리게 하는 엔딩입니다', 'An ending where AGI becomes public infrastructure that benefits everyone'],
    military_hegemony: ['군산복합체형 패권', 'Military Hegemony', '국가와 군사 계약 중심으로 패권을 구축하는 엔딩입니다', 'An ending where you build hegemony through state and military contracts'],
    open_source_liberation: ['오픈소스 해방', 'Open Source Liberation', 'AGI를 공개해 통제 대신 확산을 선택하는 엔딩입니다', 'An ending where you release AGI openly and choose diffusion over control'],
    ethical_failure: ['윤리적 유산', 'Ethical Legacy', 'AGI에는 못 닿았지만 안전 규범을 남기는 엔딩입니다', 'An ending where you miss AGI but leave behind the safety framework others build on'],
    acquisition: ['인수합병', 'Acquisition', '더 큰 기업에 흡수되어 독립성을 잃는 엔딩입니다', 'An ending where a larger firm acquires you and independence disappears'],
    internal_coup: ['CEO 실각', 'Internal Coup', '이사회가 창업자를 몰아내고 노선을 뒤집는 엔딩입니다', 'An ending where the board removes the founder and reverses the company direction'],
    state_absorption: ['국가 흡수', 'State Absorption', '정부가 회사를 국유화해 AI를 국가 도구로 바꾸는 엔딩입니다', 'An ending where the state nationalizes the company and turns AI into a state instrument']
};

for (const [endingId, [koName, enName, koDesc, enDesc]] of Object.entries(endings)) {
    glossary[`ending_${endingId}`] = createTerm(koName, enName, koDesc, enDesc);
}

const internalSlots = {
    research_assist: ['연구 지원', 'Research Assist', '연구 속도와 기술 진행 효율을 높이는 내부 AI 슬롯입니다', 'An internal AI slot that increases research speed and technology progress'],
    coding_assist: ['코딩 지원', 'Coding Assist', '훈련 파이프라인과 칩 개발 같은 구현 작업을 가속하는 슬롯입니다', 'An internal AI slot that accelerates implementation work like training pipelines and chip development'],
    data_refine: ['데이터 정제', 'Data Refine', '품질과 신선도를 개선해 데이터 자산을 더 강하게 만드는 슬롯입니다', 'An internal AI slot that improves data quality and freshness'],
    business_assist: ['경영 지원', 'Business Assist', '투자 유치와 운영 효율, 오버헤드 최적화를 돕는 슬롯입니다', 'An internal AI slot that helps fundraising, operating efficiency, and overhead optimization'],
    safety_audit: ['안전 감사', 'Safety Audit', '사고 예방, 레드팀, 안전 점수 개선에 기여하는 슬롯입니다', 'An internal AI slot that supports accident prevention, red teaming, and safety posture']
};

for (const [slotId, [koName, enName, koDesc, enDesc]] of Object.entries(internalSlots)) {
    glossary[`internalAI_${slotId}`] = createTerm(koName, enName, koDesc, enDesc);
}

const routeTerms = {
    llm: ['언어 노선', 'LLM Route', '언어 모델과 텍스트 지능을 중심으로 성장하는 연구 노선입니다', 'A research route centered on language models and text intelligence'],
    world: ['월드모델 노선', 'World Route', '멀티모달 지각과 세계 모델링을 강화하는 연구 노선입니다', 'A research route focused on multimodal perception and world modeling'],
    synergy: ['시너지 노선', 'Synergy Route', '여러 능력과 시스템을 조합해 종합 성능을 끌어올리는 노선입니다', 'A route that combines many capabilities and systems to raise holistic performance'],
    common: ['공통 노선', 'Common Route', '여러 연구 축에서 공유되는 핵심 기반 기술 노선입니다', 'A route for foundational technologies shared across multiple research branches']
};

for (const [routeId, [koName, enName, koDesc, enDesc]] of Object.entries(routeTerms)) {
    glossary[`route_${routeId}`] = createTerm(koName, enName, koDesc, enDesc);
}

const totalTerms = Object.keys(glossary).length;
if (totalTerms < 200) {
    throw new Error(`Expected at least 200 glossary terms, got ${totalTerms}`);
}

const glossaryJson = { TERMS: glossary };
writeJson('data/json/glossary.json', glossaryJson);

for (const [id, entry] of Object.entries(glossary)) {
    koLocale[`glossary.${id}.name`] = entry.name.ko;
    enLocale[`glossary.${id}.name`] = entry.name.en;
    koLocale[`glossary.${id}.description`] = entry.description.ko;
    enLocale[`glossary.${id}.description`] = entry.description.en;
    if (entry.formula?.ko) koLocale[`glossary.${id}.formula`] = entry.formula.ko;
    if (entry.formula?.en) enLocale[`glossary.${id}.formula`] = entry.formula.en;
}

writeJson('locales/ko.json', koLocale);
writeJson('locales/en.json', enLocale);

console.log(`Generated ${totalTerms} glossary terms.`);
