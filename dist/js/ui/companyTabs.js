export const COMPANY_TABS = [
    { id: 'overview', labelKey: 'company.tab_overview', fallback: '회사' },
    { id: 'gpu', labelKey: 'company.tab_gpu', fallback: 'GPU' },
    { id: 'data', labelKey: 'company.tab_data', fallback: '데이터' },
    { id: 'competitors', labelKey: 'company.tab_competitors', fallback: '경쟁사 분석' },
    { id: 'management', labelKey: 'company.tab_management', fallback: '경영' },
    { id: 'services', labelKey: 'company.tab_services', fallback: '서비스 운영' },
    { id: 'report', labelKey: 'company.report', fallback: '보고서' }
];

export function getCompanyTabById(tabId) {
    return COMPANY_TABS.find(tab => tab.id === tabId) || COMPANY_TABS[0];
}
