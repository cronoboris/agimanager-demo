import { t } from '../i18n.js';
import { storageGetItem, storageSetItem } from '../utils/storage.js';
import { TECH_TREE } from '../data/technologies.js';
import { steam } from '../utils/steamBridge.js';

const STORAGE_KEY = 'agimanager_achievements';

export const ACHIEVEMENTS = [
    { id: 'first_tech', name: '첫 연구 완료', desc: '기술 1개를 완료하세요', check: s => _completedTechs(s) >= 1 },
    { id: 'ten_techs', name: '연구 조직', desc: '기술 10개를 완료하세요', check: s => _completedTechs(s) >= 10 },
    { id: 'deep_research', name: '프런티어 랩', desc: '기술 25개를 완료하세요', check: s => _completedTechs(s) >= 25 },
    { id: 'first_model', name: '첫 모델', desc: 'AI 모델을 설계하세요', check: s => s.models.length >= 1 },
    { id: 'trained_model', name: '학습 완료', desc: '모델 훈련을 완료하세요', check: s => s.models.some(m => m.trained) },
    { id: 'first_deploy', name: '첫 배포', desc: 'AI 모델을 배포하세요', check: s => s.models.some(m => m.deployed) },
    { id: 'three_deploys', name: '제품군', desc: '모델 3개를 배포하세요', check: s => s.models.filter(m => m.deployed).length >= 3 },
    { id: 'model_50', name: '쓸만한 지능', desc: '성능 50점 이상 모델을 만드세요', check: s => _bestModel(s) >= 50 },
    { id: 'model_80', name: '강력한 모델', desc: '성능 80점 이상 모델을 만드세요', check: s => _bestModel(s) >= 80 },
    { id: 'seed_round', name: '첫 투자 유치', desc: 'Seed 라운드를 클로즈하세요', check: s => s.economy.fundingStage >= 1 },
    { id: 'series_a', name: '시리즈 A', desc: '시리즈 A 투자를 유치하세요', check: s => s.economy.fundingStage >= 2 },
    { id: 'ipo', name: '상장 기업', desc: 'IPO 단계에 도달하세요', check: s => s.economy.fundingStage >= 6 },
    { id: 'millionaire', name: '백만 달러', desc: '자금 $1M을 달성하세요', check: s => s.resources.funds >= 1_000_000 },
    { id: 'unicorn', name: '유니콘', desc: '기업가치 $1B을 달성하세요', check: s => s.economy.valuation >= 1_000_000_000 },
    { id: 'team_10', name: '작은 연구소', desc: '인재 10명을 확보하세요', check: s => s.talents.length >= 10 },
    { id: 'team_50', name: 'AI 군단', desc: '인재 50명을 확보하세요', check: s => s.talents.length >= 50 },
    { id: 'datacenter', name: '데이터센터 완공', desc: '데이터센터를 운영 상태로 만드세요', check: s => (s.economy.datacenters || []).some(d => d.operational) },
    { id: 'market_10', name: '시장 진입', desc: '시장 점유율 10%를 달성하세요', check: s => s.reputation.marketShare >= 10 },
    { id: 'market_30', name: '주요 사업자', desc: '시장 점유율 30%를 달성하세요', check: s => s.reputation.marketShare >= 30 },
    { id: 'safety_stack', name: '안전 우선', desc: '안전 기술 5개를 완료하세요', check: s => _completedByCategory(s, 'safety') >= 5 },
    { id: 'chip_stack', name: '칩 워크숍', desc: '칩 기술 3개를 완료하세요', check: s => _completedByCategory(s, 'chip') >= 3 },
    { id: 'no_cloud', name: '자체 인프라', desc: '보유 GPU가 클라우드 GPU보다 많아지세요', check: s => s.economy.ownedGPUs > 0 && s.economy.ownedGPUs > s.economy.cloudGPUs },
    { id: 'good_public', name: '좋은 시민', desc: '공공 이미지 30 이상을 달성하세요', check: s => (s.reputation.publicImage || 0) >= 30 },
    { id: 'investor_trust', name: '믿을 수 있는 CEO', desc: '투자자 신뢰 75 이상을 달성하세요', check: s => s.reputation.investorTrust >= 75 },
    { id: 'agi', name: '특이점', desc: 'AGI를 달성하세요', check: s => s.gameResult === 'singularity' },
    { id: 'safety_leader', name: '안전 리더', desc: '안전 리더 엔딩을 달성하세요', check: s => s.gameResult === 'safety_leader' },
    { id: 'market_dominance', name: '시장 지배자', desc: '시장 지배 엔딩을 달성하세요', check: s => s.gameResult === 'market_dominance' },
    { id: 'talent_exodus', name: '인재 유출', desc: '퇴사자가 경쟁사를 설립하게 두세요', event: true },
    { id: 'survive_bankruptcy', name: '벼랑 끝', desc: '런웨이 3개월 이하를 경험하세요', check: s => s.economy.runway <= 3 && s.economy.runway > 0 },
    { id: 'rich_revenue', name: '매출 머신', desc: '월 매출 $1M을 달성하세요', check: s => s.resources.monthlyIncome >= 1_000_000 }
];

