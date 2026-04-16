export function getFundsHealthClass(balance, runway) {
    if (Number(balance) >= 0) return 'res-healthy';
    if (Number.isFinite(Number(runway)) && Number(runway) < 3) return 'res-critical';
    return 'res-danger';
}

export function getAmbientEra(year) {
    const numericYear = Number(year) || 2017;
    if (numericYear < 2020) return 'early';
    if (numericYear < 2024) return 'mid';
    return 'late';
}

export function getEventPulseType(event = {}) {
    if (!event || typeof event !== 'object') return 'info';

    if (event.glitchLevel === 'danger' || event.type === 'danger') return 'danger';

    const effects = event.effects || {};
    const favorabilityDrops = Object.values(effects.countryEffects || {}).some(
        modifier => Number(modifier?.aiFavorability || 0) < 0
    );

    if (favorabilityDrops || Number(effects.aiFavorability || 0) < 0 || Number(effects.funds || 0) < 0) {
        return 'warning';
    }

    if (Number(effects.funds || 0) > 0 || Number(effects.reputation || 0) > 0 || Number(effects.investorTrust || 0) > 0) {
        return 'success';
    }

    return 'info';
}
