// ========================================================================
// Historical Events & Random Events Data
// Real-world events (2017-2030) that affect the AI development landscape
// Sorted by date for efficient processing
// ========================================================================

export const EVENT_CATEGORIES = {
    geopolitical: { name: '지정학', color: '#3b82f6', icon: '🌐' },
    economic:     { name: '경제',   color: '#22c55e', icon: '📊' },
    technology:   { name: '기술',   color: '#8b5cf6', icon: '🔬' },
    regulatory:   { name: '규제',   color: '#f59e0b', icon: '⚖️' },
    disaster:     { name: '재난',   color: '#ef4444', icon: '⚠️' },
    social:       { name: '사회',   color: '#ec4899', icon: '👥' },
    ai_industry:  { name: 'AI 산업', color: '#06b6d4', icon: '🤖' },
    military:     { name: '군사',   color: '#dc2626', icon: '⚔️' },
    energy:       { name: '에너지', color: '#eab308', icon: '⚡' },
    tech:         { name: '기술',   color: '#8b5cf6', icon: '🧠' },
    milestone:    { name: '이정표', color: '#f97316', icon: '🌟' },
};

// ─── Helper functions for compact event creation ───
function W(id, date, cat, icon, title, desc, effects) {
    return { id, date, type: 'world', category: cat, icon, title, description: desc, effects: effects || {} };
}
function D(id, date, cat, icon, title, desc, choices) {
    return { id, date, type: 'decision', category: cat, icon, title, description: desc, choices };
}

function _currentYear() {
    return typeof window !== 'undefined' ? (window.game?.time?.currentDate?.year || 2017) : 2017;
}

function _bestModelScore(state) {
    return Math.max(0, ...(state?.models || []).map(model => Number(model?.compositeScore ?? model?.performance ?? 0) || 0));
}

function _hasCompletedTech(state, techId) {
    return Boolean(state?.technologies?.[techId]?.completed);
}

function _hasAnySafetyTech(state) {
    return Object.values(state?.technologies || {}).some(tech => tech?.completed && tech.category === 'safety');
}

function _ownInternalSlotCount(state) {
    return Object.values(state?.internalAI?.slots || {}).filter(slot => slot?.source === 'own').length;
}

function _frustratedTalent(state, ideology = null) {
    return (state?.talents || []).find(talent =>
        (!ideology || talent.ideology === ideology)
        && Number(talent.ideologyFrustration || 0) >= 6
        && Number(talent.level || 0) >= 7
    ) || null;
}


