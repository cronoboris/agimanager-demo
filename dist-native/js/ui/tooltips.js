// ============================================================
// Rich Tooltip System — HTML tooltips with stat breakdowns
// ============================================================

let _tooltip = null;
let _showTimer = null;
let _currentTarget = null;
const SHOW_DELAY = 200;

function ensureTooltip() {
    if (_tooltip) return;
    _tooltip = document.createElement('div');
    _tooltip.className = 'rich-tooltip';
    document.body.appendChild(_tooltip);
}

function positionTooltip(anchor) {
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

function showTooltip(target) {
    ensureTooltip();
    _currentTarget = target;

    const html = target.getAttribute('data-rich-tooltip');
    if (!html) return;

    _tooltip.innerHTML = html;
    _tooltip.style.left = '-9999px';
    _tooltip.style.top = '-9999px';
    _tooltip.classList.add('visible');

    // Position after content is rendered
    requestAnimationFrame(() => {
        positionTooltip(target);
    });
}

function hideTooltip() {
    if (_showTimer) { clearTimeout(_showTimer); _showTimer = null; }
    _currentTarget = null;
    if (_tooltip) _tooltip.classList.remove('visible');
}

/**
 * Initialize the rich tooltip system using event delegation.
 * Elements with `data-rich-tooltip` attribute will show rich tooltips.
 */
export function initTooltips() {
    ensureTooltip();

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-rich-tooltip]');
        if (!target || target === _currentTarget) return;

        hideTooltip();
        _showTimer = setTimeout(() => showTooltip(target), SHOW_DELAY);
    }, true);

    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-rich-tooltip]');
        if (!target) return;

        // Check if we're moving to a child of the same target
        const related = e.relatedTarget;
        if (related && target.contains(related)) return;

        hideTooltip();
    }, true);

    // Hide on scroll
    document.addEventListener('scroll', hideTooltip, true);
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
