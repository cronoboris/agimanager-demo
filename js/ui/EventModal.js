import { EVENT_CATEGORIES } from '../game/Event.js';
import { getEventChoicePreviewEntries } from '../game/EventPreview.js';
import { icon } from './icons.js';
import { t } from '../i18n.js';
import { getEventPulseType } from './feedbackPolicy.js';
import { getUIGrammar } from './uiGrammar.js';

function _localizedEventCategory(categoryId) {
    const cat = EVENT_CATEGORIES[categoryId] || { name: '이벤트', color: '#64748b', icon: '📢' };
    return {
        ...cat,
        name: t(`event.category.${categoryId}`, cat.name)
    };
}

function _localizedEventTitle(event) {
    return event ? t(`event.${event.id}.title`, event.title) : '';
}

function _localizedEventDescription(event) {
    return event ? t(`event.${event.id}.description`, event.description) : '';
}

function _localizedEventChoiceText(eventId, index, choice) {
    return choice ? t(`event.${eventId}.choice_${index}`, choice.text) : '';
}

function _localizedEventChoiceHint(eventId, index, choice) {
    if (!choice?.effectHint) return '';
    return t(`event.${eventId}.choice_${index}_hint`, choice.effectHint);
}

function _localizedEventChoiceLockedHint(eventId, index, choice) {
    if (!choice?.lockedHint) return '';
    return t(`event.${eventId}.choice_${index}_locked`, choice.lockedHint);
}

function _choiceKarmaBadge(choice) {
    if (!choice?.karma || !Object.values(choice.karma).some(Boolean)) return '';
    return `<span class="choice-karma-badge">${icon('alert', 11)} ${t('event.choice.karma', '윤리적 대가')}</span>`;
}

function _choiceEffectPreviewHtml(choice) {
    const entries = getEventChoicePreviewEntries(choice);
    if (!entries.length) return '';
    return `<div class="event-choice-preview">${entries.map(entry => `
        <div class="event-effect-line event-effect-line--${entry.tone || 'neutral'}">
            <span class="event-effect-line__icon">${entry.icon || '•'}</span>
            <span>${entry.text}</span>
        </div>
    `).join('')}</div>`;
}

function _formatEventEffects(game, effects) {
    if (!effects) return '';
    const lines = [];
    const fx = (cls, ic, txt) => `<span class="${cls}" style="display:inline-flex;align-items:center;gap:3px">${icon(ic, 13)} ${txt}</span>`;
    const shortNum = typeof game?._shortNum === 'function'
        ? (value) => game._shortNum(value)
        : (value) => Math.round(value).toLocaleString();
    if (effects.funds > 0) lines.push(fx('fx-positive', 'funds', t('event.effect.funds_up', '자금 +{value}', { value: '$' + shortNum(effects.funds) })));
    if (effects.funds < 0) lines.push(fx('fx-negative', 'funds', t('event.effect.funds_down', '자금 -{value}', { value: '$' + shortNum(Math.abs(effects.funds)) })));
    if (effects.aiFavorability > 0) lines.push(fx('fx-positive', 'globe', t('event.effect.ai_favor_up', 'AI 호감도 +{value}', { value: effects.aiFavorability })));
    if (effects.aiFavorability < 0) lines.push(fx('fx-negative', 'globe', t('event.effect.ai_favor_down', 'AI 호감도 {value}', { value: effects.aiFavorability })));
    if (effects.investorTrust > 0) lines.push(fx('fx-positive', 'trendUp', t('event.effect.investor_trust_up', '투자자 신뢰 +{value}', { value: effects.investorTrust })));
    if (effects.investorTrust < 0) lines.push(fx('fx-negative', 'trendDown', t('event.effect.investor_trust_down', '투자자 신뢰 {value}', { value: effects.investorTrust })));
    if (effects.gpuPriceChange > 0) lines.push(fx('fx-negative', 'gpu', t('event.effect.gpu_up', 'GPU 가격 상승')));
    if (effects.gpuPriceChange < 0) lines.push(fx('fx-positive', 'gpu', t('event.effect.gpu_down', 'GPU 가격 하락')));
    if (effects.gpuPriceMult > 1) lines.push(fx('fx-negative', 'gpu', t('event.effect.gpu_spike', 'GPU 가격 급등')));
    if (effects.globalAILevel > 0) lines.push(fx('fx-neutral', 'model', t('event.effect.global_ai_level_up', '글로벌 AI 수준 +{value}', { value: effects.globalAILevel })));
    if (effects.competitorBoost > 0) lines.push(fx('fx-warning', 'zap', t('event.effect.competitor_boost', '경쟁사 연구력 상승')));
    if (effects.reputation > 0) lines.push(fx('fx-positive', 'star', t('event.effect.reputation_up', '평판 +{value}', { value: effects.reputation })));
    if (effects.reputation < 0) lines.push(fx('fx-negative', 'star', t('event.effect.reputation_down', '평판 {value}', { value: effects.reputation })));
    if (effects.unemployment) {
        const industries = Object.entries(effects.unemployment);
        const increasing = industries.filter(([, v]) => v > 0);
        if (increasing.length > 0) lines.push(fx('fx-warning', 'barChart', t('event.effect.unemployment_up', '실업률 상승')));
    }
    if (effects.valuationMult && effects.valuationMult < 1) lines.push(fx('fx-negative', 'diamond', t('event.effect.valuation_down', '기업가치 하락')));
    if (effects.morale > 0) lines.push(fx('fx-positive', 'heart', t('event.effect.morale_up', '사기 +{value}', { value: effects.morale })));
    if (effects.morale < 0) lines.push(fx('fx-negative', 'heart', t('event.effect.morale_down', '사기 {value}', { value: effects.morale })));
    return lines.length > 0 ? `<div class="event-effects-grid">${lines.join('')}</div>` : '';
}

