export const EVENTS = [
    {
        id: 'gov_regulation',
        title: '정부 AI 규제 강화',
        description: '각국 정부가 AI 개발에 대한 규제를 강화하려 합니다.',
        probability: 0.03,
        condition: (state) => state.global.globalAILevel > 20,
        choices: [
            { text: '규제에 순응한다', effects: { researchSpeed: -0.1, reputation: 5, favorability: 3 } },
            { text: '로비로 대응한다', effects: { funds: -100000, researchSpeed: 0, reputation: -3 } },
            { text: '다른 국가로 연구 이전', effects: { funds: -200000, researchSpeed: 0 } }
        ]
    },
    {
        id: 'investment_offer',
        title: '대규모 투자 제안',
        description: '투자자가 대규모 투자를 제안합니다.',
        probability: 0.04,
        condition: (state) => state.reputation.corporate > -20,
        choices: [
            { text: '투자 수락 ($2M)', effects: { funds: 2000000, investorTrust: 5 } },
            { text: '조건부 수락 ($1M, 자율성 유지)', effects: { funds: 1000000, investorTrust: 3 } },
            { text: '거절 (독립성 유지)', effects: { reputation: 5 } }
        ]
    },
    {
        id: 'talent_poaching',
        title: '핵심 인재 이직 위기',
        description: '경쟁사가 핵심 연구원에게 파격적인 조건을 제시했습니다.',
        probability: 0.05,
        condition: (state) => state.talents.length > 3,
        choices: [
            { text: '급여 인상으로 만류 (+30%)', effects: { salaryIncrease: 0.3, morale: 15 } },
            { text: '연구 자율성 보장', effects: { morale: 10, reputation: 2 } },
            { text: '보내준다', effects: { loseTalent: true, morale: -5 } }
        ]
    },
    {
        id: 'ethics_scandal',
        title: 'AI 윤리 스캔들',
        description: '당사 AI 모델에서 심각한 편향성이 발견되어 언론에 보도되었습니다.',
        probability: 0.03,
        condition: (state) => state.models.length > 0,
        choices: [
            { text: '즉시 서비스 중단 & 수정', effects: { reputation: -5, funds: -200000, favorability: 5 } },
            { text: '공식 사과 & 점진적 수정', effects: { reputation: -10, favorability: 2 } },
            { text: '무시하고 넘어간다', effects: { reputation: -20, favorability: -10 } }
        ]
    },
    {
        id: 'hardware_breakthrough',
        title: '새로운 하드웨어 혁신',
        description: '새로운 반도체 기술이 등장하여 컴퓨팅 비용이 감소합니다.',
        probability: 0.02,
        condition: () => true,
        choices: [
            { text: '새 하드웨어 즉시 도입', effects: { funds: -300000, computing: 20 } },
            { text: '관망 후 도입', effects: { computing: 5 } }
        ]
    },
    {
        id: 'data_breach',
        title: '데이터 유출 사고',
        description: '해커가 학습 데이터에 접근했다는 보고가 들어왔습니다.',
        probability: 0.02,
        condition: (state) => state.resources.data > 20,
        choices: [
            { text: '즉시 공개 & 보상', effects: { reputation: -5, funds: -500000, favorability: 3 } },
            { text: '조용히 해결', effects: { reputation: -3, funds: -200000 } },
            { text: '은폐 시도', effects: { reputation: -20, favorability: -15 } }
        ]
    },
    {
        id: 'opensource_contribution',
        title: '오픈소스 기여 요청',
        description: '연구 커뮤니티에서 모델 공개를 요청합니다.',
        probability: 0.03,
        condition: (state) => state.models.length > 0,
        choices: [
            { text: '핵심 모델 오픈소스', effects: { reputation: 20, favorability: 10, marketShare: -3 } },
            { text: '부분 공개', effects: { reputation: 10, favorability: 5 } },
            { text: '거절', effects: { reputation: -5 } }
        ]
    },
    {
        id: 'gpu_shortage',
        title: 'GPU 품귀 현상',
        description: '글로벌 GPU 공급 부족으로 가격이 급등합니다.',
        probability: 0.03,
        condition: () => true,
        choices: [
            { text: '비싼 가격에 확보', effects: { funds: -500000, computing: 15 } },
            { text: '대기열에 등록', effects: {} },
            { text: '자체 칩 개발 가속', effects: { funds: -300000, chipResearchBoost: true } }
        ]
    },
    {
        id: 'ai_accident',
        title: 'AI 사고 발생',
        description: 'AI 시스템이 예상치 못한 행동을 하여 피해가 발생했습니다.',
        probability: 0.02,
        condition: (state) => state.models.some(m => m.deployed && m.safetyScore < 50),
        choices: [
            { text: '전면 서비스 중단 & 조사', effects: { reputation: -15, funds: -1000000, favorability: -5, globalFavorability: -3 } },
            { text: '해당 기능만 비활성화', effects: { reputation: -10, funds: -300000, favorability: -3 } }
        ]
    },
    {
        id: 'international_ai_treaty',
        title: '국제 AI 협약',
        description: 'UN에서 AI 개발 속도 제한 협약을 추진합니다.',
        probability: 0.02,
        condition: (state) => state.global.globalAILevel > 40,
        choices: [
            { text: '협약 참여', effects: { researchSpeed: -0.15, reputation: 10, favorability: 8 } },
            { text: '관망', effects: {} },
            { text: '반대 로비', effects: { funds: -500000, reputation: -10, favorability: -5 } }
        ]
    },
    {
        id: 'anti_ai_protest',
        title: '반AI 시위',
        description: 'AI로 인한 실업 증가에 분노한 시민들이 대규모 시위를 벌입니다.',
        probability: 0.04,
        condition: (state) => {
            const avgUnemployment = Object.values(state.global.unemploymentByIndustry).reduce((a, b) => a + b, 0) / 5;
            return avgUnemployment > 10;
        },
        choices: [
            { text: 'AI 재교육 프로그램 시작', effects: { funds: -800000, favorability: 10, unemploymentReduction: 2 } },
            { text: '일자리 창출 기금 조성', effects: { funds: -500000, favorability: 7 } },
            { text: '무시', effects: { favorability: -10, reputation: -5 } }
        ]
    }
];
