import { COMPETITORS } from '../data/companies.js';
import { TECH_TREE } from '../data/technologies.js';
import { BALANCE } from '../data/balance.js';
import { t } from '../i18n.js';

function _resolveCompetitorModel(competitor, model = null) {
    if (model && typeof model === 'object') return model;
    if (competitor?.currentModel && typeof competitor.currentModel === 'object') return competitor.currentModel;
    const released = Array.isArray(competitor?.modelsReleased) ? competitor.modelsReleased : [];
    return released.length > 0 ? released[released.length - 1] : null;
}

function _resolveRelation(competitor, relationOverride = null) {
    const relation = relationOverride == null ? competitor?.relation ?? 0 : relationOverride;
    return Math.max(-100, Math.min(100, Number.isFinite(Number(relation)) ? Number(relation) : 0));
}

function _resolvePerformance(competitor, model = null) {
    const resolvedModel = _resolveCompetitorModel(competitor, model);
    const performance = Number(resolvedModel?.performance ?? competitor?.aiLevel ?? 0);
    return Number.isFinite(performance) ? Math.max(0, performance) : 0;
}

export function getCompetitorSubscriptionPricing(competitor, model = null, relationOverride = null) {
    const performance = _resolvePerformance(competitor, model);
    const relation = _resolveRelation(competitor, relationOverride);
    const monthlyCost = Math.max(0, Math.round(performance * 500 * (1 - relation / 200)));
    const aggression = Number.isFinite(Number(competitor?.stats?.aggression)) ? Number(competitor.stats.aggression) : 0;
    const refusalChance = Math.min(0.5, Math.max(0, (aggression - 50) / 200));

    return {
        performance,
        relation,
        monthlyCost,
        refusalChance
    };
}

export function canSubscribeToCompetitorModel(competitor, model = null, relationOverride = null) {
    const resolvedModel = _resolveCompetitorModel(competitor, model);
    const pricing = getCompetitorSubscriptionPricing(competitor, resolvedModel, relationOverride);
    const eligible = Boolean(resolvedModel)
        && pricing.performance > 0
        && pricing.relation > -30
        && Boolean(competitor?.currentModel || resolvedModel);

    return {
        eligible,
        reason: eligible ? null : (resolvedModel ? 'relation_too_low' : 'model_unavailable'),
        ...pricing
    };
}

export class CompanySystem {
    constructor(gameState) {
        this.state = gameState;
        this.initCompetitors();
    }

    initCompetitors() {
        this.state.competitors = COMPETITORS.map(c => ({
            ...c,
            techProgress: {},
            modelsReleased: [],
            monthsSinceLastRelease: 0,
            relation: 0,           // -100 (적대) ~ +100 (동맹)
            cooperating: false,    // 협력 연구 중
            cooperationTech: null, // 협력 연구 기술 ID
            cooperationMonths: 0   // 협력 남은 개월
        }));
    }

    processMonthly() {
        for (const comp of this.state.competitors) {
            // Research progress (with diminishing returns)
            const B = BALANCE.COMPETITOR;
            const researchGain = comp.stats.researchPower * (B.RESEARCH_VARIANCE_MIN + Math.random() * B.RESEARCH_VARIANCE_RANGE);
            comp.aiLevel += researchGain * B.AI_GROWTH_RATE / (1 + comp.aiLevel * B.AI_GROWTH_DIMINISH);

            // Model releases
            comp.monthsSinceLastRelease++;
            const cooldown = Math.max(1, B.MODEL_RELEASE_COOLDOWN || 12);
            const releaseChance = comp.monthsSinceLastRelease < cooldown
                ? 0
                : ((comp.monthsSinceLastRelease - cooldown + 1) / 36) * comp.stats.aggression / 10;

            if (Math.random() < releaseChance && comp.aiLevel > B.MODEL_RELEASE_THRESHOLD) {
                this._releaseModel(comp);
            }

            // Market share fluctuation
            const shareChange = (Math.random() - 0.5) * 2;
            comp.marketShare = Math.max(1, Math.min(40, comp.marketShare + shareChange));

            // Relation drift toward 0
            if (comp.relation > 0) comp.relation = Math.max(0, comp.relation - 0.5);
            else if (comp.relation < 0) comp.relation = Math.min(0, comp.relation + 0.3);

            // Cooperation research progress
            if (comp.cooperating && comp.cooperationMonths > 0) {
                comp.cooperationMonths--;
                if (comp.cooperationMonths <= 0) {
                    comp.cooperating = false;
                    comp.cooperationTech = null;
                }
            }
        }

        this._normalizeMarketShares();
    }

