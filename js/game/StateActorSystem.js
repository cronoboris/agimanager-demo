import { COMPETITORS } from '../data/companies.js';
import { COUNTRY_POLICY_OVERRIDES, COUNTRIES } from '../data/countries.js';
import { t } from '../i18n.js';

const REGION_POLICY_DEFAULTS = {
    north_america: { type: 'permissive', regulationLevel: 4, subsidyChance: 0.08, dataRestriction: 3, exportControl: 3, gpuAccess: 9, aiTalentPool: 9, volatility: 0.08 },
    europe: { type: 'regulatory', regulationLevel: 7, subsidyChance: 0.1, dataRestriction: 7, exportControl: 4, gpuAccess: 7, aiTalentPool: 7, volatility: 0.12 },
    east_asia: { type: 'proactive', regulationLevel: 5, subsidyChance: 0.14, dataRestriction: 5, exportControl: 5, gpuAccess: 8, aiTalentPool: 8, volatility: 0.14 },
    middle_east: { type: 'proactive', regulationLevel: 3, subsidyChance: 0.16, dataRestriction: 3, exportControl: 2, gpuAccess: 7, aiTalentPool: 6, volatility: 0.1 },
    middle_east_africa: { type: 'proactive', regulationLevel: 3, subsidyChance: 0.16, dataRestriction: 3, exportControl: 2, gpuAccess: 7, aiTalentPool: 6, volatility: 0.1 },
    south_asia: { type: 'restrictive', regulationLevel: 6, subsidyChance: 0.06, dataRestriction: 6, exportControl: 4, gpuAccess: 5, aiTalentPool: 7, volatility: 0.16 },
    southeast_asia: { type: 'proactive', regulationLevel: 4, subsidyChance: 0.12, dataRestriction: 4, exportControl: 2, gpuAccess: 7, aiTalentPool: 7, volatility: 0.1 },
    south_america: { type: 'restrictive', regulationLevel: 5, subsidyChance: 0.05, dataRestriction: 5, exportControl: 3, gpuAccess: 4, aiTalentPool: 4, volatility: 0.14 },
    east_europe: { type: 'state_driven', regulationLevel: 6, subsidyChance: 0.04, dataRestriction: 7, exportControl: 5, gpuAccess: 4, aiTalentPool: 5, volatility: 0.16 }
};

const BLOC_BY_REGION = {
    north_america: 'atlantic',
    central_america: 'latin',
    south_america: 'latin',
    europe: 'atlantic',
    east_europe: 'eurasian',
    central_asia: 'eurasian',
    east_asia: 'pacific',
    southeast_asia: 'pacific',
    south_asia: 'indian',
    middle_east: 'indian',
    africa: 'global_south',
    oceania: 'pacific'
};

const BLOC_LABELS = {
    atlantic: { ko: '대서양권', en: 'Atlantic Bloc' },
    latin: { ko: '라틴권', en: 'Latin Bloc' },
    eurasian: { ko: '유라시아권', en: 'Eurasian Bloc' },
    pacific: { ko: '태평양권', en: 'Pacific Bloc' },
    indian: { ko: '인도권', en: 'Indian Bloc' },
    global_south: { ko: '글로벌 사우스', en: 'Global South Bloc' },
    neutral: { ko: '중립권', en: 'Neutral Bloc' }
};

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));
}

function resolveRegionBloc(regionId) {
    return BLOC_BY_REGION[regionId] || 'neutral';
}

function resolveCountryPolicy(countryId) {
    const country = COUNTRIES[countryId];
    const regionDefault = REGION_POLICY_DEFAULTS[country?.region] || REGION_POLICY_DEFAULTS.north_america;
    return {
        ...regionDefault,
        ...(COUNTRY_POLICY_OVERRIDES[countryId] || {})
    };
}

function createEmptyRelations() {
    return {
        countries: {},
        companies: {}
    };
}

