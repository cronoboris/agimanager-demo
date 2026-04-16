import { t } from '../i18n.js';

const INCIDENT_TYPES = {
    overload: {
        id: 'overload',
        severity: 'high',
        labelKey: 'ops.overload',
        fallback: '서비스 과부하',
        reputationCost: -8,
        fundsCostRange: [50_000, 200_000],
        trigger: ops => Number(ops?.infraSaturation || 0) > 80
    },
    harmful_output: {
        id: 'harmful_output',
        severity: 'critical',
        labelKey: 'ops.harmful_output',
        fallback: '유해 출력 사고',
        reputationCost: -15,
        fundsCostRange: [200_000, 1_000_000],
        cooldownMonths: 3,
        trigger: (ops, model) => {
            const safety = Number(model?.capabilities?.safety || model?.safetyScore || 0);
            if (safety >= 40) return false;
            // Lower safety = higher chance (max ~25% at safety 0, ~5% at safety 39)
            const chance = 0.05 + (1 - safety / 40) * 0.20;
            return Math.random() < chance;
        }
    },
    prompt_injection: {
        id: 'prompt_injection',
        severity: 'high',
        labelKey: 'ops.prompt_injection',
        fallback: '프롬프트 인젝션 악용',
        reputationCost: -10,
        fundsCostRange: [30_000, 150_000],
        cooldownMonths: 2,
        trigger: (ops, model) => Number(model?.capabilities?.safety || model?.safetyScore || 0) < 50 && Math.random() < 0.1
    },
    regional_outage: {
        id: 'regional_outage',
        severity: 'critical',
        labelKey: 'ops.regional_outage',
        fallback: '지역 장애',
        reputationCost: -12,
        fundsCostRange: [100_000, 500_000],
        trigger: () => Math.random() < 0.03
    }
};

function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number(value) || 0));
}

function ensureServiceOpsState(state) {
    state.serviceOps ||= {};
    state.serviceOps.reliability = clamp(state.serviceOps.reliability ?? 80, 0, 100);
    state.serviceOps.incidents = Array.isArray(state.serviceOps.incidents) ? state.serviceOps.incidents : [];
    state.serviceOps.incidentHistory = Array.isArray(state.serviceOps.incidentHistory) ? state.serviceOps.incidentHistory : [];
    state.serviceOps.activeIncidents = Array.isArray(state.serviceOps.activeIncidents) ? state.serviceOps.activeIncidents : [];
    state.serviceOps.lastIncidentMonth = state.serviceOps.lastIncidentMonth || null;
    return state.serviceOps;
}

function pickFundsCost(range) {
    const [min, max] = range;
    return min + Math.floor(Math.random() * Math.max(1, max - min));
}

