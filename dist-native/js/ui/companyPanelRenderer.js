import { getCompanyTabById } from './companyTabs.js';

function renderStatRow(row = {}) {
    if (!row) return '';
    const rowClass = row.rowClassName ? ` ${row.rowClassName}` : '';
    const rowStyle = row.rowStyle ? ` style="${row.rowStyle}"` : '';
    const labelStyle = row.labelStyle ? ` style="${row.labelStyle}"` : '';
    const valueStyle = row.valueStyle ? ` style="${row.valueStyle}"` : '';
    const valueClass = row.valueClassName ? ` class="${row.valueClassName}"` : '';
    return `<div class="stat-row${rowClass}"${rowStyle}><span${labelStyle}>${row.label || ''}</span><span${valueClass}${valueStyle}>${row.value || ''}</span></div>`;
}

function renderActionButtons(actions = []) {
    if (!actions.length) return '';
    return `
        <div class="company-action-row">
            ${actions.map(action => `
                <button class="btn btn-small${action.className ? ` ${action.className}` : ''}" onclick="${action.onclick}">
                    ${action.label}
                </button>
            `).join('')}
        </div>
    `;
}

function renderPanel(title, bodyHtml) {
    return `
        <div class="panel">
            <h3>${title}</h3>
            ${bodyHtml}
        </div>
    `;
}

export function renderCompanyOverviewPanels(overview = {}) {
    const companyPanel = renderPanel(
        overview.company?.title || '',
        `${(overview.company?.rows || []).map(renderStatRow).join('')}`
    );

    const finance = overview.finance || {};
    const financePanel = renderPanel(
        finance.title || '',
        `
            ${renderStatRow(finance.fundsOnHand)}
            ${renderStatRow(finance.runway)}
            <h4 style="margin-top:8px;color:var(--success)">${finance.incomeTitle || ''}</h4>
            ${(finance.incomeRows || []).map(renderStatRow).join('')}
            <h4 style="margin-top:8px;color:var(--danger)">${finance.expenseTitle || ''}</h4>
            ${(finance.expenseRows || []).map(renderStatRow).join('')}
            ${renderStatRow(finance.balance)}
        `
    );

    const fundraisingPanel = renderPanel(
        overview.fundraising?.title || '',
        overview.fundraising?.bodyHtml || ''
    );

    const globalStatus = overview.globalStatus || {};
    const globalPanel = renderPanel(
        globalStatus.title || '',
        `
            ${renderStatRow(globalStatus.aiFavorability)}
            ${renderStatRow(globalStatus.aiLevel)}
            <h4 style="margin-top:10px">${globalStatus.unemploymentTitle || ''}</h4>
            ${(globalStatus.unemploymentRows || []).map(renderStatRow).join('')}
        `
    );

    return [companyPanel, financePanel, fundraisingPanel, globalPanel].join('');
}

export function renderCompanyGpuPanels(gpu = {}) {
    const summary = gpu.summary || {};
    const fleet = gpu.fleet || {};
    const chipPrograms = gpu.chipPrograms || {};

    return [
        renderPanel(
            summary.title || '',
            `
                ${(summary.rows || []).map(renderStatRow).join('')}
                ${renderActionButtons(summary.actions || [])}
            `
        ),
        renderPanel(
            fleet.title || '',
            `
                ${fleet.itemsHtml || `<p class="company-empty-state">${fleet.emptyText || ''}</p>`}
                ${fleet.pendingHtml ? `
                    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                        <h4>${fleet.pendingTitle || ''}</h4>
                        ${fleet.pendingHtml}
                    </div>
                ` : ''}
            `
        ),
        renderPanel(chipPrograms.title || '', chipPrograms.bodyHtml || '')
    ].join('');
}

export function renderCompanyDataPanels(data = {}) {
    const summary = data.summary || {};
    const inventory = data.inventory || {};

    return [
        renderPanel(
            summary.title || '',
            `
                ${(summary.rows || []).map(renderStatRow).join('')}
                ${renderActionButtons(summary.actions || [])}
            `
        ),
        renderPanel(
            inventory.title || '',
            inventory.itemsHtml || `<p class="company-empty-state">${inventory.emptyText || ''}</p>`
        )
    ].join('');
}

export function renderCompanyPanelHtml({ activeTabId, tabs = [], panelsByTabId = {} }) {
    const activeTab = getCompanyTabById(activeTabId);
    const selectedPanelHtml = panelsByTabId[activeTab.id] || panelsByTabId.overview || '';
    if (tabs.length <= 1) {
        return `
            <div class="panel-grid">
                ${selectedPanelHtml}
            </div>
        `;
    }

    return `
        <div class="company-subtabs">
            ${tabs.map(tab => `
                <button class="company-subtab ${tab.id === activeTab.id ? 'company-subtab--active' : ''}"
                    data-company-tab="${tab.id}"
                    onclick="game._companyTab='${tab.id}';game._renderCompany(document.getElementById('content-panel'))">
                    ${tab.label}
                </button>
            `).join('')}
        </div>
        <div class="panel-grid">
            ${selectedPanelHtml}
        </div>
    `;
}
