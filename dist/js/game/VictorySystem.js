/**
 * Victory System — 다양한 승리/패배 조건 + 점수 시스템
 */
import { TECH_TREE } from '../data/technologies.js';
import { t } from '../i18n.js';

const VICTORY_DEFS = {
    singularity: {
        icon: 'rocket',
        color: 'var(--success)',
        title: '특이점 달성!',
        msg: '당신의 AI가 인간 수준을 뛰어넘었습니다. 새로운 시대가 열립니다!',
        worldImpact: {
            ko: '당신의 AI는 새로운 기술 문명의 출발점이 되었다.',
            en: 'Your AI became the starting point of a new technological civilization.'
        },
        characterFates: { template: 'stayed' },
        legacyScoreModifier: 1.25
    },
    bankrupt: {
        icon: 'trendDown',
        color: 'var(--danger)',
        title: '파산',
        msg: '자금이 바닥났습니다. 회사는 문을 닫았습니다.',
        worldImpact: {
            ko: '초기 AI 경쟁의 한 장면으로 남았고, 남은 팀은 흩어졌다.',
            en: 'It became a footnote in the early AI race, and the remaining team dispersed.'
        },
        characterFates: { template: 'left' },
        legacyScoreModifier: 0.55
    },
    competitor_agi: {
        icon: 'alert',
        color: 'var(--warning)',
        title: '경쟁사 AGI 달성',
        msg: '경쟁사가 먼저 AGI를 달성했습니다!',
        worldImpact: {
            ko: '주도권은 경쟁사로 넘어갔고, 산업의 기준이 다시 쓰였다.',
            en: 'Leadership shifted to a rival, and the industry standard was rewritten.'
        },
        characterFates: { template: 'recruited' },
        legacyScoreModifier: 0.45
    },
    ipo_success: {
        icon: 'trendUp',
        color: 'var(--gold)',
        title: 'IPO 성공!',
        msg: '성공적인 상장! 세계적인 AI 기업으로 우뚝 섰습니다.',
        worldImpact: {
            ko: '자본 시장의 대표 사례가 되었고, 더 큰 확장을 준비했다.',
            en: 'It became a benchmark for the capital markets and prepared for even greater expansion.'
        },
        characterFates: { template: 'stayed' },
        legacyScoreModifier: 1.1
    },
    market_dominance: {
        icon: 'trophy',
        color: 'var(--accent)',
        title: '시장 지배',
        msg: 'AI 시장의 절반 이상을 차지했습니다. 독보적인 위치!',
        worldImpact: {
            ko: '산업의 관성이 당신을 중심으로 재편되었다.',
            en: 'The entire industry gravity reorganized around your company.'
        },
        characterFates: { template: 'stayed' },
        legacyScoreModifier: 1.2
    },
    safety_leader: {
        icon: 'shield',
        color: 'var(--success)',
        title: '안전 AI 리더',
        msg: '안전하고 신뢰받는 AI를 구축했습니다. 인류에 기여하는 기업!',
        worldImpact: {
            ko: '신뢰 가능한 AI의 기준을 세우며 업계의 안전 규범을 바꾸었다.',
            en: 'You set the standard for trustworthy AI and changed industry safety norms.'
        },
        characterFates: { template: 'stayed' },
        legacyScoreModifier: 1.15
    },
    time_limit: {
        icon: 'clock',
        color: 'var(--text-secondary)',
        title: '2031년 — 시대의 끝',
        msg: '13년간의 AI 경쟁이 끝났습니다. 당신의 성적표는?',
        worldImpact: {
            ko: '게임은 끝났지만, 당신이 바꾼 세계는 계속 굴러간다.',
            en: 'The game is over, but the world you changed keeps moving.'
        },
        characterFates: { template: 'retired' },
        legacyScoreModifier: 1
    },
    public_infra: {
        icon: 'globe',
        color: 'var(--success)',
        title: '공공 인프라형 AGI',
        msg: '안전하고 투명한 AGI를 공공 인프라로 전환했습니다. 인류 전체가 혜택을 누립니다.',
        worldImpact: {
            ko: 'AGI가 전력·수도처럼 공공재가 되어 불평등을 획기적으로 줄였다.',
            en: 'AGI became public infrastructure, dramatically reducing inequality.'
        },
        characterFates: { template: 'stayed' },
        legacyScoreModifier: 1.3
    },
    military_hegemony: {
        icon: 'alert',
        color: 'var(--danger)',
        title: '군산복합체형 패권',
        msg: '군사 계약과 정부 의존으로 패권적 AI 제국을 건설했습니다. 세계는 두려움에 떱니다.',
        worldImpact: {
            ko: '군사 AI가 세계 질서를 재편했다. 새로운 냉전이 시작되었다.',
            en: 'Military AI reshaped world order. A new cold war begins.'
        },
        characterFates: { template: 'recruited' },
        legacyScoreModifier: 0.7
    },
    open_source_liberation: {
        icon: 'circlePlay',
        color: 'var(--accent)',
        title: '오픈소스 해방',
        msg: 'AGI를 오픈소스로 공개했습니다. 통제권은 사라졌지만, 인류 전체가 AI의 주인이 됩니다.',
        worldImpact: {
            ko: 'AGI 코드가 공개되어 수천 개의 파생 프로젝트가 탄생했다. 혼돈과 혁신이 공존한다.',
            en: 'Open-sourced AGI spawned thousands of forks. Chaos and innovation coexist.'
        },
        characterFates: { template: 'founded' },
        legacyScoreModifier: 1.1
    },
    ethical_failure: {
        icon: 'heart',
        color: 'var(--warning)',
        title: '윤리적 유산',
        msg: 'AGI에는 도달하지 못했지만, 안전과 윤리의 기준을 세웠습니다. 후대가 당신의 원칙 위에 AGI를 완성합니다.',
        worldImpact: {
            ko: '당신의 안전 프레임워크가 업계 표준이 되어 10년 뒤 안전한 AGI를 가능케 했다.',
            en: 'Your safety framework became industry standard, enabling safe AGI a decade later.'
        },
        characterFates: { template: 'stayed' },
        legacyScoreModifier: 1
    },
    acquisition: {
        icon: 'handshake',
        color: 'var(--text-secondary)',
        title: '인수합병',
        msg: '더 큰 기업에 인수되었습니다. 당신의 기술은 살아남았지만, 독립성은 사라졌습니다.',
        worldImpact: {
            ko: '인수 기업이 당신의 기술로 시장을 지배했다. 창업자는 역사 속으로 사라졌다.',
            en: 'The acquirer dominated with your tech. The founder faded into history.'
        },
        characterFates: { template: 'recruited' },
        legacyScoreModifier: 0.5
    },
    internal_coup: {
        icon: 'alert',
        color: 'var(--danger)',
        title: 'CEO 실각',
        msg: '이사회가 반란을 일으켰습니다. 당신은 자신이 세운 회사에서 쫓겨났습니다.',
        worldImpact: {
            ko: '새 경영진이 방향을 완전히 전환했다. 당신의 비전은 폐기되었다.',
            en: 'New management reversed course. Your vision was scrapped.'
        },
        characterFates: { template: 'left' },
        legacyScoreModifier: 0.3
    },
    state_absorption: {
        icon: 'shield',
        color: 'var(--warning)',
        title: '국가 흡수',
        msg: '정부가 회사를 국유화했습니다. AI는 이제 국가의 도구입니다.',
        worldImpact: {
            ko: '국가 통제 AI가 감시와 통제의 수단이 되었다. 민간 AI 연구는 위축되었다.',
            en: 'State-controlled AI became a surveillance tool. Private AI research withered.'
        },
        characterFates: { template: 'recruited' },
        legacyScoreModifier: 0.4
    }
};