function ensureCountryActor(container, countryId) {
    const country = COUNTRIES[countryId];
    if (!country) return null;

    const existing = container.countries[countryId] || {};
    const policy = resolveCountryPolicy(countryId);
    const bloc = resolveRegionBloc(country.region);
    const relations = {
        ...createEmptyRelations(),
        ...(existing.relations || {})
    };

    for (const company of COMPETITORS) {
        if (relations.companies[company.id] === undefined) {
            relations.companies[company.id] = 0;
        }
    }

    container.countries[countryId] = {
        id: countryId,
        name: country.name,
        region: country.region,
        bloc,
        policy,
        tension: clamp(existing.tension ?? 0),
        aiPriority: clamp(existing.aiPriority ?? policy.aiTalentPool ?? 5),
        regulationPressure: clamp(existing.regulationPressure ?? policy.regulationLevel ?? 5),
        exportControlLevel: clamp(existing.exportControlLevel ?? policy.exportControl ?? 0),
        subsidyBudget: Math.max(0, Number(existing.subsidyBudget ?? 0) || 0),
        relations,
        history: Array.isArray(existing.history) ? existing.history : [],
        lastActionMonth: existing.lastActionMonth ?? null
    };

    return container.countries[countryId];
}

function ensureBlocActor(container, blocId) {
    const existing = container.blocs[blocId] || {};
    const members = Array.isArray(existing.members) ? existing.members.slice() : [];
    container.blocs[blocId] = {
        id: blocId,
        name: BLOC_LABELS[blocId] || BLOC_LABELS.neutral,
        tension: clamp(existing.tension ?? 0),
        policyPressure: clamp(existing.policyPressure ?? 0),
        exportControlLevel: clamp(existing.exportControlLevel ?? 0),
        members,
        history: Array.isArray(existing.history) ? existing.history : []
    };
    return container.blocs[blocId];
}

function ensureStateActorContainer(state) {
    if (!state.stateActors || typeof state.stateActors !== 'object') {
        state.stateActors = createDefaultStateActors();
    }

    state.stateActors.version = Number(state.stateActors.version || 1);
    state.stateActors.countries = state.stateActors.countries && typeof state.stateActors.countries === 'object' ? state.stateActors.countries : {};
    state.stateActors.blocs = state.stateActors.blocs && typeof state.stateActors.blocs === 'object' ? state.stateActors.blocs : {};
    state.stateActors.policyHistory = Array.isArray(state.stateActors.policyHistory) ? state.stateActors.policyHistory : [];
    state.stateActors.activeControls = Array.isArray(state.stateActors.activeControls) ? state.stateActors.activeControls : [];
    state.stateActors.tensionIndex = clamp(state.stateActors.tensionIndex ?? 0);
    state.stateActors.monthCounter = Number(state.stateActors.monthCounter || 0);
    state.stateActors.quarterCounter = Number(state.stateActors.quarterCounter || 0);

    return state.stateActors;
}

function ensureCompanyActor(company) {
    if (!company || typeof company !== 'object') return null;

    company.policyPressure = {
        total: 0,
        subsidy: 0,
        exportControl: 0,
        regulation: 0,
        diplomacy: 0,
        ...(company.policyPressure || {})
    };
    company.risk = {
        supplyRisk: 0,
        legalPressure: 0,
        prPressure: 0,
        ...(company.risk || {})
    };
    company.statePressure = {
        total: 0,
        lastSourceCountryId: null,
        lastReason: null,
        ...(company.statePressure || {})
    };
    return company;
}

function recordPolicyHistory(state, entry) {
    state.stateActors.policyHistory.push(entry);
    if (state.geopolitics && Array.isArray(state.geopolitics.policyHistory)) {
        state.geopolitics.policyHistory.push(entry);
    }
}

function updateActiveControls(state, regionId) {
    if (!regionId) return;
    if (!state.geopolitics) {
        state.geopolitics = {
            tensionIndex: 0,
            regionalMarket: {},
            policyHistory: [],
            activeControls: []
        };
    }
    if (!Array.isArray(state.geopolitics.activeControls)) {
        state.geopolitics.activeControls = [];
    }
    if (!state.geopolitics.activeControls.includes(regionId)) {
        state.geopolitics.activeControls.push(regionId);
    }
    if (!state.stateActors.activeControls.includes(regionId)) {
        state.stateActors.activeControls.push(regionId);
    }
}

