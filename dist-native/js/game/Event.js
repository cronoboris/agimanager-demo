/**
 * Event System — Historical Timeline + Random Events
 *
 * Historical events: triggered by real-world dates (2017+)
 * Random events: triggered by game conditions + probability
 *
 * Event types:
 * - 'world': auto-applied effects, player acknowledges (OK button)
 * - 'decision': player chooses from options with different effects
 */
import { HISTORICAL_EVENTS, RANDOM_EVENTS, EVENT_CATEGORIES, TECH_MILESTONE_EVENTS } from '../data/historical_events.js';
import { DEMO } from '../data/demo-config.js';
import { t } from '../i18n.js';
import { normalizeGameStateCompatibility } from './GameStateCompatibility.js';

export { EVENT_CATEGORIES };

function _eventTitle(event) {
    return t(`event.${event.id}.title`, event.title);
}

function _eventChoiceText(event, choice, choiceIndex) {
    return t(`event.${event.id}.choice_${choiceIndex}`, choice?.text || '');
}

export class EventSystem {
    constructor(gameState) {
        this.state = gameState;
        this.eventQueue = [];          // events waiting to be shown
        this.firedEvents = new Set();  // IDs of triggered historical events
        this.pendingEvent = null;      // currently displayed event
    }

    /**
     * Check for historical events — called every game day.
     * HISTORICAL_EVENTS is sorted by date, so we break early for efficiency.
     */
    processDay(dateInt) {
        for (const evt of HISTORICAL_EVENTS) {
            // Events are sorted — if event date is far in the future, stop
            if (evt.date > dateInt + 100) break;  // ~1 month in YYYYMMDD

            // Not yet reached this event's date
            if (dateInt < evt.date) continue;

            // Date window: convert YYYYMMDD to comparable day count for proper comparison
            // Default window: ~2 months (allows saves that skip ahead to still catch events)
            const windowDays = evt.dateWindow || 60;
            if (_daysBetween(evt.date, dateInt) > windowDays) continue;

            // Already fired
            if (this.firedEvents.has(evt.id)) continue;
            if (!_isDemoAllowed(evt)) continue;

            // Optional condition
            if (evt.condition && !evt.condition(this.state)) continue;

            // Tech-gate checks
            if (!this._checkTechGates(evt)) continue;
            if (!this._checkChainGates(evt)) continue;

            this.firedEvents.add(evt.id);
            this.eventQueue.push(evt);
        }

        this._processQueue();
    }

    /**
     * Check for random events — called monthly.
     */
    processMonthly() {
        if (this.pendingEvent) return; // don't queue random if popup is showing

        this._advanceEventChains();

        const countryMods = _getCountryModifiers(this.state);
        for (const evt of RANDOM_EVENTS) {
            if (evt.fireOnce && this.firedEvents.has(evt.id)) continue;
            if (!_isDemoAllowed(evt)) continue;
            const probability = _randomEventProbability(evt, countryMods);
            if (Math.random() > probability) continue;
            if (evt.condition && !evt.condition(this.state)) continue;
            if (!this._checkTechGates(evt)) continue;
            if (!this._checkChainGates(evt)) continue;

            if (evt.fireOnce) {
                this.firedEvents.add(evt.id);
            }
            this.eventQueue.push({ ...evt, type: evt.type || 'decision' });
            break; // only one random event per month
        }

        this._processQueue();
    }

    /**
     * Process the queue — show next event if none is pending
     */
    _processQueue() {
        if (this.pendingEvent || this.eventQueue.length === 0) return;

        this.pendingEvent = this.eventQueue.shift();
        if (this.pendingEvent.glitchLevel) {
            window.game?.triggerGlitch?.(this.pendingEvent.glitchLevel);
        }

        // World events: auto-apply effects immediately
        if (this.pendingEvent.type === 'world' && this.pendingEvent.effects) {
            this._applyEffects(this.pendingEvent.effects);
        }

        // Auto-pause the game
        if (window.game?.time) {
            window.game.time.requestAutoPause();
        }
    }

    hasPendingEvent() { return this.pendingEvent !== null; }
    getPendingEvent() { return this.pendingEvent; }
    hasQueuedEvents() { return this.eventQueue.length > 0; }

    /**
     * Dismiss a world event (player pressed OK)
     */
    dismissEvent() {
        if (!this.pendingEvent) return;

        this.state.addNews(
            t('event.log.dismiss', '{icon} {title}', {
                icon: this.pendingEvent.icon || '📢',
                title: _eventTitle(this.pendingEvent)
            }),
            this.pendingEvent.newsType || 'event'
        );

        this.pendingEvent = null;
        this._processQueue(); // show next queued event
    }

