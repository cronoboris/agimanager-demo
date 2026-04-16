import { t } from '../i18n.js';
import { DATACENTER_LOCATIONS } from '../data/datacenterLocations.js';

function _rngFn(rng = Math.random) {
    if (typeof rng === 'function') return rng;
    if (rng && typeof rng.random === 'function') return () => rng.random();
    if (rng && typeof rng.next === 'function') return () => rng.next();
    return Math.random;
}

function _roll(rng) {
    const value = Number(_rngFn(rng)());
    if (!Number.isFinite(value)) return Math.random();
    if (value <= 0) return 0;
    if (value >= 1) return 0.999999999999;
    return value;
}

function _safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function _clampChance(value) {
    return Math.min(0.95, Math.max(0, value));
}

function _localize(textKey, fallback, vars = null) {
    return t(textKey, fallback, vars || undefined);
}

function _normalizeLocationId(dc = {}) {
    const locationId = dc.locationId || 'domestic';
    if (!dc.locationId) dc.locationId = locationId;
    return locationId;
}

function _resolveLocation(dc = {}) {
    const locationId = _normalizeLocationId(dc);
    return DATACENTER_LOCATIONS[locationId] || DATACENTER_LOCATIONS.domestic;
}

function _chanceMultiplier(def, dc, location) {
    let multiplier = 1;
    const locationId = location?.id || 'domestic';

    if (def.locationOnly && Array.isArray(def.locationOnly) && !def.locationOnly.includes(locationId)) {
        return 0;
    }

    if (def.locationMult && typeof def.locationMult === 'object') {
        const locationMult = _safeNumber(def.locationMult[locationId], 1);
        if (locationMult <= 0) return 0;
        multiplier *= locationMult;
    }

    if (def.useDisasterRisk) {
        const disasterRisk = _safeNumber(dc?.risks?.disasterRisk ?? location?.disasterRisk, 0);
        multiplier *= 1 + disasterRisk;
    }

    if (def.useRegulationRisk) {
        const regulationRisk = _safeNumber(dc?.risks?.regulationRisk ?? location?.regulationRisk, 0);
        multiplier *= 1 + regulationRisk;
    }

    return multiplier;
}

function _buildChoice(eventId, choice, index) {
    const titleKey = `dc.event.${eventId}.choice_${index}`;
    const text = choice?.textKey
        ? _localize(choice.textKey, choice.text || '')
        : _localize(titleKey, choice?.text || '');

    const built = {
        text,
        effects: choice?.effects ? { ...choice.effects } : {}
    };

    if (choice?.effectHint) built.effectHint = choice.effectHint;
    if (choice?.karma) built.karma = { ...choice.karma };
    if (choice?.requiredTech) built.requiredTech = choice.requiredTech;
    if (choice?.lockedHint) built.lockedHint = choice.lockedHint;

    return built;
}

function _buildEvent(def, kind, dc, state, chance) {
    const location = _resolveLocation(dc);
    const locationId = location.id || _normalizeLocationId(dc);
    const titleKey = def.titleKey || `dc.event.${def.id}`;
    const descKey = def.descKey || `dc.event.${def.id}.desc`;
    const title = _localize(titleKey, def.fallback || def.title || def.id);
    const description = _localize(
        descKey,
        def.descFallback || def.description || '',
        {
            location: _localize(location.nameKey, location.fallback || locationId),
            locationId,
            tier: dc?.tierId || ''
        }
    );

    return {
        id: def.id,
        type: 'decision',
        category: 'company',
        eventCategory: 'datacenter',
        datacenterEventType: kind,
        datacenterId: dc?.id || null,
        locationId,
        locationName: _localize(location.nameKey, location.fallback || locationId),
        tierId: dc?.tierId || null,
        titleKey,
        descKey,
        fallback: def.fallback || def.title || def.id,
        descFallback: def.descFallback || def.description || '',
        title,
        description,
        icon: def.icon || (kind === 'construction' ? '🏗️' : '⚙️'),
        probability: def.probability,
        triggerChance: chance,
        locationMult: def.locationMult ? { ...def.locationMult } : undefined,
        effects: def.effects ? { ...def.effects } : {},
        choices: (def.choices || []).map((choice, index) => _buildChoice(def.id, choice, index)),
        metadata: {
            datacenterEvent: kind,
            datacenterId: dc?.id || null,
            locationId,
            tierId: dc?.tierId || null,
            stateMonth: state?.time?.currentDate?.month || null
        }
    };
}

