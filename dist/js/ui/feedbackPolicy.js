export function getFundsHealthClass(balance, runway) {
    if (Number(balance) >= 0) return 'res-healthy';
    if (Number.isFinite(Number(runway)) && Number(runway) < 3) return 'res-critical';
    return 'res-danger';
}

export function getAmbientEra(yearOrAct) {
    if (typeof yearOrAct === 'string') {
        if (['startup', 'expansion', 'political', 'frontier'].includes(yearOrAct)) {
            return yearOrAct;
        }
    }

    const numericYear = Number(yearOrAct) || 2017;
    if (numericYear < 2020) return 'startup';
    if (numericYear < 2024) return 'expansion';
    if (numericYear < 2028) return 'political';
    return 'frontier';
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
