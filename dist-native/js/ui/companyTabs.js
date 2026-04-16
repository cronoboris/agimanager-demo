export const COMPANY_TABS = [
    { id: 'overview', labelKey: 'company.tab_overview', fallback: '회사' }
];

export function getCompanyTabById(tabId) {
    return COMPANY_TABS.find(tab => tab.id === tabId) || COMPANY_TABS[0];
}
