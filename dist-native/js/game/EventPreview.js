import { t } from '../i18n.js';

const EFFECT_LABELS = {
    funds: 'effect.funds',
    reputation: 'effect.reputation',
    publicImage: 'effect.publicImage',
    investorTrust: 'effect.investorTrust',
    aiFavorability: 'effect.aiFavorability',
    morale: 'effect.morale',
    researchSpeed: 'effect.researchSpeed',
    computing: 'effect.computing',
    data: 'effect.data',
    marketShare: 'effect.marketShare',
    globalAILevel: 'effect.globalAILevel',
    gpuPriceChange: 'effect.gpuPriceChange',
    gpuPriceMult: 'effect.gpuPriceMult',
    cloudCostMult: 'effect.cloudCostMult',
    competitorBoost: 'effect.competitorBoost',
    valuationMult: 'effect.valuationMult',
    salaryIncrease: 'effect.salaryIncrease',
    loseTalent: 'effect.loseTalent',
    unemployment: 'effect.unemployment',
    gpuSupplyShutdownMonths: 'effect.gpuSupplyShutdownMonths',
    disableInternalAI: 'effect.disableInternalAI',
    ideologyReset: 'effect.ideologyReset'
};

const EFFECT_FALLBACKS = {
    funds: '자금',
    reputation: '평판',
    publicImage: '공공 이미지',
    investorTrust: '투자자 신뢰',
    aiFavorability: 'AI 호감도',
    morale: '인재 사기',
    researchSpeed: '연구 속도',
    computing: '컴퓨팅',
    data: '데이터',
    marketShare: '시장 점유율',
    globalAILevel: '글로벌 AI 수준',
    gpuPriceChange: 'GPU 가격',
    gpuPriceMult: 'GPU 가격 배수',
    cloudCostMult: '클라우드 비용',
    competitorBoost: '경쟁사 성장',
    valuationMult: '기업가치',
    salaryIncrease: '급여',
    loseTalent: '인재 이탈',
    unemployment: '실업률',
    gpuSupplyShutdownMonths: 'GPU 공급 중단',
    disableInternalAI: '내부 AI 비활성화',
    ideologyReset: '이념 재편'
};

const EFFECT_ICONS = {
    funds: '💰',
    reputation: '📉',
    publicImage: '🌍',
    investorTrust: '📊',
    aiFavorability: '🌐',
    morale: '😊',
    researchSpeed: '🔬',
    computing: '🖥️',
    data: '📚',
    marketShare: '📈',
    globalAILevel: '🧠',
    gpuPriceChange: '🧩',
    gpuPriceMult: '🧩',
    cloudCostMult: '☁️',
    competitorBoost: '⚔️',
    valuationMult: '💠',
    salaryIncrease: '💼',
    loseTalent: '👤',
    unemployment: '🏭',
    gpuSupplyShutdownMonths: '⛔',
    disableInternalAI: '🔒',
    ideologyReset: '🧭'
};

function _effectLabel(key) {
    return t(EFFECT_LABELS[key] || `effect.${key}`, EFFECT_FALLBACKS[key] || key);
}

function _signedNumber(value) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}`;
}

function _formatValue(key, value) {
    if (key === 'funds') {
        const sign = value > 0 ? '+' : '-';
        return `${sign}$${Math.abs(value).toLocaleString()}`;
    }
    if (key === 'salaryIncrease') {
        return `+${Math.round(value * 100)}%`;
    }
    if (key === 'cloudCostMult' || key === 'valuationMult') {
        return `${value >= 1 ? '+' : ''}${Math.round((value - 1) * 100)}%`;
    }
    if (key === 'gpuPriceMult') {
        return `${Math.round(value * 100)}%`;
    }
    if (key === 'gpuSupplyShutdownMonths') {
        return `${Math.round(value)}${t('world.months', '개월')}`;
    }
    return _signedNumber(value);
}

function _karmaEntries(karma = {}) {
    return Object.entries(karma)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => ({
            key: `karma.${key}`,
            icon: '⚠️',
            tone: 'warning',
            text: `${t('event.choice.karma', '윤리적 대가')}: ${t(`karma.${key}`, key)}`
        }));
}

export function getEventChoicePreviewEntries({ effects = {}, karma = null } = {}) {
    const entries = [];

    for (const [key, rawValue] of Object.entries(effects || {})) {
        if (key === 'karma' || rawValue == null) continue;
        if (typeof rawValue === 'function') continue;
        if (key === 'gpuSupplyShutdown') continue;

        if (key === 'loseTalent' && rawValue) {
            entries.push({
                key,
                icon: EFFECT_ICONS[key] || '•',
                tone: 'negative',
                text: `${_effectLabel(key)} 1`
            });
            continue;
        }

        if (key === 'disableInternalAI' && rawValue) {
            entries.push({
                key,
                icon: EFFECT_ICONS[key] || '•',
                tone: 'negative',
                text: _effectLabel(key)
            });
            continue;
        }

        if (key === 'ideologyReset' && rawValue) {
            entries.push({
                key,
                icon: EFFECT_ICONS[key] || '•',
                tone: 'warning',
                text: `${_effectLabel(key)}${rawValue === 'all' ? ` (${t('event.preview.all', '전체')})` : ''}`
            });
            continue;
        }

        if (key === 'unemployment' && rawValue && typeof rawValue === 'object') {
            for (const [industry, delta] of Object.entries(rawValue)) {
                if (!delta) continue;
                entries.push({
                    key: `unemployment.${industry}`,
                    icon: EFFECT_ICONS[key] || '•',
                    tone: delta > 0 ? 'negative' : 'positive',
                    text: `${_effectLabel(key)} (${t(`industry.${industry}`, industry)}) ${_signedNumber(delta)}`
                });
            }
            continue;
        }

        if (key === 'countryEffects' || key === 'specificCompetitor') continue;
        if (typeof rawValue === 'object') continue;

        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) continue;
        if (!numericValue && !['gpuSupplyShutdownMonths'].includes(key)) continue;

        entries.push({
            key,
            icon: EFFECT_ICONS[key] || '•',
            tone: numericValue < 0 ? 'negative' : 'positive',
            text: `${_effectLabel(key)} ${_formatValue(key, numericValue)}`
        });
    }

    entries.push(..._karmaEntries(karma || effects?.karma));
    return entries;
}