    /**
     * Resolve a decision event with chosen option
     */
    resolveEvent(choiceIndex) {
        if (!this.pendingEvent) return;

        const choice = this.pendingEvent.choices?.[choiceIndex];
        if (choice?.effects) {
            this._applyEffects(choice.effects);
        }
        if (choice?.karma) {
            this._applyKarma(choice.karma);
        }
        if (choice?.effects?.karma) {
            this._applyKarma(choice.effects.karma);
        }
        if (choice?.chainAdvance) {
            this._advanceChain(choice.chainAdvance);
        }

        const choiceText = choice
            ? t('event.log.choice_suffix', ' → "{choice}"', {
                choice: _eventChoiceText(this.pendingEvent, choice, choiceIndex)
            })
            : '';
        this.state.addNews(
            t('event.log.resolve', '{icon} {title}{choiceText}', {
                icon: this.pendingEvent.icon || '📢',
                title: _eventTitle(this.pendingEvent),
                choiceText
            }),
            this.pendingEvent.newsType || 'event'
        );

        this.pendingEvent = null;
        this._processQueue(); // show next queued event
    }

    /**
     * Apply effects to game state
     */
    _applyEffects(fx) {
        if (!fx) return;
        const s = this.state;
        const currentYear = window.game?.time?.currentDate?.year || 2017;

        // ─── Direct resources ───
        if (fx.funds) s.resources.funds += fx.funds;
        if (fx.computing) {
            s.economy.cloudGPUs = Math.max(0, (s.economy.cloudGPUs || 0) + fx.computing);
        }
        if (fx.data) {
            s.economy.totalDataTB = Math.max(0, (s.economy.totalDataTB || 0) + fx.data);
        }

        // ─── Reputation ───
        if (fx.reputation) s.reputation.corporate = _clamp(s.reputation.corporate + fx.reputation, -100, 100);
        if (fx.publicImage) s.reputation.publicImage = _clamp(s.reputation.publicImage + fx.publicImage, -100, 100);
        if (fx.investorTrust) s.reputation.investorTrust = _clamp(s.reputation.investorTrust + fx.investorTrust, 0, 100);
        if (fx.marketShare) s.reputation.marketShare = Math.max(0, s.reputation.marketShare + fx.marketShare);

        // ─── Global ───
        if (fx.aiFavorability) s.global.aiFavorability = _clamp(s.global.aiFavorability + fx.aiFavorability, 0, 100);
        if (fx.globalAILevel) s.global.globalAILevel += fx.globalAILevel;

        // ─── Economy ───
        if (fx.gpuPriceChange) {
            s.economy.gpuMarketPrice = Math.max(1000, s.economy.gpuMarketPrice + fx.gpuPriceChange);
        }
        if (fx.gpuPriceMult) {
            s.economy.gpuMarketShockMult = Math.max(1, Number(s.economy.gpuMarketShockMult || 1) * fx.gpuPriceMult);
            s.economy.gpuMarketPrice = Math.max(1000, Math.round(s.economy.gpuMarketPrice * fx.gpuPriceMult));
        }
        if (fx.cloudCostMult) {
            s.economy.cloudCostShockMult = Math.max(1, Number(s.economy.cloudCostShockMult || 1) * fx.cloudCostMult);
        }
        if (fx.gpuSupplyShutdown) {
            const shutdownMonths = Number(fx.gpuSupplyShutdownMonths || fx.duration || 3);
            s.economy.gpuSupplyShutdownMonths = Math.max(
                Number(s.economy.gpuSupplyShutdownMonths || 0),
                shutdownMonths
            );
        }
        if (fx.chipProgramProgress) {
            const boost = Number(fx.chipProgramProgress || 0);
            if (boost > 0 && Array.isArray(s.economy.chipPrograms)) {
                for (const program of s.economy.chipPrograms) {
                    if (!program || program.status && program.status !== 'active') continue;
                    program.phaseProgress = _clamp(Number(program.phaseProgress || 0) + boost, 0, 100);
                    program.progress = _clamp(Number(program.progress || 0) + boost / 2, 0, 100);
                }
            }
        }
        if (fx.dataCostChange) {
            s.economy.dataCostPerTB = Math.max(1000, s.economy.dataCostPerTB + fx.dataCostChange);
        }
        if (fx.valuationMult) {
            s.economy.valuation = Math.round(s.economy.valuation * fx.valuationMult);
        }

        // ─── Talent ───
        if (fx.morale) {
            for (const t of s.talents) t.morale = _clamp(t.morale + fx.morale, 0, 100);
        }
        if (fx.salaryIncrease && s.talents.length > 0) {
            const best = s.talents.reduce((a, b) => a.stats.research > b.stats.research ? a : b);
            best.salary = Math.round(best.salary * (1 + fx.salaryIncrease));
        }
        if (fx.loseTalent && s.talents.length > 0) {
            const bi = s.talents.reduce((best, t, i) =>
                t.stats.research > (s.talents[best]?.stats.research || 0) ? i : best, 0);
            const lost = s.talents.splice(bi, 1)[0];
            s.addNews(t('event.talent_left', '{name}이(가) 이직했습니다.', { name: lost.name }), 'danger');
        }

        // ─── Country-specific ───
        if (fx.countryEffects) {
            for (const [cid, m] of Object.entries(fx.countryEffects)) {
                if (m.aiFavorability != null) {
                    if (s.global.countryFavorability[cid] == null) s.global.countryFavorability[cid] = 50;
                    s.global.countryFavorability[cid] = _clamp(
                        s.global.countryFavorability[cid] + m.aiFavorability, 0, 100);
                }
            }
        }

        // ─── Unemployment ───
        if (fx.unemployment) {
            for (const [k, v] of Object.entries(fx.unemployment)) {
                if (s.global.unemploymentByIndustry[k] != null) {
                    s.global.unemploymentByIndustry[k] = _clamp(
                        s.global.unemploymentByIndustry[k] + v, 0, 50);
                }
            }
        }

        // ─── Competitor effects ───
        if (fx.competitorBoost) {
            for (const c of s.competitors) c.aiLevel += fx.competitorBoost;
        }
        if (fx.specificCompetitor) {
            for (const [cid, m] of Object.entries(fx.specificCompetitor)) {
                const c = s.competitors.find(x => x.id === cid);
                if (!c) continue;
                if (m.aiLevel) c.aiLevel += m.aiLevel;
                if (m.funding) c.stats.funding = _clamp(c.stats.funding + m.funding, 1, 10);
                if (m.marketShare) c.marketShare += m.marketShare;
                if (m.researchPower) c.stats.researchPower = _clamp(c.stats.researchPower + m.researchPower, 1, 10);
            }
        }
        if (fx.karma) {
            this._applyKarma(fx.karma);
        }
        if (fx.ideologyReset) {
            const target = fx.ideologyReset;
            for (const talent of s.talents || []) {
                if (target !== 'all' && talent.ideology !== target) continue;
                talent.ideologyFrustration = 0;
            }
        }
        if (fx.disableInternalAI) {
            if (s.internalAI?.slots) {
                for (const slot of Object.values(s.internalAI.slots)) {
                    if (!slot) continue;
                    slot.modelId = null;
                    slot.modelName = null;
                    slot.source = 'none';
                    slot.monthlyCost = 0;
                    slot.bonus = 0;
                    slot.model = null;
                }
            }
            if (Array.isArray(s.internalAI?.competitorSubscriptions)) {
                s.internalAI.competitorSubscriptions = [];
            }
            if (s.internalAI) {
                s.internalAI.totalMonthlyCost = 0;
            }
        }

        normalizeGameStateCompatibility(s, currentYear);
    }