function _localizedVictoryDef(result, def = VICTORY_DEFS[result]) {
    const base = def || VICTORY_DEFS.time_limit;
    return {
        ...base,
        title: t(`victory.${result}.title`, base.title),
        msg: t(`victory.${result}.msg`, base.msg)
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

        if (this._checkInternalCoup()) {
            return this._trigger('internal_coup');
        }

        if (this._checkAcquisition()) {
            return this._trigger('acquisition');
        }

        if (s.resources.funds <= 0 && s.getMonthlyBalance() < 0) {
            return this._trigger('bankrupt');
        }

        const bestPerf = this._getPlayerBestPerformance();
        if (bestPerf >= 100) {
            return this._trigger(this._classifySingularityEnding());
        }

        if (s.economy.fundingStage >= 6 && s.economy.valuation >= 10_000_000_000 && s.economy.ownershipPct >= 10) {
            return this._trigger('ipo_success');
        }

        if (s.reputation.marketShare >= 50) {
            s.marketDominanceMonths = (s.marketDominanceMonths || 0) + 1;
            if (s.marketDominanceMonths >= 6) {
                return this._trigger('market_dominance');
            }
        } else {
            s.marketDominanceMonths = 0;
        }

        if (this._checkSafetyLeader()) {
            return this._trigger('safety_leader');
        }

        const maxYear = this.state.player?.build?.demoMaxYear || 2031;
        if (time.currentDate.year >= maxYear) {
            if (this._checkEthicalFailure()) {
                return this._trigger('ethical_failure');
            }
            if (this._checkStateAbsorption()) {
                return this._trigger('state_absorption');
            }
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
        const safetyTechs = Object.entries(TECH_TREE)
            .filter(([, tech]) => tech.category === 'safety')
            .map(([id]) => id);

        if (safetyTechs.length === 0) return false;

        const allSafetyDone = safetyTechs.every(id => this.state.technologies[id]?.completed);
        if (!allSafetyDone) return false;

        const hasSafeModel = this.state.models.some(m => m.deployed && m.capabilities?.safety >= 80);
        if (!hasSafeModel) return false;

        return this.state.reputation.publicImage >= 50;
    }

    _classifySingularityEnding() {
        const s = this.state;
        const safetyScore = this._getSafetyScore();
        const accountability = Number(s.culture?.accountability ?? s.culture?.discipline ?? 50);
        if (safetyScore > 80 && accountability > 70) {
            return 'public_infra';
        }

        const govRevenue = Number(s.service?.totalGovernmentContracts || 0);
        const totalRevenue = Math.max(1, Number(s.service?.totalMonthlyRevenue || 1));
        const govRatio = govRevenue / totalRevenue;
        if (s.karma?.militaryContract && govRatio > 0.5) {
            return 'military_hegemony';
        }

        const osModels = Array.isArray(s.openSourceModels) ? s.openSourceModels.length : 0;
        const osShare = Number(s.service?.totalOpenSourceUsers || 0) /
            Math.max(1, Number(s.service?.totalUsers || 1));
        if (osModels >= 2 && osShare > 0.4) {
            return 'open_source_liberation';
        }

        return 'singularity';
    }

    _checkEthicalFailure() {
        const s = this.state;
        if (this._getPlayerBestPerformance() >= 100) return false;
        const safetyScore = this._getSafetyScore();
        return safetyScore > 60 && Number(s.reputation.publicImage || 0) > 70;
    }

    _checkAcquisition() {
        const s = this.state;
        if (!Array.isArray(s.competitors) || s.competitors.length === 0) return false;

        const strongest = s.competitors.reduce((a, b) =>
            (Number(a.aiLevel || 0) > Number(b.aiLevel || 0)) ? a : b
        );

        const playerStruggling = Number(s.resources.funds || 0) < 50_000 && Number(s.reputation.marketShare || 0) < 2;
        const competitorDominant = Number(strongest.aiLevel || 0) > 95;
        return playerStruggling && competitorDominant;
    }

    _checkInternalCoup() {
        const s = this.state;
        s.board ||= { confidence: 55, pressure: 0, seats: 1 };
        const boardConfidence = Number(s.board.confidence || 0);
        const underPressure = boardConfidence < 20 || Number(s.board.pressure || 0) > 80;

        if (underPressure) {
            s._boardCrisisMonths = Number(s._boardCrisisMonths || 0) + 1;
        } else {
            s._boardCrisisMonths = 0;
        }

        return s._boardCrisisMonths >= 6;
    }

    _checkStateAbsorption() {
        const s = this.state;
        const hasGovContract = Boolean(s.karma?.militaryContract) || Number(s.service?.totalGovernmentContracts || 0) > 0;
        const tension = Number(s.global?.geopoliticalTension || 0);
        const effects = Array.isArray(s.persistentEffects)
            ? s.persistentEffects
            : Array.isArray(s.activeEffects)
                ? s.activeEffects
                : [];
        const hasStateDrivenPolicy = effects.some(effect => effect?.type === 'country_policy' && effect.modifiers?.stateDriven);

        return hasGovContract && hasStateDrivenPolicy && tension > 70;
    }

    _getSafetyScore() {
        const s = this.state;
        const safetyTechs = Object.entries(TECH_TREE)
            .filter(([, tech]) => tech.category === 'safety');
        if (safetyTechs.length === 0) return 0;

        const doneFraction = safetyTechs.filter(([id]) => s.technologies[id]?.completed).length / safetyTechs.length;
        const modelSafety = Math.max(0, ...s.models.filter(m => m.deployed).map(m => Number(m.capabilities?.safety || 0)));
        const safetyPosture = Number(s.safety?.posture || 0);
        return doneFraction * 50 + modelSafety * 0.5 + safetyPosture * 0.25;
    }

    // ─── 점수 계산 ───

    calculateScore() {
        const s = this.state;
        let score = 0;

        const bestPerf = Math.max(...s.models.map(m => m.compositeScore || m.performance || 0), 0);
        score += Math.min(30, bestPerf * 0.3);

        score += Math.min(20, s.reputation.marketShare * 0.4);

        const totalTechs = Object.keys(TECH_TREE).length;
        const completed = Object.values(s.technologies).filter(t => t.completed).length;
        score += Math.min(15, (completed / totalTechs) * 15);

        const valBillion = s.economy.valuation / 1_000_000_000;
        score += Math.min(15, valBillion * 1.5);

        const safetyTechs = Object.entries(TECH_TREE)
            .filter(([, tech]) => tech.category === 'safety');
        const safetyDone = safetyTechs.filter(([id]) => s.technologies[id]?.completed).length;
        const safetyRatio = safetyTechs.length > 0 ? safetyDone / safetyTechs.length : 0;
        score += Math.min(10, safetyRatio * 10);

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

    getLegacyScoreModifier(result) {
        return Number(this.getResultDef(result)?.legacyScoreModifier || 1);
    }

    isLoss(result) {
        return result === 'bankrupt'
            || result === 'competitor_agi'
            || result === 'acquisition'
            || result === 'internal_coup'
            || result === 'state_absorption';
    }
}
