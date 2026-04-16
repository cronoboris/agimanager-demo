import { t } from '../i18n.js';
import { ICONS } from './icons.js';

export function createMonthSnapshot(input = {}) {
    const state = _resolveState(input);
    const revenue = calculateRevenueBreakdown(state);
    const expenses = calculateExpenseBreakdown(state);

    return {
        funds: _getFunds(state),
        revenueTotal: revenue.total,
        expenseTotal: expenses.total,
        talentCount: _getTalentCount(state),
        modelCount: Array.isArray(state?.models) ? state.models.length : 0,
        techCount: _getCompletedTechCount(state),
        timestamp: Date.now()
    };
}

export function buildMonthlyReportData(input = {}, prevSnapshot = null) {
    if (_looksLikeMonthlyReportData(input)) {
        return _normalizeReportData(input);
    }

    const state = _resolveState(input);
    const revenue = calculateRevenueBreakdown(state);
    const expenses = calculateExpenseBreakdown(state);
    const funds = _getFunds(state);
    const report = {
        periodLabel: _getPeriodLabel(input, state),
        title: t('report.title', '월간 보고서'),
        revenue,
        expenses,
        netIncome: revenue.total - expenses.total,
        runway: expenses.total > 0 ? Math.floor(funds / expenses.total) : Infinity,
        changes: []
    };

    if (prevSnapshot) {
        report.changes = detectMonthlyChanges(state, prevSnapshot, revenue, expenses);
    }

    return report;
}