    _applyKarma(karmaFx) {
        if (!karmaFx) return;
        const s = this.state;
        if (!s.karma) {
            s.karma = {};
        }
        let changed = false;
        for (const [key, value] of Object.entries(karmaFx)) {
            s.karma[key] = Boolean(value);
            changed = true;
        }
        if (changed) {
            window.game?.triggerGlitch?.('danger');
        }
    }

    /**
     * Check tech-gate conditions on an event.
     * requiredTechs: ALL must be completed (AND)
     * requiredTechsAny: at least ONE must be completed (OR)
     */
    _checkTechGates(evt) {
        if (evt.requiredTechs?.length > 0) {
            if (!evt.requiredTechs.every(tid => this.state.technologies[tid]?.completed)) return false;
        }
        if (evt.requiredTechsAny?.length > 0) {
            if (!evt.requiredTechsAny.some(tid => this.state.technologies[tid]?.completed)) return false;
        }
        return true;
    }

    _checkChainGates(evt) {
        if (!evt?.chainId) return true;
        const chains = this.state.eventChains || {};
        const chain = chains[evt.chainId];
        const step = Number(evt.chainStep || 1);

        if (step <= 1) {
            return !chain;
        }

        if (!chain || Number(chain.step || 0) !== step - 1) return false;

        const requiredChoice = evt.requiredChainChoice;
        if (requiredChoice) {
            const choices = Array.isArray(requiredChoice) ? requiredChoice : [requiredChoice];
            if (!choices.includes(chain.choice)) return false;
        }

        const minDelayMonths = Number(evt.minChainDelayMonths ?? ((step * 2) - 1));
        return Number(chain.monthsElapsed || 0) >= minDelayMonths;
    }

