/**
 * Victory System — 다양한 승리/패배 조건 + 점수 시스템
 *
 * 7가지 엔딩:
 * - singularity: 플레이어 AGI 달성
 * - bankrupt: 파산
 * - competitor_agi: 경쟁사 AGI 선점
 * - ipo_success: IPO 성공
 * - market_dominance: 시장 지배
 * - safety_leader: 안전 리더
 * - time_limit: 2031년 도달 (점수 평가)
 */
import { TECH_TREE } from '../data/technologies.js';
import { t } from '../i18n.js';

const VICTORY_DEFS = {
    singularity: {
        icon: 'rocket', color: 'var(--success)',
        title: '특이점 달성!',
        msg: '당신의 AI가 인간 수준을 뛰어넘었습니다. 새로운 시대가 열립니다!'
    },
    bankrupt: {
        icon: 'trendDown', color: 'var(--danger)',
        title: '파산',
        msg: '자금이 바닥났습니다. 회사는 문을 닫았습니다.'
    },
    competitor_agi: {
        icon: 'alert', color: 'var(--warning)',
        title: '경쟁사 AGI 달성',
        msg: '경쟁사가 먼저 AGI를 달성했습니다!'
    },
    ipo_success: {
        icon: 'trendUp', color: 'var(--gold)',
        title: 'IPO 성공!',
        msg: '성공적인 상장! 세계적인 AI 기업으로 우뚝 섰습니다.'
    },
    market_dominance: {
        icon: 'trophy', color: 'var(--accent)',
        title: '시장 지배',
        msg: 'AI 시장의 절반 이상을 차지했습니다. 독보적인 위치!'
    },
    safety_leader: {
        icon: 'shield', color: 'var(--success)',
        title: '안전 AI 리더',
        msg: '안전하고 신뢰받는 AI를 구축했습니다. 인류에 기여하는 기업!'
    },
    time_limit: {
        icon: 'clock', color: 'var(--text-secondary)',
        title: '2031년 — 시대의 끝',
        msg: '13년간의 AI 경쟁이 끝났습니다. 당신의 성적표는?'
    }
};

function _localizedVictoryDef(result, def = VICTORY_DEFS[result]) {
    return {
        ...def,
        title: t(`victory.${result}.title`, def.title),
        msg: t(`victory.${result}.msg`, def.msg)
    };
}

export class VictorySystem {
    constructor(gameState) {
        this.state = gameState;
    }

    /**
     * 매월 호출 — 승리/패배 조건 체크
     * @param {object} time - TimeSystem reference
     * @returns {object|null} { result, ...VICTORY_DEFS[result] } or null
     */
    checkMonthly(time) {
        const s = this.state;
        if (s.gameOver) return null;

        // 패배: 파산
        if (s.resources.funds <= 0 && s.getMonthlyBalance() < 0) {
            return this._trigger('bankrupt');
        }

        // 승리: 플레이어 AGI
        const bestPerf = this._getPlayerBestPerformance();
        if (bestPerf >= 100) {
            return this._trigger('singularity');
        }

        // 승리: IPO 성공
        if (s.economy.fundingStage >= 6 && s.economy.valuation >= 10_000_000_000 && s.economy.ownershipPct >= 10) {
            return this._trigger('ipo_success');
        }

        // 승리: 시장 지배 (50%+ 6개월 연속)
        if (s.reputation.marketShare >= 50) {
            s.marketDominanceMonths = (s.marketDominanceMonths || 0) + 1;
            if (s.marketDominanceMonths >= 6) {
                return this._trigger('market_dominance');
            }
        } else {
            s.marketDominanceMonths = 0;
        }

        // 승리: 안전 리더
        if (this._checkSafetyLeader()) {
            return this._trigger('safety_leader');
        }

        // 시간 종료: 2031년 (데모: 설정값 사용)
        const maxYear = this.state.player?.build?.demoMaxYear || 2031;
        if (time.currentDate.year >= maxYear) {
            return this._trigger('time_limit');
        }

        return null;
    }

    _trigger(result) {
        this.state.gameOver = true;
        this.state.gameResult = result;
        return { result, ..._localizedVictoryDef(result) };
    }

    _getPlayerBestPerformance() {
        if (this.state.models.length === 0) return 0;
        return Math.max(...this.state.models
            .filter(m => m.deployed)
            .map(m => m.compositeScore || m.performance || 0), 0);
    }

    _checkSafetyLeader() {
        // 안전 카테고리 기술 전부 완료
        const safetyTechs = Object.entries(TECH_TREE)
            .filter(([, t]) => t.category === 'safety')
            .map(([id]) => id);

        if (safetyTechs.length === 0) return false;

        const allSafetyDone = safetyTechs.every(id =>
            this.state.technologies[id]?.completed
        );
        if (!allSafetyDone) return false;

        // 배포 모델 중 안전 능력 80+
        const hasSafeModel = this.state.models.some(m =>
            m.deployed && m.capabilities?.safety >= 80
        );
        if (!hasSafeModel) return false;

        // 공공 이미지 50+
        return this.state.reputation.publicImage >= 50;
    }

    // ─── 점수 계산 ───

    calculateScore() {
        const s = this.state;
        let score = 0;

        // 모델 성능 (30점)
        const bestPerf = Math.max(
            ...s.models.map(m => m.compositeScore || m.performance || 0), 0
        );
        score += Math.min(30, bestPerf * 0.3);

        // 시장 점유율 (20점)
        score += Math.min(20, s.reputation.marketShare * 0.4);

        // 기술 진척 (15점)
        const totalTechs = Object.keys(TECH_TREE).length;
        const completed = Object.values(s.technologies).filter(t => t.completed).length;
        score += Math.min(15, (completed / totalTechs) * 15);

        // 기업 가치 (15점)
        const valBillion = s.economy.valuation / 1_000_000_000;
        score += Math.min(15, valBillion * 1.5);

        // 안전 (10점)
        const safetyTechs = Object.entries(TECH_TREE)
            .filter(([, t]) => t.category === 'safety');
        const safetyDone = safetyTechs.filter(([id]) =>
            s.technologies[id]?.completed
        ).length;
        const safetyRatio = safetyTechs.length > 0 ? safetyDone / safetyTechs.length : 0;
        score += Math.min(10, safetyRatio * 10);

        // 지분율 (10점)
        score += Math.min(10, s.economy.ownershipPct * 0.1);

        return Math.round(score);
    }

    getGrade(score) {
        if (score >= 90) return 'S';
        if (score >= 75) return 'A';
        if (score >= 60) return 'B';
        if (score >= 45) return 'C';
        if (score >= 30) return 'D';
        return 'F';
    }

    getGradeColor(grade) {
        const colors = { S: 'var(--gold)', A: 'var(--success)', B: 'var(--accent)', C: 'var(--text-primary)', D: 'var(--warning)', F: 'var(--danger)' };
        return colors[grade] || 'var(--text-primary)';
    }

    getResultDef(result) {
        return _localizedVictoryDef(result, VICTORY_DEFS[result] || VICTORY_DEFS.time_limit);
    }

    isLoss(result) {
        return result === 'bankrupt' || result === 'competitor_agi';
    }
}