export function renderMonthlyReportHtml(report = {}) {
    const normalized = _normalizeReportData(report);
    const title = escapeHtml(normalized.title || t('report.title', '월간 보고서'));
    const periodLabel = normalized.periodLabel ? ` <span class="monthly-report__period">${escapeHtml(normalized.periodLabel)}</span>` : '';
    const revenueRows = _renderBreakdownRows(normalized.revenue.byChannel, 'report.revenue', '매출');
    const expenseRows = _renderBreakdownRows(normalized.expenses.items, 'report.expenses', '비용');

    return `
        <section class="monthly-report">
            <header class="monthly-report__header">
                <div class="monthly-report__icon">${ICONS.barChart || '📊'}</div>
                <div>
                    <h3 class="monthly-report__title">${title}${periodLabel}</h3>
                    <div class="monthly-report__subtitle">${escapeHtml(t('report.subheading', '운영과 재무의 월간 요약'))}</div>
                </div>
            </header>
            <div class="monthly-report__grid">
                <article class="monthly-report__card">
                    <div class="monthly-report__label">${escapeHtml(t('report.revenue', '매출'))}</div>
                    <div class="monthly-report__value monthly-report__value--positive">${formatMoney(normalized.revenue.total)}</div>
                    ${revenueRows}
                </article>
                <article class="monthly-report__card">
                    <div class="monthly-report__label">${escapeHtml(t('report.expenses', '비용'))}</div>
                    <div class="monthly-report__value monthly-report__value--negative">${formatMoney(normalized.expenses.total)}</div>
                    ${expenseRows}
                </article>
                <article class="monthly-report__card">
                    <div class="monthly-report__label">${escapeHtml(t('report.netIncome', '순이익'))}</div>
                    <div class="monthly-report__value ${normalized.netIncome >= 0 ? 'monthly-report__value--positive' : 'monthly-report__value--negative'}">
                        ${formatSignedMoney(normalized.netIncome)}
                    </div>
                </article>
                <article class="monthly-report__card">
                    <div class="monthly-report__label">${escapeHtml(t('report.runway', '런웨이'))}</div>
                    <div class="monthly-report__value">${normalized.runway === Infinity ? '∞' : `${normalized.runway}${t('report.months', '개월')}`}</div>
                </article>
            </div>
            ${normalized.changes.length > 0 ? `
                <div class="monthly-report__changes">
                    <h4 class="monthly-report__changes-title">${escapeHtml(t('report.changes', '전월 대비 변화'))}</h4>
                    ${normalized.changes.map(change => `
                        <div class="monthly-report__change ${change.value >= 0 ? 'monthly-report__change--positive' : 'monthly-report__change--negative'}">
                            <span class="monthly-report__change-label">${escapeHtml(change.label)}</span>
                            <span class="monthly-report__change-value">${change.format === 'currency' ? formatSignedMoney(change.value) : formatSignedNumber(change.value)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </section>
    `;
}

export function generateMonthlyReport(input = {}, prevSnapshot = null) {
    const report = buildMonthlyReportData(input, prevSnapshot);
    return renderMonthlyReportHtml(report);
}

export function calculateRevenueBreakdown(input = {}) {
    const state = _resolveState(input);
    const source = _pickNumericMap(state?.economy?.revenue) || _pickNumericMap(state?.revenue);
    const fallbackTotal = _safeNumber(state?.resources?.monthlyIncome ?? state?.monthlyIncome ?? 0);
    const totalFromBreakdown = _sumValues(source);
    const total = totalFromBreakdown > 0 ? totalFromBreakdown : fallbackTotal;
    const byChannel = Object.keys(source).length > 0 ? source : (total > 0 ? { other: total } : {});

    if (Object.keys(source).length > 0 && total > totalFromBreakdown) {
        byChannel.other = (byChannel.other || 0) + (total - totalFromBreakdown);
    }

    return { byChannel, total };
}

export function calculateExpenseBreakdown(input = {}) {
    const state = _resolveState(input);
    const source = _pickNumericMap(state?.economy?.expenses) || _pickNumericMap(state?.expenses);
    const fallbackTotal = _safeNumber(state?.resources?.monthlyExpense ?? state?.monthlyExpense ?? 0);
    const totalFromBreakdown = _sumValues(source);
    const total = totalFromBreakdown > 0 ? totalFromBreakdown : fallbackTotal;
    const items = Object.keys(source).length > 0 ? source : (total > 0 ? { other: total } : {});

    if (Object.keys(source).length > 0 && total > totalFromBreakdown) {
        items.other = (items.other || 0) + (total - totalFromBreakdown);
    }

    return { items, total };
}

export function detectMonthlyChanges(input = {}, prevSnapshot = {}, revenue = null, expenses = null) {
    const state = _resolveState(input);
    const nextRevenue = revenue || calculateRevenueBreakdown(state);
    const nextExpenses = expenses || calculateExpenseBreakdown(state);
    const changes = [];

    _pushChange(changes, t('report.fundsChange', '자금 변동'), _getFunds(state), prevSnapshot?.funds, 'currency');
    _pushChange(changes, t('report.revenueChange', '매출 변동'), nextRevenue.total, prevSnapshot?.revenueTotal, 'currency');
    _pushChange(changes, t('report.expenseChange', '비용 변동'), nextExpenses.total, prevSnapshot?.expenseTotal, 'currency');
    _pushChange(changes, t('report.teamChange', '팀 규모 변동'), _getTalentCount(state), prevSnapshot?.talentCount, 'number');
    _pushChange(changes, t('report.modelChange', '모델 수 변동'), Array.isArray(state?.models) ? state.models.length : 0, prevSnapshot?.modelCount, 'number');
    _pushChange(changes, t('report.techChange', '완료 기술 변동'), _getCompletedTechCount(state), prevSnapshot?.techCount, 'number');

    return changes;
}

function _resolveState(input = {}) {
    if (!input || typeof input !== 'object') return {};

    const candidate = input.state;
    if (candidate && typeof candidate === 'object') {
        const looksLikeState = candidate.resources || candidate.economy || candidate.talents || candidate.models || candidate.player;
        if (looksLikeState) return candidate;
    }

    return input;
}

function _looksLikeMonthlyReportData(input = {}) {
    return Boolean(input && typeof input === 'object' && ('revenue' in input || 'expenses' in input || 'netIncome' in input || 'runway' in input));
}

function _normalizeReportData(report = {}) {
    const revenue = report.revenue && typeof report.revenue === 'object'
        ? {
            byChannel: _pickNumericMap(report.revenue.byChannel || report.revenue.items || report.revenue.breakdown || {}),
            total: _safeNumber(report.revenue.total ?? _sumValues(report.revenue.byChannel || report.revenue.items || report.revenue.breakdown || {}))
        }
        : { byChannel: {}, total: 0 };

    const expenses = report.expenses && typeof report.expenses === 'object'
        ? {
            items: _pickNumericMap(report.expenses.items || report.expenses.byItem || report.expenses.breakdown || {}),
            total: _safeNumber(report.expenses.total ?? _sumValues(report.expenses.items || report.expenses.byItem || report.expenses.breakdown || {}))
        }
        : { items: {}, total: 0 };

    const netIncome = Number.isFinite(Number(report.netIncome))
        ? Number(report.netIncome)
        : revenue.total - expenses.total;

    const runway = report.runway != null ? report.runway : (expenses.total > 0 ? Math.floor(_safeNumber(report.funds ?? 0) / expenses.total) : Infinity);

    return {
        title: report.title || t('report.title', '월간 보고서'),
        periodLabel: report.periodLabel || '',
        revenue,
        expenses,
        netIncome,
        runway,
        changes: Array.isArray(report.changes) ? report.changes : []
    };
}

function _getPeriodLabel(input = {}, state = {}) {
    const date = input?.time?.currentDate || input?.currentDate || state?.date || state?.time?.currentDate || null;
    if (!date || !Number.isFinite(Number(date.year)) || !Number.isFinite(Number(date.month))) return '';
    return `${Number(date.year)}년 ${Number(date.month)}월`;
}

function _getFunds(state = {}) {
    return _safeNumber(state?.resources?.funds ?? state?.funds ?? state?.economy?.funds ?? 0);
}

function _getTalentCount(state = {}) {
    return Array.isArray(state?.talents) ? state.talents.length : 0;
}

function _getCompletedTechCount(state = {}) {
    const technologies = state?.technologies;
    if (!technologies || typeof technologies !== 'object') return 0;

    return Object.values(technologies).filter(tech => {
        if (!tech || typeof tech !== 'object') return false;
        if (tech.completed === true) return true;
        const progress = Number(tech.progress);
        const cost = Number(tech.cost);
        return Number.isFinite(progress) && Number.isFinite(cost) && cost > 0 && progress >= cost;
    }).length;
}

function _safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function _pickNumericMap(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

    return Object.fromEntries(
        Object.entries(source)
            .map(([key, value]) => [key, _safeNumber(value, 0)])
            .filter(([, value]) => value !== 0)
    );
}

function _sumValues(map = {}) {
    return Object.values(map).reduce((sum, value) => sum + _safeNumber(value, 0), 0);
}

function _pushChange(target, label, currentValue, previousValue, format) {
    const previous = Number(previousValue);
    if (!Number.isFinite(previous)) return;

    const current = _safeNumber(currentValue, 0);
    const diff = current - previous;
    if (diff === 0) return;

    target.push({ label, value: diff, format });
}

function _renderBreakdownRows(items = {}, fallbackKey = 'report.breakdown', fallbackLabel = '') {
    const entries = Object.entries(items);
    if (entries.length === 0) {
        return fallbackLabel ? `<div class="monthly-report__breakdown monthly-report__breakdown--empty">${escapeHtml(fallbackLabel)}</div>` : '';
    }

    return `
        <ul class="monthly-report__breakdown">
            ${entries.map(([label, value]) => `
                <li class="monthly-report__breakdown-item">
                    <span class="monthly-report__breakdown-label">${escapeHtml(t(`${fallbackKey}.${label}`, label))}</span>
                    <span class="monthly-report__breakdown-value">${formatMoney(value)}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

function formatMoney(value = 0) {
    return `$${Math.abs(_safeNumber(value, 0)).toLocaleString('en-US')}`;
}

function formatSignedMoney(value = 0) {
    return `${_safeNumber(value, 0) >= 0 ? '+' : '-'}${formatMoney(value)}`;
}

function formatSignedNumber(value = 0) {
    const n = _safeNumber(value, 0);
    return `${n >= 0 ? '+' : '-'}${Math.abs(n).toLocaleString('en-US')}`;
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
