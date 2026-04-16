import { t } from '../i18n.js';

let _bar = null;

export function buildStickyInfoBarHTML(state = {}) {
    const cash = Number(state.funds ?? state.resources?.funds ?? 0);
    const runwayMonths = calculateRunwayMonths(state);
    const bottleneck = detectBottleneck(state);
    const threat = detectTopThreat(state);
    const deadline = detectNextDeadline(state);

    return `
        <section class="sticky-info-bar" role="status" aria-live="polite" aria-atomic="true">
            <article class="sib-item sib-cash" data-sib="cash" aria-label="${escapeHtml(t('sib.cash', '자금'))}">
                <span class="sib-label">${escapeHtml(t('sib.cash', '자금'))}</span>
                <span class="sib-value" data-sib-value="cash">${escapeHtml(abbreviateNumber(cash))}</span>
                <span class="sib-sub" data-sib-value="runway">${escapeHtml(formatRunway(runwayMonths))}</span>
            </article>
            <article class="sib-item sib-bottleneck" data-sib="bottleneck" aria-label="${escapeHtml(t('sib.bottleneck', '병목'))}">
                <span class="sib-label">${escapeHtml(t('sib.bottleneck', '병목'))}</span>
                <span class="sib-value" data-sib-value="bottleneck">${escapeHtml(bottleneck.label)}</span>
            </article>
            <article class="sib-item sib-threat" data-sib="threat" aria-label="${escapeHtml(t('sib.threat', '위협'))}">
                <span class="sib-label">${escapeHtml(t('sib.threat', '위협'))}</span>
                <span class="sib-value" data-sib-value="threat">${escapeHtml(threat)}</span>
            </article>
            <article class="sib-item sib-deadline" data-sib="deadline" aria-label="${escapeHtml(t('sib.deadline', '다음 일정'))}">
                <span class="sib-label">${escapeHtml(t('sib.deadline', '다음 일정'))}</span>
                <span class="sib-value" data-sib-value="deadline">${escapeHtml(deadline)}</span>
            </article>
        </section>
    `.trim();
}

export function initStickyInfoBar(root = getDocumentBody()) {
    if (!root || typeof document === 'undefined') return null;
    if (_bar) return _bar;

    _bar = document.createElement('div');
    _bar.id = 'sticky-info-bar';
    _bar.innerHTML = buildStickyInfoBarHTML();
    root.appendChild(_bar);
    return _bar;
}

export function updateStickyInfoBar(state = {}) {
    if (!_bar) {
        initStickyInfoBar();
    }
    if (!_bar) return null;

    _bar.innerHTML = buildStickyInfoBarHTML(state);
    return _bar;
}

export function destroyStickyInfoBar() {
    if (_bar && typeof _bar.remove === 'function') {
        _bar.remove();
    }
    _bar = null;
}

export function detectBottleneck(state = {}) {
    const checks = [
        {
            id: 'gpu',
            label: t('sib.gpuShortage', 'GPU 부족'),
            score: Number(state.compute?.gpuUtilization || 0) >= 90 ? 4 : 0,
            severity: 'critical'
        },
        {
            id: 'funds',
            label: t('sib.fundShortage', '자금 부족'),
            score: calculateRunwayMonths(state) <= 3 ? 3 : 0,
            severity: 'critical'
        },
        {
            id: 'talent',
            label: t('sib.talentShortage', '인재 부족'),
            score: Number(state.talents?.length || 0) < 5 ? 2 : 0,
            severity: 'warning'
        },
        {
            id: 'morale',
            label: t('sib.lowMorale', '사기 저하'),
            score: Number(state.morale ?? 50) < 30 ? 1 : 0,
            severity: 'warning'
        }
    ];

    checks.sort((a, b) => b.score - a.score);
    return checks[0].score > 0
        ? checks[0]
        : { id: 'none', label: t('sib.none', '양호'), score: 0, severity: 'ok' };
}

export function detectTopThreat(state = {}) {
    const competitors = Array.isArray(state.competitors) ? state.competitors : [];
    if (competitors.length === 0) return '-';

    const top = competitors.reduce((best, current) => {
        const bestScore = competitorScore(best);
        const currentScore = competitorScore(current);
        return currentScore > bestScore ? current : best;
    });

    return top?.name ? String(top.name) : '-';
}

export function detectNextDeadline(state = {}) {
    const deadlines = [];

    if (state.currentTraining?.estimatedCompletion != null) {
        deadlines.push({
            label: t('sib.trainingDone', '훈련 완료'),
            value: toNumericDeadline(state.currentTraining.estimatedCompletion)
        });
    }

    if (state.board?.nextMeetingMonth != null) {
        deadlines.push({
            label: t('sib.boardMeeting', '이사회'),
            value: toNumericDeadline(state.board.nextMeetingMonth)
        });
    }

    if (state.economy?.nextFundingMonth != null) {
        deadlines.push({
            label: t('sib.fundingRound', '투자 라운드'),
            value: toNumericDeadline(state.economy.nextFundingMonth)
        });
    }

    const next = deadlines
        .filter(entry => Number.isFinite(entry.value))
        .sort((a, b) => a.value - b.value)[0];

    return next ? next.label : '-';
}

export function calculateRunwayMonths(state = {}) {
    const cash = Number(state.funds ?? state.resources?.funds ?? 0);
    const expenses = Number(
        state.economy?.totalExpenses ??
        state.economy?.monthlyExpense ??
        state.resources?.monthlyExpense ??
        0
    );
    const revenue = Number(
        state.economy?.totalRevenue ??
        state.economy?.monthlyIncome ??
        state.resources?.monthlyIncome ??
        0
    );
    const burn = expenses - revenue;
    if (burn <= 0) return Infinity;
    return Math.max(0, Math.floor(cash / burn));
}

function competitorScore(competitor = {}) {
    return Number(competitor.stats?.researchPower || 0) + Number(competitor.aiLevel || 0);
}

function formatRunway(runwayMonths) {
    if (runwayMonths === Infinity) return t('sib.runwayStable', '무한');
    return `${runwayMonths}${t('sib.months', '개월')}`;
}

function abbreviateNumber(value) {
    const num = Number(value || 0);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
    return `${num.toLocaleString()}`;
}

function toNumericDeadline(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object') {
        const year = Number(value.year);
        const month = Number(value.month);
        if (Number.isFinite(year) && Number.isFinite(month)) {
            return year * 12 + month;
        }
    }
    return Number.NaN;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getDocumentBody() {
    if (typeof document === 'undefined') return null;
    return document.body || null;
}