function _pickEvent(events, dc, state, rng) {
    const location = _resolveLocation(dc);

    for (const def of events) {
        const multiplier = _chanceMultiplier(def, dc, location);
        const chance = _clampChance(_safeNumber(def.probability, 0) * multiplier);
        if (chance <= 0) continue;
        const roll = _roll(rng);
        if (roll >= chance) continue;
        return { def, chance };
    }

    return null;
}

function _shouldSkipOperationalForMonth(dc, currentMonth) {
    if (currentMonth == null) return false;
    if (!Number.isFinite(Number(currentMonth))) return false;
    if (Number(dc?.lastOperationalEventMonth) === Number(currentMonth)) return true;
    return false;
}

export const DC_CONSTRUCTION_EVENTS = [
    {
        id: 'permit_delay',
        titleKey: 'dc.event.permit_delay',
        fallback: '인허가 지연',
        descKey: 'dc.event.permit_delay.desc',
        descFallback: '현지 정부의 인허가 절차가 지연되고 있습니다.',
        probability: 0.08,
        locationMult: { domestic: 0.5, us_virginia: 0.3, uae: 0.2, nordics: 1.5 },
        effects: { buildDelay: 1 },
        choices: [
            { text: '기다린다', effects: { buildDelay: 1 } },
            { text: '로비 비용 지출 ($200K)', effects: { funds: -200_000 } },
            { text: '다른 부지 물색 ($500K, 지연 없음)', effects: { funds: -500_000, buildDelay: 0 } }
        ]
    },
    {
        id: 'construction_accident',
        titleKey: 'dc.event.accident',
        fallback: '건설 현장 사고',
        descKey: 'dc.event.accident.desc',
        descFallback: '건설 현장에서 사고가 발생했습니다. 공사가 지연됩니다.',
        probability: 0.05,
        effects: { buildDelay: 2, funds: -100_000 },
        choices: [
            { text: '안전 강화 조치 ($300K)', effects: { funds: -300_000, buildDelay: 1 } },
            { text: '일정 유지 (위험 감수)', effects: { buildDelay: 0, futureDisasterRisk: +0.05 } }
        ]
    },
    {
        id: 'supply_chain_issue',
        titleKey: 'dc.event.supply_chain',
        fallback: '건설 자재 공급 차질',
        descKey: 'dc.event.supply_chain.desc',
        descFallback: '반도체 장비와 냉각 시스템 공급이 지연되고 있습니다.',
        probability: 0.06,
        locationMult: { space_orbital: 3.0, iceland: 1.5 },
        effects: { buildDelay: 1 },
        choices: [
            { text: '대체 공급업체 ($150K 추가)', effects: { funds: -150_000 } },
            { text: '기다린다', effects: { buildDelay: 1 } }
        ]
    },
    {
        id: 'local_protest',
        titleKey: 'dc.event.protest',
        fallback: '지역 주민 반대 시위',
        descKey: 'dc.event.protest.desc',
        descFallback: '데이터센터 건설에 반대하는 지역 주민 시위가 발생했습니다.',
        probability: 0.04,
        locationMult: { nordics: 2.0, domestic: 1.5, space_orbital: 0 },
        effects: { reputation: -3 },
        choices: [
            { text: '지역 사회 투자 ($500K)', effects: { funds: -500_000, reputation: +5 } },
            { text: '공개 사과', effects: { reputation: -2, buildDelay: 1 } },
            { text: '무시', effects: { reputation: -8 } }
        ]
    },
    {
        id: 'natural_disaster_construction',
        titleKey: 'dc.event.disaster',
        fallback: '자연재해 발생',
        descKey: 'dc.event.disaster.desc',
        descFallback: '건설 현장 인근에 자연재해가 발생했습니다.',
        probability: 0.03,
        useDisasterRisk: true,
        effects: { buildDelay: 3, funds: -500_000 },
        choices: [
            { text: '재건 시작 ($1M)', effects: { funds: -1_000_000, buildDelay: 2 } },
            { text: '보험 청구 (2개월 소요)', effects: { buildDelay: 4 } }
        ]
    },
    {
        id: 'space_debris',
        titleKey: 'dc.event.space_debris',
        fallback: '우주 파편 위협',
        descKey: 'dc.event.space_debris.desc',
        descFallback: '우주 파편이 데이터센터 궤도에 접근하고 있습니다.',
        probability: 0.1,
        locationOnly: ['space_orbital'],
        effects: { buildDelay: 1 },
        choices: [
            { text: '궤도 조정 ($2M)', effects: { funds: -2_000_000 } },
            { text: '방어 시스템 가동', effects: { funds: -500_000, buildDelay: 1 } }
        ]
    }
];