export function createDefaultStateActors() {
    return {
        version: 1,
        countries: {},
        blocs: {},
        policyHistory: [],
        activeControls: [],
        tensionIndex: 0,
        monthCounter: 0,
        quarterCounter: 0
    };
}

export function normalizeStateActorState(state) {
    if (!state || typeof state !== 'object') return state;
    const container = ensureStateActorContainer(state);

    for (const countryId of Object.keys(COUNTRIES)) {
        ensureCountryActor(container, countryId);
    }

    for (const actor of Object.values(container.countries)) {
        const bloc = actor.bloc || 'neutral';
        const blocActor = ensureBlocActor(container, bloc);
        if (!blocActor.members.includes(actor.id)) {
            blocActor.members.push(actor.id);
        }
        actor.policy = resolveCountryPolicy(actor.id);
        actor.aiPriority = clamp(actor.aiPriority ?? actor.policy.aiTalentPool ?? 5);
        actor.regulationPressure = clamp(actor.regulationPressure ?? actor.policy.regulationLevel ?? 5);
        actor.exportControlLevel = clamp(actor.exportControlLevel ?? actor.policy.exportControl ?? 0);
        actor.tension = clamp(actor.tension ?? 0);
        actor.subsidyBudget = Math.max(0, Number(actor.subsidyBudget ?? 0) || 0);
        actor.relations ||= createEmptyRelations();
        actor.relations.countries = actor.relations.countries && typeof actor.relations.countries === 'object' ? actor.relations.countries : {};
        actor.relations.companies = actor.relations.companies && typeof actor.relations.companies === 'object' ? actor.relations.companies : {};
        actor.history = Array.isArray(actor.history) ? actor.history : [];
    }

    for (const company of state.competitors || []) {
        ensureCompanyActor(company);
        for (const actor of Object.values(container.countries)) {
            if (actor.relations.companies[company.id] === undefined) {
                actor.relations.companies[company.id] = 0;
            }
        }
    }

    state.global ||= {};
    state.global.geopoliticalTension = clamp(state.global.geopoliticalTension ?? 0);
    state.geopolitics ||= {
        tensionIndex: 0,
        regionalMarket: {},
        policyHistory: [],
        activeControls: []
    };
    state.geopolitics.tensionIndex = clamp(state.geopolitics.tensionIndex ?? 0);
    state.geopolitics.policyHistory = Array.isArray(state.geopolitics.policyHistory) ? state.geopolitics.policyHistory : [];
    state.geopolitics.activeControls = Array.isArray(state.geopolitics.activeControls) ? state.geopolitics.activeControls : [];

    return state;
}

export function applyCountryPressureToCountry(state, sourceCountryId, targetCountryId, intensity = 1, reason = 'pressure') {
    normalizeStateActorState(state);
    const source = state.stateActors.countries[sourceCountryId];
    const target = state.stateActors.countries[targetCountryId];
    if (!source || !target || sourceCountryId === targetCountryId) return null;

    const amount = Math.max(0, Number(intensity) || 0);
    const polarity = reason === 'export_control' || reason === 'regulation' || reason === 'pressure' ? -1 : 1;
    const relationDelta = polarity * amount;

    source.relations.countries[targetCountryId] = clamp((source.relations.countries[targetCountryId] ?? 0) + relationDelta, -100, 100);
    target.relations.countries[sourceCountryId] = clamp((target.relations.countries[sourceCountryId] ?? 0) + relationDelta, -100, 100);

    if (reason === 'export_control') {
        target.exportControlLevel = clamp(target.exportControlLevel + amount * 1.1);
        target.regulationPressure = clamp(target.regulationPressure + amount * 0.8);
        target.tension = clamp(target.tension + amount * 0.6);
        updateActiveControls(state, target.region);
        for (const company of state.competitors || []) {
            if (company.country !== targetCountryId) continue;
            ensureCompanyActor(company);
            company.policyPressure.exportControl = Math.max(0, Number(company.policyPressure.exportControl || 0) + amount);
            company.policyPressure.total = Math.max(0, Number(company.policyPressure.total || 0) + amount);
            company.risk.supplyRisk = Math.max(0, Number(company.risk.supplyRisk || 0) + amount * 0.4);
            company.risk.legalPressure = Math.max(0, Number(company.risk.legalPressure || 0) + amount * 0.1);
            company.statePressure.total = Math.max(0, Number(company.statePressure.total || 0) + amount);
            company.statePressure.lastSourceCountryId = sourceCountryId;
            company.statePressure.lastReason = reason;
        }
    } else if (reason === 'subsidy') {
        target.subsidyBudget = Math.max(0, target.subsidyBudget + amount * 25000);
        target.aiPriority = clamp(target.aiPriority + amount * 0.4);
        target.tension = clamp(target.tension + amount * 0.15);
    } else if (reason === 'regulation') {
        target.regulationPressure = clamp(target.regulationPressure + amount);
        target.tension = clamp(target.tension + amount * 0.4);
    } else {
        target.tension = clamp(target.tension + amount * 0.3);
    }

    target.history.push({
        type: 'country_pressure',
        sourceCountryId,
        reason,
        amount
    });
    source.history.push({
        type: 'country_pressure_outbound',
        targetCountryId,
        reason,
        amount
    });
    recordPolicyHistory(state, {
        type: 'country_pressure',
        sourceCountryId,
        targetCountryId,
        reason,
        amount
    });

    return {
        sourceCountryId,
        targetCountryId,
        reason,
        amount
    };
}

