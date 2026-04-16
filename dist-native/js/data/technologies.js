import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('technologies.json');

export const TECH_TREE = data.TECH_TREE;
export const TECH_CATEGORIES = data.TECH_CATEGORIES;
export const ROUTE_INFO = data.ROUTE_INFO;
