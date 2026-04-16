import { loadDataJson } from '../data/jsonLoader.js';
import { getLocale } from '../i18n.js';
export { normalizeTooltipDelayMs } from '../game/GameSettings.js';

let _glossary = null;
let _loadPromise = null;

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function resolveLocalizedValue(value, fallback = '') {
    if (value == null) return fallback;
    if (typeof value === 'string') return value;

    if (typeof value === 'object') {
        const locale = getLocale?.() || 'ko';
        return value[locale] || value.ko || value.en || fallback;
    }

    return String(value);
}

function getTermEntry(termId) {
    return _glossary?.[termId] || null;
}

function normalizeGlossary(raw) {
    if (!raw || typeof raw !== 'object') return {};
    if (raw.TERMS && typeof raw.TERMS === 'object') return raw.TERMS;
    if (raw.terms && typeof raw.terms === 'object') return raw.terms;
    return raw;
}

function renderBreakdownRows(breakdown = []) {
    if (!Array.isArray(breakdown) || breakdown.length === 0) return '';

    const rows = breakdown
        .map((row) => {
            if (row == null) return '';
            if (typeof row === 'string') {
                return `<div class="term-tooltip__extra">${escapeHtml(row)}</div>`;
            }

            const label = resolveLocalizedValue(row.label, '');
            const value = resolveLocalizedValue(row.value, '');
            const labelHtml = label ? `<span class="term-tooltip__breakdown-label">${escapeHtml(label)}</span>` : '';
            const valueHtml = value ? `<span class="term-tooltip__breakdown-value">${escapeHtml(value)}</span>` : '';

            if (!labelHtml && !valueHtml) return '';
            return `<div class="term-tooltip__breakdown-row">${labelHtml}${valueHtml}</div>`;
        })
        .filter(Boolean);

    if (rows.length === 0) return '';
    return `<div class="term-tooltip__breakdown">${rows.join('')}</div>`;
}

function renderExtraLines(extraLines = []) {
    if (!Array.isArray(extraLines) || extraLines.length === 0) return '';
    const lines = extraLines
        .map(line => (line == null ? '' : `<div class="term-tooltip__extra">${escapeHtml(resolveLocalizedValue(line, ''))}</div>`))
        .filter(Boolean);
    return lines.length > 0 ? `<div class="term-tooltip__extra-list">${lines.join('')}</div>` : '';
}

export async function loadGlossary() {
    if (_glossary) return _glossary;
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
        try {
            const loaded = await loadDataJson('glossary.json');
            _glossary = normalizeGlossary(loaded);
        } catch {
            _glossary = {};
        }
        return _glossary;
    })();

    return _loadPromise;
}

export function buildTermTooltipHtml(termId, options = {}) {
    const entry = getTermEntry(termId);
    if (!entry) return '';

    const title = resolveLocalizedValue(options.title ?? entry.name, termId);
    const description = resolveLocalizedValue(options.description ?? entry.description, '');
    const formula = resolveLocalizedValue(options.formula ?? entry.formula, '');
    const value = resolveLocalizedValue(options.value, '');
    const breakdown = renderBreakdownRows(options.breakdown);
    const extraLines = renderExtraLines(options.extraLines);

    let html = `<div class="term-tooltip">`;
    html += `<div class="tt-title term-tooltip__title">${escapeHtml(title)}</div>`;

    if (value) {
        html += `<div class="term-tooltip__value">${escapeHtml(value)}</div>`;
    }

    if (description) {
        html += `<div class="term-tooltip__description">${escapeHtml(description)}</div>`;
    }

    if (formula) {
        html += `<div class="term-tooltip__formula">${escapeHtml(formula)}</div>`;
    }

    if (breakdown) {
        html += breakdown;
    }

    if (extraLines) {
        html += extraLines;
    }

    html += `</div>`;
    return html;
}

export function escapeTooltipAttr(html = '') {
    return String(html)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '&#10;');
}

export function term(termId, customLabel = null, options = {}) {
    const entry = getTermEntry(termId);
    const label = resolveLocalizedValue(customLabel ?? entry?.name, termId);

    if (!entry) return escapeHtml(label);

    const tooltipHtml = buildTermTooltipHtml(termId, options);
    const tooltipAttr = escapeTooltipAttr(tooltipHtml);

    return `<span class="term-link" data-term-tooltip="${tooltipAttr}" tabindex="0">${escapeHtml(label)}</span>`;
}

export function termValue(termId, value, options = {}) {
    const entry = getTermEntry(termId);
    if (!entry) return escapeHtml(value);

    const tooltipOptions = {
        ...options,
        value,
    };
    const tooltipHtml = buildTermTooltipHtml(termId, tooltipOptions);
    const tooltipAttr = escapeTooltipAttr(tooltipHtml);

    return `<span class="term-link" data-term-tooltip="${tooltipAttr}" tabindex="0">${escapeHtml(value)}</span>`;
}

export function getGlossaryEntry(termId) {
    return getTermEntry(termId);
}

export function localizeGlossaryValue(value, fallback = '') {
    return resolveLocalizedValue(value, fallback);
}
