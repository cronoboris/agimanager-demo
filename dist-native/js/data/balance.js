import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('balance.json');

export const BALANCE = data.BALANCE;
