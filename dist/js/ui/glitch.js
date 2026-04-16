const GLITCH_DURATION_MS = {
    warning: 800,
    danger: 1500
};

export function triggerGlitch(container, level = 'warning') {
    if (!container?.classList) return false;

    const resolvedLevel = level === 'danger' ? 'danger' : 'warning';
    const glitchClass = `glitch-${resolvedLevel}`;
    const duration = GLITCH_DURATION_MS[resolvedLevel];

    if (container._glitchTimeout) {
        clearTimeout(container._glitchTimeout);
    }

    container.classList.remove('glitch-warning', 'glitch-danger');
    // Force the browser to notice the class re-add so repeated glitches replay.
    void container.offsetWidth;
    container.classList.add(glitchClass);

    container._glitchTimeout = setTimeout(() => {
        container.classList.remove(glitchClass);
        container._glitchTimeout = null;
    }, duration);

    return true;
}

export function getGlitchDuration(level = 'warning') {
    return GLITCH_DURATION_MS[level === 'danger' ? 'danger' : 'warning'];
}
