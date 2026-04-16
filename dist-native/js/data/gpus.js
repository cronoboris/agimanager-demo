import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('gpus.json');

export const GPU_CATALOG = data.GPU_CATALOG || [];
export const GPU_EVENTS = data.GPU_EVENTS || [];
export const GPU_BY_ID = Object.fromEntries(GPU_CATALOG.map(gpu => [gpu.id, gpu]));