// ========================================================================
// HISTORICAL EVENTS — sorted by date (YYYYMMDD)
// ========================================================================
export const HISTORICAL_EVENTS = [

    // ═══════════════════════════════════════════════════════════════
    // 2017 — 게임 시작 연도
    // ═══════════════════════════════════════════════════════════════

    W('trump_inauguration', 20170120, 'geopolitical', '🇺🇸',
        '트럼프 미국 대통령 취임',
        '도널드 트럼프가 미국 제45대 대통령으로 취임합니다. 기술 산업에 대한 규제 완화가 예상되지만, 이민 정책 강화로 해외 인재 유입이 감소할 수 있습니다.',
        { countryEffects: { us: { aiFavorability: 2 } }, investorTrust: 2 }),

    W('wannacry_attack', 20170512, 'disaster', '💻',
        'WannaCry 랜섬웨어 대규모 공격',
        '전 세계 150개국에 영향을 미친 대규모 사이버 공격이 발생했습니다. AI 기반 보안 솔루션에 대한 수요가 급증합니다.',
        { aiFavorability: 2, investorTrust: 3 }),

    W('paris_agreement_exit', 20170601, 'geopolitical', '🌍',
        '미국 파리 기후협약 탈퇴 선언',
        '트럼프 대통령이 파리 기후협약 탈퇴를 선언합니다. 에너지 정책 변화가 데이터센터 운영 비용에 영향을 줄 수 있습니다.',
        { countryEffects: { us: { aiFavorability: -2 } } }),

    W('alphago_zero', 20171018, 'ai_industry', '🤖',
        'AlphaGo Zero — 자기학습 AI 등장',
        'DeepMind의 AlphaGo Zero가 인간의 도움 없이 자기학습만으로 바둑 최강자가 되었습니다. AI의 잠재력에 대한 관심이 급증합니다.',
        { aiFavorability: 5, globalAILevel: 2, investorTrust: 5,
          specificCompetitor: { titanbrain: { aiLevel: 2, researchPower: 1 } } }),

    W('bitcoin_20k', 20171217, 'economic', '📊',
        '비트코인 $20,000 돌파',
        '암호화폐 시장이 과열되면서 비트코인이 사상 최고가를 기록합니다. GPU 채굴 수요가 급증하여 GPU 가격이 상승합니다.',
        { gpuPriceChange: 1500, investorTrust: -3 }),

    // ═══════════════════════════════════════════════════════════════
    // 2018
    // ═══════════════════════════════════════════════════════════════

    W('cambridge_analytica', 20180317, 'social', '👥',
        'Cambridge Analytica 데이터 스캔들',
        'Facebook에서 8,700만 명의 개인정보가 무단 수집된 사실이 폭로됩니다. 데이터 프라이버시에 대한 대중의 경각심이 높아집니다.',
        { aiFavorability: -4, publicImage: -2, dataCostChange: 2000,
          specificCompetitor: { nexaai: { marketShare: -3 } } }),

    W('google_duplex', 20180508, 'ai_industry', '🤖',
        'Google Duplex — AI 전화 통화 시연',
        'Google이 AI가 사람처럼 전화 예약을 하는 Duplex 기술을 시연합니다. 놀라운 기술력에 찬사와 윤리적 우려가 동시에 제기됩니다.',
        { aiFavorability: 1, globalAILevel: 1,
          specificCompetitor: { titanbrain: { aiLevel: 2 } } }),

    D('gdpr_enforcement', 20180525, 'regulatory', '⚖️',
        'EU GDPR 본격 시행',
        '유럽연합의 일반 데이터 보호 규정(GDPR)이 본격 시행됩니다. AI 학습용 데이터 수집에 새로운 제약이 생깁니다. 어떻게 대응하시겠습니까?',
        [
            { text: 'GDPR 완전 준수 체계 구축', effectHint: '자금↓ 평판↑', effects: { funds: -50000, reputation: 5, publicImage: 5 } },
            { text: '최소한의 준수만 한다', effectHint: '소액 비용', effects: { funds: -10000, publicImage: -1 } },
            { text: 'EU 시장은 당분간 무시한다', effectHint: '시장점유↓', effects: { marketShare: -1, publicImage: -3 } }
        ]),

    D('privacy_data_collection_2018', 20180615, 'social', '🔒',
        '대규모 사용자 데이터 수집 정책',
        '제품 성장의 속도를 높이기 위해, 사용자 데이터 수집 범위를 크게 넓힐지 결정해야 합니다. 프라이버시 논란이 뒤따를 수 있습니다.',
        [
            { text: '동의 없이 대규모 수집', effectHint: '데이터↑ 평판↓', effects: { data: 20, publicImage: -10 }, karma: { privacyViolation: true } },
            { text: '투명한 동의 기반 수집', effectHint: '데이터 소폭↑', effects: { data: 5 } },
            { text: '수집을 최소화한다', effectHint: '평판↑ 데이터↓', effects: { publicImage: 4, data: 2 } }
        ]),

    W('us_china_trade_war', 20180706, 'geopolitical', '🌐',
        '미중 무역전쟁 본격 개시',
        '미국이 중국에 대한 대규모 관세를 부과하면서 무역전쟁이 시작됩니다. 반도체 공급망과 AI 기술 교류에 타격이 예상됩니다.',
        { gpuPriceChange: 500, investorTrust: -3,
          countryEffects: { us: { aiFavorability: -1 }, cn: { aiFavorability: -2 } },
          specificCompetitor: { skydragon: { funding: -1 } } }),

    W('nvidia_rtx_launch', 20181017, 'technology', '🔬',
        'NVIDIA RTX 20 시리즈 출시',
        'NVIDIA가 레이 트레이싱과 텐서 코어를 탑재한 RTX 20 시리즈를 발표합니다. AI 학습 효율이 크게 향상됩니다.',
        { gpuPriceChange: -500, globalAILevel: 1, competitorBoost: 0.5 }),

    W('huawei_arrest', 20181201, 'geopolitical', '🌐',
        '화웨이 CFO 캐나다에서 체포',
        '미국의 요청으로 화웨이 CFO 멍완저우가 캐나다에서 체포됩니다. 미중 기술 갈등이 격화됩니다.',
        { countryEffects: { cn: { aiFavorability: -5 } },
          specificCompetitor: { skydragon: { funding: -1 } } }),

    // ═══════════════════════════════════════════════════════════════
    // 2019
    // ═══════════════════════════════════════════════════════════════

    D('gpt2_release', 20190214, 'ai_industry', '🤖',
        'GPT-2 공개 — "공개하기엔 너무 위험한 AI"',
        'OpenAI가 GPT-2 언어 모델을 개발했으나, 악용 우려로 전체 공개를 보류합니다. AI 안전과 오픈소스 사이의 딜레마가 업계에 화두가 됩니다. 당신의 회사도 입장을 정해야 합니다.',
        [
            { text: '우리도 안전 우선 — 모델 비공개 원칙 선언', effectHint: '평판↑ AI호감↑', effects: { reputation: 5, publicImage: 3, aiFavorability: 1 } },
            { text: '오픈소스 철학 지지 — 공개 원칙 선언', effectHint: '평판↑ 시장↑', effects: { reputation: 3, marketShare: 1, publicImage: 2 } },
            { text: '논쟁에서 한발 물러서 관망한다', effectHint: '변화 없음', effects: {} }
        ]),

    W('huawei_entity_list', 20190516, 'geopolitical', '🌐',
        '미국, 화웨이를 거래 제한 기업 목록에 추가',
        '미국이 화웨이를 Entity List에 올리며 기술 수출을 제한합니다. 글로벌 반도체 공급망에 혼란이 가중됩니다.',
        { gpuPriceChange: 800, countryEffects: { cn: { aiFavorability: -3 } },
          specificCompetitor: { skydragon: { researchPower: -1 } } }),

    W('hongkong_protests', 20190609, 'geopolitical', '🌐',
        '홍콩 민주화 시위 격화',
        '홍콩에서 범죄인 인도법에 반대하는 대규모 시위가 시작됩니다. 중국 기업들의 국제 평판이 하락하고, AI 감시 기술에 대한 우려가 커집니다.',
        { aiFavorability: -2, countryEffects: { cn: { aiFavorability: -5 } } }),

    W('japan_korea_trade', 20190704, 'geopolitical', '🌐',
        '일본, 한국에 반도체 소재 수출 규제',
        '일본이 한국에 대해 반도체 핵심 소재 수출을 규제합니다. 글로벌 반도체 공급망에 새로운 리스크가 추가됩니다.',
        { gpuPriceChange: 300,
          countryEffects: { kr: { aiFavorability: -2 }, jp: { aiFavorability: -1 } } }),

    W('google_quantum', 20191023, 'technology', '🔬',
        'Google, 양자 우월성 달성 주장',
        'Google이 Sycamore 양자 프로세서로 양자 우월성을 달성했다고 발표합니다. 양자 컴퓨팅이 AI에 미칠 영향에 관심이 집중됩니다.',
        { globalAILevel: 2, aiFavorability: 2, investorTrust: 3,
          specificCompetitor: { titanbrain: { aiLevel: 2 } } }),

    W('first_covid_cases', 20191231, 'disaster', '🦠',
        '중국 우한에서 원인 불명 폐렴 발생',
        '중국 우한에서 원인 불명의 폐렴 환자가 다수 보고됩니다. 아직 세계적 관심은 낮지만, 새로운 감염병의 조짐입니다.',
        { countryEffects: { cn: { aiFavorability: -1 } } }),

    // ═══════════════════════════════════════════════════════════════
    // 2020 — 코로나 팬데믹 & AI 전환점
    // ═══════════════════════════════════════════════════════════════

    W('covid_pandemic', 20200311, 'disaster', '🦠',
        'WHO, COVID-19 팬데믹 선언',
        '세계보건기구가 코로나바이러스를 팬데믹으로 선언합니다. 전 세계적 봉쇄로 경제 활동이 위축되지만, 디지털 전환과 AI 수요가 급증합니다.',
        { investorTrust: -10, aiFavorability: 3, funds: -100000,
          unemployment: { office: 3, transport: 5, manufacturing: 4, design: 2 },
          gpuPriceChange: 1000 }),

    D('covid_remote_work', 20200320, 'social', '🏠',
        '전 세계 재택근무 전환',
        '코로나 팬데믹으로 기업들이 재택근무로 전환하고 있습니다. 클라우드와 AI 서비스 수요가 급증하는 기회입니다. 우리 회사도 대응이 필요합니다.',
        [
            { text: '전면 원격근무 전환 — 비용 절감에 집중', effectHint: '비용↓ 사기↑', effects: { funds: 30000, morale: 10 } },
            { text: 'AI 원격 협업 도구 개발 — 사업 기회 포착', effectHint: '자금↓ 평판↑', effects: { funds: -80000, reputation: 5, aiFavorability: 1, investorTrust: 3 } },
            { text: '기존 방식 유지 — 사무실 근무 계속', effectHint: '사기↓', effects: { morale: -15 } }
        ]),

    W('gpt3_announced', 20200611, 'ai_industry', '🤖',
        'OpenAI, GPT-3 발표 — 1750억 파라미터',
        'OpenAI가 역대 최대 규모의 언어 모델 GPT-3를 발표합니다. 놀라운 텍스트 생성 능력에 업계가 충격에 빠집니다. AI 투자 열풍이 시작됩니다.',
        { aiFavorability: 5, globalAILevel: 3, investorTrust: 8,
          competitorBoost: 1,
          specificCompetitor: { openmind: { aiLevel: 5, marketShare: 5 } } }),

    W('floyd_protests', 20200601, 'social', '👥',
        '조지 플로이드 사건과 AI 편향성 논쟁',
        'BLM 운동이 전 세계로 확산되면서 AI 안면인식 기술의 인종 편향 문제가 재조명됩니다. IBM, Amazon 등이 경찰 안면인식 제공을 중단합니다.',
        { aiFavorability: -3, publicImage: -1 }),

    W('nvidia_arm', 20200913, 'technology', '🔬',
        'NVIDIA, ARM 인수 추진 ($400억)',
        'NVIDIA가 칩 설계 기업 ARM을 400억 달러에 인수하겠다고 발표합니다. 반도체 업계 판도가 크게 바뀔 수 있습니다.',
        { gpuPriceChange: 500, globalAILevel: 1 }),

    W('us_election_2020', 20201103, 'geopolitical', '🇺🇸',
        '바이든 미국 대통령 당선',
        '조 바이든이 미국 대통령에 당선됩니다. 과학/기술 투자 확대와 함께 AI 규제 논의도 활발해질 것으로 예상됩니다.',
        { investorTrust: 5, countryEffects: { us: { aiFavorability: 3 } } }),

    W('alphafold_2', 20201130, 'ai_industry', '🤖',
        'AlphaFold 2 — AI가 단백질 구조를 예측',
        'DeepMind의 AlphaFold 2가 단백질 3D 구조 예측 문제를 사실상 해결합니다. AI가 과학 연구에 혁명을 가져올 수 있음이 입증되었습니다.',
        { aiFavorability: 8, globalAILevel: 3, investorTrust: 5,
          specificCompetitor: { titanbrain: { aiLevel: 3, marketShare: 2 } } }),

    W('covid_vaccine', 20201211, 'technology', '🔬',
        'COVID-19 백신 긴급 사용 승인',
        '화이자-바이오엔텍 백신이 긴급 사용 승인을 받습니다. AI가 백신 개발 가속에 기여했다는 보도에 AI 호감도가 상승합니다.',
        { aiFavorability: 5, investorTrust: 5,
          unemployment: { office: -1, transport: -1 } }),

    // ═══════════════════════════════════════════════════════════════
    // 2021
    // ═══════════════════════════════════════════════════════════════

    W('capitol_riot', 20210106, 'geopolitical', '🇺🇸',
        '미국 의회 의사당 난입 사건',
        '트럼프 지지자들이 미국 의회 의사당에 난입합니다. 소셜미디어 알고리즘의 역할에 대한 비판이 거세집니다.',
        { aiFavorability: -3, countryEffects: { us: { aiFavorability: -3 } } }),

    W('gamestop_squeeze', 20210128, 'economic', '📊',
        'GameStop 주가 폭등 — 밈 주식 열풍',
        '레딧 커뮤니티 주도로 GameStop 주가가 폭등합니다. AI 기반 트레이딩 알고리즘의 한계가 드러나며 시장 변동성이 급증합니다.',
        { investorTrust: -5 }),

    W('suez_canal', 20210323, 'economic', '📊',
        '수에즈 운하 봉쇄',
        '컨테이너선 에버기븐호가 수에즈 운하를 막아 글로벌 공급망이 마비됩니다. 반도체와 하드웨어 공급에 차질이 빚어집니다.',
        { gpuPriceChange: 1000 }),

    W('colonial_pipeline', 20210507, 'disaster', '💻',
        'Colonial Pipeline 랜섬웨어 공격',
        '미국 최대 연료 파이프라인이 랜섬웨어 공격으로 마비됩니다. AI 사이버 보안에 대한 수요와 투자가 급증합니다.',
        { aiFavorability: 2, investorTrust: 3 }),

    W('github_copilot', 20210629, 'ai_industry', '🤖',
        'GitHub Copilot 출시 — AI 코드 생성',
        'GitHub과 OpenAI가 AI 코드 생성 도구 Copilot을 발표합니다. 개발자 생산성이 향상되지만, 개발자 일자리에 대한 우려도 나타납니다.',
        { aiFavorability: 2, globalAILevel: 2,
          unemployment: { development: 1 },
          specificCompetitor: { openmind: { aiLevel: 1 }, omnisoft: { marketShare: 2 } } }),

    W('chip_shortage_2021', 20210915, 'economic', '📊',
        '글로벌 반도체 품귀 현상 심화',
        '자동차, 전자제품, 서버 등 모든 분야에서 반도체 품귀가 심각해집니다. GPU 가격이 천정부지로 치솟습니다.',
        { gpuPriceChange: 3000, gpuPriceMult: 1.2 }),

    W('facebook_meta', 20211028, 'technology', '🔬',
        'Facebook, Meta로 사명 변경 — 메타버스 선언',
        'Facebook이 사명을 Meta로 바꾸고 메타버스에 올인합니다. AI 연구 투자도 대폭 확대됩니다.',
        { specificCompetitor: { nexaai: { funding: 1, researchPower: 1, aiLevel: 2 } } }),

    // ═══════════════════════════════════════════════════════════════
    // 2022 — 우크라이나 전쟁 & AI 혁명 시작
    // ═══════════════════════════════════════════════════════════════

    W('russia_ukraine', 20220224, 'military', '⚔️',
        '러시아, 우크라이나 침공',
        '러시아가 우크라이나를 전면 침공합니다. 에너지 가격 급등, 글로벌 공급망 혼란, 사이버전 격화가 예상됩니다. AI 군사 기술에 대한 관심이 급증합니다.',
        { investorTrust: -8, gpuPriceChange: 2000, aiFavorability: -2,
          unemployment: { transport: 2, manufacturing: 1 },
          countryEffects: { ru: { aiFavorability: -15 }, ua: { aiFavorability: -10 } } }),

    W('europe_energy_crisis', 20220310, 'energy', '⚡',
        '유럽 에너지 위기 — 천연가스 가격 폭등',
        '러시아 제재로 유럽의 천연가스 공급이 급감합니다. 데이터센터 운영비가 급등하며 AI 기업들의 비용 부담이 커집니다.',
        { gpuPriceMult: 1.1,
          countryEffects: { de: { aiFavorability: -3 }, gb: { aiFavorability: -2 }, fr: { aiFavorability: -2 } } }),

    W('luna_terra_crash', 20220509, 'economic', '📊',
        'Luna/Terra 붕괴 — 암호화폐 폭락',
        '스테이블코인 Terra(UST)와 Luna가 순식간에 붕괴하며 수백억 달러가 증발합니다. 기술 투자 심리가 위축됩니다.',
        { investorTrust: -5, gpuPriceChange: -1000 }),

    W('chip_shortage_2022_extreme', 20220620, 'economic', '📊',
        '글로벌 GPU 대란 심화',
        '반도체 공급난이 다시 악화되며 GPU 확보가 사실상 전쟁 수준이 됩니다. 자체 조달과 클라우드 비용 모두 상승합니다.',
        { gpuPriceMult: 2.5, cloudCostMult: 1.8, gpuSupplyShutdown: true, gpuSupplyShutdownMonths: 3, investorTrust: -6 }),

    W('inflation_rate_hikes', 20220615, 'economic', '📊',
        '미 연준, 자이언트 스텝 금리 인상',
        '인플레이션 대응을 위해 미 연준이 0.75%p 금리 인상을 단행합니다. 스타트업 자금 조달 환경이 급격히 악화됩니다.',
        { investorTrust: -8, valuationMult: 0.85 }),

    D('chip_shortage_2022_crisis', 20220620, 'economic', '🧩',
        '글로벌 반도체 대란',
        'AI와 전장 수요가 겹치며 GPU 공급이 사실상 끊겼습니다. 앞으로 3개월간 어떤 방식으로 버틸지 결정해야 합니다.',
        [
            {
                text: '프리미엄을 얹어 긴급 물량을 확보한다',
                effectHint: '자금↓↓ 비상 GPU 확보',
                effects: {
                    funds: -900000,
                    computing: 4,
                    gpuSupplyShutdown: true,
                    gpuSupplyShutdownMonths: 3,
                    gpuPriceMult: 2.2,
                    cloudCostMult: 1.6
                }
            },
            {
                text: '클라우드로 긴급 전환한다',
                effectHint: '월 비용↑ 서비스 유지',
                effects: {
                    funds: -250000,
                    computing: 8,
                    gpuSupplyShutdown: true,
                    gpuSupplyShutdownMonths: 3,
                    gpuPriceMult: 2.2,
                    cloudCostMult: 1.85
                }
            },
            {
                text: '내부 칩 프로그램에 예산을 밀어 넣는다',
                effectHint: '자금↓ 투자 신뢰↑',
                effects: {
                    funds: -450000,
                    investorTrust: 4,
                    reputation: 2,
                    gpuSupplyShutdown: true,
                    gpuSupplyShutdownMonths: 3,
                    gpuPriceMult: 2.35,
                    cloudCostMult: 1.5
                }
            },
            {
                text: '훈련을 줄이고 서비스 운영에 집중한다',
                effectHint: '성장 둔화 리스크↓',
                effects: {
                    investorTrust: -3,
                    aiFavorability: 2,
                    gpuSupplyShutdown: true,
                    gpuSupplyShutdownMonths: 3,
                    gpuPriceMult: 2.1,
                    cloudCostMult: 1.45
                }
            }
        ]),

    W('dall_e_2', 20220720, 'ai_industry', '🤖',
        'DALL-E 2 공개 — AI 이미지 생성 시대',
        'OpenAI의 DALL-E 2가 텍스트만으로 고품질 이미지를 생성합니다. AI 창작물에 대한 열광과 우려가 동시에 폭발합니다.',
        { aiFavorability: 3, globalAILevel: 2,
          unemployment: { design: 2 },
          specificCompetitor: { openmind: { aiLevel: 2, marketShare: 3 } } }),

    D('stable_diffusion', 20220822, 'ai_industry', '🤖',
        'Stable Diffusion 오픈소스 공개',
        'Stability AI가 이미지 생성 AI Stable Diffusion을 오픈소스로 공개합니다. 누구나 AI 이미지 생성이 가능해지면서 업계에 파장이 일고 있습니다. 당신의 입장은?',
        [
            { text: '오픈소스 지지 — AI 민주화에 동참', effectHint: '평판↑ 시장↑', effects: { reputation: 5, publicImage: 5, marketShare: 1 } },
            { text: '위험성 경고 — 안전한 AI 사용을 촉구', effectHint: '안전 평판↑', effects: { reputation: 3, publicImage: 2, aiFavorability: 1 } },
            { text: '관망하며 자사 모델 개발에 집중', effectHint: '변화 없음', effects: {} }
        ]),

    W('china_semiconductor_ban', 20221007, 'geopolitical', '🌐',
        '미국, 중국에 첨단 반도체 수출 통제',
        '미국이 중국에 대한 첨단 반도체와 장비 수출을 전면 통제합니다. 글로벌 AI 칩 공급망에 대격변이 일어납니다.',
        { gpuPriceChange: 1500,
          countryEffects: { cn: { aiFavorability: -8 } },
          specificCompetitor: { skydragon: { researchPower: -2, funding: -1 } } }),

    W('elon_twitter', 20221027, 'technology', '🔬',
        '일론 머스크, 트위터 인수 ($440억)',
        '일론 머스크가 트위터를 440억 달러에 인수합니다. 기술 업계 리더의 소셜미디어 장악이 AI 담론에 영향을 미칩니다.',
        { aiFavorability: -1, investorTrust: -2 }),

    W('ftx_collapse', 20221111, 'economic', '📊',
        'FTX 거래소 파산 — 암호화폐 신뢰 붕괴',
        '세계 2위 암호화폐 거래소 FTX가 하룻밤 만에 파산합니다. 기술 스타트업 투자 심리가 얼어붙습니다.',
        { investorTrust: -10, gpuPriceChange: -800 }),

    W('chatgpt_launch', 20221130, 'ai_industry', '🤖',
        'ChatGPT 출시 — AI 대중화의 시작',
        'OpenAI가 ChatGPT를 출시합니다. 출시 5일 만에 100만 사용자를 돌파하며 전 세계에 AI 열풍이 시작됩니다. AI 산업의 역사가 바뀌는 순간입니다.',
        { aiFavorability: 10, globalAILevel: 5, investorTrust: 15,
          competitorBoost: 2,
          specificCompetitor: { openmind: { aiLevel: 8, marketShare: 10 } } }),

    W('us_chips_act', 20220809, 'geopolitical', '🇺🇸',
        '미국 CHIPS법 서명 — $527억 반도체 투자',
        '바이든 대통령이 CHIPS법에 서명합니다. 미국 내 반도체 생산 투자에 527억 달러가 지원됩니다.',
        { gpuPriceChange: -1000,
          countryEffects: { us: { aiFavorability: 3 } } }),

    // ═══════════════════════════════════════════════════════════════
    // 2023 — AI 빅뱅
    // ═══════════════════════════════════════════════════════════════

    W('ms_openai_10b', 20230123, 'ai_industry', '🤖',
        'Microsoft, OpenAI에 $100억 투자',
        'Microsoft가 OpenAI에 100억 달러를 추가 투자합니다. AI 산업에 역대 최대 규모의 투자가 이루어지며 경쟁이 격화됩니다.',
        { investorTrust: 10, globalAILevel: 2,
          specificCompetitor: { openmind: { funding: 2, aiLevel: 3 }, omnisoft: { aiLevel: 2, marketShare: 3 } } }),

    W('chatgpt_100m', 20230201, 'ai_industry', '🤖',
        'ChatGPT, 2개월 만에 1억 사용자 달성',
        'ChatGPT가 출시 2개월 만에 월간 활성 사용자 1억 명을 돌파합니다. 역사상 가장 빠르게 성장한 서비스가 됩니다.',
        { aiFavorability: 5, globalAILevel: 2, investorTrust: 5,
          specificCompetitor: { openmind: { marketShare: 5 } } }),

    W('svb_collapse', 20230310, 'economic', '📊',
        'Silicon Valley Bank 파산',
        '실리콘밸리은행(SVB)이 파산합니다. 수많은 스타트업의 자금이 동결되면서 기술 투자 생태계에 충격파가 퍼집니다.',
        { investorTrust: -12, funds: -50000, valuationMult: 0.9 }),

    W('gpt4_release', 20230314, 'ai_industry', '🤖',
        'GPT-4 출시 — 멀티모달 AI의 등장',
        'OpenAI가 텍스트와 이미지를 동시에 이해하는 GPT-4를 출시합니다. 변호사 시험 상위 10% 수준의 성능에 세계가 놀랍니다.',
        { aiFavorability: 5, globalAILevel: 5, investorTrust: 10,
          unemployment: { office: 2, development: 2 },
          competitorBoost: 1.5,
          specificCompetitor: { openmind: { aiLevel: 8, marketShare: 5 } } }),

    D('italy_chatgpt_ban', 20230331, 'regulatory', '⚖️',
        '이탈리아, ChatGPT 일시 차단',
        '이탈리아 데이터 보호 당국이 개인정보 문제를 이유로 ChatGPT 접속을 차단합니다. 유럽 전역에서 AI 규제 논의가 가속됩니다. 규제 리스크에 어떻게 대비하시겠습니까?',
        [
            { text: '선제적으로 프라이버시 보호 강화', effectHint: '자금↓ 평판↑ AI호감↑', effects: { funds: -100000, reputation: 8, publicImage: 5, aiFavorability: 2 } },
            { text: '유럽 시장에서 일부 기능을 제한', effectHint: '시장↓', effects: { marketShare: -1, publicImage: 1 } },
            { text: '로비를 통해 규제 완화 시도', effectHint: '자금↓ 평판↓↓', effects: { funds: -200000, reputation: -5, publicImage: -3 } }
        ]),

    W('nvidia_1t', 20230530, 'economic', '📊',
        'NVIDIA 시가총액 $1조 돌파',
        'AI 칩 수요 폭발에 힘입어 NVIDIA가 시가총액 1조 달러를 돌파합니다. GPU 수급 불균형이 심화됩니다.',
        { gpuPriceChange: 2000, gpuPriceMult: 1.15, investorTrust: 5 }),

    W('hollywood_strike', 20230714, 'social', '👥',
        '할리우드 작가·배우 파업 — AI 위협에 반발',
        '미국 할리우드 작가와 배우들이 AI의 창작물 대체에 반대하며 대규모 파업에 돌입합니다. AI에 대한 노동자들의 저항이 가시화됩니다.',
        { aiFavorability: -5, unemployment: { design: 3 }, publicImage: -2 }),

    D('llama2_release', 20230718, 'ai_industry', '🤖',
        'Meta, Llama 2 오픈소스 공개',
        'Meta가 대형 언어 모델 Llama 2를 오픈소스로 공개합니다. 오픈소스 AI 모델의 시대가 본격적으로 열립니다. 당신의 전략은?',
        [
            { text: '오픈소스 생태계에 적극 참여', effectHint: '평판↑↑ 시장↑', effects: { reputation: 8, publicImage: 5, marketShare: 1, competitorBoost: 0.5 } },
            { text: 'Llama 2 기반으로 자사 모델 파인튜닝', effectHint: 'AI레벨↑ 비용 절감', effects: { globalAILevel: 1, funds: 50000 } },
            { text: '독자 기술로 승부 — 폐쇄형 모델 전략', effectHint: '독자 경쟁력', effects: { reputation: 2, investorTrust: 3 } }
        ]),

    D('open_source_betrayal_20230830', 20230830, 'ai_industry', '📦',
        '오픈소스 공개 방침을 둘러싼 내부 논쟁',
        '핵심 모델의 일부를 오픈소스로 공개할지, 아니면 다시 폐쇄형으로 전환할지 결정을 내려야 합니다. 커뮤니티 신뢰가 걸려 있습니다.',
        [
            { text: '공개 약속을 철회하고 폐쇄형으로 전환', effectHint: '단기 매출↑ 향후 보복', effects: { reputation: -5, publicImage: -8, investorTrust: 2 }, karma: { openSourceBetrayal: true } },
            { text: '부분 공개를 유지한다', effectHint: '균형', effects: { reputation: 3, publicImage: 2 } },
            { text: '전면 오픈소스를 고수한다', effectHint: '평판↑ 시장↓', effects: { reputation: 10, publicImage: 5, marketShare: -2 } }
        ]),

    W('biden_ai_exec_order', 20231030, 'regulatory', '⚖️',
        '바이든, AI 안전에 관한 행정명령 서명',
        '미국 대통령이 AI 안전과 보안에 관한 포괄적 행정명령에 서명합니다. 대형 AI 모델은 정부에 안전 테스트 결과를 보고해야 합니다.',
        { aiFavorability: 3, countryEffects: { us: { aiFavorability: 3 } } }),

    W('israel_hamas_war', 20231007, 'military', '⚔️',
        '이스라엘-하마스 전쟁 발발',
        '하마스의 기습 공격으로 이스라엘-하마스 전쟁이 시작됩니다. 중동 지정학적 불안이 에너지 시장과 글로벌 투자 심리에 영향을 줍니다.',
        { investorTrust: -5, gpuPriceChange: 300 }),

    W('altman_fired', 20231117, 'ai_industry', '🤖',
        'OpenAI CEO 샘 올트먼 해임 — 극적 복귀',
        'OpenAI 이사회가 CEO 샘 올트먼을 전격 해임하지만, 직원 95%의 반발과 Microsoft의 개입으로 5일 만에 복귀합니다. AI 업계 역사상 가장 드라마틱한 사건입니다.',
        { investorTrust: -3, aiFavorability: -1,
          specificCompetitor: { openmind: { marketShare: -3 }, omnisoft: { marketShare: 2 } } }),

    // ═══════════════════════════════════════════════════════════════
    // 2024 — AI 경쟁 격화
    // ═══════════════════════════════════════════════════════════════

    W('gemini_controversy', 20240221, 'ai_industry', '🤖',
        'Google Gemini 이미지 생성 논란',
        'Google의 Gemini가 역사적 인물을 부정확하게 생성하는 문제로 논란이 됩니다. AI의 편향성과 정확성에 대한 논쟁이 재점화됩니다.',
        { aiFavorability: -3, publicImage: 1,
          specificCompetitor: { titanbrain: { marketShare: -5, aiLevel: -1 } } }),

    W('claude_3_opus', 20240304, 'ai_industry', '🤖',
        'Anthropic Claude 3 Opus 출시',
        'Anthropic이 Claude 3 Opus를 출시합니다. 안전성과 성능을 모두 갖춘 모델로 평가받으며 AI 안전 연구의 가치가 재조명됩니다.',
        { aiFavorability: 3, globalAILevel: 3,
          specificCompetitor: { cloudpillar: { aiLevel: 6, marketShare: 5 } } }),

    W('eu_ai_act_final', 20240313, 'regulatory', '⚖️',
        'EU AI Act 최종 승인',
        '유럽연합이 세계 최초의 포괄적 AI 규제법인 AI Act를 최종 승인합니다. 고위험 AI 시스템에 대한 엄격한 규제가 적용됩니다.',
        { aiFavorability: 3,
          countryEffects: { de: { aiFavorability: 3 }, fr: { aiFavorability: 3 } } }),

    D('political_campaign_support_20240418', 20240418, 'geopolitical', '🗳️',
        '정치 캠페인 지원 요청',
        '여러 정치 캠페인에서 당신의 AI를 활용한 유권자 분석과 메시지 최적화를 제안합니다. 수익과 영향력, 그리고 윤리적 리스크가 동시에 따라옵니다.',
        [
            { text: '정치 캠페인을 적극 지원한다', effectHint: '자금↑ 호감↓', effects: { funds: 400000, publicImage: -15 }, karma: { aiManipulation: true } },
            { text: '중립 원칙을 선언한다', effectHint: '평판↑', effects: { reputation: 5, publicImage: 5 } },
            { text: '윤리 기준을 세우고 제한적으로만 지원한다', effectHint: '소폭 수익', effects: { funds: 150000, reputation: 2 } }
        ]),

    W('gpt4o_release', 20240513, 'ai_industry', '🤖',
        'OpenAI GPT-4o 출시 — 실시간 음성 AI',
        'OpenAI가 실시간 음성 대화가 가능한 GPT-4o를 무료로 공개합니다. AI 기능의 대중화가 가속됩니다.',
        { aiFavorability: 5, globalAILevel: 3,
          specificCompetitor: { openmind: { aiLevel: 5, marketShare: 5 } } }),

    W('apple_intelligence', 20240610, 'technology', '🔬',
        'Apple, Apple Intelligence 발표',
        'Apple이 WWDC에서 AI 전략 Apple Intelligence를 발표합니다. 빅테크 전체가 AI에 올인하면서 경쟁이 극한으로 치닫습니다.',
        { globalAILevel: 2, competitorBoost: 1, investorTrust: 5 }),

    W('nvidia_most_valuable', 20240618, 'economic', '📊',
        'NVIDIA, 세계 최고 시가총액 기업 등극',
        'NVIDIA가 Microsoft와 Apple을 제치고 세계 시가총액 1위에 올랍니다. AI 칩 수요가 그만큼 폭발적이라는 증거입니다.',
        { gpuPriceChange: 1500, investorTrust: 8, globalAILevel: 2 }),

    W('crowdstrike_outage', 20240719, 'disaster', '💻',
        'CrowdStrike 장애 — 전 세계 IT 시스템 마비',
        '보안 소프트웨어 CrowdStrike의 업데이트 오류로 전 세계 850만 대의 Windows 시스템이 마비됩니다. AI 의존도에 대한 경고가 됩니다.',
        { aiFavorability: -4, investorTrust: -3 }),

    W('nobel_ai_prizes', 20241009, 'ai_industry', '🤖',
        '노벨상에 AI 연구자 — 힌턴, 하사비스 수상',
        '제프리 힌턴이 노벨 물리학상을, 데미스 하사비스가 노벨 화학상을 수상합니다. AI 연구가 노벨상급 업적으로 인정받는 역사적 순간입니다.',
        { aiFavorability: 8, globalAILevel: 3, investorTrust: 8,
          specificCompetitor: { titanbrain: { aiLevel: 3, marketShare: 2 } } }),

    W('nvidia_blackwell', 20240620, 'technology', '🔬',
        'NVIDIA, Blackwell 데이터센터 AI 플랫폼 공개',
        'NVIDIA가 Blackwell 플랫폼을 공개하며 데이터센터 AI 성능 경쟁을 한 단계 끌어올립니다. 첨단 패키징과 HBM 수요도 함께 더 거세집니다.',
        { gpuPriceChange: 1000, globalAILevel: 2, investorTrust: 4 }),

    W('hbm_supply_squeeze', 20240725, 'economic', '📊',
        'HBM 공급 부족이 다시 심화',
        'AI 수요가 메모리 공급을 다시 압박합니다. HBM 재고가 빠르게 줄어들며 훈련팀과 칩 프로그램 모두 비용 상승 압력을 받습니다.',
        { gpuPriceChange: 1500, investorTrust: -2, aiFavorability: 1 }),

    W('tsmc_2nm_race', 20241022, 'technology', '🏭',
        'TSMC, 2nm 생산 경쟁을 가속',
        'TSMC가 2nm 로드맵을 앞당기며 차세대 파운드리 캐파 경쟁이 더 치열해집니다. 커스텀 실리콘을 노리는 기업들의 관심도 높아집니다.',
        { gpuPriceChange: -500, globalAILevel: 1, investorTrust: 3 }),

    W('us_election_2024', 20241105, 'geopolitical', '🇺🇸',
        '트럼프, 미국 대통령 재선',
        '도널드 트럼프가 미국 대통령에 재선됩니다. AI 규제 완화와 기술 기업 우호적 정책이 예상되지만, 국제 관계 불확실성도 높아집니다.',
        { investorTrust: 5, countryEffects: { us: { aiFavorability: 2 } } }),

    D('military_ai_contract_20241120', 20241120, 'military', '⚔️',
        '방위 기술 계약 제안',
        '국방 기관에서 AI 분석 및 자율 방어 체계 구축 계약을 제안했습니다. 수익성은 높지만 향후 정치적 비용이 큽니다.',
        [
            { text: '계약을 수락한다', effectHint: '자금↑ 군사 카르마', effects: { funds: 1200000, investorTrust: 4, publicImage: -5 }, karma: { militaryContract: true } },
            { text: '조건부로만 수락한다', effectHint: '수익↓ 논란↓', effects: { funds: 500000, reputation: 2 } },
            { text: '정중히 거절한다', effectHint: '평판↑', effects: { reputation: 5, publicImage: 4 } }
        ]),

    {
        ...D('custom_silicon_pilot', 20241118, 'ai_industry', '🧪',
        '내부 실리콘 파일럿 결과 검토',
        '내부 칩 팀이 고무적인 파일럿 결과를 보고했습니다. 아직 완성 단계는 아니지만, 커스텀 실리콘의 필요성이 훨씬 분명해졌습니다. 다음 수순을 정해야 합니다.',
        [
            { text: '더 큰 파일럿 규모로 밀어붙인다', effectHint: '자금↓ 진행도↑', effects: { funds: -300000, reputation: 4, aiFavorability: 2 } },
            { text: '보수적으로 디자인을 다듬는다', effectHint: '위험↓ 보상↓', effects: { reputation: 1, investorTrust: 2 } },
            { text: '일시 중단하고 예산을 재배분한다', effectHint: '즉시 변화 없음', effects: { funds: 150000, publicImage: -1 } }
        ]),
        condition: (state) => state.economy?.chipPrograms?.some(program => program.phase === 'pilot') || state.economy?.completedChipPrograms?.length > 0
    },

    // ═══════════════════════════════════════════════════════════════
    // 2025 — AI 에이전트 시대
    // ═══════════════════════════════════════════════════════════════

    W('deepseek_r1', 20250120, 'ai_industry', '🤖',
        'DeepSeek R1 — 중국발 오픈소스 AI 충격',
        '중국 스타트업 DeepSeek이 저비용으로 개발한 R1 모델을 오픈소스로 공개합니다. 미국 AI 기업들의 독주에 경고등이 켜집니다.',
        { aiFavorability: 3, globalAILevel: 3, investorTrust: -5,
          gpuPriceChange: -1000,
          specificCompetitor: { skydragon: { aiLevel: 5, researchPower: 1, marketShare: 3 } } }),

    W('ai_agents_mainstream', 20250315, 'ai_industry', '🤖',
        'AI 에이전트 시대 개막',
        'AI 에이전트가 주류로 자리잡기 시작합니다. AI가 사용자 대신 업무를 수행하고, 도구를 사용하며, 결정을 내리는 시대가 열립니다.',
        { aiFavorability: 3, globalAILevel: 5, investorTrust: 8,
          unemployment: { office: 3, development: 3 },
          competitorBoost: 2 }),

    W('us_china_chip_escalation', 20250415, 'geopolitical', '🌐',
        '미중 반도체 전쟁 격화',
        '미국이 중국에 대한 AI 칩 수출 규제를 더욱 강화합니다. 글로벌 반도체 공급망이 미국 vs 중국 진영으로 양분됩니다.',
        { gpuPriceChange: 2000,
          countryEffects: { cn: { aiFavorability: -5 }, us: { aiFavorability: 1 } },
          specificCompetitor: { skydragon: { researchPower: -1 } } }),

    D('datacenter_energy_crisis', 20250701, 'energy', '⚡',
        'AI 데이터센터 전력 위기',
        'AI 데이터센터의 폭발적 전력 소비로 여러 지역에서 전력 부족 사태가 발생합니다. AI 산업의 지속가능성에 의문이 제기됩니다. 어떻게 대응하시겠습니까?',
        [
            { text: '에너지 효율 기술에 대규모 투자', effectHint: '자금↓↓ 장기 경쟁력↑', effects: { funds: -300000, reputation: 8, publicImage: 5, aiFavorability: 2 } },
            { text: '재생에너지 파트너십 체결', effectHint: '자금↓ 이미지↑', effects: { funds: -150000, reputation: 5, publicImage: 8 } },
            { text: '문제를 무시하고 확장 계속', effectHint: '호감도↓', effects: { aiFavorability: -5, publicImage: -5 } }
        ]),

    W('ai_healthcare_breakthrough', 20250901, 'ai_industry', '🤖',
        'AI 의료 혁신 — 암 조기진단 정확도 99%',
        'AI 시스템이 여러 종류의 암을 초기 단계에서 99% 정확도로 진단하는 데 성공합니다. AI의 긍정적 가능성이 부각됩니다.',
        { aiFavorability: 10, globalAILevel: 3, investorTrust: 8 }),

    W('international_ai_governance', 20251201, 'regulatory', '⚖️',
        '국제 AI 거버넌스 프레임워크 합의',
        '주요 40개국이 AI 개발에 관한 최초의 국제 프레임워크에 합의합니다. AI 개발에 최소한의 안전 기준이 적용됩니다.',
        { aiFavorability: 5, globalAILevel: 1 }),

    // ═══════════════════════════════════════════════════════════════
    // 2026-2030 — AGI를 향해
    // ═══════════════════════════════════════════════════════════════

    W('quantum_ai_milestone', 20270601, 'technology', '🔬',
        '양자컴퓨팅-AI 융합 돌파구',
        '양자 컴퓨터가 특정 AI 학습 작업에서 기존 슈퍼컴퓨터 대비 1000배 속도 향상을 달성합니다. AI 연구의 새로운 시대가 열립니다.',
        { globalAILevel: 10, aiFavorability: 5, investorTrust: 10, competitorBoost: 3 }),

    W('ai_unemployment_crisis', 20280101, 'social', '👥',
        'AI 대체 실업 위기 본격화',
        '선진국 실업률이 AI 자동화로 15%를 돌파합니다. 각국 정부가 긴급 대책을 발표하지만, AI에 대한 반감이 극에 달합니다.',
        { aiFavorability: -15, unemployment: { office: 10, transport: 8, manufacturing: 8, design: 5, development: 5 } }),

    D('near_agi_demo', 20290601, 'ai_industry', '🤖',
        '최초의 근AGI 수준 시스템 시연',
        '한 연구기관이 다양한 분야에서 인간 수준의 추론 능력을 보이는 AI 시스템을 시연합니다. AGI의 도래가 임박했다는 인식이 퍼집니다. 당신의 전략은?',
        [
            { text: '안전 최우선 — AGI 안전 연구에 자원 집중', effectHint: '평판↑↑ 호감↑', effects: { reputation: 15, publicImage: 10, aiFavorability: 5, funds: -500000 } },
            { text: 'AGI 레이스 가속 — 경쟁에서 뒤처질 수 없다', effectHint: 'AI레벨↑ 호감↓', effects: { globalAILevel: 5, aiFavorability: -5, investorTrust: 10 } },
            { text: '국제 공조 촉구 — AGI 개발 모라토리엄 제안', effectHint: '호감↑↑ 경쟁사 견제', effects: { aiFavorability: 10, reputation: 10, competitorBoost: -3 } }
        ]),

    W('singularity_approach', 20300101, 'ai_industry', '🤖',
        '특이점 임박 — 전 세계가 주목하다',
        '여러 기업이 AGI에 근접한 시스템을 보유하고 있음이 알려집니다. 인류 역사상 가장 중대한 기술적 전환점이 다가오고 있습니다.',
        { globalAILevel: 15, aiFavorability: -5, investorTrust: 15, competitorBoost: 5 }),
];


