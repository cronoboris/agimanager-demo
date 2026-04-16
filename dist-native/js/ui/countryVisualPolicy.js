import { REGIONS } from '../data/countries.js';

const TIER1_COLORS = {
    us: '#3b82f6',
    cn: '#ef4444',
    kr: '#06b6d4',
    gb: '#eab308',
    jp: '#ec4899',
    de: '#22c55e',
    fr: '#2563eb',
    in: '#f97316',
    ca: '#dc2626',
    il: '#818cf8',
    tw: '#0891b2',
    sg: '#14b8a6'
};

function hexToRgb(hex) {
    const normalized = String(hex || '').replace('#', '').trim();
    const value = normalized.length === 3
        ? normalized.split('').map(ch => ch + ch).join('')
        : normalized;
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16)
    };
}

function rgbToHex({ r, g, b }) {
    const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
    return `#${[clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function mixHexColors(base, target, amount = 0.5) {
    const from = hexToRgb(base);
    const to = hexToRgb(target);
    if (!from || !to) return base;
    const ratio = Math.max(0, Math.min(1, amount));
    return rgbToHex({
        r: from.r + ((to.r - from.r) * ratio),
        g: from.g + ((to.g - from.g) * ratio),
        b: from.b + ((to.b - from.b) * ratio)
    });
}

export function getTensionBand(gameState = null) {
    const tension = Number(gameState?.global?.geopoliticalTension || 0);
    if (tension >= 80) return 'critical';
    if (tension >= 60) return 'high';
    if (tension >= 30) return 'elevated';
    return 'base';
}

function getCountryBaseColor(countryData) {
    if (!countryData) return '#334155';
    if (countryData.color) return countryData.color;
    if (TIER1_COLORS[countryData.id]) return TIER1_COLORS[countryData.id];
    const region = REGIONS[countryData.region];
    return region ? region.color : '#475569';
}

function applyTensionTint(baseColor, countryData, gameState) {
    const tensionBand = getTensionBand(gameState);
    if (tensionBand === 'base') return baseColor;

    const favorability = Number(gameState?.global?.countryFavorability?.[countryData?.id] ?? countryData?.aiFavorability ?? 50);
    const hasRegPenalty = Boolean(countryData?.isEU || Number(countryData?.penalties?.regulationPenalty || 1) > 1);

    if (tensionBand === 'critical') {
        const target = hasRegPenalty || favorability < 40 ? '#ef4444' : '#f97316';
        const mix = hasRegPenalty ? 0.72 : favorability < 40 ? 0.6 : 0.45;
        return mixHexColors(baseColor, target, mix);
    }

    if (tensionBand === 'high') {
        if (hasRegPenalty) return mixHexColors(baseColor, '#f97316', 0.58);
        if (favorability < 45) return mixHexColors(baseColor, '#fb923c', 0.42);
        return mixHexColors(baseColor, '#f59e0b', 0.18);
    }

    if (hasRegPenalty) return mixHexColors(baseColor, '#eab308', 0.5);
    if (favorability < 45) return mixHexColors(baseColor, '#f59e0b', 0.24);
    return baseColor;
}

export function getCountryColor(countryData, gameState = null) {
    return applyTensionTint(getCountryBaseColor(countryData), countryData, gameState);
}

export function getCountryOpacity(tier, isPlayer) {
    if (isPlayer) return 0.4;
    if (tier === 1) return 0.3;
    if (tier === 2) return 0.18;
    return 0.1;
}

export function getCountryVisualPolicy(countryData, gameState = null, { isPlayer = false } = {}) {
    const tensionBand = getTensionBand(gameState);
    const favorability = Number(gameState?.global?.countryFavorability?.[countryData?.id] ?? countryData?.aiFavorability ?? 50);
    const hasRegPenalty = Boolean(countryData?.isEU || Number(countryData?.penalties?.regulationPenalty || 1) > 1);
    const tier = Number(countryData?.tier || 3);
    const color = getCountryColor(countryData, gameState);
    const tensionBoost = tensionBand === 'critical'
        ? 0.14
        : tensionBand === 'high'
            ? 0.08
            : tensionBand === 'elevated'
                ? 0.04
                : 0;

    return {
        color,
        favorability,
        hasRegPenalty,
        tensionBand,
        svg: {
            fillOpacity: getCountryOpacity(tier, isPlayer),
            strokeWidth: isPlayer ? 1.2 : (tier <= 2 ? 0.6 : 0.3),
            hitStrokeWidth: tier <= 2 ? 12 : 8,
            fontSize: tier === 1 ? 8 : 6,
            dotRadius: isPlayer ? 4 : (tier === 1 ? 2.5 : 1.5),
            showLabel: tier <= 2,
            showFavBar: tier === 1,
            labelOffsetY: isPlayer ? 20 : (tier === 1 ? 10 : 7)
        },
        webgl: {
            thickness: isPlayer ? 15 : (tier === 1 ? 10 : tier === 2 ? 6 : 3),
            emissiveIntensity: (isPlayer ? 0.32 : (tier <= 2 ? 0.08 : 0.01)) + tensionBoost,
            baseEmissiveIntensity: isPlayer ? 0.32 : (tier <= 2 ? 0.08 : 0.01),
            tensionBoost,
            floatAmplitude: isPlayer ? 1.2 : (tier <= 2 ? 0.45 : 0.18),
            pulseStrength: isPlayer ? 0.22 : (tier === 1 ? 0.08 : 0),
            labelOffsetY: isPlayer ? 28 : (tier === 1 ? 18 : 14),
            showOverlayLabel: tier <= 2,
            showFavBar: tier === 1
        }
    };
}