export const DC_OPERATIONAL_EVENTS = [
    {
        id: 'power_outage',
        titleKey: 'dc.ops.power_outage',
        fallback: '전력 장애',
        probability: 0.06,
        locationMult: { iceland: 0.3, nordics: 0.4, space_orbital: 0.1 },
        effects: { tflopsLoss: 0.2, duration: 1 },
        choices: [
            { text: '긴급 발전기 가동 ($200K)', effects: { funds: -200_000, tflopsLoss: 0.05 } },
            { text: '복구 대기', effects: { tflopsLoss: 0.2, reputation: -2 } }
        ]
    },
    {
        id: 'cooling_failure',
        titleKey: 'dc.ops.cooling_failure',
        fallback: '냉각 시스템 장애',
        probability: 0.05,
        locationMult: { uae: 2.0, singapore: 1.5, iceland: 0.2, space_orbital: 0.3 },
        effects: { tflopsLoss: 0.3, gpuDamage: 5 },
        choices: [
            { text: '즉시 셧다운 + 수리 ($500K)', effects: { funds: -500_000, tflopsLoss: 0.1 } },
            { text: '부분 가동 유지', effects: { gpuDamage: 10, tflopsLoss: 0.15 } }
        ]
    },
    {
        id: 'regulation_inspection',
        titleKey: 'dc.ops.inspection',
        fallback: '규제 당국 점검',
        probability: 0.04,
        useRegulationRisk: true,
        effects: { reputation: -2 },
        choices: [
            { text: '전면 협조 ($100K)', effects: { funds: -100_000, reputation: +3 } },
            { text: '최소 대응', effects: { reputation: -5, regulationPenalty: 1 } }
        ]
    },
    {
        id: 'cyber_attack',
        titleKey: 'dc.ops.cyber_attack',
        fallback: '사이버 공격',
        probability: 0.03,
        effects: { reputation: -5, funds: -300_000 },
        choices: [
            { text: '보안팀 긴급 투입 ($500K)', effects: { funds: -500_000, reputation: -2 } },
            { text: '서비스 일시 중단', effects: { tflopsLoss: 0.5, reputation: -8, duration: 1 } }
        ]
    }
];

export function checkDatacenterConstructionEvent(dc, state, { rng } = {}) {
    if (!dc || dc.operational || _safeNumber(dc.buildMonthsLeft, 0) <= 0) return null;
    const result = _pickEvent(DC_CONSTRUCTION_EVENTS, dc, state, rng);
    if (!result) return null;

    if (Number.isFinite(Number(dc?.buildMonth))) {
        dc.lastConstructionEventMonth = Number(dc.buildMonth);
    }

    return _buildEvent(result.def, 'construction', dc, state, result.chance);
}

export function checkDatacenterOperationalEvent(dc, state, { rng, currentMonth } = {}) {
    if (!dc || !dc.operational) return null;
    if (_shouldSkipOperationalForMonth(dc, currentMonth)) return null;
    const result = _pickEvent(DC_OPERATIONAL_EVENTS, dc, state, rng);
    if (!result) return null;

    if (currentMonth != null && Number.isFinite(Number(currentMonth))) {
        dc.lastOperationalEventMonth = Number(currentMonth);
    }

    return _buildEvent(result.def, 'operational', dc, state, result.chance);
}