    _advanceEventChains() {
        if (!this.state.eventChains || typeof this.state.eventChains !== 'object') {
            this.state.eventChains = {};
            return;
        }
        for (const chain of Object.values(this.state.eventChains)) {
            if (!chain || typeof chain !== 'object') continue;
            chain.monthsElapsed = Number(chain.monthsElapsed || 0) + 1;
        }
    }

    _advanceChain(chainAdvance) {
        const { chainId, step, choice } = chainAdvance || {};
        if (!chainId) return;
        const currentDate = typeof window !== 'undefined'
            ? { ...window.game?.time?.currentDate }
            : null;
        if (!this.state.eventChains || typeof this.state.eventChains !== 'object') {
            this.state.eventChains = {};
        }
        this.state.eventChains[chainId] = {
            ...(this.state.eventChains[chainId] || {}),
            step: Number(step || 0),
            choice: choice || null,
            monthsElapsed: 0,
            startedDate: this.state.eventChains[chainId]?.startedDate || currentDate,
            updatedDate: currentDate
        };
    }

    /**
     * Called when a technology completes. Checks TECH_MILESTONE_EVENTS
     * for any event triggered by this tech.
     */
    processTechCompletion(techId) {
        if (!TECH_MILESTONE_EVENTS || TECH_MILESTONE_EVENTS.length === 0) return;

        for (const evt of TECH_MILESTONE_EVENTS) {
            if (evt.triggerTech !== techId) continue;
            if (this.firedEvents.has(evt.id)) continue;
            if (!_isDemoAllowed(evt)) continue;
            if (evt.condition && !evt.condition(this.state)) continue;
            if (!this._checkTechGates(evt)) continue;
            if (!this._checkChainGates(evt)) continue;

            this.firedEvents.add(evt.id);
            this.eventQueue.push(evt);
        }

        this._processQueue();
    }

    // ─── Serialization ───
    toJSON() {
        return { firedEvents: [...this.firedEvents] };
    }

    fromJSON(data) {
        if (data?.firedEvents) {
            this.firedEvents = new Set(data.firedEvents);
        }
    }
}

function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function _getCountryModifiers(state) {
    return state?.player?.countryModifiers || state?.player?.countryBonuses || {};
}

function _randomEventProbability(evt, countryMods = {}) {
    const baseProbability = Number(evt?.probability) || 0;
    if (baseProbability <= 0) return 0;

    const riskMultiplier = Math.max(1, Number(countryMods.internationalRisk) || 1);
    const riskCategories = new Set(['regulatory', 'disaster', 'social']);
    const adjustedProbability = riskCategories.has(evt?.category)
        ? baseProbability * riskMultiplier
        : baseProbability;

    return Math.min(0.95, adjustedProbability);
}

/** Convert YYYYMMDD integer to Date, then compute day difference */
function _daysBetween(dateInt1, dateInt2) {
    const y1 = Math.floor(dateInt1 / 10000), m1 = Math.floor((dateInt1 % 10000) / 100), d1 = dateInt1 % 100;
    const y2 = Math.floor(dateInt2 / 10000), m2 = Math.floor((dateInt2 % 10000) / 100), d2 = dateInt2 % 100;
    const t1 = new Date(y1, m1 - 1, d1).getTime();
    const t2 = new Date(y2, m2 - 1, d2).getTime();
    return Math.round(Math.abs(t2 - t1) / 86400000);
}

function _isDemoAllowed(evt) {
    if (!DEMO?.eventFilter || !evt) return true;
    const filter = DEMO.eventFilter;

    if (evt.date && filter.maxHistoricalYear) {
        const year = Math.floor(Number(evt.date) / 10000);
        if (year > Number(filter.maxHistoricalYear)) return false;
    }

    if (Array.isArray(filter.blockPrefixes) && evt.id) {
        if (filter.blockPrefixes.some(prefix => String(evt.id).startsWith(prefix))) {
            return false;
        }
    }

    return true;
}