export function applyCountryPressureToCompany(state, sourceCountryId, companyId, intensity = 1, reason = 'pressure') {
    normalizeStateActorState(state);
    const source = state.stateActors.countries[sourceCountryId];
    const company = (state.competitors || []).find(entry => entry.id === companyId);
    if (!source || !company) return null;

    ensureCompanyActor(company);
    const amount = Math.max(0, Number(intensity) || 0);
    const polarity = reason === 'export_control' || reason === 'regulation' || reason === 'pressure' ? -1 : 1;
    const relationDelta = polarity * amount;

    source.relations.companies[companyId] = clamp((source.relations.companies[companyId] ?? 0) + relationDelta, -100, 100);
    company.statePressure.total = Math.max(0, Number(company.statePressure.total || 0) + amount);
    company.statePressure.lastSourceCountryId = sourceCountryId;
    company.statePressure.lastReason = reason;

    if (reason === 'subsidy') {
        company.policyPressure.subsidy = Math.max(0, Number(company.policyPressure.subsidy || 0) + amount);
        company.policyPressure.total = Math.max(0, Number(company.policyPressure.total || 0) + amount);
        company.risk.prPressure = Math.max(0, Number(company.risk.prPressure || 0) - amount * 0.2);
        source.subsidyBudget = Math.max(0, source.subsidyBudget - amount * 12500);
    } else if (reason === 'export_control') {
        company.policyPressure.exportControl = Math.max(0, Number(company.policyPressure.exportControl || 0) + amount);
        company.policyPressure.total = Math.max(0, Number(company.policyPressure.total || 0) + amount);
        company.risk.supplyRisk = Math.max(0, Number(company.risk.supplyRisk || 0) + amount * 0.4);
        company.risk.legalPressure = Math.max(0, Number(company.risk.legalPressure || 0) + amount * 0.15);
        source.exportControlLevel = clamp(source.exportControlLevel + amount * 0.4);
        updateActiveControls(state, company.country ? COUNTRIES[company.country]?.region : null);
        if (company.country && company.country !== sourceCountryId) {
            applyCountryPressureToCountry(state, sourceCountryId, company.country, amount * 0.5, 'export_control');
        }
    } else if (reason === 'regulation') {
        company.policyPressure.regulation = Math.max(0, Number(company.policyPressure.regulation || 0) + amount);
        company.policyPressure.total = Math.max(0, Number(company.policyPressure.total || 0) + amount);
        company.risk.legalPressure = Math.max(0, Number(company.risk.legalPressure || 0) + amount * 0.3);
        source.regulationPressure = clamp(source.regulationPressure + amount * 0.35);
    } else {
        company.policyPressure.diplomacy = Math.max(0, Number(company.policyPressure.diplomacy || 0) + amount);
        company.policyPressure.total = Math.max(0, Number(company.policyPressure.total || 0) + amount);
    }

    source.history.push({
        type: 'company_pressure',
        companyId,
        reason,
        amount
    });
    recordPolicyHistory(state, {
        type: 'company_pressure',
        sourceCountryId,
        companyId,
        reason,
        amount
    });

    return {
        sourceCountryId,
        companyId,
        reason,
        amount
    };
}

