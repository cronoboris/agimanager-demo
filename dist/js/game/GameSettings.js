const DISPLAY_MODE_OPTIONS = ['windowed', 'fullscreen', 'borderless'];
const MAP_RENDERER_OPTIONS = ['globe', 'webgl', 'svg'];
export const UI_SCALE_OPTIONS = Object.freeze([75, 85, 100, 110, 125, 150]);
export const AUTOSAVE_INTERVAL_OPTIONS = Object.freeze(['monthly', 'quarterly', 'yearly', '5min', 'off']);
export const SETTINGS_KEY = 'agimanager_settings';

const LEGACY_ACCESSIBILITY_KEY = 'agimanager_accessibility';
const LEGACY_SOUND_KEY = 'agimanager_sound_settings';
const LEGACY_MAP_MODE_KEY = 'agimanager_map_mode';
const LEGACY_LOCALE_KEY = 'agimanager_locale';
const LOCALE_OPTIONS = ['ko', 'en'];

export const DEFAULT_SETTINGS = Object.freeze({
    display: Object.freeze({
        mode: 'windowed',
        uiScale: 100,
        reducedMotion: false,
        highContrast: false,
        resolution: 'auto',
        vsync: true,
        mapRenderer: 'globe'
    }),
    audio: Object.freeze({
        master: 80,
        music: 60,
        sfx: 80,
        muteOnBlur: false,
        enabled: true,
        musicEnabled: true
    }),
    gameplay: Object.freeze({
        autosaveInterval: 'monthly',
        autoPauseOnEvent: true,
        tooltipDelay: 300,
        locale: 'ko'
    }),
    controls: Object.freeze({
        edgePan: false,
        zoomSpeed: 1,
        panSpeed: 1
    })
});

