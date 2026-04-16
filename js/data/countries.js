import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('countries.json');

export const REGIONS = data.REGIONS;
export const COUNTRIES = data.COUNTRIES;
export const COUNTRY_POLICY_OVERRIDES = data.COUNTRY_POLICY_OVERRIDES || {};
export const PLAYABLE_COUNTRIES = Object.values(COUNTRIES).filter(c => c.playable);

export const COUNTRIES_BY_REGION = {};
for (const country of Object.values(COUNTRIES)) {
    if (!COUNTRIES_BY_REGION[country.region]) COUNTRIES_BY_REGION[country.region] = [];
    COUNTRIES_BY_REGION[country.region].push(country);
}

export const EU_MEMBERS = Object.values(COUNTRIES).filter(c => c.isEU);

export const ISO_TO_ID = {};
for (const country of Object.values(COUNTRIES)) {
    ISO_TO_ID[String(country.isoNumeric)] = country.id;
}
