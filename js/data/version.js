import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('version.json');

export const VERSION = data.version;
export const SAVE_VERSION = data.saveVersion;
export const DEMO_VERSION = data.demoVersion;
export const MIN_COMPATIBLE_SAVE = data.minCompatibleSave;
