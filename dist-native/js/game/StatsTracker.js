import { storageGetItem, storageSetItem } from '../utils/storage.js';

const STORAGE_KEY = 'agimanager_stats';

const DEFAULT_STATS = {
    gamesPlayed: 0,
    totalPlayTimeMinutes: 0,
    highestValuation: 0,
    highestScore: 0,
    bestGrade: 'F',
    techsResearched: 0,
    modelsDeployed: 0,
    fundingRoundsCompleted: 0,
    victories: { singularity: 0, ipo_success: 0, market_dominance: 0, safety_leader: 0, time_limit: 0 },
    defeats: { bankrupt: 0, competitor_agi: 0 },
    favoriteRoute: null,
    favoriteCountry: null,
    routeCounts: {},
    countryCounts: {},
    endings: {},
    legacyRuns: []
};

const GRADE_RANK = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

export class StatsTracker {
    constructor() {
        this.stats = structuredClone(DEFAULT_STATS);
        this.ready = this._load();
        this._sessionStart = Date.now();
        this._gameStartedRecorded = false;
        this._gameOverRecordedFor = null;
    }

    async _load() {
        const raw = await storageGetItem(STORAGE_KEY);
        if (!raw) return;
        try {
            this.stats = _mergeDefaults(JSON.parse(raw));
        } catch {
            this.stats = structuredClone(DEFAULT_STATS);
        }
    }

    async _save() {
        await storageSetItem(STORAGE_KEY, JSON.stringify(this.stats));
    }

    async recordGameStart(state) {
        await this.ready;
        if (this._gameStartedRecorded) return;
        this._gameStartedRecorded = true;

        this.stats.gamesPlayed++;
        _count(this.stats.routeCounts, state.player.techRoute || 'unknown');
        _count(this.stats.countryCounts, state.player.country || 'unknown');
        this.stats.favoriteRoute = _maxKey(this.stats.routeCounts);
        this.stats.favoriteCountry = _maxKey(this.stats.countryCounts);
        await this._save();
    }

    async updateSnapshot(state) {
        await this.ready;
        const minutes = Math.max(0, Math.floor((Date.now() - this._sessionStart) / 60000));
        this.stats.totalPlayTimeMinutes += minutes;
        this._sessionStart = Date.now();

        this.stats.highestValuation = Math.max(this.stats.highestValuation, state.economy.valuation || 0);
        this.stats.techsResearched = Math.max(this.stats.techsResearched, _completedTechs(state));
        this.stats.modelsDeployed = Math.max(this.stats.modelsDeployed, (state.models || []).filter(m => m.deployed).length);
        this.stats.fundingRoundsCompleted = Math.max(this.stats.fundingRoundsCompleted, state.economy.fundingStage || 0);
        await this._save();
    }

    async recordGameOver(state, score, grade, isLoss) {
        await this.ready;
        const key = `${state.gameResult || 'unknown'}:${state.player.companyName || ''}:${state.player.foundedDate?.year || ''}`;
        if (this._gameOverRecordedFor === key) return;
        this._gameOverRecordedFor = key;

        await this.updateSnapshot(state);
        this.stats.highestScore = Math.max(this.stats.highestScore, score || 0);
        if (GRADE_RANK[grade] > GRADE_RANK[this.stats.bestGrade]) this.stats.bestGrade = grade;

        const result = state.gameResult || 'unknown';
        _count(this.stats.endings, result);
        if (isLoss) {
            this.stats.defeats[result] = (this.stats.defeats[result] || 0) + 1;
        } else {
            this.stats.victories[result] = (this.stats.victories[result] || 0) + 1;
        }

        const legacySummary = _buildLegacySummary(state, score, grade);
        if (legacySummary) {
            const legacyKey = `${legacySummary.companyName}:${legacySummary.result}:${legacySummary.year}`;
            if (!this.stats.legacyRuns.some(run => `${run.companyName}:${run.result}:${run.year}` === legacyKey)) {
                this.stats.legacyRuns.unshift(legacySummary);
                this.stats.legacyRuns = this.stats.legacyRuns.slice(0, 12);
            }
        }

        await this._save();
    }

    getStats() {
        return this.stats;
    }
}

function _mergeDefaults(value) {
    return {
        ...structuredClone(DEFAULT_STATS),
        ...(value || {}),
        victories: { ...DEFAULT_STATS.victories, ...(value?.victories || {}) },
        defeats: { ...DEFAULT_STATS.defeats, ...(value?.defeats || {}) },
        routeCounts: { ...(value?.routeCounts || {}) },
        countryCounts: { ...(value?.countryCounts || {}) },
        endings: { ...(value?.endings || {}) },
        legacyRuns: Array.isArray(value?.legacyRuns) ? value.legacyRuns : []
    };
}

function _completedTechs(state) {
    return Object.values(state.technologies || {}).filter(t => t.completed).length;
}

function _count(obj, key) {
    obj[key] = (obj[key] || 0) + 1;
}

function _maxKey(obj) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function _buildLegacySummary(state, score, grade) {
    if (!state?.gameResult) return null;
    const bestModel = Math.max(0, ...(state.models || []).map(model => Number(model?.compositeScore ?? model?.performance ?? 0) || 0));
    return {
        companyName: state.player?.companyName || 'Unknown',
        result: state.gameResult,
        score: Number(score || 0),
        grade: grade || 'F',
        techRoute: state.player?.techRoute || 'llm',
        year: state.player?.foundedDate?.year || state.time?.currentDate?.year || 2017,
        bestModel,
        legacy: _deriveLegacyType(state)
    };
}

function _deriveLegacyType(state) {
    if ((state.player?.modifiers?.openSourceRevenue || 1) > 1.05) {
        return 'open_source_pioneer';
    }
    if ((state.player?.modifiers?.safetyResearch || 1) > 1.05) {
        return 'ai_legacy';
    }
    if ((state.models || []).some(model => model.deployed && model.deploymentStrategy === 'open_source')) {
        return 'open_source_pioneer';
    }
    if ((state.reputation?.publicImage || 0) >= 50) {
        return 'public_trust';
    }
    if ((state.reputation?.marketShare || 0) > 25) {
        return 'scale_builder';
    }
    return 'balanced_builder';
}
