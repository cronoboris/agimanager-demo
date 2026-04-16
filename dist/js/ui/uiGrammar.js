const CATEGORY_GRAMMAR_MAP = {
    economic: 'corporate',
    ai_industry: 'corporate',
    energy: 'corporate',
    milestone: 'corporate',
    regulatory: 'government',
    geopolitical: 'government',
    military: 'government',
    social: 'media',
    tech: 'media',
    technology: 'media',
    disaster: 'crisis'
};

export function getUIGrammar(category) {
    return CATEGORY_GRAMMAR_MAP[category] || 'corporate';
}

export function applyUIGrammar(element, category) {
    if (!element) return;
    element.setAttribute('data-ui-grammar', getUIGrammar(category));
}
