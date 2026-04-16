// ============================================================
// Rich Tooltip System — HTML tooltips with stat breakdowns
// ============================================================

import { normalizeTooltipDelayMs } from '../game/GameSettings.js';

let _tooltip = null;
let _showTimer = null;
let _currentTarget = null;
let _isInitialized = false;
let _tooltipDelayMs = normalizeTooltipDelayMs(300);

function ensureTooltip() {
    if (_tooltip || typeof document === 'undefined') return;
    _tooltip = document.createElement('div');
    _tooltip.className = 'rich-tooltip';
    document.body.appendChild(_tooltip);
}

function positionTooltip(anchor) {
    if (!_tooltip) return;

    const rect = anchor.getBoundingClientRect();
    const ttRect = _tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default: below center
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - ttRect.width / 2;

    // Flip above if overflowing bottom
    if (top + ttRect.height > vh - 12) {
        top = rect.top - ttRect.height - 8;
    }

    // Horizontal clamp
    left = Math.max(8, Math.min(left, vw - ttRect.width - 8));
    top = Math.max(8, top);

    _tooltip.style.left = `${left}px`;
    _tooltip.style.top = `${top}px`;
}

function getTooltipTarget(target) {
    if (!target) return null;
    return target.closest('[data-term-tooltip], [data-rich-tooltip]');
}

function getTooltipMode(target) {
    if (target?.hasAttribute?.('data-term-tooltip')) return 'term';
    if (target?.hasAttribute?.('data-rich-tooltip')) return 'rich';
    return null;
}

function showTooltip(target) {
    ensureTooltip();
    if (!_tooltip) return;

    _currentTarget = target;
    const mode = getTooltipMode(target);
    const html = mode === 'term'
        ? target.getAttribute('data-term-tooltip')
        : target.getAttribute('data-rich-tooltip');

    if (!html) return;

    _tooltip.classList.toggle('term-tooltip', mode === 'term');
    _tooltip.innerHTML = html;
    _tooltip.style.left = '-9999px';
    _tooltip.style.top = '-9999px';
    _tooltip.classList.add('visible');

    const raf = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 0);

    raf(() => {
        positionTooltip(target);
    });
}

function hideTooltip() {
    if (_showTimer) {
        clearTimeout(_showTimer);
        _showTimer = null;
    }
    _currentTarget = null;
    if (_tooltip) {
        _tooltip.classList.remove('visible');
        _tooltip.classList.remove('term-tooltip');
    }
}

function scheduleTooltip(target) {
    if (!target || target === _currentTarget) return;

    hideTooltip();
    _showTimer = setTimeout(() => showTooltip(target), _tooltipDelayMs);
}

function isRelatedTargetWithin(target, relatedTarget) {
    return Boolean(relatedTarget && target?.contains?.(relatedTarget));
}

/**
 * Initialize the rich tooltip system using event delegation.
 * Elements with `data-rich-tooltip` or `data-term-tooltip` attributes will show tooltips.
 */
export function initTooltips() {
    if (_isInitialized || typeof document === 'undefined') return;
    _isInitialized = true;
    ensureTooltip();

    document.addEventListener('mouseover', (e) => {
        const target = getTooltipTarget(e.target);
        if (!target) return;

        scheduleTooltip(target);
    }, true);

    document.addEventListener('mouseout', (e) => {
        const target = getTooltipTarget(e.target);
        if (!target) return;

        if (isRelatedTargetWithin(target, e.relatedTarget)) return;
        hideTooltip();
    }, true);

    document.addEventListener('focusin', (e) => {
        const target = getTooltipTarget(e.target);
        if (!target) return;

        scheduleTooltip(target);
    }, true);

    document.addEventListener('focusout', (e) => {
        const target = getTooltipTarget(e.target);
        if (!target) return;

        if (isRelatedTargetWithin(target, e.relatedTarget)) return;
        hideTooltip();
    }, true);

    // Hide on scroll
    document.addEventListener('scroll', hideTooltip, true);
}

export function setTooltipDelay(delayMs) {
    _tooltipDelayMs = normalizeTooltipDelayMs(delayMs);
    return _tooltipDelayMs;
}

export function getTooltipDelay() {
    return _tooltipDelayMs;
}

/**
 * Helper to build a tooltip HTML string with title and stat rows.
 * @param {string} title - Tooltip header
 * @param {Array<{label: string, value: string, color?: string}>} stats - Stat rows
 * @returns {string} HTML string for data-rich-tooltip
 */
export function buildTooltip(title, stats = []) {
    let html = `<div class="tt-title">${title}</div>`;
    if (stats.length > 0) {
        html += '<div class="tt-divider"></div>';
        for (const s of stats) {
            const colorStyle = s.color ? ` style="color:${s.color}"` : '';
            html += `<div class="tt-stat"><span class="tt-stat-label">${s.label}</span><span class="tt-stat-value"${colorStyle}>${s.value}</span></div>`;
        }
    }
    return html;
}
