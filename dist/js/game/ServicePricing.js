export const SERVICE_PRICE_MIN = 0.3;
export const SERVICE_PRICE_MAX = 3.0;

export const FREE_SERVICE_CHANNEL_TYPES = Object.freeze(['open_source', 'internal']);

export const SERVICE_CHANNEL_PRICE_ELASTICITY = Object.freeze({
    api: 0.8,
    consumer_chat: 1.2,
    enterprise: 0.4,
    government: 0.2,
    open_source: 0,
    internal: 0,
    b2b_license: 0.6
});

export const COMPETITOR_PRICE_STRATEGY = Object.freeze({
    aggressive: { priceMult: 0.65, variance: 0.08 },
    platform: { priceMult: 1.08, variance: 0.12 },
    safety: { priceMult: 1.3, variance: 0.08 },
    research: { priceMult: 1.18, variance: 0.1 },
    state_backed: { priceMult: 0.9, variance: 0.06 },
    balanced: { priceMult: 1.0, variance: 0.1 }
});

function _toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function isFreeServiceChannel(channelType = '') {
    return FREE_SERVICE_CHANNEL_TYPES.includes(channelType);
}

export function clampServicePriceMult(priceMult, channelType = null) {
    if (isFreeServiceChannel(channelType)) return 0;
    const fallback = 1;
    return Math.max(SERVICE_PRICE_MIN, Math.min(SERVICE_PRICE_MAX, _toNumber(priceMult, fallback) || fallback));
}

export function getServiceChannelElasticity(channelType = '') {
    return SERVICE_CHANNEL_PRICE_ELASTICITY[channelType] ?? 0.8;
}

export function getServiceDemandMultiplier(priceMult, channelType = null) {
    if (isFreeServiceChannel(channelType)) return 1;
    const resolvedPrice = clampServicePriceMult(priceMult, channelType);
    const elasticity = getServiceChannelElasticity(channelType);
    return 1 / Math.pow(resolvedPrice, elasticity);
}

export function getServicePriceCompetitiveness(priceMult, { channelType = null, exponent = 0.5 } = {}) {
    if (isFreeServiceChannel(channelType)) return 1.1;
    const resolvedPrice = clampServicePriceMult(priceMult, channelType);
    return 1 / Math.pow(resolvedPrice, exponent);
}

export function getServicePriceBand(priceMult, channelType = null) {
    if (isFreeServiceChannel(channelType)) return 'free';
    const resolvedPrice = clampServicePriceMult(priceMult, channelType);
    if (resolvedPrice < 0.85) return 'cheap';
    if (resolvedPrice > 1.2) return 'premium';
    return 'standard';
}

export function getAggregateServicePriceCompetitiveness(channels = [], exponent = 0.5) {
    const activeChannels = Array.isArray(channels)
        ? channels.filter(channel => channel && channel.active)
        : [];
    if (activeChannels.length === 0) return 1;

    let weightedTotal = 0;
    let totalWeight = 0;
    for (const channel of activeChannels) {
        const weight = Math.max(
            1,
            _toNumber(channel.estimatedUsers, 0),
            _toNumber(channel.allocatedTFLOPS, 0)
        );
        weightedTotal += getServicePriceCompetitiveness(channel.priceMult, {
            channelType: channel.type,
            exponent
        }) * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? weightedTotal / totalWeight : 1;
}

export function getCompetitorPriceStrategy(doctrineType = 'balanced') {
    return COMPETITOR_PRICE_STRATEGY[doctrineType] || COMPETITOR_PRICE_STRATEGY.balanced;
}

export function resolveCompetitorPriceMult(doctrineType = 'balanced', randomValue = Math.random()) {
    const strategy = getCompetitorPriceStrategy(doctrineType);
    const centeredRandom = (_toNumber(randomValue, 0.5) - 0.5) * 2;
    return clampServicePriceMult(strategy.priceMult + (centeredRandom * strategy.variance));
}

export function getAverageServiceElasticity(channelTypes = []) {
    const types = Array.isArray(channelTypes) && channelTypes.length > 0 ? channelTypes : ['api'];
    const total = types.reduce((sum, type) => sum + getServiceChannelElasticity(type), 0);
    return total / types.length;
}
