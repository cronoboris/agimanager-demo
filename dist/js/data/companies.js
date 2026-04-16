import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('companies.json');

export const COMPETITORS = data.COMPETITORS;