export function propagateBlocTension(state, blocId, delta, sourceCountryId = null) {
    normalizeStateActorState(state);
    const bloc = state.stateActors.blocs[blocId];
    if (!bloc) return null;

    const amount = Math.max(0, Number(delta) || 0);
    if (amount === 0) return null;

    bloc.tension = clamp(bloc.tension + amount);
    bloc.policyPressure = clamp(bloc.policyPressure + amount * 0.4);
    bloc.exportControlLevel = clamp(bloc.exportControlLevel + amount * 0.2);

    const memberSet = new Set(bloc.members || []);
    for (const countryId of memberSet) {
        const actor = state.stateActors.countries[countryId];
        if (!actor) continue;
        const share = countryId === sourceCountryId ? 0.2 : 0.6;
        actor.tension = clamp(actor.tension + amount * share);
        actor.regulationPressure = clamp(actor.regulationPressure + amount * (share * 0.35));
        if (sourceCountryId && countryId !== sourceCountryId) {
            actor.relations.countries[sourceCountryId] = clamp((actor.relations.countries[sourceCountryId] ?? 0) - amount * 0.5, -100, 100);
        }
    }

    const nextTension = clamp(state.global.geopoliticalTension + amount * 0.35);
    state.global.geopoliticalTension = nextTension;
    recordPolicyHistory(state, {
        type: 'bloc_tension',
        blocId,
        sourceCountryId,
        amount
    });

    return {
        blocId,
        sourceCountryId,
        amount
    };
}

export function processQuarterlyStateActors(state) {
    normalizeStateActorState(state);
    const events = [];

    for (const bloc of Object.values(state.stateActors.blocs)) {
        if ((bloc.tension || 0) < 20) continue;
        const delta = Math.max(1, Math.round(bloc.tension / 25));
        bloc.exportControlLevel = clamp(bloc.exportControlLevel + delta);
        bloc.policyPressure = clamp(bloc.policyPressure + delta * 0.5);
        for (const countryId of bloc.members || []) {
            const actor = state.stateActors.countries[countryId];
            if (!actor) continue;
            actor.exportControlLevel = clamp(actor.exportControlLevel + delta * 0.4);
            actor.regulationPressure = clamp(actor.regulationPressure + delta * 0.5);
            actor.tension = clamp(actor.tension + delta * 0.25);
        }
        updateActiveControls(state, bloc.members?.[0] ? state.stateActors.countries[bloc.members[0]]?.region : null);
        const event = {
            type: 'export_control',
            title: t('geo.bloc_export_tighten', '{bloc} 진영의 수출 통제가 강화됩니다.', { bloc: bloc.name?.ko || bloc.id }),
            affectedRegions: (bloc.members || [])
                .map(countryId => COUNTRIES[countryId]?.region)
                .filter(Boolean)
                .filter((regionId, index, array) => array.indexOf(regionId) === index)
        };
        events.push(event);
        recordPolicyHistory(state, {
            type: 'quarterly_bloc_shift',
            blocId: bloc.id,
            delta
        });
    }

    state.stateActors.quarterCounter += 1;
    return events;
}

