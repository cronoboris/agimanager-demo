// ============================================================
// Toast Notification System — Paradox-style slide-in toasts
// ============================================================

let _iconFn = null;
let _container = null;
let _toasts = [];
let _nextId = 1;
const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

const TYPE_ICONS = {
    info: 'globe',
    success: 'check',
    warning: 'alert',
    danger: 'flame',
    event: 'zap'
};

function ensureContainer() {
    if (_container) return;
    _container = document.createElement('div');
    _container.className = 'toast-container';
    document.body.appendChild(_container);
}

/**
 * Inject the icon() function from icons.js to avoid circular imports.
 */
export function setIconFunction(fn) {
    _iconFn = fn;
}

/**
 * Show a toast notification.
 * @param {string} message - The toast message
 * @param {'info'|'success'|'warning'|'danger'|'event'} type - Toast type
 * @param {number} duration - Auto-dismiss in ms (0 = manual only)
 * @returns {number} Toast ID for manual dismissal
 */
export function toast(message, type = 'info', duration = DEFAULT_DURATION) {
    ensureContainer();

    const id = _nextId++;
    const iconName = TYPE_ICONS[type] || TYPE_ICONS.info;
    const iconHtml = _iconFn ? _iconFn(iconName, 16) : '';

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.dataset.toastId = id;
    el.innerHTML = `
        <span class="toast__icon">${iconHtml}</span>
        <span class="toast__msg">${message}</span>
        <button class="toast__close" onclick="this.parentElement.dispatchEvent(new Event('dismiss'))">&times;</button>
    `;

    el.addEventListener('dismiss', () => dismissToast(id));

    _container.prepend(el);

    // Trigger reflow, then animate in
    el.offsetHeight; // force reflow
    requestAnimationFrame(() => el.classList.add('toast--visible'));

    const entry = { id, el, timer: null };

    if (duration > 0) {
        entry.timer = setTimeout(() => dismissToast(id), duration);
    }

    _toasts.push(entry);

    // Enforce max toast limit
    while (_toasts.length > MAX_TOASTS) {
        dismissToast(_toasts[0].id);
    }

    return id;
}

/**
 * Dismiss a toast by ID.
 */
export function dismissToast(id) {
    const idx = _toasts.findIndex(t => t.id === id);
    if (idx === -1) return;

    const entry = _toasts[idx];
    _toasts.splice(idx, 1);

    if (entry.timer) clearTimeout(entry.timer);

    entry.el.classList.remove('toast--visible');
    entry.el.classList.add('toast--exit');

    // Remove from DOM after animation
    setTimeout(() => {
        if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    }, 350);
}

export function dismissAllToasts() {
    for (const entry of [..._toasts]) {
        dismissToast(entry.id);
    }
}