function _localizeAchievement(achievement) {
    return {
        ...achievement,
        name: t(`achievement.${achievement.id}.name`, achievement.name),
        desc: t(`achievement.${achievement.id}.desc`, achievement.desc)
    };
}

export class AchievementSystem {
    constructor({ onUnlock } = {}) {
        this.onUnlock = onUnlock || (() => {});
        this.unlocked = {};
        this.ready = this._load();
    }

    async _load() {
        const raw = await storageGetItem(STORAGE_KEY);
        if (!raw) return;
        try {
            this.unlocked = JSON.parse(raw) || {};
        } catch {
            this.unlocked = {};
        }
    }

    async _save() {
        await storageSetItem(STORAGE_KEY, JSON.stringify(this.unlocked));
    }

    async checkAll(state) {
        await this.ready;
        const newlyUnlocked = [];
        for (const achievement of ACHIEVEMENTS) {
            if (this.unlocked[achievement.id] || !achievement.check) continue;
            if (achievement.check(state)) {
                newlyUnlocked.push(this._unlockNow(achievement));
            }
        }
        if (newlyUnlocked.length > 0) await this._save();
        return newlyUnlocked;
    }

    async unlock(id) {
        await this.ready;
        const achievement = ACHIEVEMENTS.find(a => a.id === id);
        if (!achievement || this.unlocked[id]) return null;
        const unlocked = this._unlockNow(achievement);
        await this._save();
        return unlocked;
    }

    _unlockNow(achievement) {
        const localizedAchievement = _localizeAchievement(achievement);
        const unlocked = {
            id: achievement.id,
            unlockedAt: Date.now(),
            gameDate: window.game?.time?.getDateString?.() || null
        };
        this.unlocked[achievement.id] = unlocked;
        void steam.unlockAchievement(achievement.id);
        this.onUnlock(localizedAchievement, unlocked);
        return localizedAchievement;
    }

    getAll() {
        return ACHIEVEMENTS.map(achievement => ({
            ..._localizeAchievement(achievement),
            unlocked: Boolean(this.unlocked[achievement.id]),
            unlockedAt: this.unlocked[achievement.id]?.unlockedAt || null,
            gameDate: this.unlocked[achievement.id]?.gameDate || null
        }));
    }

    getSummary() {
        const total = ACHIEVEMENTS.length;
        const unlocked = ACHIEVEMENTS.filter(a => this.unlocked[a.id]).length;
        return { unlocked, total };
    }
}

function _completedTechs(state) {
    return Object.values(state.technologies || {}).filter(t => t.completed).length;
}

function _completedByCategory(state, category) {
    return Object.entries(state.technologies || {}).filter(([id, tech]) =>
        tech.completed && TECH_TREE[id]?.category === category
    ).length;
}

function _bestModel(state) {
    return Math.max(...(state.models || []).map(m => m.compositeScore || m.performance || 0), 0);
}