export function showEventPopup(game) {
    const event = game.events.getPendingEvent();
    if (!event) return;
    const pulseCountry = game._getEventPulseCountry(event);
    if (pulseCountry) {
        game.showMapEventPulse(pulseCountry, getEventPulseType(event));
    }

    const cat = _localizedEventCategory(event.category);
    const dateStr = game.time.getShortDate();
    const queueCount = game.events.eventQueue?.length || 0;
    const queueBadge = queueCount > 0 ? `<span class="event-queue-badge">+${queueCount}</span>` : '';
    const popup = document.getElementById('popup');

    if (event.type === 'world') {
        popup.innerHTML = `
            <div class="popup-content event-popup" data-ui-grammar="${getUIGrammar(event.category)}">
                <div class="event-category-bar" style="background:${cat.color}">
                    <span class="event-cat-label">${cat.icon} ${cat.name}</span>
                    <span class="event-date-label">${dateStr} ${queueBadge}</span>
                </div>
                <h3>${event.icon || cat.icon} ${_localizedEventTitle(event)}</h3>
                <p class="event-description">${_localizedEventDescription(event)}</p>
                ${_formatEventEffects(game, event.effects)}
                <div class="popup-buttons">
                    <button class="btn btn-primary" onclick="game._dismissCurrentEvent()">${t('common.confirm', '확인')}</button>
                </div>
            </div>
        `;
    } else {
        popup.innerHTML = `
            <div class="popup-content event-popup" data-ui-grammar="${getUIGrammar(event.category)}">
                <div class="event-category-bar" style="background:${cat.color}">
                    <span class="event-cat-label">${cat.icon} ${cat.name}</span>
                    <span class="event-date-label">${dateStr} ${queueBadge}</span>
                </div>
                <h3>${event.icon || cat.icon} ${_localizedEventTitle(event)}</h3>
                <p class="event-description">${_localizedEventDescription(event)}</p>
                <div class="event-choices">
                    ${(event.choices || []).map((c, i) => {
                        const locked = c.requiredTech && !game.state.technologies[c.requiredTech]?.completed;
                        const choiceText = _localizedEventChoiceText(event.id, i, c);
                        const choiceHint = _localizedEventChoiceHint(event.id, i, c);
                        const karmaBadge = _choiceKarmaBadge(c);
                        if (locked) {
                            return `<button class="btn btn-choice disabled" disabled style="opacity:0.35;cursor:not-allowed;border-style:dashed">
                                <span class="choice-text">${icon('lock', 13)} ${choiceText}</span>
                                ${choiceHint ? `<span class="choice-hint">${choiceHint}</span>` : ''}
                                ${_choiceEffectPreviewHtml(c)}
                                ${karmaBadge}
                                <span class="choice-hint" style="color:var(--danger)">${_localizedEventChoiceLockedHint(event.id, i, c) || t('event.requires_tech', '기술 연구 필요')}</span>
                            </button>`;
                        }
                        return `<button class="btn btn-choice" onclick="game._resolveCurrentEvent(${i})">
                            <span class="choice-text">${choiceText}</span>
                            ${choiceHint ? `<span class="choice-hint">${choiceHint}</span>` : ''}
                            ${_choiceEffectPreviewHtml(c)}
                            ${karmaBadge}
                        </button>`;
                    }).join('')}
                </div>
            </div>
        `;
    }
    popup.classList.add('show');
}

export function renderParadoxEventModal(game, message, type) {
    let modalContainer = document.getElementById('paradox-event-modal');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'paradox-event-modal';
        modalContainer.className = 'paradox-modal-overlay';
        document.body.appendChild(modalContainer);
    }

    const entry = message && typeof message === 'object' ? message : null;
    const bodyMessage = entry?.message || String(message || '');
    game._paradoxModalState = { entry: entry || { message: bodyMessage }, type };

    let title = t('modal.notice', '알림');
    if (type === 'success') title = t('modal.research_complete', '연구 달성');
    else if (type === 'urgent') title = t('modal.critical_warning', '치명적 경고');
    else if (type === 'milestone') title = t('modal.historic_turning_point', '역사적 전환점');
    else if (type === 'event') title = t('modal.global_news', '글로벌 뉴스');

    modalContainer.innerHTML = `
        <div class="paradox-modal-content">
            <div class="paradox-modal-header">${icon('diamond', 16)} ${title}</div>
            <div class="paradox-modal-body">${bodyMessage}</div>
            <div class="paradox-modal-footer">
                <button class="btn btn-primary btn-large" style="width:100%" onclick="document.getElementById('paradox-event-modal').classList.remove('show'); game._restorePreEventPauseState();">${t('common.confirm', '확인')}</button>
            </div>
        </div>
    `;

    // Small timeout to allow CSS transition
    setTimeout(() => modalContainer.classList.add('show'), 10);
}