export function processMonthlyStateActors(state) {
    normalizeStateActorState(state);
    const events = [];
    const globalTension = clamp(state.global.geopoliticalTension);
    const tensionPulse = Math.max(0, Math.round(globalTension / 20));

    for (const actor of Object.values(state.stateActors.countries)) {
        const policy = actor.policy || resolveCountryPolicy(actor.id);
        const bloc = state.stateActors.blocs[actor.bloc];
        const blocTension = Number(bloc?.tension || 0);
        const pressureGain = tensionPulse + Math.round(actor.exportControlLevel / 4) + Math.round(actor.regulationPressure / 8);
        actor.tension = clamp(actor.tension + pressureGain + Math.round(blocTension / 18));
        actor.regulationPressure = clamp(actor.regulationPressure + Math.round(actor.tension / 25));
        actor.aiPriority = clamp(actor.aiPriority + Math.round((policy.aiTalentPool || 5) / 10));
        actor.subsidyBudget = Math.max(0, Number(actor.subsidyBudget || 0) + Math.round((policy.subsidyChance || 0) * 5000));

        if (actor.subsidyBudget > 0 && actor.aiPriority >= 7) {
            const homeCompany = (state.competitors || []).find(company => company.country === actor.id);
            if (homeCompany) {
                events.push({
                    type: 'subsidy',
                    title: t('geo.subsidy_granted', '{country}이(가) AI 보조금을 지급합니다.', { country: actor.name }),
                    amount: 50000 + Math.round(actor.subsidyBudget / 10),
                    country: actor.id
                });
                applyCountryPressureToCompany(state, actor.id, homeCompany.id, 1 + Math.round(actor.aiPriority / 5), 'subsidy');
                actor.subsidyBudget = Math.max(0, actor.subsidyBudget - 25000);
            }
        }

        if (actor.exportControlLevel >= 6) {
            const foreignCompany = (state.competitors || []).find(company => company.country && company.country !== actor.id);
            if (foreignCompany) {
                events.push({
                    type: 'export_control',
                    title: t('geo.country_export_control', '{country}이(가) 첨단 기술 수출을 통제합니다.', { country: actor.name }),
                    affectedRegions: [COUNTRIES[foreignCompany.country]?.region].filter(Boolean)
                });
                applyCountryPressureToCompany(state, actor.id, foreignCompany.id, 1 + Math.round(actor.exportControlLevel / 4), 'export_control');
            }
        }

        if (actor.regulationPressure >= 8) {
            events.push({
                type: 'policy_change',
                title: t('geo.regulation_pressure', '{country}의 AI 규제 압력이 높아지고 있습니다.', { country: actor.name }),
                regulationDelta: 1,
                country: actor.id
            });
            recordPolicyHistory(state, {
                type: 'policy_change',
                countryId: actor.id,
                regulationPressure: actor.regulationPressure
            });
        }
    }

    for (const bloc of Object.values(state.stateActors.blocs)) {
        if (!bloc.members?.length) continue;
        const blocTension = Math.max(...bloc.members.map(countryId => Number(state.stateActors.countries[countryId]?.tension || 0)));
        bloc.tension = clamp(Math.max(bloc.tension, blocTension));
        if (bloc.tension >= 12) {
            propagateBlocTension(state, bloc.id, Math.round(bloc.tension / 18), bloc.members[0]);
        }
    }

    state.stateActors.monthCounter += 1;

    const countryTensions = Object.values(state.stateActors.countries).map(actor => Number(actor.tension || 0));
    const blocTensions = Object.values(state.stateActors.blocs).map(bloc => Number(bloc.tension || 0));
    const countryAverage = countryTensions.length ? countryTensions.reduce((sum, value) => sum + value, 0) / countryTensions.length : 0;
    const blocAverage = blocTensions.length ? blocTensions.reduce((sum, value) => sum + value, 0) / blocTensions.length : 0;
    state.stateActors.tensionIndex = clamp(Math.round((countryAverage + blocAverage) / 2));
    state.geopolitics.tensionIndex = state.stateActors.tensionIndex;
    state.global.geopoliticalTension = clamp(Math.round((state.global.geopoliticalTension * 0.6) + (state.stateActors.tensionIndex * 0.4)));

    const activeControls = [];
    for (const actor of Object.values(state.stateActors.countries)) {
        if (actor.exportControlLevel >= 6) {
            activeControls.push(actor.region);
        }
    }
    state.stateActors.activeControls = [...new Set(activeControls)];
    state.geopolitics.activeControls = [...new Set(activeControls)];

    return events;
}

export function processStateActorCycle(state) {
    normalizeStateActorState(state);
    const monthlyEvents = processMonthlyStateActors(state);
    const quarterlyEvents = state.stateActors.monthCounter % 3 === 0
        ? processQuarterlyStateActors(state)
        : [];

    return {
        monthlyEvents,
        quarterlyEvents
    };
}
