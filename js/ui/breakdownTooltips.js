import { t } from '../i18n.js';

export function formatBreakdownValue(value, mode = 'set', unit = '') {
    if (mode === 'multiply') return `x${Number(value).toFixed(2)}`;
    if (mode === 'add') return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}${unit}`;
    return `${Number(value).toFixed(2)}${unit}`;
}

export function renderBreakdownTooltip({ title, base = 0, entries = [], final = 0, unit = '' }) {
    let html = `<div class="bd-tooltip"><div class="bd-title">${title}</div>`;
    html += `<div class="bd-row"><span class="bd-label">${t('breakdown.base', '기본값')}</span><span class="bd-value">${formatBreakdownValue(base, 'set', unit)}</span></div>`;
    for (const entry of entries) {
        html += `<div class="bd-row">
            <span class="bd-label">${entry.label}</span>
            <span class="bd-value">${formatBreakdownValue(entry.value, entry.mode || 'set', unit)}</span>
        </div>`;
    }
    html += '<div class="bd-divider"></div>';
    html += `<div class="bd-row bd-final"><span class="bd-label">${t('breakdown.final', '최종')}</span><span class="bd-value">${formatBreakdownValue(final, 'set', unit)}</span></div></div>`;
    return html;
}

export function collectBreakdown(metricId, state) {
    if (metricId === 'researchSpeed') {
        const base = 1;
        const entries = [];
        const countryMod = Number(state?.player?.countryModifiers?.researchSpeed || 1);
        if (countryMod !== 1) entries.push({ label: t('breakdown.country', '국가 보너스'), value: countryMod, mode: 'multiply' });
        const cultureMod = 1 + ((Number(state?.culture?.speed || 50) - 50) / 200);
        if (Math.abs(cultureMod - 1) > 0.01) entries.push({ label: t('breakdown.culture', '회사 문화'), value: cultureMod, mode: 'multiply' });
        const final = entries.reduce((acc, entry) => entry.mode === 'multiply' ? acc * entry.value : acc + entry.value, base);
        return { base, entries, final, unit: '/일' };
    }

    if (metricId === 'revenue') {
        const ecoRevenue = state?.economy?.revenue || {};
        const entries = Object.entries(ecoRevenue)
            .filter(([, value]) => Number(value) !== 0)
            .map(([key, value]) => ({ label: t(`breakdown.revenue.${key}`, key), value: Number(value), mode: 'add' }));
        const final = entries.reduce((sum, entry) => sum + entry.value, 0);
        return { base: 0, entries, final, unit: '$' };
    }

    if (metricId === 'expenses') {
        const ecoExpenses = state?.economy?.expenses || {};
        const entries = Object.entries(ecoExpenses)
            .filter(([, value]) => Number(value) !== 0)
            .map(([key, value]) => ({ label: t(`breakdown.expenses.${key}`, key), value: Number(value), mode: 'add' }));
        const final = entries.reduce((sum, entry) => sum + entry.value, 0);
        return { base: 0, entries, final, unit: '$' };
    }

    if (metricId === 'safetyScore') {
        const base = 35;
        const safety = Number(state?.safety?.posture || 0);
        return { base, entries: [{ label: t('breakdown.current', '현재'), value: safety - base, mode: 'add' }], final: safety, unit: '' };
    }

    return { base: 0, entries: [], final: 0, unit: '' };
}
