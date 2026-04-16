import { syncStateEconomyCompatibility } from './ComputeSystem.js';
import { syncStateChipProgramCompatibility } from './ChipProgramSystem.js';

export function normalizeGameStateCompatibility(state, currentYear = 2017) {
    if (!state) return state;
    if (!state.eventChains || typeof state.eventChains !== 'object') {
        state.eventChains = {};
    }
    syncStateEconomyCompatibility(state, currentYear);
    syncStateChipProgramCompatibility(state);
    return state;
}

export function normalizeSerializedGamePayload(payload) {
    if (!payload?.state) return payload;
    const currentYear = payload.time?.currentDate?.year || 2017;
    normalizeGameStateCompatibility(payload.state, currentYear);
    return payload;
}