function createIncident(incidentDef, model, channel, currentDate) {
    return {
        id: `${incidentDef.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: incidentDef.id,
        label: t(incidentDef.labelKey, incidentDef.fallback),
        severity: incidentDef.severity,
        modelId: model.id,
        modelName: model.name,
        channelType: channel.type,
        reputationCost: incidentDef.reputationCost,
        fundsCost: pickFundsCost(incidentDef.fundsCostRange),
        year: currentDate?.year,
        month: currentDate?.month
    };
}

export function recordIncident(state, incident) {
    const serviceOps = ensureServiceOpsState(state);
    serviceOps.incidents.unshift(incident);
    serviceOps.incidents = serviceOps.incidents.slice(0, 12);
    serviceOps.incidentHistory.push({ ...incident, resolvedMonth: null });
    serviceOps.incidentHistory = serviceOps.incidentHistory.slice(-50);
    serviceOps.activeIncidents = [incident];
    serviceOps.lastIncidentMonth = incident.year && incident.month ? `${incident.year}-${incident.month}` : null;
}

export function createIncidentEvent(incident) {
    return {
        id: incident.id,
        title: incident.label,
        description: t(
            'ops.incident_desc',
            '{model}의 {channel} 서비스에서 {type} 사고가 발생했습니다. 심각도: {severity}',
            {
                model: incident.modelName,
                channel: t(`service.${incident.channelType}`, incident.channelType),
                type: incident.label,
                severity: incident.severity
            }
        ),
        choices: [
            {
                text: t('ops.emergency_fix', '긴급 수정 (비용 발생)'),
                effects: {
                    funds: -incident.fundsCost,
                    reputation: Math.floor(incident.reputationCost * 0.3)
                }
            },
            {
                text: t('ops.acknowledge', '공개 사과'),
                effects: {
                    reputation: incident.reputationCost,
                    publicImage: -3
                }
            },
            {
                text: t('ops.ignore', '무시한다 (위험)'),
                effects: {
                    reputation: Math.floor(incident.reputationCost * 1.5),
                    investorTrust: -5
                }
            }
        ]
    };
}

export function checkRegulationTrigger(state, currentDate = null) {
    const serviceOps = ensureServiceOpsState(state);
    const history = serviceOps.incidentHistory || [];
    const current = currentDate
        ? ((currentDate.year || 2017) * 12) + (currentDate.month || 1)
        : ((history[0]?.year || 2017) * 12) + (history[0]?.month || 1);
    const recentCritical = history.filter(incident => {
        const incidentMonth = ((incident.year || 2017) * 12) + (incident.month || 1);
        return incident.severity === 'critical' && (current - incidentMonth) <= 3;
    });
    if (recentCritical.length < 2) return null;
    return {
        id: `regulation_crackdown_${Date.now()}`,
        title: t('ops.regulation_crackdown', '규제 당국 조사'),
        description: t('ops.regulation_crackdown_desc', '최근 잇따른 서비스 사고로 규제 당국이 조사에 착수했습니다. 운영 개선을 요구합니다.'),
        choices: [
            { text: t('ops.comply', '즉시 개선 조치'), effects: { funds: -300_000, reputation: 5 } },
            { text: t('ops.lobby', '로비로 무마'), effects: { funds: -500_000, investorTrust: -3 } },
            { text: t('ops.resist', '조사에 불응'), effects: { reputation: -20, investorTrust: -10 } }
        ]
    };
}

export function processMonthlyServiceOps(state, currentDate = null) {
    const serviceOps = ensureServiceOpsState(state);
    const incidents = [];
    let reliabilityAccumulator = 0;
    let reliabilityCount = 0;

    // Track per-type cooldowns
    if (!serviceOps.incidentCooldowns) serviceOps.incidentCooldowns = {};
    const currentMonth = currentDate ? ((currentDate.year || 2017) * 12) + (currentDate.month || 1) : 0;

    for (const model of state.models || []) {
        if (!model?.deployed || !Array.isArray(model.serviceChannels)) continue;
        for (const channel of model.serviceChannels) {
            if (!channel?.active || !channel.ops) continue;
            reliabilityAccumulator += Number(channel.ops.sla || 0);
            reliabilityCount += 1;

            const chosenIncident = Object.values(INCIDENT_TYPES).find(def => {
                // Check cooldown
                const cooldown = def.cooldownMonths || 0;
                const lastFired = serviceOps.incidentCooldowns[def.id] || 0;
                if (cooldown > 0 && currentMonth > 0 && (currentMonth - lastFired) < cooldown) return false;
                return def.trigger(channel.ops, model, channel);
            });
            if (!chosenIncident) continue;
            serviceOps.incidentCooldowns[chosenIncident.id] = currentMonth;
            const incident = createIncident(chosenIncident, model, channel, currentDate);
            recordIncident(state, incident);
            incidents.push(incident);
            break; // max one incident per model per month
        }
    }

    serviceOps.reliability = reliabilityCount > 0
        ? Math.round(reliabilityAccumulator / reliabilityCount)
        : clamp(serviceOps.reliability ?? 80, 0, 100);

    const regulationEvent = checkRegulationTrigger(state, currentDate);
    if (regulationEvent) {
        serviceOps.activeIncidents = [...serviceOps.activeIncidents, { type: 'regulation', title: regulationEvent.title }].slice(-5);
    }

    return incidents;
}