function readLocalStorageValue(key) {
    if (typeof localStorage === 'undefined') return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeLocalStorageValue(key, value) {
    if (typeof localStorage === 'undefined') return false;
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function parseJson(raw, fallback = null) {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function coerceBoolean(value, fallback = false) {
    if (value === true || value === false) return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return fallback;
}

function normalizePercent(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? clamp(Math.round(num), 0, 100) : fallback;
}

function normalizeRange(value, min, max, fallback, digits = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const clamped = clamp(num, min, max);
    const precision = 10 ** digits;
    return Math.round(clamped * precision) / precision;
}

function normalizeUiScale(value, fallback = DEFAULT_SETTINGS.display.uiScale) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;

    const snapped = UI_SCALE_OPTIONS.reduce((closest, option) => {
        const distance = Math.abs(option - num);
        const closestDistance = Math.abs(closest - num);
        return distance < closestDistance ? option : closest;
    }, UI_SCALE_OPTIONS[0]);

    return clamp(snapped, UI_SCALE_OPTIONS[0], UI_SCALE_OPTIONS.at(-1));
}

export function normalizeTooltipDelayMs(value) {
    const num = Number(value);
    return Number.isFinite(num) ? clamp(Math.round(num), 0, 1000) : DEFAULT_SETTINGS.gameplay.tooltipDelay;
}

function normalizeLocale(value) {
    return LOCALE_OPTIONS.includes(value) ? value : DEFAULT_SETTINGS.gameplay.locale;
}

function normalizeDisplayMode(value) {
    return DISPLAY_MODE_OPTIONS.includes(value) ? value : DEFAULT_SETTINGS.display.mode;
}

function normalizeMapRenderer(value) {
    return MAP_RENDERER_OPTIONS.includes(value) ? value : DEFAULT_SETTINGS.display.mapRenderer;
}

function normalizeAutosaveInterval(value) {
    return AUTOSAVE_INTERVAL_OPTIONS.includes(value) ? value : DEFAULT_SETTINGS.gameplay.autosaveInterval;
}

function normalizeResolution(value) {
    if (!value || value === 'auto') return 'auto';
    if (typeof value === 'string' && /^\d+x\d+$/i.test(value)) {
        return value.toLowerCase();
    }
    if (typeof value === 'object') {
        const width = Number(value.width);
        const height = Number(value.height);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            return `${Math.round(width)}x${Math.round(height)}`;
        }
    }
    return DEFAULT_SETTINGS.display.resolution;
}

function readLegacySettings() {
    const accessibility = parseJson(readLocalStorageValue(LEGACY_ACCESSIBILITY_KEY), {}) || {};
    const sound = parseJson(readLocalStorageValue(LEGACY_SOUND_KEY), {}) || {};
    const mapMode = readLocalStorageValue(LEGACY_MAP_MODE_KEY);
    const locale = readLocalStorageValue(LEGACY_LOCALE_KEY);

    const legacyFontScale = Number(accessibility.fontScale);
    const uiScale = Number.isFinite(legacyFontScale)
        ? Math.round(legacyFontScale * 100)
        : DEFAULT_SETTINGS.display.uiScale;

    return {
        display: {
            reducedMotion: accessibility.reducedMotion,
            highContrast: accessibility.highContrast,
            uiScale,
            mapRenderer: mapMode || undefined
        },
        audio: {
            master: Number.isFinite(Number(sound.masterVolume)) ? Number(sound.masterVolume) * 100 : undefined,
            music: Number.isFinite(Number(sound.musicVolume)) ? Number(sound.musicVolume) * 100 : undefined,
            sfx: Number.isFinite(Number(sound.sfxVolume)) ? Number(sound.sfxVolume) * 100 : undefined,
            enabled: sound.enabled,
            musicEnabled: sound.musicEnabled,
            muteOnBlur: sound.muteOnBlur
        },
        gameplay: {
            locale: locale || undefined
        }
    };
}

export function normalizeGameSettings(input = {}) {
    const merged = {
        display: {
            ...DEFAULT_SETTINGS.display,
            ...(input.display || {})
        },
        audio: {
            ...DEFAULT_SETTINGS.audio,
            ...(input.audio || {})
        },
        gameplay: {
            ...DEFAULT_SETTINGS.gameplay,
            ...(input.gameplay || {})
        },
        controls: {
            ...DEFAULT_SETTINGS.controls,
            ...(input.controls || {})
        }
    };

    return {
        display: {
            mode: normalizeDisplayMode(merged.display.mode),
            uiScale: normalizeUiScale(merged.display.uiScale),
            reducedMotion: coerceBoolean(merged.display.reducedMotion, DEFAULT_SETTINGS.display.reducedMotion),
            highContrast: coerceBoolean(merged.display.highContrast, DEFAULT_SETTINGS.display.highContrast),
            resolution: normalizeResolution(merged.display.resolution),
            vsync: coerceBoolean(merged.display.vsync, DEFAULT_SETTINGS.display.vsync),
            mapRenderer: normalizeMapRenderer(merged.display.mapRenderer)
        },
        audio: {
            master: normalizePercent(merged.audio.master, DEFAULT_SETTINGS.audio.master),
            music: normalizePercent(merged.audio.music, DEFAULT_SETTINGS.audio.music),
            sfx: normalizePercent(merged.audio.sfx, DEFAULT_SETTINGS.audio.sfx),
            muteOnBlur: coerceBoolean(merged.audio.muteOnBlur, DEFAULT_SETTINGS.audio.muteOnBlur),
            enabled: coerceBoolean(merged.audio.enabled, DEFAULT_SETTINGS.audio.enabled),
            musicEnabled: coerceBoolean(merged.audio.musicEnabled, DEFAULT_SETTINGS.audio.musicEnabled)
        },
        gameplay: {
            autosaveInterval: normalizeAutosaveInterval(merged.gameplay.autosaveInterval),
            autoPauseOnEvent: coerceBoolean(merged.gameplay.autoPauseOnEvent, DEFAULT_SETTINGS.gameplay.autoPauseOnEvent),
            tooltipDelay: normalizeTooltipDelayMs(merged.gameplay.tooltipDelay),
            locale: normalizeLocale(merged.gameplay.locale)
        },
        controls: {
            edgePan: coerceBoolean(merged.controls.edgePan, DEFAULT_SETTINGS.controls.edgePan),
            zoomSpeed: normalizeRange(merged.controls.zoomSpeed, 0.3, 2.0, DEFAULT_SETTINGS.controls.zoomSpeed),
            panSpeed: normalizeRange(merged.controls.panSpeed, 0.3, 2.0, DEFAULT_SETTINGS.controls.panSpeed)
        }
    };
}

export function loadGameSettingsSync() {
    const stored = parseJson(readLocalStorageValue(SETTINGS_KEY), null);
    const legacy = readLegacySettings();
    return normalizeGameSettings({
        ...legacy,
        ...(stored || {}),
        display: {
            ...(legacy.display || {}),
            ...(stored?.display || {})
        },
        audio: {
            ...(legacy.audio || {}),
            ...(stored?.audio || {})
        },
        gameplay: {
            ...(legacy.gameplay || {}),
            ...(stored?.gameplay || {})
        },
        controls: {
            ...(legacy.controls || {}),
            ...(stored?.controls || {})
        }
    });
}

export async function loadGameSettings() {
    return loadGameSettingsSync();
}

export function saveGameSettingsSync(settings) {
    const normalized = normalizeGameSettings(settings);
    writeLocalStorageValue(SETTINGS_KEY, JSON.stringify(normalized));
    return normalized;
}

export async function saveGameSettings(settings) {
    return saveGameSettingsSync(settings);
}

export function getAutosaveIntervalMs(interval) {
    return interval === '5min' ? 5 * 60 * 1000 : null;
}

export function shouldAutosaveOnCycle(interval, cycle) {
    if (interval === 'monthly' && cycle === 'month') return true;
    if (interval === 'quarterly' && cycle === 'quarter') return true;
    if (interval === 'yearly' && cycle === 'year') return true;
    return false;
}

export function parseResolutionValue(value) {
    if (!value || value === 'auto') return null;
    const match = String(value).match(/^(\d+)x(\d+)$/i);
    if (!match) return null;
    return {
        width: Number(match[1]),
        height: Number(match[2])
    };
}

export function formatResolutionLabel(width, height) {
    return `${width} × ${height}`;
}
