import { storageGetItem, storageSetItem } from './utils/storage.js';
import { HISTORICAL_EVENTS, RANDOM_EVENTS, TECH_MILESTONE_EVENTS } from './data/historical_events.js';

const LOCALE_KEY = 'agimanager_locale';
const DEFAULT_LOCALE = 'ko';
const SUPPORTED_LOCALES = ['ko', 'en'];

let _strings = {};
let _locale = DEFAULT_LOCALE;
let _eventFallbacks = null;

async function _loadLocale(lang) {
    const locale = SUPPORTED_LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;
    const url = new URL(`../locales/${locale}.json`, import.meta.url);

    if (typeof window === 'undefined') {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(url, 'utf8');
        return JSON.parse(raw);
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load locale: ${locale}`);
    return res.json();
}

export async function getSavedLocale() {
    return (await storageGetItem(LOCALE_KEY)) || DEFAULT_LOCALE;
}

export async function initLocale(lang = DEFAULT_LOCALE) {
    _locale = SUPPORTED_LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;
    _strings = await _loadLocale(_locale);
    return _locale;
}

export async function setLocale(lang) {
    await initLocale(lang);
    await storageSetItem(LOCALE_KEY, _locale);
    return _locale;
}

export function t(key, fallback, vars = null) {
    const template = Object.prototype.hasOwnProperty.call(_strings, key)
        ? _strings[key]
        : _getEventFallback(key) ?? (fallback ?? key);
    if (!vars) return template;

    return template.replace(/\{(\w+)\}/g, (_, name) => {
        const value = vars[name];
        return value == null ? `{${name}}` : String(value);
    });
}

export function getLocale() {
    return _locale;
}

export function getSupportedLocales() {
    return [...SUPPORTED_LOCALES];
}

function _getEventFallback(key) {
    if (!key.startsWith('event.')) return null;
    _eventFallbacks ??= _buildEventFallbacks();
    return _eventFallbacks[key] ?? null;
}

function _buildEventFallbacks() {
    const fallbacks = {};
    const events = [...HISTORICAL_EVENTS, ...RANDOM_EVENTS, ...TECH_MILESTONE_EVENTS];

    for (const event of events) {
        if (!event?.id) continue;
        const baseKey = `event.${event.id}`;
        if (event.title != null) fallbacks[`${baseKey}.title`] = event.title;
        if (event.description != null) fallbacks[`${baseKey}.description`] = event.description;

        for (const [index, choice] of (event.choices || []).entries()) {
            if (choice?.text != null) fallbacks[`${baseKey}.choice_${index}`] = choice.text;
            if (choice?.effectHint != null) fallbacks[`${baseKey}.choice_${index}_hint`] = choice.effectHint;
            if (choice?.lockedHint != null) fallbacks[`${baseKey}.choice_${index}_locked`] = choice.lockedHint;
        }
    }

    return fallbacks;
}
