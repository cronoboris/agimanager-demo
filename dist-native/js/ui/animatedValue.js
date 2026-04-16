// ============================================================
// Animated Value System — Smooth number ticking (Paradox-style)
// ============================================================

export class ValueTracker {
    constructor() {
        this._values = new Map(); // elementId → { current, target, animating, rafId }
    }

    /**
     * Update a tracked value. Animates if changed.
     * @param {string} elementId - DOM element ID
     * @param {number} newValue - Target value
     * @param {number} duration - Animation duration in ms
     * @param {Function} formatter - Value → display string
     */
    update(elementId, newValue, duration = 500, formatter = String) {
        const el = document.getElementById(elementId);
        if (!el) return;

        let entry = this._values.get(elementId);

        if (!entry) {
            entry = { current: newValue, target: newValue, animating: false, rafId: null };
            this._values.set(elementId, entry);
            el.textContent = formatter(newValue);
            return;
        }

        // If already at target, no-op
        if (entry.target === newValue) {
            if (!entry.animating) return;
        }

        const from = entry.animating ? entry.current : entry.target;
        entry.target = newValue;

        // Cancel existing animation
        if (entry.rafId) cancelAnimationFrame(entry.rafId);

        // Direction flash
        if (newValue > from) {
            el.classList.remove('value-down');
            el.classList.add('value-up');
        } else if (newValue < from) {
            el.classList.remove('value-up');
            el.classList.add('value-down');
        }

        // Clear flash after duration
        setTimeout(() => {
            el.classList.remove('value-up', 'value-down');
        }, 800);

        // Animate
        entry.animating = true;
        const startTime = performance.now();
        const startVal = from;

        const tick = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - t, 3);

            entry.current = startVal + (newValue - startVal) * eased;
            el.textContent = formatter(Math.round(entry.current));

            if (t < 1) {
                entry.rafId = requestAnimationFrame(tick);
            } else {
                entry.current = newValue;
                entry.animating = false;
                entry.rafId = null;
                el.textContent = formatter(newValue);
            }
        };

        entry.rafId = requestAnimationFrame(tick);
    }

    /**
     * Reset tracking for an element (e.g., on full re-render).
     */
    reset(elementId) {
        const entry = this._values.get(elementId);
        if (entry?.rafId) cancelAnimationFrame(entry.rafId);
        this._values.delete(elementId);
    }
}