    _releaseModel(comp) {
        const version = comp.modelsReleased.length + 2;
        const baseName = comp.currentModel.name.split('-')[0];
        const B = BALANCE.COMPETITOR;
        const performance = Math.min(B.PERFORMANCE_CAP, comp.aiLevel * 1.15 + Math.random() * 6);

        comp.currentModel = {
            name: `${baseName}-${version}`,
            performance: Math.round(performance)
        };
        comp.modelsReleased.push({ ...comp.currentModel, date: { ...window.game?.time?.currentDate } });
        comp.monthsSinceLastRelease = 0;
        comp.marketShare += 3;

        this.state.addNews(
            t('company.competitor_model_release', '{company}이(가) \'{model}\' 발표! (성능: {score}점)', {
                company: comp.name,
                model: comp.currentModel.name,
                score: comp.currentModel.performance
            }),
            'warning'
        );

        if (window.game?.time) {
            window.game.time.requestAutoPause();
        }

        // Safety check - if aggression high and safety low, chance of scandal
        if (comp.stats.aggression > B.SCANDAL_AGGRESSION_THRESHOLD && comp.stats.safetyFocus < B.SCANDAL_SAFETY_THRESHOLD && Math.random() < B.SCANDAL_CHANCE) {
            this.state.global.aiFavorability -= 3;
            this.state.addNews(
                t('company.competitor_safety_issue', '{company}의 {model}에서 안전 문제 발견!', {
                    company: comp.name,
                    model: comp.currentModel.name
                }),
                'danger'
            );
        }

        // Check for AGI
        if (performance >= B.AGI_NEAR_THRESHOLD) {
            this.state.addNews(t('company.competitor_near_agi', '⚠️ {company}이(가) AGI에 근접하고 있습니다!', {
                company: comp.name
            }), 'danger');
        }
        if (performance >= B.AGI_THRESHOLD) {
            this.state.gameOver = true;
            this.state.gameResult = 'competitor_agi';
            this.state.addNews(t('company.competitor_agi', '{company}이(가) AGI를 달성했습니다. 게임 오버.', {
                company: comp.name
            }), 'danger');
        }
    }

    _normalizeMarketShares() {
        const playerShare = this.state.reputation.marketShare;
        const totalCompShare = this.state.competitors.reduce((s, c) => s + c.marketShare, 0);
        const total = totalCompShare + playerShare;

        if (total > 0) {
            for (const comp of this.state.competitors) {
                comp.marketShare = (comp.marketShare / total) * (100 - playerShare);
            }
        }
    }

    getCompetitor(id) {
        return this.state.competitors.find(c => c.id === id);
    }

    getLeaderboard() {
        const entries = [
            ...this.state.competitors.map(c => ({
                name: c.name,
                performance: c.currentModel.performance,
                marketShare: c.marketShare,
                isPlayer: false
            })),
            {
                name: this.state.player.companyName || t('company.default_name', 'My Company'),
                performance: this._getPlayerBestModel(),
                marketShare: this.state.reputation.marketShare,
                isPlayer: true
            }
        ];
        return entries.sort((a, b) => b.performance - a.performance);
    }

    _getPlayerBestModel() {
        if (this.state.models.length === 0) return 0;
        return Math.max(...this.state.models.map(m => m.performance || 0));
    }

    // ─── Diplomacy ───

    /** Propose cooperation research with a competitor */
    proposeCooperation(compId, techId) {
        const comp = this.getCompetitor(compId);
        if (!comp || comp.cooperating) return { ok: false, msg: t('diplomacy.already_cooperating', '이미 협력 중입니다.') };
        if (comp.relation < -20) return { ok: false, msg: t('diplomacy.relation_too_low', '관계가 너무 나쁩니다. (최소 -20 필요)') };

        const cost = 100_000 + Math.max(0, -comp.relation) * 5000;
        if (this.state.resources.funds < cost) return {
            ok: false,
            msg: t('diplomacy.insufficient_funds_amount', '자금 부족 ({cost} 필요)', { cost: `$${cost.toLocaleString()}` })
        };

        this.state.resources.funds -= cost;
        comp.cooperating = true;
        comp.cooperationTech = techId;
        comp.cooperationMonths = 6;
        comp.relation = Math.min(100, comp.relation + 15);

        return { ok: true, cost, msg: t('diplomacy.coop_started', '{company}과(와) 협력 연구 시작! (+15 관계)', { company: comp.name }) };
    }

    /** Get cooperation research bonus for a tech */
    getCooperationBonus(techId) {
        for (const comp of this.state.competitors) {
            if (comp.cooperating && comp.cooperationTech === techId) {
                return 1.3; // 30% 연구 속도 보너스
            }
        }
        return 1.0;
    }

