import { TECH_TREE } from '../data/technologies.js';
import { BALANCE } from '../data/balance.js';
import { t } from '../i18n.js';
import { getInternalAIBonus } from './InternalAISystem.js';

const COMMUNITY_RESEARCH_TECHS = new Set([
    'data_collection',
    'data_refinement',
    'distributed_learning',
    'federated_learning',
    'synthetic_data',
    'bias_audit'
]);

export class TechTree {
    constructor(gameState) {
        this.state = gameState;
        this.initTechnologies();
    }

    initTechnologies() {
        for (const [id, tech] of Object.entries(TECH_TREE)) {
            this.state.technologies[id] = {
                id,
                progress: 0,
                completed: false,
                researching: false,
                assignedTalents: []
            };
        }
    }

    getTechData(id) {
        return TECH_TREE[id];
    }

    getTechState(id) {
        return this.state.technologies[id];
    }

    canResearch(id) {
        const tech = TECH_TREE[id];
        const techState = this.state.technologies[id];
        if (!tech || techState.completed || techState.researching) return false;

        // requiresAny: OR logic (at least one must be completed)
        if (tech.requiresAny && tech.requiresAny.length > 0) {
            if (!tech.requiresAny.some(reqId => this.state.technologies[reqId]?.completed)) return false;
        }

        return tech.requires.every(reqId => this.state.technologies[reqId]?.completed);
    }

    startResearch(techId, talentIds) {
        if (!this.canResearch(techId)) return false;
        const techState = this.state.technologies[techId];
        techState.researching = true;
        techState.assignedTalents = talentIds;

        for (const tid of talentIds) {
            const talent = this.state.talents.find(t => t.id === tid);
            if (talent) talent.assignment = techId;
        }

        this.state.addNews(t('research.started_news', '"{name}" 연구를 시작했습니다.', {
            name: t(`tech.${techId}.name`, TECH_TREE[techId].name)
        }), 'info');
        return true;
    }

    addTalentToResearch(techId, talentId) {
        const techState = this.state.technologies[techId];
        if (!techState?.researching) return false;
        if (techState.assignedTalents.includes(talentId)) return false;
        const talent = this.state.talents.find(t => t.id === talentId);
        if (!talent || talent.assignment) return false;
        techState.assignedTalents.push(talentId);
        talent.assignment = techId;
        return true;
    }

    removeTalentFromResearch(techId, talentId) {
        const techState = this.state.technologies[techId];
        if (!techState?.researching) return false;
        const idx = techState.assignedTalents.indexOf(talentId);
        if (idx === -1) return false;
        techState.assignedTalents.splice(idx, 1);
        const talent = this.state.talents.find(t => t.id === talentId);
        if (talent) talent.assignment = null;
        // If no talents left, pause research (don't cancel — keep progress)
        return true;
    }

    cancelResearch(techId) {
        const techState = this.state.technologies[techId];
        if (!techState.researching) return;
        techState.researching = false;
        for (const tid of techState.assignedTalents) {
            const talent = this.state.talents.find(t => t.id === tid);
            if (talent) talent.assignment = null;
        }
        techState.assignedTalents = [];
    }

