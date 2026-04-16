/**
 * Demo Configuration
 */
export const DEMO = {
    enabled: true,
    version: '0.1.0-demo',
    maxYear: 2023,
    allowedRoutes: ['llm'],
    maxTechTier: 3,
    maxCompetitors: 3,
    eventFilter: {
        maxHistoricalYear: 2020,
        blockPrefixes: ['horror_', 'late_', 'chain_step3_']
    },
    restrictedFeatures: ['chipProgram', 'internalAI', 'worldMap3D'],
    endMessage: '데모 버전을 플레이해주셔서 감사합니다!\n정식 버전에서는 2031년까지, 7개 승리 조건, 100개 기술, 5개 노선으로 플레이할 수 있습니다.',
};