    getCompetitorSubscriptionPricing(compId, model = null, relationOverride = null) {
        const comp = this.getCompetitor(compId);
        if (!comp) {
            return { eligible: false, reason: 'competitor_not_found', performance: 0, relation: 0, monthlyCost: 0, refusalChance: 0 };
        }
        return getCompetitorSubscriptionPricing(comp, model, relationOverride);
    }

    canSubscribeToCompetitorModel(compId, model = null, relationOverride = null) {
        const comp = this.getCompetitor(compId);
        if (!comp) {
            return { eligible: false, reason: 'competitor_not_found', performance: 0, relation: 0, monthlyCost: 0, refusalChance: 0 };
        }
        return canSubscribeToCompetitorModel(comp, model, relationOverride);
    }

    /** Scout a talent from competitor (generates high-quality talent, worsens relation) */
    scoutTalent(compId) {
        const comp = this.getCompetitor(compId);
        if (!comp) return { ok: false, msg: t('diplomacy.competitor_not_found', '경쟁사를 찾을 수 없습니다.') };

        const cost = 50_000 + comp.stats.researchPower * 10_000;
        if (this.state.resources.funds < cost) return {
            ok: false,
            msg: t('diplomacy.insufficient_funds_amount', '자금 부족 ({cost} 필요)', { cost: `$${cost.toLocaleString()}` })
        };

        // Success chance based on relation and their aggression
        const baseChance = 0.5 + comp.relation * 0.002; // -100→30%, 0→50%, +100→70%
        const success = Math.random() < Math.max(0.1, Math.min(0.8, baseChance));

        this.state.resources.funds -= cost;
        comp.relation = Math.max(-100, comp.relation - 20);

        if (!success) {
            return { ok: false, cost, msg: t('diplomacy.scout_fail', '{company} 스카우트 실패! 관계 악화. (-20)', { company: comp.name }) };
        }

        // Generate a high-quality talent from the competitor
        const talent = {
            id: `talent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: `${t('talent.ex_prefix', 'Ex-')}${comp.name}`,
            country: comp.country,
            specialty: [['ml', 'nlp', 'vision', 'rl', 'safety', 'infra', 'hw', 'data'][Math.floor(Math.random() * 8)]],
            stats: {
                research: Math.min(10, comp.stats.researchPower + Math.floor(Math.random() * 2)),
                creativity: Math.min(10, 5 + Math.floor(Math.random() * 4)),
                collaboration: Math.min(10, 4 + Math.floor(Math.random() * 4))
            },
            salary: comp.stats.researchPower * 4000 + Math.floor(Math.random() * 5000),
            morale: 60 + Math.floor(Math.random() * 20),
            loyalty: 40 + Math.floor(Math.random() * 20), // Lower loyalty initially
            trait: ['perfectionist', 'speedrunner', 'innovator'][Math.floor(Math.random() * 3)],
            assignment: null,
            monthsWorked: 0,
            level: Math.min(9, comp.stats.researchPower + Math.floor(Math.random() * 2))
        };

        // Weaken competitor slightly
        comp.aiLevel = Math.max(5, comp.aiLevel - 1);

        return { ok: true, cost, talent, msg: t('diplomacy.scout_success', '{company}에서 인재 스카우트 성공! 관계 -20', { company: comp.name }) };
    }

    /** Improve relation (gift/investment) */
    improveRelation(compId) {
        const comp = this.getCompetitor(compId);
        if (!comp) return { ok: false, msg: t('diplomacy.competitor_not_found', '경쟁사를 찾을 수 없습니다.') };

        const cost = 50_000;
        if (this.state.resources.funds < cost) return { ok: false, msg: t('diplomacy.insufficient_funds', '자금 부족') };

        this.state.resources.funds -= cost;
        const gain = 8 + Math.floor(Math.random() * 7); // +8~15
        comp.relation = Math.min(100, comp.relation + gain);

        return { ok: true, cost, msg: t('diplomacy.relation_improved', '{company}과(와) 관계 개선! (+{gain})', { company: comp.name, gain }) };
    }

    /** Acquire a competitor and absorb part of its market and research position */
    acquireCompetitor(compId) {
        const comp = this.getCompetitor(compId);
        if (!comp) return { ok: false, msg: t('diplomacy.competitor_not_found', '경쟁사를 찾을 수 없습니다.') };
        if (comp.relation < 50) return { ok: false, msg: t('diplomacy.mna_relation_required', 'M&A에는 관계도 +50 이상이 필요합니다.') };

        const cost = this._estimateAcquisitionPrice(comp);
        if (this.state.resources.funds < cost) {
            return { ok: false, msg: t('diplomacy.acquisition_insufficient_funds', '인수 자금 부족 ({cost} 필요)', { cost: `$${cost.toLocaleString()}` }) };
        }

        this.state.resources.funds -= cost;
        this.state.reputation.marketShare = Math.min(100, this.state.reputation.marketShare + comp.marketShare * 0.5);
        this._absorbResearchProgress(comp);
        comp.marketShare = Math.max(1, comp.marketShare * 0.3);
        comp.aiLevel = Math.max(5, comp.aiLevel * 0.7);
        comp.relation = 80;
        this._normalizeMarketShares();

        return { ok: true, cost, msg: t('diplomacy.acquisition_complete', '{company} 부분 인수 완료! 시장점유율을 흡수했습니다.', { company: comp.name }) };
    }

    /** License a technology from a competitor for immediate research progress */
    licenseTech(compId, techId) {
        const comp = this.getCompetitor(compId);
        const tech = TECH_TREE[techId];
        const techState = this.state.technologies[techId];
        if (!comp || !tech || !techState) return { ok: false, msg: t('diplomacy.license_target_missing', '라이선싱 대상을 찾을 수 없습니다.') };
        if (comp.relation < 0) return { ok: false, msg: t('diplomacy.license_relation_required', '기술 라이선싱에는 관계도 0 이상이 필요합니다.') };
        if (techState.completed) return { ok: false, msg: t('diplomacy.license_already_completed', '이미 완료한 기술입니다.') };

        const cost = 200_000 + comp.stats.researchPower * 30_000;
        if (this.state.resources.funds < cost) return {
            ok: false,
            msg: t('diplomacy.insufficient_funds_amount', '자금 부족 ({cost} 필요)', { cost: `$${cost.toLocaleString()}` })
        };

        this.state.resources.funds -= cost;
        techState.progress = Math.min(99, (techState.progress || 0) + 50);
        comp.relation = Math.min(100, comp.relation + 10);

        return {
            ok: true,
            cost,
            msg: t('diplomacy.license_complete', '기술 라이선싱 완료! {tech} +50% 진행', {
                tech: t(`tech.${techId}.name`, tech.name)
            })
        };
    }

    /** File a patent lawsuit: expensive, risky, but can slow a competitor */
    fileLawsuit(compId) {
        const comp = this.getCompetitor(compId);
        if (!comp) return { ok: false, msg: t('diplomacy.competitor_not_found', '경쟁사를 찾을 수 없습니다.') };

        const cost = 300_000;
        if (this.state.resources.funds < cost) return { ok: false, msg: t('diplomacy.lawsuit_insufficient_funds', '소송 비용 부족 ($300K)') };

        this.state.resources.funds -= cost;
        comp.relation = Math.max(-100, comp.relation - 30);

        if (Math.random() < 0.5) {
            comp.marketShare = Math.max(1, comp.marketShare - 5);
            this.state.resources.funds += 500_000;
            return { ok: true, cost, msg: t('diplomacy.lawsuit_win', '{company} 상대 특허 소송 승소! 배상금 $500K 획득', { company: comp.name }) };
        }

        this.state.resources.funds = Math.max(0, this.state.resources.funds - 200_000);
        return { ok: false, cost, msg: t('diplomacy.lawsuit_lose', '{company} 상대 특허 소송 패소. 추가 비용 $200K 발생', { company: comp.name }) };
    }

    /** Provoke/attack competitor */
    provoke(compId) {
        const comp = this.getCompetitor(compId);
        if (!comp) return { ok: false };

        comp.relation = Math.max(-100, comp.relation - 15);
        comp.marketShare = Math.max(1, comp.marketShare - 1);
        this.state.reputation.marketShare += 0.3;
        this.state.reputation.publicImage = Math.max(-50, (this.state.reputation.publicImage || 0) - 3);

        return { ok: true, msg: t('diplomacy.provoke_result', '{company}에 대한 공격적 마케팅! 관계 -15, 이미지 -3', { company: comp.name }) };
    }

    _estimateAcquisitionPrice(comp) {
        const marketValue = comp.marketShare * 1_500_000;
        const researchValue = comp.aiLevel * comp.stats.researchPower * 40_000;
        const modelValue = (comp.currentModel?.performance || 0) * 25_000;
        return Math.round(Math.max(500_000, marketValue + researchValue + modelValue));
    }

    _absorbResearchProgress(comp) {
        const candidates = Object.keys(TECH_TREE)
            .filter(id => this.state.technologies[id] && !this.state.technologies[id].completed);
        const boosts = Math.min(3, candidates.length);
        for (let i = 0; i < boosts; i++) {
            const id = candidates[Math.floor(Math.random() * candidates.length)];
            const techState = this.state.technologies[id];
            techState.progress = Math.min(90, (techState.progress || 0) + 15 + comp.stats.researchPower);
        }
    }
}