    processDailyResearch() {
        for (const [id, techState] of Object.entries(this.state.technologies)) {
            if (!techState.researching || techState.completed) continue;

            const tech = TECH_TREE[id];
            const assignedTalents = techState.assignedTalents
                .map(tid => this.state.talents.find(t => t.id === tid))
                .filter(Boolean);

            if (assignedTalents.length === 0) {
                techState.researching = false;
                continue;
            }

            const R = BALANCE.RESEARCH;
            let dailyProgress = 0;
            for (const talent of assignedTalents) {
                const relevance = talent.specialty.some(s =>
                    this._specialtyMatchesCategory(s, tech.category)
                ) ? R.SPECIALTY_RELEVANCE_BONUS : 1.0;

                dailyProgress += (talent.stats.research * R.TALENT_RESEARCH_WEIGHT + talent.stats.creativity * R.TALENT_CREATIVITY_WEIGHT) * relevance;
            }

            // Small team bonus
            if (this.state.talents.length < R.SMALL_TEAM_THRESHOLD) {
                dailyProgress *= R.SMALL_TEAM_BONUS;
            }

            if (this.state.talents.length >= (R.LARGE_TEAM_THRESHOLD || Infinity)) {
                dailyProgress *= (R.LARGE_TEAM_BONUS || 1);
            }

            // Computing bonus
            const computeBonus = Math.min(R.COMPUTE_BONUS_CAP, 1.0 + this.state.resources.computing * R.COMPUTE_BONUS_PER_GPU);
            dailyProgress *= computeBonus;

            // Morale modifier
            const avgMorale = assignedTalents.reduce((s, t) => s + t.morale, 0) / assignedTalents.length;
            dailyProgress *= (avgMorale / 100);

            // Tech route bonus from player's chosen specialization
            const playerRoute = this.state.player?.techRoute;
            if (playerRoute && tech.route && tech.route !== 'common') {
                if (playerRoute === 'llm' && tech.route === 'llm') dailyProgress *= 1.10;
                else if (playerRoute === 'world' && tech.route === 'world') dailyProgress *= 1.10;
                else if (playerRoute === 'generative' && (tech.category === 'generative' || tech.route === 'world')) dailyProgress *= 1.10;
                else if (playerRoute === 'safety' && tech.category === 'safety') dailyProgress *= 1.20;
                else if (playerRoute === 'balanced' && tech.route === 'synergy') dailyProgress *= 1.15;
            }

            // Cooperation research bonus
            if (window.game?.companies) {
                dailyProgress *= window.game.companies.getCooperationBonus(id);
            }

            const countryMods = this.state.player?.countryModifiers || {};
            if (['foundation', 'data'].includes(tech.category) && countryMods.academicResearch) {
                dailyProgress *= countryMods.academicResearch;
            }
            if (['frontier_ai', 'integration'].includes(tech.category) && countryMods.innovation) {
                dailyProgress *= countryMods.innovation;
            }
            if (tech.category === 'chip' && countryMods.chipResearch) {
                dailyProgress *= countryMods.chipResearch;
            }
            if (tech.category === 'product' && tech.id === 'robot_ai' && countryMods.robotics) {
                dailyProgress *= countryMods.robotics;
            }
            if (tech.category === 'safety' && countryMods.cybersecurity) {
                dailyProgress *= countryMods.cybersecurity;
            }

            // Player modifiers from character creation
            const mods = this.state.player?.modifiers || {};
            if (tech.category === 'safety' && mods.safetyResearch) {
                dailyProgress *= mods.safetyResearch;
            } else if (tech.route === 'world' && mods.worldModelResearch) {
                dailyProgress *= mods.worldModelResearch;
            }
            dailyProgress *= (mods.researchSpeed || 1.0);

            const researchBonus = getInternalAIBonus(this.state.internalAI, 'research_assist');
            if (researchBonus > 0) dailyProgress *= (1 + researchBonus);

            const safetyBonus = getInternalAIBonus(this.state.internalAI, 'safety_audit');
            if (tech.category === 'safety' && safetyBonus > 0) {
                dailyProgress *= (1 + safetyBonus);
            }

            const hasOpenSourceCommunity = (this.state.models || []).some(model =>
                model?.deployed && (model.deployedAsOpenSource || model.deploymentStrategy === 'open_source')
            ) || (this.state.openSourceModels || []).length > 0;
            if (hasOpenSourceCommunity && COMMUNITY_RESEARCH_TECHS.has(id)) {
                dailyProgress *= (1 / (R.OPENSOURCE_COMMUNITY_DISCOUNT || 0.85));
            }

            techState.progress += dailyProgress / tech.cost * 100;

            if (techState.progress >= 100) {
                techState.progress = 100;
                techState.completed = true;
                techState.researching = false;
                for (const talent of assignedTalents) {
                    talent.assignment = null;
                }
                techState.assignedTalents = [];
                this._applyTechEffects(id);
                this.state.addNews(t('research.completed_news', '"{name}" 연구 완료!', {
                    name: t(`tech.${id}.name`, tech.name)
                }), 'success');
                window.game?.triggerSuccessImpact?.('normal', { soundId: 'research_complete' });

                // Trigger tech milestone events
                if (window.game?.events) {
                    window.game.events.processTechCompletion(id);
                }

                if (window.game?.time) {
                    window.game.time.requestAutoPause();
                }
            }
        }
    }

    _specialtyMatchesCategory(specialty, category) {
        const map = {
            ml: ['foundation', 'model_arch', 'advanced_ai', 'frontier_ai', 'generative', 'integration'],
            nlp: ['model_arch', 'advanced_ai', 'frontier_ai'],
            vision: ['model_arch', 'advanced_ai', 'frontier_ai', 'generative'],
            rl: ['foundation', 'advanced_ai', 'frontier_ai'],
            safety: ['safety'],
            infra: ['infra', 'energy'],
            hw: ['chip', 'infra', 'energy', 'quantum'],
            data: ['data']
        };
        return (map[specialty] || []).includes(category);
    }

    _applyTechEffects(techId) {
        const tech = TECH_TREE[techId];
        if (!tech.effects) return;

        const e = tech.effects;
        if (e.reputationBonus) this.state.reputation.corporate += e.reputationBonus;
        if (e.favorabilityPenalty) this.state.reputation.publicImage += e.favorabilityPenalty;
    }

    getResearchingTechs() {
        return Object.entries(this.state.technologies)
            .filter(([, s]) => s.researching)
            .map(([id, s]) => ({ ...s, ...TECH_TREE[id] }));
    }

    getCompletedTechs() {
        return Object.entries(this.state.technologies)
            .filter(([, s]) => s.completed)
            .map(([id]) => id);
    }

    getAvailableTechs() {
        return Object.keys(TECH_TREE).filter(id => this.canResearch(id));
    }
}
