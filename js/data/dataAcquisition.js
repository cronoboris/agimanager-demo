import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('data_acquisition.json');

export const DATA_ACQUISITION = data;
export const DATA_METHODS = data.METHODS || {};
export const DATA_ACQUISITION_TYPES = data.DATA_TYPES || {};