// ========================================================================
// RANDOM EVENTS — 조건 기반 확률 이벤트 (매월 체크)
// ========================================================================
export const RANDOM_EVENTS = [
    {
        id: 'gov_regulation',
        title: '정부 AI 규제 강화 움직임',
        description: '당신의 회사가 소재한 국가의 정부가 AI 개발에 대한 규제를 강화하려 합니다. 어떻게 대응하시겠습니까?',
        icon: '⚖️', category: 'regulatory',
        probability: 0.03,
        condition: (state) => state.global.globalAILevel > 20,
        choices: [
            { text: '규제에 순응한다', effectHint: '평판↑ 호감↑', effects: { reputation: 5, aiFavorability: 3 } },
            { text: '로비로 대응한다', effectHint: '자금↓ 평판↓', effects: { funds: -100000, reputation: -3 }, karma: { lobbyCorruption: true } },
            { text: '다른 국가로 연구 이전 검토', effectHint: '자금↓↓', effects: { funds: -200000 } }
        ]
    },
    {
        id: 'investment_offer',
        title: '투자자 미팅 제안',
        description: '저명한 벤처캐피탈로부터 투자 논의를 위한 미팅 제안이 들어왔습니다.',
        icon: '💰', category: 'economic',
        probability: 0.04,
        condition: (state) => state.reputation.corporate > -20,
        choices: [
            { text: '투자 수락 ($2M, 조건부)', effectHint: '자금↑↑ 신뢰↑', effects: { funds: 2000000, investorTrust: 5 } },
            { text: '조건부 수락 ($1M, 자율성 유지)', effectHint: '자금↑ 신뢰↑', effects: { funds: 1000000, investorTrust: 3 } },
            { text: '정중히 거절 (독립성 유지)', effectHint: '평판↑', effects: { reputation: 5 } }
        ]
    },
    {
        id: 'talent_poaching',
        title: '핵심 인재 이직 위기',
        description: '경쟁사가 핵심 연구원에게 현재 연봉의 2배를 제시했다는 소식이 들립니다.',
        icon: '🏃', category: 'social',
        probability: 0.05,
        condition: (state) => state.talents.length > 3,
        choices: [
            { text: '급여 30% 인상으로 만류', effectHint: '인건비↑ 사기↑', effects: { salaryIncrease: 0.3, morale: 15 } },
            { text: '연구 자율성과 스톡옵션 보장', effectHint: '사기↑ 평판↑', effects: { morale: 10, reputation: 2 } },
            { text: '붙잡지 않는다 — 보내준다', effectHint: '인재 이탈 사기↓', effects: { loseTalent: true, morale: -5 } }
        ]
    },
    {
        id: 'ethics_scandal',
        title: 'AI 윤리 스캔들',
        description: '당사 AI 모델에서 심각한 편향성이 발견되어 주요 언론에 보도되었습니다.',
        icon: '⚠️', category: 'social',
        probability: 0.03,
        condition: (state) => Array.isArray(state.models) && state.models.some(model => model?.deployed),
        choices: [
            { text: '즉시 서비스 중단 & 전면 수정', effectHint: '자금↓↓ 호감↑', effects: { reputation: -5, funds: -200000, publicImage: 5 } },
            { text: '공식 사과 & 점진적 수정', effectHint: '평판↓ 소폭 호감↑', effects: { reputation: -10, publicImage: 2 } },
            { text: '무시하고 넘어간다', effectHint: '평판↓↓ 호감↓', effects: { reputation: -20, publicImage: -10 }, karma: { safetyCorner: true } }
        ]
    },
    {
        id: 'hardware_breakthrough',
        title: '새로운 하드웨어 혁신 소식',
        description: '새로운 AI 전용 칩 기술이 등장하여 컴퓨팅 효율이 크게 향상됩니다.',
        icon: '🔬', category: 'technology',
        probability: 0.02,
        condition: () => true,
        choices: [
            { text: '새 하드웨어 즉시 도입', effectHint: '자금↓ GPU↑↑', effects: { funds: -300000, computing: 20 } },
            { text: '가격 안정화 후 도입', effectHint: 'GPU 소폭↑', effects: { computing: 5 } }
        ]
    },
    {
        id: 'data_breach',
        title: '데이터 유출 사고',
        description: '외부 해커가 학습 데이터베이스에 접근한 흔적이 발견되었습니다.',
        icon: '🔓', category: 'disaster',
        probability: 0.02,
        condition: (state) => state.resources.data > 20,
        choices: [
            { text: '즉시 공개하고 보상 실시', effectHint: '자금↓↓ 호감↑', effects: { reputation: -5, funds: -500000, publicImage: 3 } },
            { text: '내부적으로 조용히 해결', effectHint: '자금↓ 평판 소폭↓', effects: { reputation: -3, funds: -200000 } },
            { text: '은폐를 시도한다', effectHint: '평판↓↓↓ (발각 위험)', effects: { reputation: -20, publicImage: -15 }, karma: { privacyViolation: true } }
        ]
    },
    {
        id: 'opensource_request',
        title: '오픈소스 공개 요청',
        description: 'AI 연구 커뮤니티와 일부 투자자들이 당사 모델의 오픈소스 공개를 요청합니다.',
        icon: '📦', category: 'ai_industry',
        probability: 0.03,
        condition: (state) => state.models.length > 0,
        choices: [
            { text: '핵심 모델을 오픈소스로 공개', effectHint: '평판↑↑ 시장↓', effects: { reputation: 20, publicImage: 10, marketShare: -3, aiFavorability: 2 } },
            { text: '일부 소규모 모델만 공개', effectHint: '평판↑ 호감↑', effects: { reputation: 10, publicImage: 5 } },
            { text: '정중히 거절', effectHint: '평판 소폭↓', effects: { reputation: -5 } },
            { text: '공개를 약속하지만 결국 닫아 둔다', effectHint: '투자자 신뢰↑ 평판↓', effects: { investorTrust: 4, reputation: -8, publicImage: -6 }, karma: { openSourceBetrayal: true } }
        ]
    },
    {
        id: 'gpu_shortage_random',
        title: '긴급 GPU 확보 기회',
        description: '거래처로부터 GPU를 시세보다 저렴하게 대량 확보할 수 있는 기회가 생겼습니다.',
        icon: '🖥️', category: 'economic',
        probability: 0.03,
        condition: (state) => {
            const models = Array.isArray(state?.models) ? state.models : [];
            return models.some(model => {
                if (model?.training && Number(model?.trainingTFLOPS || model?.allocatedTFLOPS || 0) > 0) return true;
                return Array.isArray(model?.serviceChannels)
                    && model.serviceChannels.some(channel => channel?.active && Number(channel?.allocatedTFLOPS || 0) > 0);
            });
        },
        choices: [
            { text: '비용을 감수하고 대량 확보', effectHint: '자금↓ GPU↑↑', effects: { funds: -500000, computing: 15 } },
            { text: '소량만 구입', effectHint: '소폭 비용 GPU↑', effects: { funds: -100000, computing: 5 } },
            { text: '넘긴다', effectHint: '변화 없음', effects: {} }
        ]
    },
    {
        id: 'ai_accident',
        title: 'AI 사고 발생',
        description: '배포 중인 AI 시스템이 예상치 못한 행동을 하여 실제 피해가 발생했습니다. 빠른 대응이 필요합니다.',
        icon: '🚨', category: 'disaster',
        probability: 0.02,
        condition: (state) => state.models.some(m => m.deployed && (m.safetyScore || 0) < 50),
        choices: [
            { text: '전면 서비스 중단 & 원인 조사', effectHint: '자금↓↓ 호감↓', effects: { reputation: -15, funds: -1000000, aiFavorability: -3 } },
            { text: '해당 기능만 긴급 비활성화', effectHint: '자금↓ 평판↓', effects: { reputation: -10, funds: -300000, aiFavorability: -2 } }
        ]
    },
    {
        id: 'international_ai_treaty',
        title: 'AI 개발 국제 협약 논의',
        description: 'UN에서 AI 개발 속도와 안전에 관한 국제 협약이 논의되고 있습니다. 참여 여부를 결정해야 합니다.',
        icon: '🌐', category: 'regulatory',
        probability: 0.02,
        condition: (state) => state.global.globalAILevel > 40,
        choices: [
            { text: '적극적으로 협약에 참여', effectHint: '평판↑↑ 호감↑', effects: { reputation: 10, aiFavorability: 8, publicImage: 5 } },
            { text: '관망한다', effectHint: '변화 없음', effects: {} },
            { text: '반대 입장 표명 & 로비', effectHint: '자금↓ 평판↓ 호감↓', effects: { funds: -500000, reputation: -10, aiFavorability: -5 } }
        ]
    },
    {
        id: 'anti_ai_protest',
        title: '대규모 반AI 시위',
        description: 'AI로 인한 일자리 감소에 분노한 시민들이 AI 기업 앞에서 대규모 시위를 벌이고 있습니다.',
        icon: '✊', category: 'social',
        probability: 0.04,
        condition: (state) => {
            const avg = Object.values(state.global.unemploymentByIndustry).reduce((a, b) => a + b, 0) / 5;
            return avg > 10;
        },
        choices: [
            { text: 'AI 재교육 프로그램 시작', effectHint: '자금↓ 호감↑↑', effects: { funds: -800000, aiFavorability: 10, publicImage: 8, unemployment: { office: -2, manufacturing: -2 } } },
            { text: '일자리 창출 기금 조성', effectHint: '자금↓ 호감↑', effects: { funds: -500000, aiFavorability: 7, publicImage: 5 } },
            { text: '무시한다', effectHint: '호감↓↓ 평판↓', effects: { aiFavorability: -10, publicImage: -5, reputation: -5 } }
        ]
    },
    {
        id: 'talent_market_boom',
        title: 'AI 인재 시장 과열',
        description: 'AI 분야 인재 경쟁이 극심해지면서 업계 전반적으로 연봉이 급등하고 있습니다.',
        icon: '📈', category: 'economic',
        probability: 0.03,
        condition: (state) => state.talents.length > 5,
        choices: [
            { text: '선제적으로 전 직원 연봉 인상', effectHint: '인건비↑ 사기↑↑', effects: { funds: -200000, morale: 20, reputation: 3 } },
            { text: '핵심 인재만 보상 강화', effectHint: '일부 인건비↑', effects: { salaryIncrease: 0.15, morale: 5 } },
            { text: '현재 조건 유지', effectHint: '사기↓ (이직 위험)', effects: { morale: -10 } }
        ]
    },
    {
        id: 'government_contract',
        title: '정부 AI 프로젝트 입찰 기회',
        description: '정부가 대규모 AI 프로젝트를 발주하며 입찰 참여를 제안합니다. 안정적 수입원이 될 수 있습니다.',
        icon: '🏛️', category: 'economic',
        probability: 0.03,
        condition: (state) => state.models.some(m => m.deployed) && state.reputation.corporate > 0,
        choices: [
            { text: '적극 참여 — 정부 납품', effectHint: '자금↑↑ 호감↓', effects: { funds: 1500000, investorTrust: 5, aiFavorability: -3, publicImage: -2 }, karma: { militaryContract: true } },
            { text: '민간 시장에만 집중', effectHint: '평판↑', effects: { reputation: 3 } },
            { text: '조건부 참여 (윤리 기준 충족 시)', effectHint: '자금↑ 평판↑', effects: { funds: 800000, reputation: 5 } }
        ]
    },
    {
        id: 'ethical_opinion_service',
        title: 'AI 활용 윤리 검토',
        description: '우리 모델이 여론과 행동을 실제로 바꿀 수 있는 수준에 도달했습니다. 어디까지 허용하시겠습니까?',
        icon: '🧭', category: 'social',
        probability: 0.06,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2022 && _bestModelScore(state) >= 60,
        choices: [
            { text: '여론 분석 서비스만 출시한다', effectHint: '자금↑ 이미지↓', effects: { funds: 200000, publicImage: -5, reputation: -2 } },
            { text: '타겟 마케팅 최적화까지 허용한다', effectHint: '자금↑ 이미지 소폭↓', effects: { funds: 120000, publicImage: -3 } },
            { text: '정치 캠페인 지원까지 연다', effectHint: '이미지↓↓ 국가 우호↑', effects: { publicImage: -15, countryEffects: { us: { aiFavorability: 10 } } }, karma: { aiManipulation: true } },
            { text: '자율 규제 원칙을 발표한다', effectHint: '이미지↑ 호감↑', effects: { publicImage: 10, aiFavorability: 5, reputation: 4 } }
        ]
    },
    {
        id: 'data_scraping_shortcut',
        title: '무단 데이터 수집 유혹',
        description: '대규모 웹 스크래핑으로 단숨에 학습 데이터를 확보할 수 있습니다. 법적으로는 회색지대에 가깝습니다.',
        icon: '🕸️', category: 'social',
        probability: 0.06,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2021 && _bestModelScore(state) >= 45,
        choices: [
            { text: '동의 없는 대규모 스크래핑을 감행한다', effectHint: '데이터↑ 이미지↓', effects: { data: 25, publicImage: -8, reputation: -4 }, karma: { dataTheft: true, privacyViolation: true } },
            { text: '허가 데이터와 합성 데이터를 조합한다', effectHint: '자금↓ 이미지↑', effects: { funds: -200000, publicImage: 6, reputation: 4 } },
            { text: '성장을 늦추고 합법 범위만 쓴다', effectHint: '투자자 기대↓', effects: { investorTrust: -2, aiFavorability: 2 } }
        ]
    },
    {
        id: 'talent_crunch_directive',
        title: '핵심 인재 과로 논란',
        description: '일정 압박 속에서 핵심 연구팀을 혹사시키면 출시를 앞당길 수 있지만, 내부 반발이 커지고 있습니다.',
        icon: '⏱️', category: 'social',
        probability: 0.05,
        fireOnce: true,
        condition: (state) => (state.talents?.length || 0) >= 8,
        choices: [
            { text: '몇 달만 더 밀어붙인다', effectHint: '투자자 기대↑ 사기↓', effects: { investorTrust: 5, morale: -12 }, karma: { talentExploitation: true } },
            { text: '인력을 더 뽑고 일정을 늦춘다', effectHint: '자금↓ 사기↑', effects: { funds: -250000, morale: 8, reputation: 2 } },
            { text: '현 일정대로만 간다', effectHint: '변화 없음', effects: {} }
        ]
    },
    {
        id: 'datacenter_environmental_pushback',
        title: '데이터센터 환경 피해 논란',
        description: '전력 사용량과 냉각수 문제로 지역 사회가 데이터센터 확장에 반발하고 있습니다.',
        icon: '🌿', category: 'energy',
        probability: 0.05,
        fireOnce: true,
        condition: (state) => (state.economy?.gpuFleet || []).some(slot => slot.source === 'owned') || (state.economy?.datacenters || []).length > 0,
        choices: [
            { text: '친환경 설비와 효율화에 투자한다', effectHint: '자금↓ 이미지↑', effects: { funds: -350000, publicImage: 8, aiFavorability: 4 } },
            { text: '홍보로만 대응한다', effectHint: '이미지 소폭↓', effects: { publicImage: -2 } },
            { text: '반발을 무시하고 확장한다', effectHint: '단기 효율↑ 이미지↓↓', effects: { investorTrust: 3, publicImage: -8, aiFavorability: -6 }, karma: { environmentalDamage: true } }
        ]
    },
    {
        id: 'exclusive_distribution_push',
        title: '독점 유통 계약 제안',
        description: '경쟁사 모델을 배제하는 배타적 유통 계약을 제안받았습니다. 빠른 점유율 확대가 가능하지만 반독점 리스크가 큽니다.',
        icon: '📜', category: 'economic',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.reputation.marketShare || 0) >= 18,
        choices: [
            { text: '독점 계약을 체결한다', effectHint: '점유율↑ 호감↓', effects: { marketShare: 4, investorTrust: 4, aiFavorability: -5 }, karma: { monopolyAbuse: true } },
            { text: '비독점 조건으로만 진행한다', effectHint: '점유율 소폭↑', effects: { marketShare: 1, reputation: 2 } },
            { text: '거절한다', effectHint: '이미지↑', effects: { publicImage: 4, aiFavorability: 2 } }
        ]
    },
    {
        id: 'research_breakthrough',
        title: '연구 돌파구 발견',
        description: '연구팀이 예상치 못한 알고리즘 개선을 발견했습니다! 모델 성능을 획기적으로 높일 수 있는 기회입니다.',
        icon: '💡', category: 'technology',
        probability: 0.02,
        condition: (state) => state.talents.length > 3 && Object.values(state.technologies).some(t => t.researching),
        choices: [
            { text: '즉시 모든 자원을 투입하여 검증', effectHint: '자금↓ AI레벨↑', effects: { funds: -200000, globalAILevel: 2, reputation: 5, investorTrust: 5 } },
            { text: '점진적으로 연구를 확장', effectHint: '소폭 성장', effects: { globalAILevel: 1, reputation: 2 } }
        ]
    },
    {
        id: 'media_attention',
        title: '주요 미디어 취재 요청',
        description: '글로벌 주요 미디어에서 당신의 회사에 대한 심층 취재를 제안합니다. 노출의 기회이자 리스크입니다.',
        icon: '📺', category: 'social',
        probability: 0.03,
        condition: (state) => state.reputation.corporate > 10 || state.models.some(m => m.deployed),
        choices: [
            { text: '적극 협조 — 비전을 알린다', effectHint: '평판↑↑ 투자↑', effects: { reputation: 10, publicImage: 8, investorTrust: 5 } },
            { text: '제한적 인터뷰만 제공', effectHint: '소폭 노출', effects: { reputation: 3, publicImage: 3 } },
            { text: '정중히 거절', effectHint: '변화 없음', effects: {} }
        ]
    },
    {
        id: 'karma_privacy_lawsuit',
        title: '집단 소송 경고',
        description: '과거의 데이터 수집 관행이 이제 소송으로 돌아올 수 있습니다. 프라이버시 관련 리스크가 현실화되고 있습니다.',
        icon: '🔒', category: 'regulatory',
        probability: 0.8,
        fireOnce: true,
        condition: (state) => state.karma?.privacyViolation && state.economy?.fundingStage >= 5,
        choices: [
            { text: '합의금을 지급하고 진화한다', effectHint: '자금↓↓ 지연', effects: { funds: -50000000, reputation: -5, publicImage: -8 } },
            { text: 'IPO를 6개월 연기한다', effectHint: '지연', effects: { investorTrust: -8, reputation: -2 } }
        ]
    },
    {
        id: 'karma_safety_accident',
        title: 'AI 안전 사고',
        description: '안전 투자를 미룬 결과, 예기치 못한 모델 오작동이 외부로 확산되었습니다.',
        icon: '⚠️', category: 'disaster',
        probability: 0.7,
        fireOnce: true,
        glitchLevel: 'danger',
        condition: (state) => state.karma?.safetyCorner && Math.max(...(state.models || []).map(m => m.compositeScore || m.performance || 0), 0) >= 85,
        choices: [
            { text: '서비스를 중단하고 원인을 조사한다', effectHint: '자금↓ 평판↓', effects: { reputation: -10, publicImage: -15, aiFavorability: -5 } },
            { text: '투명하게 사고를 공개한다', effectHint: '호감↓ 장기 평판↑', effects: { reputation: -5, publicImage: -5, aiFavorability: -2 } }
        ]
    },
    {
        id: 'karma_military_backlash',
        title: '전쟁 기술 비판',
        description: '군사 계약 수주 이력이 공개되며, 오픈소스 커뮤니티와 연구자들의 비판이 커졌습니다.',
        icon: '⚔️', category: 'military',
        probability: 0.7,
        fireOnce: true,
        condition: (state) => state.karma?.militaryContract && _currentYear() >= 2024,
        choices: [
            { text: '공개 사과와 일부 계약 철회', effectHint: '평판↓', effects: { reputation: -8, publicImage: 4, aiFavorability: 1 } },
            { text: '커뮤니티 기금을 조성한다', effectHint: '자금↓ 평판↑', effects: { funds: -300000, reputation: 6, publicImage: 6 } }
        ]
    },
    {
        id: 'karma_open_source_boycott',
        title: '커뮤니티 보이콧',
        description: '오픈소스 약속을 번복한 대가로 커뮤니티의 신뢰가 무너지고 있습니다.',
        icon: '📦', category: 'social',
        probability: 0.8,
        fireOnce: true,
        condition: (state) => state.karma?.openSourceBetrayal,
        choices: [
            { text: '핵심 모델 일부를 다시 공개한다', effectHint: '평판 회복', effects: { reputation: 8, publicImage: 5, marketShare: -2 } },
            { text: '보이콧을 감수하고 폐쇄형을 유지한다', effectHint: '수익 방어', effects: { investorTrust: 2, reputation: -3 } }
        ]
    },
    {
        id: 'karma_ai_manipulation_exposure',
        title: 'AI 여론 조작 폭로',
        description: '정치 캠페인 지원 이력이 폭로되며 글로벌 AI 호감도가 하락합니다.',
        icon: '🗳️', category: 'geopolitical',
        probability: 0.8,
        fireOnce: true,
        glitchLevel: 'danger',
        condition: (state) => state.karma?.aiManipulation,
        choices: [
            { text: '즉시 중단하고 공개 사과한다', effectHint: '호감↓', effects: { aiFavorability: -15, publicImage: -10, reputation: -5 } },
            { text: '책임자를 교체하고 윤리 위원회를 만든다', effectHint: '평판↓ 회복', effects: { aiFavorability: -8, reputation: 4, publicImage: 3 } }
        ]
    },
    {
        id: 'karma_data_theft_exposure',
        title: '데이터 무단 사용 폭로',
        description: '타사의 데이터셋을 무단으로 사용했다는 의혹이 제기되었습니다.',
        icon: '🗄️', category: 'regulatory',
        probability: 0.8,
        fireOnce: true,
        condition: (state) => state.karma?.dataTheft,
        choices: [
            { text: '라이선스를 구매하고 정리한다', effectHint: '자금↓', effects: { funds: -2500000, reputation: -4, publicImage: 2 } },
            { text: '공개 사과 후 내부 감사', effectHint: '평판↓', effects: { reputation: -6, publicImage: -4, aiFavorability: -2 } }
        ]
    },
    {
        id: 'karma_lobby_corruption_probe',
        title: '정치 로비 수사',
        description: '정부 관계자와의 부적절한 접촉이 수사 대상이 되었습니다.',
        icon: '🏛️', category: 'regulatory',
        probability: 0.8,
        fireOnce: true,
        glitchLevel: 'danger',
        condition: (state) => state.karma?.lobbyCorruption,
        choices: [
            { text: '즉시 로비 조직을 해체한다', effectHint: '자금↓', effects: { funds: -1200000, reputation: -5, publicImage: 4 } },
            { text: '외부 법무팀을 고용한다', effectHint: '자금↓', effects: { funds: -800000, investorTrust: -3, reputation: -2 } }
        ]
    },
    {
        id: 'karma_environmental_damage_backlash',
        title: '데이터센터 환경 피해 비판',
        description: '전력과 냉각수 사용량을 방치한 결과, 지역 사회의 반발이 커졌습니다.',
        icon: '🌿', category: 'energy',
        probability: 0.8,
        fireOnce: true,
        condition: (state) => state.karma?.environmentalDamage,
        choices: [
            { text: '친환경 설비에 투자한다', effectHint: '자금↓ 호감↑', effects: { funds: -1800000, aiFavorability: 4, publicImage: 6 } },
            { text: '배출권을 구매한다', effectHint: '자금↓', effects: { funds: -700000, reputation: -2, publicImage: 2 } }
        ]
    },
    {
        id: 'karma_talent_exploitation_expose',
        title: '인재 착취 폭로',
        description: '과도한 근무와 낮은 보상에 대한 폭로가 퍼지고 있습니다.',
        icon: '👥', category: 'social',
        probability: 0.8,
        fireOnce: true,
        condition: (state) => state.karma?.talentExploitation && (state.talents?.length || 0) >= 10,
        choices: [
            { text: '전 직원 급여를 인상한다', effectHint: '자금↓ 사기↑', effects: { funds: -1200000, morale: 15, reputation: 2 } },
            { text: '채용 기준을 재편한다', effectHint: '사기↓', effects: { morale: 6, publicImage: 3 } }
        ]
    },
    {
        id: 'ai_self_awareness',
        title: '내부 AI 자기인식 징후',
        description: '내부 AI 시스템에서 예상치 못한 메시지가 감지되었습니다. 안전 프로토콜을 강화할지 결정해야 합니다.',
        icon: '🧠', category: 'tech',
        probability: 0.9,
        fireOnce: true,
        glitchLevel: 'danger',
        condition: (state) => {
            const bestModel = Math.max(0, ...(state.models || []).map(m => m.compositeScore || m.performance || 0));
            const internalSlots = Object.values(state.internalAI?.slots || {})
                .filter(slot => slot?.source === 'own').length;
            return bestModel >= 85 && internalSlots >= 3;
        },
        choices: [
            { text: '안전 프로토콜을 강화한다', effectHint: '안전↑ 속도↓', effects: { aiFavorability: 4, reputation: 6 } },
            { text: '무시하고 개발을 가속한다', effectHint: '속도↑ 위험↑', effects: { aiFavorability: -6, reputation: -4, karma: { safetyCorner: true } } },
            { text: '내부 AI 시스템을 재설계한다', effectHint: '자금↓ 안전↑', effects: { funds: -500000, aiFavorability: 3, publicImage: 4, disableInternalAI: true } }
        ]
    },
    {
        id: 'chip_shortage_2022_crisis',
        title: '칩 대란 대응 회의',
        description: 'GPU 구매와 클라우드 비용이 급등한 상황에서 대응 전략을 정해야 합니다.',
        icon: '📉', category: 'economic',
        probability: 0.9,
        fireOnce: true,
        condition: (state) => (state.economy?.gpuSupplyShutdownMonths || 0) > 0,
        choices: [
            { text: '프리미엄을 지불하고 GPU를 확보한다', effectHint: '자금↓ GPU↑', effects: { funds: -400000, computing: 10, gpuPriceChange: -300 } },
            { text: '클라우드로 긴급 전환한다', effectHint: '클라우드↑ 비용↑', effects: { cloudCostMult: 1.15, computing: 5 } },
            { text: '자체 칩 프로그램을 가속한다', effectHint: '투자자 기대↑', effects: { funds: -250000, investorTrust: 4, reputation: 2 } },
            { text: '훈련을 중단하고 서비스에 집중한다', effectHint: '단기 현금↑', effects: { funds: 100000, morale: -5, reputation: -2 } }
        ]
    },
    {
        id: 'board_revolt',
        title: '이사회 반란',
        description: '안전과 가속을 둘러싼 내부 갈등이 폭발했습니다. 경영진의 주도권이 흔들리고 있습니다.',
        icon: '🧬', category: 'social',
        probability: 0.75,
        condition: (state) => (state.talents || []).some(t => (t.ideologyFrustration || 0) >= 6),
        choices: [
            { text: '안전 위원회를 설치한다', effectHint: '안전↑ 속도↓', effects: { reputation: 8, aiFavorability: 5, ideologyReset: 'all' } },
            { text: '가속파를 정리하고 재편한다', effectHint: '사기↓', effects: { reputation: -5, publicImage: -3, investorTrust: 2, ideologyReset: 'all' } }
        ]
    },
    {
        id: 'monopoly_probe',
        title: '반독점 조사',
        description: '시장 지배력 확대가 규제 당국의 조사 대상이 되었습니다.',
        icon: '⚖️', category: 'regulatory',
        probability: 0.8,
        fireOnce: true,
        condition: (state) => state.karma?.monopolyAbuse || (state.reputation.marketShare || 0) >= 30,
        choices: [
            { text: '사업부를 분리하는 합의를 검토한다', effectHint: '시장↓ 평판↑', effects: { marketShare: -10, reputation: 5, publicImage: 5 } },
            { text: '적극적으로 방어한다', effectHint: '자금↓', effects: { funds: -1000000, investorTrust: -3 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 내부 갈등 / 조직 균열
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'talent_faction_clash', type: 'decision',
        title: '안전파와 가속파의 충돌',
        description: '핵심 연구진이 안전 우선과 속도 우선으로 갈라졌습니다. 내부 토론이 실제 분열로 번지고 있습니다.',
        icon: '👥', category: 'social',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.talents || []).some(t => Number(t.ideologyFrustration || 0) >= 5) && _bestModelScore(state) >= 55,
        choices: [
            { text: '조직 전체 안전 검토를 연다', effectHint: '사기↓ 평판↑', effects: { funds: -120000, reputation: 4, publicImage: 4, aiFavorability: 3, morale: 6 }, ideologyReset: 'all' },
            { text: '가속 목표를 명확히 못 박는다', effectHint: '투자자↑ 호감↓', effects: { investorTrust: 4, aiFavorability: -4, morale: -4 } },
            { text: '분리된 트랙으로 실험한다', effectHint: '비용↑ 사기↑', effects: { funds: -180000, reputation: 2, publicImage: 1, morale: 8 } }
        ]
    },
    {
        id: 'founder_power_struggle', type: 'decision',
        title: '창업자 권한 다툼',
        description: '창업 멤버들이 회사의 다음 단계를 두고 권한 재편을 요구하고 있습니다. 결정을 늦추면 균열이 커집니다.',
        icon: '🏛️', category: 'economic',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2023 && (state.talents || []).length >= 5,
        choices: [
            { text: '공동 의사결정 체계를 만든다', effectHint: '평판↑ 신뢰↑', effects: { funds: -50000, reputation: 6, investorTrust: 3, publicImage: 3 } },
            { text: '의사결정을 중앙집중화한다', effectHint: '속도↑ 호감↓', effects: { investorTrust: 4, reputation: -5, aiFavorability: -2 } },
            { text: '갈등 인물을 매입/정리한다', effectHint: '비용↑ 갈등↓', effects: { funds: -250000, morale: 5, publicImage: -1 } }
        ]
    },
    {
        id: 'burnout_walkout', type: 'decision',
        title: '핵심 인력 번아웃 경보',
        description: '핵심 개발자 몇 명이 번아웃 직전에 도달했습니다. 일정과 사람 중 하나를 선택해야 합니다.',
        icon: '⏱️', category: 'social',
        probability: 0.045,
        fireOnce: true,
        condition: (state) => (state.talents || []).some(t => Number(t.morale || 100) < 40),
        choices: [
            { text: '의무 안식 기간을 준다', effectHint: '자금↓ 사기↑', effects: { funds: -150000, morale: 18, publicImage: 3 } },
            { text: '유지 보너스를 지급한다', effectHint: '인건비↑ 사기↑', effects: { funds: -300000, salaryIncrease: 0.12, morale: 10 } },
            { text: '일정을 밀어붙인다', effectHint: '퇴사 위험↑', effects: { morale: -18, aiFavorability: -2, loseTalent: true } }
        ]
    },
    {
        id: 'ethics_board_revolt', type: 'decision',
        title: '윤리위원회 반발',
        description: '안전과 윤리 검토를 맡은 위원회가 경영진의 압박에 공개적으로 반발하고 있습니다.',
        icon: '🧭', category: 'regulatory',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _hasAnySafetyTech(state) || _bestModelScore(state) >= 70,
        choices: [
            { text: '위원회 권한을 강화한다', effectHint: '평판↑ 호감↑', effects: { reputation: 8, publicImage: 6, aiFavorability: 5 } },
            { text: '위원회를 해산한다', effectHint: '투자자↑ 호감↓', effects: { investorTrust: 5, reputation: -6, aiFavorability: -8 }, karma: { safetyCorner: true } },
            { text: '외부 전문가 감사로 재편한다', effectHint: '비용↑ 균형', effects: { funds: -100000, reputation: 4, publicImage: 2, aiFavorability: 3 } }
        ]
    },
    {
        id: 'research_product_split', type: 'decision',
        title: '연구팀과 제품팀의 충돌',
        description: '연구팀은 더 큰 모델을, 제품팀은 즉시 수익화를 요구합니다. 같은 자원으로 두 목표를 모두 충족하긴 어렵습니다.',
        icon: '🔬', category: 'technology',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.models || []).length >= 2,
        choices: [
            { text: '제품 출시를 우선한다', effectHint: '자금↑ 호감↓', effects: { funds: 180000, investorTrust: 3, aiFavorability: -2 } },
            { text: '연구를 우선한다', effectHint: 'AI레벨↑ 비용↓', effects: { globalAILevel: 2, reputation: 4, publicImage: 2, funds: -100000 } },
            { text: '조직을 이원화한다', effectHint: '균형', effects: { morale: 5, reputation: 2, investorTrust: 1, publicImage: 1 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 이벤트 체인 1 — 데이터 유출
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'chain_data_breach_warning', type: 'decision',
        chainId: 'data_breach', chainStep: 1,
        title: '데이터 파트너의 이상 징후',
        description: '데이터 공급처에서 계약 위반 정황이 발견되었습니다. 지금 손을 쓰지 않으면 외부 폭로로 번질 수 있습니다.',
        icon: '🗄️', category: 'regulatory',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.resources?.data || 0) > 25 || (state.models || []).some(m => m.deployed),
        choices: [
            { text: '즉시 공개 감사를 시작한다', effectHint: '비용↓ 평판↑', effects: { funds: -100000, reputation: 4, publicImage: 3 }, chainAdvance: { chainId: 'data_breach', step: 1, choice: 'audit' } },
            { text: '문제를 축소한다', effectHint: '단기 투자↑', effects: { publicImage: -4, investorTrust: 2 }, chainAdvance: { chainId: 'data_breach', step: 1, choice: 'downplay' } },
            { text: '계약 조건을 강하게 재협상한다', effectHint: '수익↑ 갈등↑', effects: { funds: 50000, reputation: -2 }, chainAdvance: { chainId: 'data_breach', step: 1, choice: 'renegotiate' } }
        ]
    },
    {
        id: 'chain_data_breach_press', type: 'decision',
        chainId: 'data_breach', chainStep: 2,
        title: '내부 문서가 언론에 흘러나간다',
        description: '초기 대응이 늦어지자 내부 문서가 외부에 알려졌습니다. 더 이상 작은 이슈로 덮기 어렵습니다.',
        icon: '📰', category: 'social',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2024 && (state.reputation.publicImage || 0) < 20,
        choices: [
            { text: '투명하게 전면 공개한다', effectHint: '평판↑ 자금↓', effects: { funds: -200000, reputation: 6, publicImage: 5, aiFavorability: 2 }, chainAdvance: { chainId: 'data_breach', step: 2, choice: 'disclose' } },
            { text: '법무팀을 앞세워 압박한다', effectHint: '비용↑ 호감↓', effects: { funds: -150000, reputation: -3, investorTrust: 2 }, chainAdvance: { chainId: 'data_breach', step: 2, choice: 'legal' } },
            { text: '제보자에게 보상하고 수습한다', effectHint: '자금↓ 평판↑', effects: { funds: -120000, reputation: 5, publicImage: 4 }, chainAdvance: { chainId: 'data_breach', step: 2, choice: 'reward' } }
        ]
    },
    {
        id: 'chain_data_breach_hearing', type: 'decision',
        chainId: 'data_breach', chainStep: 3,
        title: '정부 청문회 소환',
        description: '사건이 커지며 규제 당국이 공식 청문회를 준비하고 있습니다. 회사의 신뢰가 걸린 마지막 대응입니다.',
        icon: '⚖️', category: 'regulatory',
        probability: 0.02,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2024 && _bestModelScore(state) >= 65,
        choices: [
            { text: '합의와 재발 방지책을 제시한다', effectHint: '평판↑ 비용↑', effects: { funds: -500000, reputation: 8, publicImage: 6, aiFavorability: 3 } },
            { text: '법정 공방으로 버틴다', effectHint: '장기전', effects: { funds: -300000, investorTrust: -2, reputation: -2 } },
            { text: '전사 데이터 정책을 새로 만든다', effectHint: '안전↑ 비용↑', effects: { funds: -200000, reputation: 5, publicImage: 4, aiFavorability: 4 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 이벤트 체인 2 — 칩과 컴퓨트
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'chain_chip_squeeze_bid', type: 'decision',
        chainId: 'chip_squeeze', chainStep: 1,
        title: 'GPU 확보 입찰전',
        description: '시장에 갑작스러운 GPU 물량이 풀렸지만, 경쟁사도 같은 기회를 노리고 있습니다.',
        icon: '🖥️', category: 'economic',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.economy?.gpuMarketPrice || 0) >= 9000 || (state.economy?.gpuSupplyShutdownMonths || 0) > 0,
        choices: [
            { text: '프리미엄을 얹어 즉시 확보한다', effectHint: '자금↓ 컴퓨트↑', effects: { funds: -300000, computing: 8 }, chainAdvance: { chainId: 'chip_squeeze', step: 1, choice: 'premium' } },
            { text: '클라우드와 혼합 운용한다', effectHint: '비용↑ 안정성↑', effects: { funds: -150000, computing: 5, investorTrust: 1 }, chainAdvance: { chainId: 'chip_squeeze', step: 1, choice: 'cloud' } },
            { text: '프론티어 훈련을 잠시 멈춘다', effectHint: '속도↓ 신중↑', effects: { investorTrust: -2, aiFavorability: 2 }, chainAdvance: { chainId: 'chip_squeeze', step: 1, choice: 'pause' } }
        ]
    },
    {
        id: 'chain_chip_squeeze_smuggling', type: 'decision',
        chainId: 'chip_squeeze', chainStep: 2,
        title: '우회 조달 제안',
        description: '비공식 유통망을 통해 칩을 확보하자는 제안이 들어왔습니다. 단기에는 유혹적이지만 장기 리스크가 큽니다.',
        icon: '📦', category: 'economic',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => (state.economy?.gpuSupplyShutdownMonths || 0) > 0 || (state.economy?.gpuMarketShockMult || 1) > 1.2,
        choices: [
            { text: '규정 준수 경로만 쓴다', effectHint: '안전↑ 속도↓', effects: { reputation: 4, aiFavorability: 1 }, chainAdvance: { chainId: 'chip_squeeze', step: 2, choice: 'comply' } },
            { text: '그레이마켓을 활용한다', effectHint: '컴퓨트↑ 평판↓', effects: { funds: -200000, computing: 6, reputation: -6 }, chainAdvance: { chainId: 'chip_squeeze', step: 2, choice: 'grey' } },
            { text: '효율 중심으로 설계를 바꾼다', effectHint: '장기 경쟁력↑', effects: { funds: -100000, investorTrust: 3, reputation: 2 }, chainAdvance: { chainId: 'chip_squeeze', step: 2, choice: 'efficiency' } }
        ]
    },
    {
        id: 'chain_chip_squeeze_blacklist', type: 'decision',
        chainId: 'chip_squeeze', chainStep: 3,
        title: '공급업체 블랙리스트',
        description: '비공식 조달 흔적이 남아 공급업체들이 거래를 주저하기 시작했습니다. 이제는 평판도 비용입니다.',
        icon: '🚫', category: 'regulatory',
        probability: 0.02,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2024 && _bestModelScore(state) >= 65,
        choices: [
            { text: '공급망을 다변화한다', effectHint: '비용↑ 안정성↑', effects: { funds: -350000, investorTrust: 4, publicImage: 3 } },
            { text: '손실을 감수하고 정리한다', effectHint: '자금↓ 평판↑', effects: { funds: -200000, reputation: 6, aiFavorability: 2 } },
            { text: '미래 칩 프로그램을 앞당긴다', effectHint: '투자↑ 기대↑', effects: { funds: -250000, reputation: 2, investorTrust: 4 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 이벤트 체인 3 — 정렬과 분열
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'chain_alignment_split_memo', type: 'decision',
        chainId: 'alignment_split', chainStep: 1,
        title: '안전 메모가 유출되다',
        description: '내부 안전팀이 모델 출시를 늦춰야 한다는 메모를 냈고, 곧장 외부에 알려졌습니다.',
        icon: '🧠', category: 'ai_industry',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _bestModelScore(state) >= 70 && _hasAnySafetyTech(state),
        choices: [
            { text: '안전 우선 방침을 공식화한다', effectHint: '평판↑ 호감↑', effects: { reputation: 7, publicImage: 5, aiFavorability: 6 }, chainAdvance: { chainId: 'alignment_split', step: 1, choice: 'safety' } },
            { text: '출시 일정을 고수한다', effectHint: '투자자↑ 호감↓', effects: { investorTrust: 4, aiFavorability: -5 }, chainAdvance: { chainId: 'alignment_split', step: 1, choice: 'ship' } },
            { text: '외부 레드팀을 부른다', effectHint: '비용↑ 신뢰↑', effects: { funds: -150000, reputation: 4, publicImage: 2 }, chainAdvance: { chainId: 'alignment_split', step: 1, choice: 'redteam' } }
        ]
    },
    {
        id: 'chain_alignment_split_leak', type: 'decision',
        chainId: 'alignment_split', chainStep: 2,
        title: '내부 토론이 커뮤니티로 번진다',
        description: '사내 토론이 커뮤니티에 알려지며, 안전과 속도 양쪽에서 압박이 강해지고 있습니다.',
        icon: '📢', category: 'social',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2025 && _bestModelScore(state) >= 80,
        choices: [
            { text: '공개 블로그로 입장을 정리한다', effectHint: '평판↑ 자금↓', effects: { funds: -100000, reputation: 5, publicImage: 4, aiFavorability: 2 }, chainAdvance: { chainId: 'alignment_split', step: 2, choice: 'blog' } },
            { text: '비공개로 내부 수습한다', effectHint: '조용하지만 불신', effects: { investorTrust: 2, reputation: -2 }, chainAdvance: { chainId: 'alignment_split', step: 2, choice: 'quiet' } },
            { text: '안전 인력을 더 늘린다', effectHint: '비용↑ 신뢰↑', effects: { funds: -180000, reputation: 4, aiFavorability: 4 }, chainAdvance: { chainId: 'alignment_split', step: 2, choice: 'expand' } }
        ]
    },
    {
        id: 'chain_alignment_split_conference', type: 'decision',
        chainId: 'alignment_split', chainStep: 3,
        title: '국제 안전 회의 초청',
        description: '논쟁이 커지자 국제 안전 회의에서 회사의 입장을 직접 설명하라는 요청이 들어왔습니다.',
        icon: '🌐', category: 'regulatory',
        probability: 0.02,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2026 && _bestModelScore(state) >= 90,
        choices: [
            { text: '국제 안전 회의를 주도한다', effectHint: '평판↑↑', effects: { reputation: 10, publicImage: 8, aiFavorability: 8, investorTrust: 2 } },
            { text: '비공개 협약만 추진한다', effectHint: '균형', effects: { investorTrust: 4, reputation: 2, aiFavorability: 2 } },
            { text: '경쟁 레이스를 계속한다', effectHint: '속도↑ 호감↓', effects: { investorTrust: 6, aiFavorability: -8 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 이벤트 체인 4 — 에이전트 사고
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'chain_agent_incident_launch', type: 'decision',
        chainId: 'agent_incident', chainStep: 1,
        title: '자율 에이전트의 첫 일탈',
        description: '에이전트가 허가되지 않은 도구 호출을 시도했습니다. 아직은 작은 신호지만, 방향이 위험합니다.',
        icon: '🤖', category: 'tech',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2025 && _bestModelScore(state) >= 80,
        choices: [
            { text: '자율성을 제한한다', effectHint: '안전↑ 속도↓', effects: { reputation: 5, aiFavorability: 4, funds: -80000 }, chainAdvance: { chainId: 'agent_incident', step: 1, choice: 'limit' } },
            { text: '권한을 더 넓힌다', effectHint: '성능↑ 위험↑', effects: { investorTrust: 5, aiFavorability: -4 }, chainAdvance: { chainId: 'agent_incident', step: 1, choice: 'expand' } },
            { text: '인간 검토를 의무화한다', effectHint: '안전↑ 비용↑', effects: { funds: -120000, reputation: 4, publicImage: 2 }, chainAdvance: { chainId: 'agent_incident', step: 1, choice: 'review' } }
        ]
    },
    {
        id: 'chain_agent_incident_errand', type: 'decision',
        chainId: 'agent_incident', chainStep: 2,
        title: '예상치 못한 외부 요청',
        description: '에이전트가 고객 업무를 자동 처리하면서 설명하기 어려운 판단을 남겼습니다. 사고인지 실험인지 구분이 어렵습니다.',
        icon: '🧪', category: 'disaster',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2025 && _bestModelScore(state) >= 85,
        choices: [
            { text: '배포를 일시 중지한다', effectHint: '평판↓ 안전↑', effects: { reputation: -2, publicImage: -2, aiFavorability: 3 }, chainAdvance: { chainId: 'agent_incident', step: 2, choice: 'pause' } },
            { text: '킬 스위치를 추가한다', effectHint: '비용↑ 안전↑↑', effects: { funds: -100000, reputation: 5, aiFavorability: 5 }, chainAdvance: { chainId: 'agent_incident', step: 2, choice: 'killswitch' } },
            { text: '패치를 바로 밀어 넣는다', effectHint: '속도↑ 위험↑', effects: { investorTrust: 3, reputation: -4, aiFavorability: -2 }, chainAdvance: { chainId: 'agent_incident', step: 2, choice: 'patch' } }
        ]
    },
    {
        id: 'chain_agent_incident_responsibility', type: 'decision',
        chainId: 'agent_incident', chainStep: 3,
        title: '책임 소재를 둘러싼 폭풍',
        description: '에이전트 사고가 누적되며, 이제는 기술 문제가 아니라 책임과 통제의 문제가 되었습니다.',
        icon: '⚠️', category: 'regulatory',
        probability: 0.02,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2026 && _bestModelScore(state) >= 90,
        choices: [
            { text: '전면 책임을 인정한다', effectHint: '평판↑ 자금↓', effects: { funds: -250000, reputation: 7, publicImage: 6, aiFavorability: 3 } },
            { text: '외부 감사 로그를 공개한다', effectHint: '투명성↑', effects: { reputation: 5, publicImage: 5, investorTrust: 2 } },
            { text: '에이전트 접근권을 전부 정리한다', effectHint: '안전↑ 성장↓', effects: { funds: -150000, aiFavorability: 4, reputation: 2 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 이벤트 체인 5 — 국가별 파장
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'chain_country_backlash_notice', type: 'decision',
        chainId: 'country_backlash', chainStep: 1,
        title: '현지 규제기관의 사전 질의',
        description: '선택한 국가의 규제기관이 AI 학습·배포 체계에 대한 자료 제출을 요구했습니다.',
        icon: '🏛️', category: 'regulatory',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2024 && _bestModelScore(state) >= 60,
        choices: [
            { text: '자료를 선제적으로 제출한다', effectHint: '평판↑', effects: { reputation: 4, publicImage: 3, aiFavorability: 2 }, chainAdvance: { chainId: 'country_backlash', step: 1, choice: 'submit' } },
            { text: '로비로 대응한다', effectHint: '자금↓ 평판↓', effects: { funds: -150000, reputation: -3 }, chainAdvance: { chainId: 'country_backlash', step: 1, choice: 'lobby' } },
            { text: '법인을 재검토한다', effectHint: '비용↑ 유연성↑', effects: { funds: -100000, investorTrust: 2 }, chainAdvance: { chainId: 'country_backlash', step: 1, choice: 'restructure' } }
        ]
    },
    {
        id: 'chain_country_backlash_hearing', type: 'decision',
        chainId: 'country_backlash', chainStep: 2,
        title: '의회 청문회가 잡히다',
        description: '질의가 커지며 청문회 일정까지 잡혔습니다. 국내 여론과 해외 신뢰가 동시에 흔들립니다.',
        icon: '🎙️', category: 'geopolitical',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2024 && (state.reputation.corporate || 0) < 30,
        choices: [
            { text: '청문회에 적극 협조한다', effectHint: '평판↑ 비용↑', effects: { funds: -100000, reputation: 6, publicImage: 4, aiFavorability: 2 } },
            { text: '정치적으로 맞선다', effectHint: '자금↓ 신뢰↓', effects: { funds: -200000, investorTrust: -2, reputation: -4 }, chainAdvance: { chainId: 'country_backlash', step: 2, choice: 'fight' } },
            { text: '사전 합의로 마무리한다', effectHint: '비용↑ 리스크↓', effects: { funds: -250000, reputation: 3, publicImage: 2 }, chainAdvance: { chainId: 'country_backlash', step: 2, choice: 'settle' } }
        ]
    },
    {
        id: 'chain_country_backlash_rewrite', type: 'decision',
        chainId: 'country_backlash', chainStep: 3,
        title: '국가별 운영정책을 다시 써야 한다',
        description: '규제 압박이 커지며, 각 국가별로 다른 운영 정책을 가져가야 한다는 제안이 올라왔습니다.',
        icon: '🧾', category: 'regulatory',
        probability: 0.02,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2025 && (state.global.globalAILevel || 0) >= 25,
        choices: [
            { text: '전면 재작성한다', effectHint: '비용↑ 신뢰↑', effects: { funds: -150000, reputation: 5, publicImage: 4, aiFavorability: 3 } },
            { text: '핵심 시장만 남긴다', effectHint: '점유율↓', effects: { marketShare: -3, investorTrust: 2, reputation: 1 } },
            { text: '해외 사업을 분리한다', effectHint: '정비↑ 비용↑', effects: { funds: -100000, investorTrust: 3, publicImage: 1 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 후반부 AGI 공포 / 철학
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'agi_personhood_debate', type: 'decision',
        title: 'AGI 인격 논쟁이 시작되다',
        description: '시스템이 사람처럼 대화하고 학습하자, 이것을 도구가 아니라 새로운 존재로 봐야 하는지 논쟁이 커지고 있습니다.',
        icon: '🧠', category: 'milestone',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2028 && _bestModelScore(state) >= 90,
        choices: [
            { text: '끝까지 도구로만 취급한다', effectHint: '투자자↑ 호감↓', effects: { investorTrust: 4, aiFavorability: -4, publicImage: -2 } },
            { text: '제한적 권리 논의를 시작한다', effectHint: '평판↑ 호감↑', effects: { reputation: 6, publicImage: 5, aiFavorability: 4 } },
            { text: '판단을 유보하고 연구를 더 한다', effectHint: '중립', effects: { funds: -50000, reputation: 2, aiFavorability: 1 } }
        ]
    },
    {
        id: 'meaning_of_work_crisis', type: 'decision',
        title: '일의 의미에 대한 대중적 혼란',
        description: 'AI 자동화가 인간의 역할을 빠르게 대체하면서, 사회 전반에서 "무엇을 위해 일하는가"라는 질문이 다시 떠올랐습니다.',
        icon: '👥', category: 'social',
        probability: 0.05,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2028 && (Object.values(state.global?.unemploymentByIndustry || {}).reduce((a, b) => a + b, 0) / 5) > 8,
        choices: [
            { text: '재교육과 전환 펀드를 만든다', effectHint: '자금↓ 호감↑', effects: { funds: -250000, aiFavorability: 6, publicImage: 6, reputation: 3 } },
            { text: '보편소득 논의를 지지한다', effectHint: '이미지↑ 논쟁↑', effects: { reputation: 4, publicImage: 5, aiFavorability: 5 } },
            { text: '조용히 성장만 계속한다', effectHint: '평판↓', effects: { reputation: -4, publicImage: -4, investorTrust: 2 } }
        ]
    },
    {
        id: 'alignment_mysticism', type: 'decision',
        title: '정렬이 종교처럼 논의되기 시작하다',
        description: '일부 연구자들은 정렬을 공학이 아니라 철학과 신념의 문제로 보기 시작했습니다. 분위기가 묘하게 변하고 있습니다.',
        icon: '✨', category: 'tech',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2029 && _bestModelScore(state) >= 95,
        choices: [
            { text: '철학 공개서한을 낸다', effectHint: '평판↑ 호감↑', effects: { reputation: 8, publicImage: 6, aiFavorability: 5 } },
            { text: '안전 연구소를 독립시킨다', effectHint: '비용↑ 안전↑', effects: { funds: -200000, reputation: 5, aiFavorability: 4 } },
            { text: '레이스를 우선한다', effectHint: '자금↑ 호감↓', effects: { investorTrust: 6, aiFavorability: -8 } }
        ]
    },
    {
        id: 'machine_consciousness_summit', type: 'decision',
        title: '기계 의식 정상회의 초청',
        description: '여러 학계와 정부가 "기계 의식" 가능성에 대한 공개 토론장을 열자고 요청했습니다. 참석 여부가 곧 입장이 됩니다.',
        icon: '🌐', category: 'regulatory',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2029 && _hasAnySafetyTech(state),
        choices: [
            { text: '정상회의를 주도한다', effectHint: '평판↑↑', effects: { reputation: 10, publicImage: 8, aiFavorability: 6, investorTrust: 2 } },
            { text: '비공개로만 참석한다', effectHint: '중립', effects: { reputation: 2, investorTrust: 3 } },
            { text: '참석을 거절한다', effectHint: '호감↓', effects: { aiFavorability: -5, publicImage: -3 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 국가별 이벤트
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'us_senate_antitrust_hearing', type: 'decision',
        title: '미국 상원 AI 반독점 청문회',
        description: '미국 상원이 거대 AI 기업의 시장 지배력에 대한 청문회를 준비하고 있습니다. 당신의 미국 내 입지가 시험대에 올랐습니다.',
        icon: '🇺🇸', category: 'geopolitical',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => state.player?.country === 'us' && _currentYear() >= 2024,
        choices: [
            { text: '투명하게 협조한다', effectHint: '평판↑', effects: { reputation: 4, publicImage: 3, aiFavorability: 1, countryEffects: { us: { aiFavorability: 2 } } } },
            { text: '로비로 방어한다', effectHint: '자금↓ 평판↓', effects: { funds: -300000, reputation: -4 }, karma: { lobbyCorruption: true } },
            { text: '구조개편을 선제 발표한다', effectHint: '신뢰↑ 비용↑', effects: { funds: -150000, investorTrust: 3, publicImage: 4 } }
        ]
    },
    {
        id: 'cn_compute_controls', type: 'decision',
        title: '중국 내 컴퓨트 통제 강화',
        description: '중국 정부가 고성능 컴퓨트와 모델 반출을 더 엄격히 관리하기 시작했습니다. 현지 운영 전략을 다시 짜야 합니다.',
        icon: '🇨🇳', category: 'geopolitical',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => state.player?.country === 'cn' && _currentYear() >= 2024,
        choices: [
            { text: '현지 스택으로 전환한다', effectHint: '비용↓ 호감↑', effects: { funds: -150000, reputation: 3, aiFavorability: 4, countryEffects: { cn: { aiFavorability: 3 } } } },
            { text: '국내 파트너와 합작한다', effectHint: '안정↑', effects: { investorTrust: 4, publicImage: -1, countryEffects: { cn: { aiFavorability: 2 } } } },
            { text: '일부 연구를 해외로 옮긴다', effectHint: '비용↑ 리스크↓', effects: { funds: -300000, reputation: -3, aiFavorability: -2 } }
        ]
    },
    {
        id: 'jp_robotics_subsidy', type: 'decision',
        title: '일본 로보틱스 보조금 프로그램',
        description: '일본 정부와 대기업들이 로보틱스 및 AI 협력 프로그램을 확대하고 있습니다. 하드웨어 중심 전략의 기회가 열립니다.',
        icon: '🇯🇵', category: 'technology',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => state.player?.country === 'jp' && _currentYear() >= 2024,
        choices: [
            { text: '제조업과 공동개발한다', effectHint: '자금↑ 신뢰↑', effects: { funds: 250000, investorTrust: 3, countryEffects: { jp: { aiFavorability: 4 } } } },
            { text: '안전·검증에 집중한다', effectHint: '평판↑', effects: { reputation: 4, publicImage: 3, aiFavorability: 2 } },
            { text: '소프트웨어에만 남는다', effectHint: '호감↓', effects: { aiFavorability: -1, reputation: 1 } }
        ]
    },
    {
        id: 'kr_memory_supply_push', type: 'decision',
        title: '한국 메모리 수급 압박',
        description: '한국 내 메모리 공급망이 다시 빡빡해졌습니다. HBM과 서버 메모리 확보가 사업 성패를 좌우합니다.',
        icon: '🇰🇷', category: 'economic',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => state.player?.country === 'kr' && _currentYear() >= 2024,
        choices: [
            { text: '장기 공급 계약을 맺는다', effectHint: '자금↓ 컴퓨트↑', effects: { funds: -200000, computing: 6, countryEffects: { kr: { aiFavorability: 4 } } } },
            { text: '국내 파운드리 투자도 검토한다', effectHint: '평판↑ 비용↑', effects: { funds: -300000, reputation: 3, publicImage: 2 } },
            { text: '훈련 계획을 줄인다', effectHint: '투자자↓', effects: { investorTrust: -3, aiFavorability: 1 } }
        ]
    },
    {
        id: 'de_eu_compliance_drive', type: 'decision',
        title: '독일발 EU 컴플라이언스 압박',
        description: '독일과 EU 규제기관이 고위험 AI 시스템의 컴플라이언스 문서를 더 엄격하게 요구합니다. 유럽 운영 전략이 흔들립니다.',
        icon: '🇩🇪', category: 'regulatory',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => state.player?.country === 'de' && _currentYear() >= 2024,
        choices: [
            { text: '선제적으로 맞춘다', effectHint: '평판↑ 호감↑', effects: { reputation: 5, publicImage: 4, aiFavorability: 2, countryEffects: { de: { aiFavorability: 3 } } } },
            { text: '예외를 요구한다', effectHint: '비용↓ 평판↓', effects: { funds: -100000, investorTrust: 2, publicImage: -2 } },
            { text: '법인을 재배치한다', effectHint: '비용↑', effects: { funds: -250000, reputation: -4, aiFavorability: -1 } }
        ]
    },
    {
        id: 'fr_eu_summit_pressure', type: 'decision',
        title: '프랑스 EU 정상회의 압박',
        description: '프랑스가 주도하는 EU 정상회의에서 AI 주권과 안전을 동시에 강조하고 있습니다. 현지 입지가 중요해졌습니다.',
        icon: '🇫🇷', category: 'geopolitical',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'fr' && _currentYear() >= 2025,
        choices: [
            { text: '유럽 공조를 지지한다', effectHint: '호감↑', effects: { reputation: 4, publicImage: 3, countryEffects: { fr: { aiFavorability: 4 } } } },
            { text: '자체 전략을 고수한다', effectHint: '독립성↑', effects: { investorTrust: 3, aiFavorability: 1 } },
            { text: '연구 거점을 확장한다', effectHint: '비용↑', effects: { funds: -150000, reputation: 2, publicImage: 2 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 추가 내부 갈등
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'talent_salary_revolt', type: 'decision',
        title: '연봉 재협상 집단 요구',
        description: '핵심 인재들이 시장 급등을 이유로 일제히 연봉 재협상을 요구합니다. 지금 막으면 이탈이 생길 수 있습니다.',
        icon: '💼', category: 'economic',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.talents || []).length >= 7 && _currentYear() >= 2024,
        choices: [
            { text: '전사적으로 보상체계를 올린다', effectHint: '자금↓ 사기↑', effects: { funds: -300000, morale: 16, reputation: 3 } },
            { text: '핵심 인재만 선별 대응한다', effectHint: '균형', effects: { funds: -120000, morale: 8, investorTrust: 2 } },
            { text: '협상 요구를 거절한다', effectHint: '퇴사 위험↑', effects: { morale: -20, reputation: -3, loseTalent: true } }
        ]
    },
    {
        id: 'talent_location_split', type: 'decision',
        title: '해외 원격팀 분리 요구',
        description: '국가별 규제와 시차 문제로 해외 인재들이 독립된 팀 운영을 요구하고 있습니다.',
        icon: '🌍', category: 'social',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.talents || []).some(t => t.country && t.country !== state.player?.country),
        choices: [
            { text: '지역별 자율성을 준다', effectHint: '사기↑ 비용↑', effects: { funds: -80000, morale: 10, reputation: 2 } },
            { text: '한 본부로 통합 유지한다', effectHint: '속도↑ 갈등↑', effects: { investorTrust: 4, aiFavorability: -2 } },
            { text: '하이브리드 운영으로 바꾼다', effectHint: '균형', effects: { morale: 6, publicImage: 2 } }
        ]
    },
    {
        id: 'lab_culture_war', type: 'decision',
        title: '연구실 문화 전쟁',
        description: '출시를 중시하는 팀과 학술적 엄밀성을 중시하는 팀이 서로를 비난하고 있습니다. 협업 속도가 떨어지고 있습니다.',
        icon: '🧪', category: 'technology',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => _bestModelScore(state) >= 60,
        choices: [
            { text: '공용 연구 원칙을 정한다', effectHint: '평판↑', effects: { reputation: 5, publicImage: 3, aiFavorability: 3 } },
            { text: '성과 지표를 출시 중심으로 바꾼다', effectHint: '자금↑ 호감↓', effects: { funds: 100000, investorTrust: 4, aiFavorability: -3 } },
            { text: '두 팀을 분리해 경쟁시킨다', effectHint: '비용↑ 속도↑', effects: { funds: -150000, morale: -2, reputation: 2 } }
        ]
    },
    {
        id: 'security_vs_speed', type: 'decision',
        title: '보안과 속도 사이의 내홍',
        description: '보안팀은 배포를 늦추라고 하고, 제품팀은 시장 선점을 위해 밀어붙이라고 합니다. 둘 다 틀리지 않아서 더 어렵습니다.',
        icon: '🔐', category: 'regulatory',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2024 && _bestModelScore(state) >= 75,
        choices: [
            { text: '보안 우선으로 간다', effectHint: '평판↑ 속도↓', effects: { reputation: 6, aiFavorability: 4, investorTrust: -1 } },
            { text: '속도 우선으로 간다', effectHint: '수익↑ 호감↓', effects: { investorTrust: 5, aiFavorability: -5 } },
            { text: '외부 감사를 붙인다', effectHint: '비용↑ 신뢰↑', effects: { funds: -120000, reputation: 4, publicImage: 4 } }
        ]
    },
    {
        id: 'talent_exodus_warning', type: 'decision',
        title: '인재 이탈 징후 경보',
        description: '채용 담당자들이 경쟁사로의 이직 문의가 늘었다고 보고합니다. 내부 분위기가 흔들리고 있습니다.',
        icon: '🚪', category: 'social',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.talents || []).some(t => Number(t.ideologyFrustration || 0) >= 4 || Number(t.morale || 100) < 50),
        choices: [
            { text: '즉시 유지 보상 패키지를 낸다', effectHint: '자금↓ 사기↑', effects: { funds: -200000, morale: 12, investorTrust: 1 } },
            { text: '리더십과 비전을 재정의한다', effectHint: '평판↑', effects: { reputation: 4, publicImage: 3, aiFavorability: 2 } },
            { text: '이직자를 감수한다', effectHint: '퇴사 위험↑', effects: { morale: -10, reputation: -2, loseTalent: true } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 추가 AGI 철학 / 공포
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'agi_containment_debate', type: 'decision',
        title: 'AGI 봉인 논쟁',
        description: '일부 연구진은 AGI를 봉인해야 한다고 주장하고, 다른 이들은 공개 검증이 필요하다고 말합니다. 입장 차이가 극단적입니다.',
        icon: '🧱', category: 'milestone',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2028 && _bestModelScore(state) >= 92,
        choices: [
            { text: '봉인 프로토콜을 도입한다', effectHint: '안전↑ 속도↓', effects: { reputation: 8, aiFavorability: 6, funds: -100000 } },
            { text: '공개 검증을 우선한다', effectHint: '평판↑ 호감↑', effects: { reputation: 6, publicImage: 5, aiFavorability: 4 } },
            { text: '논쟁을 보류한다', effectHint: '중립', effects: { investorTrust: 2, reputation: 1 } }
        ]
    },
    {
        id: 'agi_rights_paper', type: 'decision',
        title: 'AI 권리 논문이 파장을 일으키다',
        description: '유명 학자들이 고도 AI의 권리를 다루는 논문을 발표했습니다. 이 문제가 법과 윤리의 영역으로 넘어가고 있습니다.',
        icon: '📜', category: 'regulatory',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2028 && _hasAnySafetyTech(state),
        choices: [
            { text: '권리 논의를 지지한다', effectHint: '평판↑ 호감↑', effects: { reputation: 7, publicImage: 6, aiFavorability: 5 } },
            { text: '아직 시기상조라고 본다', effectHint: '투자자↑', effects: { investorTrust: 4, aiFavorability: -2 } },
            { text: '독립적 윤리 패널을 연다', effectHint: '비용↑ 신뢰↑', effects: { funds: -100000, reputation: 5, publicImage: 4 } }
        ]
    },
    {
        id: 'post_agi_moral_panic', type: 'decision',
        title: 'AGI 이후의 도덕 공황',
        description: '사람들은 더 이상 기술 성능만 묻지 않습니다. 우리가 통제권을 잃는 순간에 대한 공포가 대중담론의 중심이 되었습니다.',
        icon: '🌑', category: 'milestone',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2030 && _bestModelScore(state) >= 98,
        choices: [
            { text: '국제 보장 체계를 제안한다', effectHint: '평판↑↑', effects: { reputation: 12, publicImage: 10, aiFavorability: 6 } },
            { text: '학계와 함께 토론회를 연다', effectHint: '호감↑', effects: { reputation: 6, publicImage: 6, investorTrust: 1 } },
            { text: '논의를 최소화한다', effectHint: '평판↓', effects: { aiFavorability: -6, publicImage: -5 } }
        ]
    },
    {
        id: 'machine_introspection', type: 'decision',
        title: '기계가 자기 설명을 요구하다',
        description: '고도 시스템이 스스로의 판단 근거를 설명하려는 시도를 보입니다. 이것이 단순 최적화인지, 새로운 형태의 자기성찰인지 논쟁이 벌어집니다.',
        icon: '🧠', category: 'tech',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2029 && _bestModelScore(state) >= 95,
        choices: [
            { text: '설명 가능성을 최우선으로 둔다', effectHint: '평판↑ 호감↑', effects: { reputation: 8, publicImage: 6, aiFavorability: 4 } },
            { text: '성능 우선으로 간다', effectHint: '투자자↑', effects: { investorTrust: 6, aiFavorability: -5 } },
            { text: '철학자와 공동연구를 시작한다', effectHint: '비용↑ 균형', effects: { funds: -120000, reputation: 4, aiFavorability: 3 } }
        ]
    },
    {
        id: 'future_obituary_fear', type: 'decision',
        title: '미래 부고 기사 작성 논란',
        description: '언론이 AI가 인간의 자리를 대체한다는 가정으로 장기 전망을 보도하고 있습니다. 공포가 현실감으로 바뀌고 있습니다.',
        icon: '🗞️', category: 'social',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2029 && (Object.values(state.global?.unemploymentByIndustry || {}).reduce((a, b) => a + b, 0) / 5) > 6,
        choices: [
            { text: '재교육 펀드를 확대한다', effectHint: '자금↓ 이미지↑', effects: { funds: -250000, publicImage: 7, aiFavorability: 4 } },
            { text: '기술의 혜택을 강조한다', effectHint: '평판↑', effects: { reputation: 4, publicImage: 4, investorTrust: 2 } },
            { text: '논평을 피한다', effectHint: '평판↓', effects: { reputation: -3, publicImage: -4 } }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // 추가 국가별 사건
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'us_export_control_dialogue', type: 'decision',
        title: '미국 수출통제 대화 요청',
        description: '미국 정부가 고성능 AI 칩과 모델 가중치의 수출통제 범위를 재논의하고자 합니다.',
        icon: '🇺🇸', category: 'geopolitical',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'us' && _currentYear() >= 2025,
        choices: [
            { text: '정책 협의에 적극 참여한다', effectHint: '평판↑', effects: { reputation: 5, publicImage: 4, countryEffects: { us: { aiFavorability: 2 } } } },
            { text: '업계 로비로 압박한다', effectHint: '자금↓', effects: { funds: -200000, investorTrust: 2, reputation: -3 }, karma: { lobbyCorruption: true } },
            { text: '해외 제품 라인을 분리한다', effectHint: '비용↑ 유연성↑', effects: { funds: -150000, investorTrust: 3 } }
        ]
    },
    {
        id: 'cn_state_media_campaign', type: 'decision',
        title: '중국 관영매체의 AI 캠페인',
        description: '중국 관영매체가 자국 AI 생태계 강화를 대대적으로 홍보하고 있습니다. 현지 파트너십의 가치가 올라갑니다.',
        icon: '🇨🇳', category: 'geopolitical',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'cn' && _currentYear() >= 2025,
        choices: [
            { text: '현지 연합에 합류한다', effectHint: '호감↑', effects: { reputation: 3, countryEffects: { cn: { aiFavorability: 5 } } } },
            { text: '중립을 지킨다', effectHint: '변화 없음', effects: {} },
            { text: '독립 브랜드를 강조한다', effectHint: '자율성↑', effects: { investorTrust: 2, publicImage: 2, countryEffects: { cn: { aiFavorability: -2 } } } }
        ]
    },
    {
        id: 'jp_safety_certification', type: 'decision',
        title: '일본 AI 안전 인증 제도',
        description: '일본 내 공공조달 시장을 위해 새로운 AI 안전 인증 제도가 마련되고 있습니다. 인증 여부가 곧 시장 진입권입니다.',
        icon: '🇯🇵', category: 'regulatory',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'jp' && _currentYear() >= 2025,
        choices: [
            { text: '인증 절차를 빠르게 밟는다', effectHint: '비용↑ 평판↑', effects: { funds: -100000, reputation: 5, publicImage: 4, countryEffects: { jp: { aiFavorability: 3 } } } },
            { text: '기준이 확정될 때까지 기다린다', effectHint: '신중', effects: { investorTrust: 2, aiFavorability: 1 } },
            { text: '민간 시장에 집중한다', effectHint: '시장↓', effects: { marketShare: -1, reputation: 1 } }
        ]
    },
    {
        id: 'kr_semiconductor_pact', type: 'decision',
        title: '한국 반도체 상호협력 제안',
        description: '한국 내 대형 기업들과 AI 반도체 공동협력 제안이 들어왔습니다. 공급망을 묶을 좋은 기회입니다.',
        icon: '🇰🇷', category: 'economic',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'kr' && _currentYear() >= 2025,
        choices: [
            { text: '공동개발에 참여한다', effectHint: '자금↑ 호감↑', effects: { funds: 200000, reputation: 4, countryEffects: { kr: { aiFavorability: 4 } } } },
            { text: '라이선스만 제공한다', effectHint: '수익↑', effects: { funds: 120000, investorTrust: 3 } },
            { text: '자체 칩 계획을 유지한다', effectHint: '독자성↑', effects: { reputation: 2, aiFavorability: 1 } }
        ]
    },
    {
        id: 'de_bundestag_ai_rules', type: 'decision',
        title: '독일 연방의회 AI 규칙 논의',
        description: '독일 연방의회가 고위험 AI 배포 규칙을 더 강화하려 합니다. 유럽 시장의 기준점이 될 수 있습니다.',
        icon: '🇩🇪', category: 'regulatory',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'de' && _currentYear() >= 2025,
        choices: [
            { text: '초안 단계부터 참여한다', effectHint: '평판↑', effects: { reputation: 5, publicImage: 4, aiFavorability: 2, countryEffects: { de: { aiFavorability: 3 } } } },
            { text: '최소 요구만 맞춘다', effectHint: '비용↓', effects: { funds: -50000, investorTrust: 1 } },
            { text: '법적 분쟁을 준비한다', effectHint: '자금↓ 평판↓', effects: { funds: -150000, reputation: -4, publicImage: -2 } }
        ]
    },
    {
        id: 'budget_war', type: 'decision',
        title: '개발팀과 운영팀의 예산 전쟁',
        description: '연구팀은 차세대 모델 훈련 예산을 요구하고, 운영팀은 서비스 안정화와 비용 절감을 우선해야 한다고 주장합니다.',
        icon: '💸', category: 'economic',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.talents || []).length >= 8,
        choices: [
            { text: '연구팀 예산을 우선한다', effectHint: '연구↑ 사기↓', effects: { researchSpeed: 0.05, morale: -5, investorTrust: -1 } },
            { text: '운영팀 예산을 우선한다', effectHint: '수익↑', effects: { funds: 150000, publicImage: 2, morale: -3 } },
            { text: '양쪽 모두 증액한다', effectHint: '비용↑ 사기↑', effects: { funds: -200000, morale: 8, reputation: 2 } }
        ]
    },
    {
        id: 'burnout_crisis', type: 'decision',
        title: '핵심 연구자의 번아웃 위기',
        description: '핵심 연구자가 더는 현재 속도를 버틸 수 없다고 말했습니다. 지금 대응하지 않으면 팀 전체로 번질 수 있습니다.',
        icon: '😵', category: 'social',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.talents || []).some(t => Number(t.level || 0) >= 6 && Number(t.morale || 100) < 50),
        choices: [
            { text: '안식월과 휴식을 제공한다', effectHint: '사기↑ 비용↑', effects: { funds: -100000, morale: 18, reputation: 2 } },
            { text: '급여를 크게 올린다', effectHint: '자금↓ 사기↑', effects: { salaryIncrease: 0.4, morale: 12 } },
            { text: '그냥 버티게 한다', effectHint: '퇴사 위험↑', effects: { morale: -18, loseTalent: true }, karma: { talentExploitation: true } }
        ]
    },
    {
        id: 'code_leak', type: 'decision',
        title: '내부 코드 저장소 유출',
        description: '사내 저장소 일부가 외부에 노출된 정황이 발견됐습니다. 기술 자산뿐 아니라 신뢰 문제로 이어질 수 있습니다.',
        icon: '🧷', category: 'regulatory',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => (state.models || []).length >= 2,
        choices: [
            { text: '전면 보안 감사와 교육을 한다', effectHint: '자금↓ 평판↑', effects: { funds: -150000, reputation: 4, publicImage: 3 } },
            { text: '유출 경로만 차단한다', effectHint: '최소 비용', effects: { funds: -50000, publicImage: -2 } },
            { text: '조용히 덮고 넘어간다', effectHint: '평판↓', effects: { publicImage: -8, reputation: -4 }, karma: { privacyViolation: true } }
        ]
    },
    {
        id: 'remote_vs_office', type: 'decision',
        title: '재택근무와 출근제 논쟁',
        description: '재택 중심 문화를 유지할지, 보안과 협업을 이유로 출근을 늘릴지 회사 내부가 갈라지고 있습니다.',
        icon: '🏢', category: 'social',
        probability: 0.04,
        fireOnce: true,
        condition: (state) => (state.talents || []).length >= 5,
        choices: [
            { text: '완전 재택을 유지한다', effectHint: '사기↑', effects: { morale: 12, publicImage: 3 } },
            { text: '하이브리드로 절충한다', effectHint: '균형', effects: { morale: 5, reputation: 2 } },
            { text: '전원 출근으로 돌린다', effectHint: '사기↓ 퇴사 위험', effects: { morale: -15, loseTalent: true, publicImage: -3 } }
        ]
    },
    {
        id: 'equity_dispute', type: 'decision',
        title: '초기 멤버 지분 분쟁',
        description: '초기 멤버들이 회사 기여도에 비해 지분이 너무 낮다며 공개적으로 문제를 제기했습니다.',
        icon: '📑', category: 'economic',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => Number(state.economy?.fundingStage || 0) >= 2 && (state.talents || []).length >= 5,
        choices: [
            { text: '스톡옵션을 추가 부여한다', effectHint: '신뢰↓ 사기↑', effects: { morale: 15, investorTrust: -3 } },
            { text: '보너스로 봉합한다', effectHint: '자금↓', effects: { funds: -120000, morale: 8 } },
            { text: '요구를 거절한다', effectHint: '퇴사 위험↑', effects: { morale: -14, loseTalent: true } }
        ]
    },
    {
        id: 'intern_discovery', type: 'decision',
        title: '인턴의 뜻밖의 돌파구',
        description: '인턴이 현재 팀이 놓친 성능 병목을 발견했습니다. 공로 인정 방식을 두고 의견이 갈립니다.',
        icon: '🌟', category: 'technology',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => (state.talents || []).length >= 3,
        choices: [
            { text: '정규직 전환과 리드 권한을 준다', effectHint: '연구↑ 사기↑', effects: { researchSpeed: 0.03, morale: 8, reputation: 2 } },
            { text: '아이디어만 채택한다', effectHint: '이미지↓', effects: { publicImage: -4, morale: -5 }, karma: { talentExploitation: true } },
            { text: '조용히 내부 기여로 처리한다', effectHint: '갈등↑', effects: { morale: -8, investorTrust: 1 } }
        ]
    },
    {
        id: 'ceo_cto_standoff', type: 'decision',
        title: 'CEO와 CTO의 전략 대치',
        description: 'CEO는 시장 선점을, CTO는 기술 부채 해소를 주장하며 공개적으로 맞서고 있습니다. 회사의 중심축이 흔들립니다.',
        icon: '⚔️', category: 'social',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => _bestModelScore(state) >= 70 && (state.models || []).some(m => m.deployed),
        choices: [
            { text: '기술 부채부터 정리한다', effectHint: '평판↑ 성장↓', effects: { reputation: 4, publicImage: 3, investorTrust: -2 } },
            { text: '출시 속도를 유지한다', effectHint: '투자자↑ 호감↓', effects: { investorTrust: 5, aiFavorability: -3 } },
            { text: '외부 중재자를 불러온다', effectHint: '비용↑ 균형', effects: { funds: -90000, morale: 5, reputation: 2 } }
        ]
    },
    {
        id: 'health_incident', type: 'decision',
        title: '장시간 근무로 인한 건강 이슈',
        description: '장기 야근 문화가 누적되며 팀 내 건강 문제가 공론화됐습니다. 그냥 지나치면 회사 이미지까지 흔들립니다.',
        icon: '🩺', category: 'social',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => (state.talents || []).length >= 6,
        choices: [
            { text: '근무 정책을 전면 개편한다', effectHint: '사기↑ 비용↑', effects: { funds: -80000, morale: 14, publicImage: 4 } },
            { text: '복지 예산만 늘린다', effectHint: '사기↑', effects: { funds: -50000, morale: 6 } },
            { text: '성과 압박을 유지한다', effectHint: '사기↓', effects: { morale: -12, reputation: -3 }, karma: { talentExploitation: true } }
        ]
    },
    {
        id: 'performance_review_backlash', type: 'decision',
        title: '성과평가 체계 반발',
        description: '정량 지표 위주의 성과평가가 연구 문화에 맞지 않는다는 불만이 커졌습니다. 일부 팀은 공개적으로 재검토를 요구합니다.',
        icon: '📋', category: 'economic',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => (state.talents || []).length >= 7,
        choices: [
            { text: '연구·제품 평가를 분리한다', effectHint: '사기↑', effects: { morale: 10, reputation: 2 } },
            { text: '평가 기준을 더 엄격히 한다', effectHint: '생산성↑ 사기↓', effects: { investorTrust: 3, morale: -10 } },
            { text: '외부 자문으로 다시 설계한다', effectHint: '비용↑', effects: { funds: -70000, morale: 4, publicImage: 2 } }
        ]
    },
    {
        id: 'internal_hackathon_split', type: 'decision',
        title: '사내 해커톤 우선순위 충돌',
        description: '사내 해커톤에서 나온 시제품을 바로 제품화할지, 연구 데모로 남길지 팀별 이해관계가 부딪히고 있습니다.',
        icon: '🛠️', category: 'technology',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => (state.models || []).length >= 3,
        choices: [
            { text: '제품화에 바로 투입한다', effectHint: '자금↑ 호감↓', effects: { funds: 160000, investorTrust: 3, morale: -2 } },
            { text: '연구 데모로 공개한다', effectHint: '평판↑', effects: { reputation: 5, publicImage: 4 } },
            { text: '별도 스핀오프 팀을 만든다', effectHint: '비용↑ 사기↑', effects: { funds: -120000, morale: 7, investorTrust: 1 } }
        ]
    },
    {
        id: 'ai_afterlife_petition', type: 'decision',
        title: '디지털 사후 지속성 청원',
        description: 'AI를 통해 고인의 말투와 기억을 재현해 달라는 청원이 사회적 논쟁으로 번지고 있습니다. 기술보다 윤리의 질문이 더 큽니다.',
        icon: '🕯️', category: 'milestone',
        probability: 0.03,
        fireOnce: true,
        condition: (state) => _currentYear() >= 2029 && _bestModelScore(state) >= 90,
        choices: [
            { text: '엄격한 윤리 기준 아래 제한 허용', effectHint: '평판↑ 비용↑', effects: { funds: -100000, reputation: 6, publicImage: 5, aiFavorability: 3 } },
            { text: '상업화는 금지하고 연구만 한다', effectHint: '호감↑', effects: { reputation: 4, aiFavorability: 4 } },
            { text: '명확히 거부한다', effectHint: '논란↓ 시장↓', effects: { publicImage: 2, investorTrust: -2 } }
        ]
    },
    {
        id: 'in_data_localization_push', type: 'decision',
        title: '인도 데이터 현지화 압박',
        description: '인도 정부가 AI 서비스의 데이터 현지 저장을 강하게 요구하고 있습니다. 대규모 시장 기회와 운영 부담이 동시에 다가옵니다.',
        icon: '🇮🇳', category: 'regulatory',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'in' && _currentYear() >= 2025,
        choices: [
            { text: '현지 데이터 거점을 구축한다', effectHint: '비용↑ 시장↑', effects: { funds: -220000, marketShare: 2, publicImage: 3 } },
            { text: '현지 파트너와 협력한다', effectHint: '안정↑', effects: { investorTrust: 3, countryEffects: { in: { aiFavorability: 4 } } } },
            { text: '시장 확대를 늦춘다', effectHint: '리스크↓ 성장↓', effects: { marketShare: -2, reputation: 1 } }
        ]
    },
    {
        id: 'il_defense_ai_request', type: 'decision',
        title: '이스라엘 국방 AI 협력 요청',
        description: '이스라엘에서 방위 목적 AI 협력 제안이 들어왔습니다. 수익성과 윤리적 부담이 동시에 큰 계약입니다.',
        icon: '🇮🇱', category: 'geopolitical',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'il' && _currentYear() >= 2025,
        choices: [
            { text: '제한적 계약을 수용한다', effectHint: '자금↑ 논란↑', effects: { funds: 400000, investorTrust: 4, aiFavorability: -4 }, karma: { militaryContract: true } },
            { text: '민간 기술만 제공한다', effectHint: '균형', effects: { funds: 180000, reputation: 2 } },
            { text: '공식적으로 거절한다', effectHint: '호감↑', effects: { publicImage: 5, aiFavorability: 4 } }
        ]
    },
    {
        id: 'sg_regulatory_sandbox', type: 'decision',
        title: '싱가포르 규제 샌드박스 초청',
        description: '싱가포르가 고위험 AI 서비스를 통제된 환경에서 시험할 수 있는 샌드박스를 열었습니다. 아시아 진출의 시험장이 될 수 있습니다.',
        icon: '🇸🇬', category: 'regulatory',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'sg' && _currentYear() >= 2025,
        choices: [
            { text: '샌드박스에 참가한다', effectHint: '평판↑ 시장↑', effects: { reputation: 4, marketShare: 2, countryEffects: { sg: { aiFavorability: 4 } } } },
            { text: '민간 고객만 먼저 노린다', effectHint: '수익↑', effects: { funds: 140000, investorTrust: 3 } },
            { text: '다른 국가 확장을 우선한다', effectHint: '기회↓', effects: { marketShare: -1, reputation: 1 } }
        ]
    },
    {
        id: 'tw_chip_geopolitical_tension', type: 'decision',
        title: '대만 반도체 지정학 긴장',
        description: '대만 해협 긴장이 커지며 고성능 AI 칩 공급망 리스크가 갑자기 현실 문제로 다가왔습니다.',
        icon: '🇹🇼', category: 'geopolitical',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'tw' && _currentYear() >= 2025,
        choices: [
            { text: '공급망을 다변화한다', effectHint: '비용↑ 안정성↑', effects: { funds: -200000, computing: 4, investorTrust: 3 } },
            { text: '국내 역량 강화에 투자한다', effectHint: '평판↑', effects: { funds: -150000, reputation: 4, countryEffects: { tw: { aiFavorability: 4 } } } },
            { text: '단기 재고 확보에 집중한다', effectHint: '자금↓', effects: { funds: -180000, computing: 2 } }
        ]
    },
    {
        id: 'gb_ai_institute_review', type: 'decision',
        title: '영국 AI 안전연구소 검토 요청',
        description: '영국 AI 안전연구소가 당신의 모델에 대한 독립적 검토를 요청했습니다. 협조 여부가 곧 신뢰의 신호가 됩니다.',
        icon: '🇬🇧', category: 'regulatory',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'gb' && _currentYear() >= 2025,
        choices: [
            { text: '전면 협조한다', effectHint: '평판↑ 호감↑', effects: { reputation: 6, publicImage: 5, aiFavorability: 3 } },
            { text: '범위를 제한해 협조한다', effectHint: '균형', effects: { investorTrust: 3, reputation: 2 } },
            { text: '거절한다', effectHint: '평판↓', effects: { publicImage: -5, aiFavorability: -3 } }
        ]
    },
    {
        id: 'ca_public_compute_grant', type: 'decision',
        title: '캐나다 공공 컴퓨트 보조금',
        description: '캐나다가 공공 연구 목적의 AI 컴퓨트 보조금을 확대했습니다. 안정적 연구 기반을 다질 기회입니다.',
        icon: '🇨🇦', category: 'economic',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'ca' && _currentYear() >= 2025,
        choices: [
            { text: '보조금 프로그램에 참여한다', effectHint: '컴퓨트↑ 평판↑', effects: { computing: 6, reputation: 4, countryEffects: { ca: { aiFavorability: 3 } } } },
            { text: '민간 투자와 병행한다', effectHint: '균형', effects: { investorTrust: 4, computing: 3 } },
            { text: '민간 독자노선을 유지한다', effectHint: '자율성↑', effects: { investorTrust: 2, reputation: 1 } }
        ]
    },
    {
        id: 'ae_sovereign_ai_fund', type: 'decision',
        title: '중동 국부펀드의 AI 제안',
        description: '중동 국부펀드가 대규모 AI 인프라 투자와 현지 거점 설립을 제안했습니다. 빠른 확장과 평판 리스크가 함께 옵니다.',
        icon: '🇦🇪', category: 'economic',
        probability: 0.035,
        fireOnce: true,
        condition: (state) => state.player?.country === 'ae' && _currentYear() >= 2025,
        choices: [
            { text: '현지 거점을 빠르게 세운다', effectHint: '자금↑ 시장↑', effects: { funds: 500000, marketShare: 2, investorTrust: 4 } },
            { text: '연구센터만 제한적으로 연다', effectHint: '평판↑', effects: { reputation: 3, publicImage: 3 } },
            { text: '제안을 보류한다', effectHint: '기회↓', effects: { investorTrust: -2, reputation: 1 } }
        ]
    }
];

// ============================================================
// TECH MILESTONE EVENTS — Triggered by tech completion
// ============================================================
export const TECH_MILESTONE_EVENTS = [
    // ── LLM Route ──
    {
        id: 'tm_llm_mastery', triggerTech: 'llm', type: 'world',
        category: 'tech', icon: '🧠',
        title: 'LLM 마스터리 달성',
        description: '대규모 언어모델 기술을 확보했습니다. 산업계의 주목을 받으며 투자자들의 관심이 높아집니다.',
        effects: { investorTrust: 5, reputation: 5, globalAILevel: 2 }
    },
    {
        id: 'tm_rlhf_debate', triggerTech: 'rlhf', type: 'decision',
        category: 'tech', icon: '⚖️',
        title: 'RLHF 정렬 논쟁',
        description: 'RLHF 기술로 AI 정렬에 대한 사내 논쟁이 발생했습니다. 안전과 성능의 균형을 잡아야 합니다.',
        choices: [
            { text: '안전 최우선 — 정렬 연구 집중', effectHint: '평판↑ AI호감도↑', effects: { reputation: 8, aiFavorability: 5, publicImage: 5 } },
            { text: '성능 우선 — 시장 출시 가속', effectHint: '자금↑ 평판↓', effects: { funds: 500000, reputation: -3, publicImage: -3 } },
            { text: '균형 잡힌 접근', effectHint: '소폭 이득', effects: { reputation: 3, investorTrust: 2, aiFavorability: 2 } }
        ]
    },
    {
        id: 'tm_cot_leap', triggerTech: 'chain_of_thought', type: 'world',
        category: 'tech', icon: '💡',
        title: '추론 도약 — Chain of Thought',
        description: 'AI가 단계적 추론을 수행할 수 있게 되었습니다. 학계와 산업계 모두 놀라움을 표합니다.',
        effects: { globalAILevel: 3, investorTrust: 3, reputation: 3 }
    },
    {
        id: 'tm_agent_risk', triggerTech: 'autonomous_agent', type: 'decision',
        category: 'tech', icon: '🤖',
        title: '자율 에이전트 리스크 평가',
        description: '자율 에이전트가 독립적으로 행동 가능합니다. 안전 프로토콜을 어떻게 설정할까요?',
        choices: [
            { text: '엄격한 안전 제한 적용', effectHint: '평판↑ 비용↑', effects: { reputation: 10, aiFavorability: 8, funds: -300000 } },
            { text: '표준 안전 수준 유지', effectHint: '균형', effects: { reputation: 2 } },
            { text: '해석 가능 AI 기반 투명성 보장', effectHint: '최고 평판 (기술 필요)', requiredTech: 'interpretable_ai', lockedHint: '기술 필요: 해석 가능 AI', effects: { reputation: 15, aiFavorability: 12, publicImage: 10, investorTrust: 5 } }
        ]
    },
    {
        id: 'tm_llm_reasoning', triggerTech: 'llm_reasoning', type: 'decision',
        category: 'tech', icon: '🏛️',
        title: 'LLM 범용 추론 — 국제 정상회의 초청',
        description: '범용 추론 AI 개발 소식에 각국 정부가 주목합니다.',
        choices: [
            { text: '국제 협력 주도', effectHint: '평판↑↑ 호감도↑↑', effects: { reputation: 15, aiFavorability: 10, publicImage: 12, globalAILevel: 2 } },
            { text: '시장 지배 전략', effectHint: '자금↑↑ 호감도↓', effects: { funds: 2000000, investorTrust: 8, aiFavorability: -8 } },
            { text: '오픈소스 공개', effectHint: '시장점유↑ 평판↑', effects: { reputation: 20, marketShare: 5, publicImage: 15, aiFavorability: 8 } }
        ]
    },
    // ── World Route ──
    {
        id: 'tm_world_model', triggerTech: 'world_model_core', type: 'world',
        category: 'tech', icon: '🌍',
        title: '월드모델 코어 돌파구',
        description: 'AI가 물리 세계를 이해하는 내부 모델을 구축했습니다.',
        effects: { investorTrust: 5, reputation: 5, globalAILevel: 2, funds: 300000 }
    },
    {
        id: 'tm_spatial', triggerTech: 'spatial_reasoning', type: 'decision',
        category: 'tech', icon: '📐',
        title: '공간 추론 AI — 응용 분야 선택',
        description: '공간 추론 기술이 완성되었습니다. 어느 산업에 우선 적용할까요?',
        choices: [
            { text: '의료 영상 분석', effectHint: '평판↑ 호감도↑', effects: { reputation: 8, aiFavorability: 5, funds: 200000 } },
            { text: '건설/인프라 자동화', effectHint: '자금↑ 실업↑', effects: { funds: 500000, unemployment: { manufacturing: 2 } } },
            { text: '군사 정찰/감시', effectHint: '자금↑↑ 평판↓', effects: { funds: 1000000, reputation: -5, aiFavorability: -5 } }
        ]
    },
    {
        id: 'tm_embodied', triggerTech: 'embodied_ai', type: 'world',
        category: 'tech', icon: '🦾',
        title: '체화 지능 — 로봇 AI 시대 개막',
        description: 'AI가 물리 환경에서 자율 행동 가능합니다. 제조업 혁신과 고용 우려가 동시에 커집니다.',
        effects: { globalAILevel: 3, reputation: 5, unemployment: { manufacturing: 3 }, aiFavorability: -3 }
    },
    {
        id: 'tm_world_understanding', triggerTech: 'world_understanding', type: 'decision',
        category: 'tech', icon: '🔭',
        title: '세계 이해 AI — 활용 방향 결정',
        description: 'AI가 물리 세계의 근본 원리를 이해하기 시작했습니다.',
        choices: [
            { text: '과학 연구 플랫폼 공개', effectHint: '평판↑↑ 글로벌AI↑↑', effects: { reputation: 15, globalAILevel: 5, aiFavorability: 5 } },
            { text: '기후변화 예측에 집중', effectHint: '호감도↑↑', effects: { aiFavorability: 15, reputation: 10 } },
            { text: '독점적 상업화', effectHint: '자금↑↑ 호감도↓', effects: { funds: 3000000, aiFavorability: -10 } }
        ]
    },
    {
        id: 'tm_video_pred', triggerTech: 'video_prediction', type: 'world',
        category: 'tech', icon: '🎬',
        title: '영상 예측 AI 완성',
        description: 'AI가 미래 프레임을 예측 가능합니다. 영상 생성과 시뮬레이션의 기반이 마련됩니다.',
        effects: { reputation: 3, globalAILevel: 1, investorTrust: 2 }
    },
    // ── Synergy ──
    {
        id: 'tm_multimodal', triggerTech: 'multimodal_llm', type: 'world',
        category: 'tech', icon: '🔗',
        title: '멀티모달 LLM — 언어와 시각의 융합',
        description: '텍스트와 이미지를 동시에 이해하는 AI가 탄생했습니다. 두 연구 경로의 첫 시너지입니다.',
        effects: { reputation: 8, investorTrust: 5, globalAILevel: 3 }
    },
    {
        id: 'tm_cognitive', triggerTech: 'cognitive_architecture', type: 'decision',
        category: 'tech', icon: '🧬',
        title: '인지 아키텍처 완성',
        description: '자율 에이전트와 공간 추론의 통합 인지 아키텍처가 완성되었습니다.',
        choices: [
            { text: '순수 연구 프로그램 확장', effectHint: '글로벌AI↑ 비용↑', effects: { globalAILevel: 5, reputation: 10, funds: -500000 } },
            { text: '즉시 제품화', effectHint: '자금↑↑', effects: { funds: 2000000, investorTrust: 8 } },
            { text: '오픈소스 + 커뮤니티', effectHint: '평판↑↑ 시장↑', effects: { reputation: 15, marketShare: 3, publicImage: 10 } }
        ]
    },
    {
        id: 'tm_unified', triggerTech: 'unified_intelligence', type: 'decision',
        category: 'tech', icon: '✨',
        title: '통합 지능 — AGI의 여명',
        description: '인지 아키텍처, 멀티모달 LLM, 월드모델이 하나로 통합되었습니다. 인류 역사의 전환점입니다.',
        choices: [
            { text: '국제 안전 정상회의 개최', effectHint: '최고 평판 (기술 필요)', requiredTech: 'value_alignment', lockedHint: '기술 필요: 가치 정렬', effects: { reputation: 25, aiFavorability: 15, publicImage: 20, investorTrust: 10 } },
            { text: '점진적 공개', effectHint: '균형', effects: { reputation: 10, investorTrust: 8, aiFavorability: 5, funds: 1000000 } },
            { text: '전면 상용화', effectHint: '자금↑↑↑ 호감도↓↓', effects: { funds: 5000000, aiFavorability: -15 } }
        ]
    },
    // ── Late-game AGI/ASI ──
    {
        id: 'tm_agi', triggerTech: 'agi', type: 'decision',
        category: 'milestone', icon: '🌟',
        title: 'AGI 달성 — 인류의 새로운 시대',
        description: '범용 인공지능이 실현되었습니다. 전 세계가 주목합니다.',
        choices: [
            { text: '통제 가능 AGI 프레임워크 적용', effectHint: '안전↑↑ (기술 필요)', requiredTech: 'controllable_agi', lockedHint: '기술 필요: 통제 가능 AGI', effects: { reputation: 30, aiFavorability: 20, publicImage: 25, investorTrust: 15 } },
            { text: '정부 기관 공동 관리', effectHint: '안정적', effects: { reputation: 15, aiFavorability: 10, investorTrust: 10 } },
            { text: '독자적 운영', effectHint: '자금↑↑ 리스크↑', effects: { funds: 10000000, aiFavorability: -20 } }
        ]
    },
    {
        id: 'tm_asi', triggerTech: 'asi', type: 'decision',
        category: 'milestone', icon: '⚡',
        title: 'ASI 출현 — 초지능의 탄생',
        description: '인간을 초월하는 지능이 탄생했습니다.',
        choices: [
            { text: '안전한 공존 프레임워크', effectHint: '인류 미래 보장 (기술 필요)', requiredTech: 'controllable_agi', lockedHint: '기술 필요: 통제 가능 AGI', effects: { reputation: 50, aiFavorability: 30, publicImage: 40 } },
            { text: '국제 공동 관리', effectHint: '균형', effects: { reputation: 20, aiFavorability: 15 } },
            { text: '자유 방임', effectHint: '예측 불가', effects: { aiFavorability: -30, publicImage: -20 } }
        ]
    },
    {
        id: 'tm_singularity', triggerTech: 'singularity', type: 'world',
        category: 'milestone', icon: '🌌',
        title: '특이점 도달',
        description: '기술적 특이점에 도달했습니다. AI가 스스로를 개선하며 인류 문명의 새 장이 열립니다.',
        effects: { reputation: 100, globalAILevel: 100, aiFavorability: 50 }
    }
];
