export function captureEventPauseState(time) {
    const currentSpeed = Number.isFinite(time?.speed) ? time.speed : 0;
    return {
        speedToRestore: currentSpeed,
        wasPaused: currentSpeed === 0
    };
}

export function restoreEventPauseState(time, state) {
    if (!time || !state) return;

    if (state.wasPaused || state.speedToRestore === 0) {
        time.pause?.();
        return;
    }

    time.setSpeed?.(state.speedToRestore);
}
