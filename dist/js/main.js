import { GameState } from './game/GameState.js';
import { TimeSystem } from './game/TimeSystem.js';
import { SimulationClock } from './game/SimulationClock.js';
import { captureEventPauseState, restoreEventPauseState } from './game/eventPauseState.js';
import { TechTree } from './game/TechTree.js';
import { CompanySystem } from './game/Company.js';
import { EventSystem, EVENT_CATEGORIES } from './game/Event.js';
import { MarketSystem } from './game/Market.js';
import { EconomySystem, FUNDING_ROUNDS, getFundingRoundName } from './game/EconomySystem.js';
import {
    getModelBenchmarks,
    getRelativePerformance,
    getRelativePerformancePercent,
    getRelativePerformanceTier,
    getTeamResearchPower,
    calculateDataMixFit,
    estimateTrainingDays,
    getAvailableGPUs,
    getComputeBudget,
    getFleetStats,
    getGpuById,
    getMarketExpectations,
    getModelComputeQualityBonus,
    getParameterScaleRequirements,
    getServiceTFLOPS,
    getTotalDataTB,
    syncStateEconomyCompatibility,
    getBestDeployedModel
} from './game/ComputeSystem.js';
import {
    canStartChipProgram,
    getChipProgramCatalog,
    processChipProgramsMonthly,
    previewChipProgram,
    startChipProgram
} from './game/ChipProgramSystem.js';
import {
    INTERNAL_AI_SLOTS,
    assignInternalAISlot,
    clearInternalAISlot,
    getInternalAIBonus,
    recalculateInternalAITotalMonthlyCost
} from './game/InternalAISystem.js';
import { getEventChoicePreviewEntries } from './game/EventPreview.js';
import { COUNTRIES, PLAYABLE_COUNTRIES, REGIONS, COUNTRIES_BY_REGION } from './data/countries.js';
import { TECH_TREE, TECH_CATEGORIES, ROUTE_INFO } from './data/technologies.js';
import { BALANCE } from './data/balance.js';
import { GPU_CATALOG, GPU_EVENTS } from './data/gpus.js';
import { generateTalent, SPECIALTIES, PERSONALITIES, PERSONALITY_TRAITS, IDEOLOGIES } from './data/names.js';
import { VERSION } from './data/version.js';
import { renderWorldMap, initMapData, showMapEventPulse as showSvgMapEventPulse } from './ui/WorldMap.js';
import { WebGLMap } from './ui/WebGLMap.js';
import { GlobeMap } from './ui/GlobeMap.js';
import { MAP_MODES } from './ui/countryVisualPolicy.js';
import { triggerGlitch as triggerGlitchEffect } from './ui/glitch.js';
import { getEventPulseType, getFundsHealthClass } from './ui/feedbackPolicy.js';
import { MODEL_ARCHITECTURES, PARAMETER_SCALES, SCALE_ORDER, TRAINING_PHASES,
         CAPABILITY_BENCHMARKS, BENCHMARKS, BENCHMARK_WEIGHTS, DATA_TYPES, CAP_DATA_MAP,
         TECH_CAP_BONUSES, DEPLOYMENT_STRATEGIES } from './data/models.js';
import { DATA_METHODS as DATA_ACQUISITION_METHOD_MAP } from './data/dataAcquisition.js';
import { DATACENTER_LOCATIONS } from './data/datacenterLocations.js';
import { ICONS, icon } from './ui/icons.js';
import { computeSubsetTechTreeLayout } from './ui/techTreeLayout.js';
import { COMPANY_TABS, getCompanyTabById } from './ui/companyTabs.js';
import {
    renderCompanyDataPanels,
    renderCompanyGpuPanels,
    renderCompanyOverviewPanels,
    renderCompanyPanelHtml
} from './ui/companyPanelRenderer.js';
import { dismissAllToasts, toast, setIconFunction } from './ui/notifications.js';
import { initTooltips, buildTooltip, setTooltipDelay } from './ui/tooltips.js';
import { buildTermTooltipHtml, escapeTooltipAttr, loadGlossary, term, termValue } from './ui/glossaryTooltip.js';
import { ValueTracker } from './ui/animatedValue.js';
import { SaveManager, MAX_SLOTS } from './game/SaveManager.js';
import { VictorySystem } from './game/VictorySystem.js';
import { AchievementSystem } from './game/AchievementSystem.js';
import { StatsTracker } from './game/StatsTracker.js';
import { Tutorial } from './ui/Tutorial.js';
import { SoundSystem } from './ui/SoundSystem.js';
import { logger } from './ui/Logger.js';
import { storageGetItemSync, storageRemoveItem, storageSetItem } from './utils/storage.js';
import { getLocale, getSavedLocale, initLocale, setLocale, t } from './i18n.js';
import { showEventPopup, renderParadoxEventModal } from './ui/EventModal.js';
import { showGameOver } from './ui/EndingScreen.js';
import { buildMonthlyReportData, createMonthSnapshot, renderMonthlyReportHtml } from './ui/MonthlyReport.js';
import { checkActTransition, getCampaignData, initCampaign } from './game/CampaignSystem.js';
import { initBoard, processMonthlyBoardCulture, processQuarterlyBoard } from './game/BoardSystem.js';
import { calculateRegionalMarketShare, getCountryPolicy, getCountryPolicyEffects, getRegionsData, initGeopolitics, processGeopoliticsCycle } from './game/GeopoliticsSystem.js';
import { checkRegulationTrigger, createIncidentEvent, processMonthlyServiceOps } from './game/ServiceOpsSystem.js';
import { processMonthlySafety } from './game/SafetySystem.js';
import { processPersistentEffects } from './game/PersistentEffectSystem.js';
import {
    addDataAsset,
    calculateTrainingDataQuality,
    normalizeDataStateCompatibility,
    processMonthlyData,
    startDataAcquisition as startDataAcquisitionAction
} from './game/DataSystem.js';
import {
    checkDatacenterConstructionEvent,
    checkDatacenterOperationalEvent
} from './game/DatacenterEvents.js';
import { applyMoodToDocument } from './ui/MoodSystem.js';
import { collectBreakdown, renderBreakdownTooltip } from './ui/breakdownTooltips.js';
import { initStickyInfoBar, updateStickyInfoBar, detectBottleneck, detectTopThreat } from './ui/StickyInfoBar.js';
import { steam } from './utils/steamBridge.js';
import {
    DEFAULT_SETTINGS,
    SETTINGS_KEY,
    UI_SCALE_OPTIONS,
    loadGameSettingsSync,
    normalizeGameSettings,
    parseResolutionValue,
    saveGameSettingsSync
} from './game/GameSettings.js';
import {
    clampServicePriceMult,
    getServicePriceBand,
    isFreeServiceChannel
} from './game/ServicePricing.js';
import { renderSettingsModalContent } from './ui/settingsModal.js';

const MAP_MODE_KEY = 'agimanager_map_mode';
const DEFAULT_ACCESSIBILITY_SETTINGS = Object.freeze({
    reducedMotion: false,
    highContrast: false,
    fontScale: 1
});

function _normalizeAccessibilitySettings(input = {}) {
    const uiScale = Number(input.uiScale ?? input.fontScale * 100);
    const normalizedUiScale = Number.isFinite(uiScale) ? uiScale : 100;
    return {
        reducedMotion: Boolean(input.reducedMotion),
        highContrast: Boolean(input.highContrast),
        fontScale: Math.max(0.75, Math.min(1.5, normalizedUiScale / 100))
    };
}

function _getAccessibilitySettingsSync() {
    const settings = loadGameSettingsSync();
    return _normalizeAccessibilitySettings(settings.display);
}

function _applyAccessibilitySettings(settings, doc = document) {
    if (!doc?.body || !doc?.documentElement) return settings;
    const normalized = _normalizeAccessibilitySettings(settings);
    doc.body.dataset.reduceMotion = normalized.reducedMotion ? '1' : '0';
    doc.body.dataset.highContrast = normalized.highContrast ? '1' : '0';
    doc.documentElement.dataset.fontScale = normalized.fontScale > 1.05 ? 'large' : normalized.fontScale < 0.99 ? 'small' : 'normal';
    doc.documentElement.style.fontSize = `${16 * normalized.fontScale}px`;
    return normalized;
}

function _getMenuSoundSystem() {
    if (typeof window === 'undefined') return null;
    if (window.game?.sound) return window.game.sound;
    if (!window.__menuSoundSystem) {
        window.__menuSoundSystem = new SoundSystem();
    }
    return window.__menuSoundSystem;
}

function _getCurrentSettings() {
    if (window.game?.settings) {
        return normalizeGameSettings(window.game.settings);
    }
    return loadGameSettingsSync();
}

function _syncLegacySettingMirrors(settings) {
    const normalized = normalizeGameSettings(settings);
    storageSetItem(MAP_MODE_KEY, normalized.display.mapRenderer);
}

function _syncDocumentSettings(settings, doc = document) {
    const normalized = normalizeGameSettings(settings);
    _applyAccessibilitySettings(normalized.display, doc);
    setTooltipDelay(normalized.gameplay.tooltipDelay);
    if (doc?.documentElement) {
        doc.documentElement.lang = normalized.gameplay.locale || getLocale();
    }
    return normalized;
}

function _applyAudioSettingsToActiveSystems(settings) {
    const normalized = normalizeGameSettings(settings);
    const targets = [];
    if (window.game?.sound) targets.push(window.game.sound);
    if (window.__menuSoundSystem && window.__menuSoundSystem !== window.game?.sound) {
        targets.push(window.__menuSoundSystem);
    }

    for (const soundSystem of targets) {
        soundSystem?.applyGameSettings?.(normalized.audio);
    }
}

function _applyMapInteractionSettings(settings) {
    const normalized = normalizeGameSettings(settings);
    const globeOptions = {
        edgePan: normalized.controls.edgePan,
        zoomSpeed: normalized.controls.zoomSpeed,
        panSpeed: normalized.controls.panSpeed,
        reducedMotion: normalized.display.reducedMotion
    };
    window.game?.globeMap?.applyControlSettings?.(globeOptions);
    window.game?.webglMap?.applySettings?.(globeOptions);
    _bgGlobe?.applyControlSettings?.({
        ...globeOptions,
        edgePan: false
    });
}

async function _syncRuntimeSettings(settings, { rerender = true, reopenSettings = false } = {}) {
    const normalized = saveGameSettingsSync(settings);
    _syncLegacySettingMirrors(normalized);
    _syncDocumentSettings(normalized);
    _applyAudioSettingsToActiveSystems(normalized);
    _applyMapInteractionSettings(normalized);

    if (window.game) {
        window.game.settings = normalized;
        window.game.mapModePreference = normalized.display.mapRenderer;
        window.game.saveManager?.setAutosavePolicy?.(normalized.gameplay.autosaveInterval, window.game);

        if (window.game.state?.gameStarted) {
            window.game._applyDisplayPreference?.(normalized.display);
            window.game._applyTooltipPreference?.(normalized.gameplay);
            if (rerender) {
                window.game.renderAll();
                window.game.renderContent();
            }
        }
    }

    if (reopenSettings) {
        await window.menuShowSettings(window.__settingsModalTab || 'display');
    }

    return normalized;
}

const RESEARCH_GROUPS = [
    {
        id: 'research',
        name: 'research.group_research',
        nameKo: '연구',
        color: '#4fc3f7',
        icon: 'brain',
        categories: ['foundation', 'model_arch', 'advanced_ai', 'frontier_ai', 'integration']
    },
    {
        id: 'service',
        name: 'research.group_service',
        nameKo: '서비스',
        color: '#a855f7',
        icon: 'diamond',
        categories: ['generative', 'product']
    },
    {
        id: 'infra',
        name: 'research.group_infra',
        nameKo: '인프라',
        color: '#eab308',
        icon: 'gpu',
        categories: ['chip', 'infra', 'energy']
    },
    {
        id: 'governance',
        name: 'research.group_governance',
        nameKo: '거버넌스',
        color: '#22c55e',
        icon: 'shield',
        categories: ['data', 'safety', 'quantum']
    }
];

const RESEARCH_GROUP_BY_CATEGORY = Object.fromEntries(
    RESEARCH_GROUPS.flatMap(group => group.categories.map(category => [category, group.id]))
);

const RESEARCH_ROUTE_COLORS = {
    llm: '#4fc3f7',
    world: '#ffb74d',
    synergy: '#ce93d8',
    common: '#6b7b8d'
};

function _relativePerformanceRevenueMultiplier(relativePerformance) {
    if (relativePerformance < 0.5) return relativePerformance * 0.1;
    if (relativePerformance < 1.0) return 0.2 + ((relativePerformance - 0.5) * 1.6);
    if (relativePerformance < 1.5) return 1.0 + ((relativePerformance - 1.0) * 1.5);
    return 1.75 + ((relativePerformance - 1.5) * 0.5);
}

function _benchmarkTierLabel(ratio) {
    const tier = getRelativePerformanceTier(ratio);
    return t(tier.key, tier.fallback);
}

const MODELS_TABS = [
    { id: 'development', icon: 'model', labelKey: 'models.tab.development', fallback: '개발' },
    { id: 'services', icon: 'rocket', labelKey: 'models.tab.services', fallback: '서비스' },
    { id: 'internal_ai', icon: 'brain', labelKey: 'models.tab.internal_ai', fallback: '내부 AI' }
];

const INTERNAL_AI_SLOT_META = {
    research_assist: { icon: 'brain', nameKey: 'internal_ai.slot.research_assist', fallback: '연구 지원', effectKey: 'internal_ai.effect.research_assist', effectFallback: '연구 속도' },
    coding_assist: { icon: 'zap', nameKey: 'internal_ai.slot.coding_assist', fallback: '코딩 지원', effectKey: 'internal_ai.effect.coding_assist', effectFallback: '훈련/칩 개발 속도' },
    data_refine: { icon: 'data', nameKey: 'internal_ai.slot.data_refine', fallback: '데이터 정제', effectKey: 'internal_ai.effect.data_refine', effectFallback: '데이터 품질' },
    business_assist: { icon: 'briefcase', nameKey: 'internal_ai.slot.business_assist', fallback: '경영 지원', effectKey: 'internal_ai.effect.business_assist', effectFallback: '투자 유치/오버헤드' },
    safety_audit: { icon: 'shield', nameKey: 'internal_ai.slot.safety_audit', fallback: '안전 감사', effectKey: 'internal_ai.effect.safety_audit', effectFallback: '안전 연구/이미지' }
};

const SERVICE_CHANNEL_META = {
    api: { icon: 'globe', nameKey: 'service.channel.api', fallback: 'API 서비스', descriptionKey: 'service.channel.api.desc', descriptionFallback: '개발자 API를 운영합니다.', defaultAllocation: 120, requiresTech: ['api_platform'] },
    consumer_chat: { icon: 'circlePlay', nameKey: 'service.channel.consumer_chat', fallback: '소비자 챗봇', descriptionKey: 'service.channel.consumer_chat.desc', descriptionFallback: '대규모 소비자 챗 서비스를 운영합니다.', defaultAllocation: 150, requiresTech: ['chatbot_product'] },
    enterprise: { icon: 'briefcase', nameKey: 'service.channel.enterprise', fallback: '엔터프라이즈', descriptionKey: 'service.channel.enterprise.desc', descriptionFallback: '기업 계약형 솔루션을 제공합니다.', defaultAllocation: 100, requiresTech: ['enterprise_integration'] },
    government: { icon: 'shield', nameKey: 'service.channel.government', fallback: '정부 계약', descriptionKey: 'service.channel.government.desc', descriptionFallback: '정부/공공 계약형 배포입니다.', defaultAllocation: 90, requiresTech: ['enterprise_integration'] },
    open_source: { icon: 'globe', nameKey: 'service.channel.open_source', fallback: '오픈소스', descriptionKey: 'service.channel.open_source.desc', descriptionFallback: '가중치를 공개합니다. 연산 비용 없음, 되돌릴 수 없음.', defaultAllocation: 0 },
    internal: { icon: 'brain', nameKey: 'service.channel.internal', fallback: '내부 활용', descriptionKey: 'service.channel.internal.desc', descriptionFallback: '회사 내부 업무에 모델을 투입합니다.', defaultAllocation: 40, requiresTech: ['code_gen'] },
    b2b_license: { icon: 'diamond', nameKey: 'service.channel.b2b_license', fallback: '타사 제공', descriptionKey: 'service.channel.b2b_license.desc', descriptionFallback: '타사에 라이선싱/API 제공을 합니다.', defaultAllocation: 80, requiresTech: ['enterprise_integration'] }
};

const DATA_TYPE_PROFILES = {
    web_text: { quality: 72, freshness: 85, bias: 18, legal: 8 },
    books: { quality: 84, freshness: 62, bias: 10, legal: 4 },
    code: { quality: 82, freshness: 75, bias: 10, legal: 6 },
    scientific: { quality: 90, freshness: 70, bias: 8, legal: 10 },
    images: { quality: 74, freshness: 80, bias: 22, legal: 12 },
    audio: { quality: 70, freshness: 82, bias: 18, legal: 12 },
    video: { quality: 76, freshness: 78, bias: 24, legal: 14 },
    synthetic: { quality: 60, freshness: 95, bias: 28, legal: 4 }
};

const DATA_METHOD_SPEED_LABELS = {
    purchase: { ko: '즉시', en: 'Instant' },
    partnership: { ko: '3개월', en: '3 months' },
    scraping: { ko: '1개월', en: '1 month' },
    synthetic: { ko: '2개월', en: '2 months' },
    userLogs: { ko: '자동', en: 'Passive' }
};

const DATA_ACQUISITION_METHODS = Object.values(DATA_ACQUISITION_METHOD_MAP).map((method) => ({
    ...method,
    speedLabel: DATA_METHOD_SPEED_LABELS[method.id] || { ko: method.speed || '', en: method.speed || '' }
}));

const LEGACY_UNLOCK_TECH_BY_ROUTE = {
    llm: 'gpt_architecture',
    world: 'vision_transformer',
    generative: 'diffusion',
    safety: 'rlhf',
    balanced: 'chain_of_thought'
};

function _pickLegacyUnlockTech(route) {
    return LEGACY_UNLOCK_TECH_BY_ROUTE[route] || 'transformer';
}

function _getLegacyBonusChoices() {
    return [
        {
            id: 'research_lab',
            title: t('legacy.bonus.research.title', '전설의 연구소'),
            desc: t('legacy.bonus.research.desc', '연구 속도 +5%'),
            effect: { modifiers: { researchSpeed: 1.05 } }
        },
        {
            id: 'open_source_pioneer',
            title: t('legacy.bonus.open_source.title', '오픈소스 유산'),
            desc: t('legacy.bonus.open_source.desc', '미완료 기술 1개를 즉시 해금'),
            effect: { unlockTech: true }
        },
        {
            id: 'investor_trust',
            title: t('legacy.bonus.investor.title', '투자자 신뢰'),
            desc: t('legacy.bonus.investor.desc', '투자자 신뢰 +10'),
            effect: { investorTrust: 10 }
        },
        {
            id: 'ai_legacy',
            title: t('legacy.bonus.ai.title', 'AI 유산'),
            desc: t('legacy.bonus.ai.desc', '내부 AI 슬롯 1개를 오픈소스 도우미로 채움'),
            effect: { internalAiSlot: true }
        }
    ];
}

function _localizedDataMethodName(method) {
    if (!method) return '';
    const locale = getLocale?.() || 'ko';
    return method.name?.[locale] || method.name?.ko || method.name?.en || method.id || '';
}

function _localizedDataMethodDescription(method) {
    if (!method) return '';
    const locale = getLocale?.() || 'ko';
    return method.description?.[locale] || method.description?.ko || method.description?.en || '';
}

function _localizedDataMethodSpeed(method) {
    if (!method) return '';
    const locale = getLocale?.() || 'ko';
    return method.speedLabel?.[locale] || method.speedLabel?.ko || method.speedLabel?.en || '';
}


// Demo mode (only exists in demo build, falls back to null in full version)
let DEMO = null;
try {
    const m = await import('./data/demo-config.js');
    DEMO = m.DEMO;
} catch { /* Not demo build — full version */ }

await initLocale(await getSavedLocale());
await loadGlossary();
_syncDocumentSettings(loadGameSettingsSync());
document.documentElement.lang = getLocale();

// Global error handler
window.addEventListener('error', (e) => logger.error('runtime', e.message, { file: e.filename, line: e.lineno }));
window.addEventListener('unhandledrejection', (e) => logger.error('promise', e.reason?.message || String(e.reason)));

// Native-feel Context Menu Blocker
document.addEventListener('contextmenu', e => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }
});

class Game {
    constructor() {
        this.settings = _getCurrentSettings();
        this.state = new GameState();
        this.time = new TimeSystem();
        this.clock = new SimulationClock(this.time);
        this.techTree = new TechTree(this.state);
        this.companies = new CompanySystem(this.state);
        this.events = new EventSystem(this.state);
        this.market = new MarketSystem(this.state);
        this.economy = new EconomySystem(this.state);
        this.victory = new VictorySystem(this.state);
        this.saveManager = new SaveManager();
        this.tutorial = new Tutorial(this);
        this.sound = new SoundSystem();
        this.stats = new StatsTracker();
        this.achievements = new AchievementSystem({
            onUnlock: (achievement) => {
                toast(t('news.achievement_unlocked_toast', '업적 달성: {name}', { name: achievement.name }), 'success');
                this.state.addNews({
                    key: 'news.achievement_unlocked',
                    fallback: '🏆 업적 달성: {name} — {description}',
                    params: {
                        name: {
                            __i18nKey: `achievement.${achievement.id}.name`,
                            fallback: achievement.name
                        },
                        description: {
                            __i18nKey: `achievement.${achievement.id}.desc`,
                            fallback: achievement.desc
                        }
                    }
                }, 'info');
                this.triggerSuccessImpact('normal', { soundId: 'notification' });
            }
        });

        this.currentTab = 'map';
        this._researchGroup = 'research';
        this._companyTab = 'overview';
        this._modelsTab = 'development';
        this._dataMethodId = 'purchase';
        this._dataTypeId = 'web_text';
        this._dataAmountTB = 1;
        this.talentMarket = [];
        this._dataStateWarnings = {
            freshnessMonth: null,
            legalMonth: null
        };
        this._steamProfile = { available: false, name: null };
        this._ensureDataState();
        void this._refreshSteamProfile();

        window.game = this;

        // Initialize UI systems
        setIconFunction(icon);
        initTooltips();
        this.valueTracker = new ValueTracker();
        this._unreadNewsCount = 0;
        this._lastViewedNewsTab = false;
        this._prevMonthResources = {};

        // Map transform state
        this.mapTransform = { x: 0, y: 0, scale: 1 };
        this.isDraggingMap = false;
        this.wasDraggingMap = false;
        this.lastDragPos = { x: 0, y: 0 };
        this._mapHoverCountry = null;
        this._mapEventsAttached = false;
        this.webglMap = null;
        this._webglMapDisabled = false;
        this.mapModePreference = this.settings.display.mapRenderer || storageGetItemSync(MAP_MODE_KEY) || 'globe';

        // Wrap addNews to fire toast notifications & Paradox Popups
        const origAddNews = this.state.addNews.bind(this.state);
        this.state.addNews = (message, type = 'info') => {
            const entry = origAddNews(message, type);
            const renderedMessage = entry?.message || (typeof message === 'string' ? message : '');
            if (['urgent', 'event', 'milestone', 'success', 'warning'].includes(entry.type) && this.state.gameStarted) {
                if (this.settings?.gameplay?.autoPauseOnEvent !== false) {
                    // Force pause — save previous speed for restore (only if not already paused by event)
                    if (!this._preEventPauseState) {
                        this._preEventPauseState = captureEventPauseState(this.time);
                    }
                    this.time.pause();
                }
                this._renderParadoxEventModal(entry, entry.type);
                // Sound based on type
                if (entry.type === 'danger' || entry.type === 'urgent') this.sound.play('warning');
                else if (entry.type !== 'success') this.sound.play('notification');
            } else {
                toast(renderedMessage, entry.type);
            }
            this._unreadNewsCount++;
            // Clamp unread to actual news log size (log is truncated to 200)
            const logSize = this.state.newsLog?.length || 0;
            if (this._unreadNewsCount > logSize) this._unreadNewsCount = logSize;
            return entry;
        };

        // Game logic callbacks
        this.clock.onHour(() => this._onHour());
        this.clock.onSixHours(() => this._onSixHours());
        this.clock.onDay(() => this._onDay());
        this.clock.onMonth(() => this._onMonth());
        this.clock.onQuarter(() => this._onQuarter());
        this.clock.onYear(() => this._onYear());

        // Decoupled render: rAF-driven UI updates
        this.time.onRender(() => this._onRender());
        this.time.onSpeedChange(() => this._onSpeedChange());

        // Keyboard shortcuts (Paradox-style)
        this._setupKeyboard();

        this.sound.applyGameSettings?.(this.settings.audio);
        this.saveManager.setAutosavePolicy?.(this.settings.gameplay.autosaveInterval, this);
    }

    _setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.defaultPrevented) return;
            if (!this.state.gameStarted || this.state.gameOver) return;
            if (this.tutorial?.isActive()) return;
            // Don't capture when typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            // ── ESC: 팝업/모달/패널 닫기 (최우선) ──
            if (e.code === 'Escape') {
                e.preventDefault();
                // 1. 일반 팝업 (국가 정보, 기술 상세 등)
                const popup = document.getElementById('popup');
                if (popup?.classList.contains('show')) {
                    popup.classList.remove('show');
                    return;
                }
                // 2. 세이브/로드 모달
                const saveModal = document.getElementById('saveload-modal');
                if (saveModal?.classList.contains('show')) {
                    saveModal.classList.remove('show');
                    return;
                }
                // 3. 메뉴 모달
                const menuModal = document.getElementById('menu-modal');
                if (menuModal) {
                    menuModal.remove();
                    return;
                }
                // 4. 패러독스 이벤트 모달 (이벤트는 ESC로 닫지 않음 — 선택 강제)
                // 5. 다른 탭이면 → 지도 탭으로
                if (this.currentTab !== 'map') {
                    this.switchTab('map');
                    return;
                }
                // 6. 지도 탭에서 ESC → 설정 모달 열기 (게임 종료 접근 가능)
                this._showInGameSettings();
                return;
            }

            // Block other shortcuts when modal is open
            if (document.querySelector('.popup-overlay.show, #popup.show, #menu-modal, #paradox-event-modal.show, #saveload-modal.show')) return;

            switch (e.code) {
                // ── 속도 조절 ──
                case 'Space':
                    e.preventDefault();
                    this.time.togglePause();
                    break;
                case 'Digit1': case 'Numpad1': this.time.setSpeed(1); break;
                case 'Digit2': case 'Numpad2': this.time.setSpeed(2); break;
                case 'Digit3': case 'Numpad3': this.time.setSpeed(3); break;
                case 'Digit4': case 'Numpad4': this.time.setSpeed(4); break;
                case 'Digit5': case 'Numpad5': this.time.setSpeed(5); break;
                case 'Equal': case 'NumpadAdd':
                    e.preventDefault();
                    this.time.speedUp();
                    break;
                case 'Minus': case 'NumpadSubtract':
                    e.preventDefault();
                    this.time.speedDown();
                    break;

                // ── 탭 전환 (사이드바 순서: F1~F10) ──
                case 'F1': e.preventDefault(); this.switchTab('map'); break;
                case 'F2': e.preventDefault(); this.switchTab('company'); break;
                case 'F3': e.preventDefault(); this.switchTab('research'); break;
                case 'F4': e.preventDefault(); this.switchTab('talent'); break;
                case 'F5': e.preventDefault(); this.switchTab('models'); break;
                case 'F6': e.preventDefault(); this.switchTab('gpu'); break;
                case 'F7': e.preventDefault(); this.switchTab('data'); break;
                case 'F8': e.preventDefault(); this.switchTab('leaderboard'); break;
                case 'F9': e.preventDefault(); this.switchTab('world'); break;
                case 'F10': e.preventDefault(); this.switchTab('news'); break;

                // ── 세이브/로드 ──
                case 'F11':
                    e.preventDefault();
                    this._showSaveLoadModal('save');
                    break;
                case 'F12':
                    e.preventDefault();
                    this._showSaveLoadModal('load');
                    break;
            }
        });
    }

    triggerGlitch(level = 'warning') {
        if (this.settings?.display?.reducedMotion) return null;
        const container = document.querySelector('.game-container');
        return triggerGlitchEffect(container, level);
    }

    triggerSuccessImpact(level = 'normal', { soundId = null, countryId = null, pulseType = 'success' } = {}) {
        const container = document.querySelector('.game-container');
        if (container) {
            const className = level === 'major' ? 'success-impact--major' : 'success-impact';
            container.classList.remove('success-impact', 'success-impact--major');
            void container.offsetWidth;
            container.classList.add(className);
            window.clearTimeout(this._successImpactTimer);
            this._successImpactTimer = window.setTimeout(() => {
                container.classList.remove('success-impact', 'success-impact--major');
            }, level === 'major' ? 320 : 220);
        }

        if (soundId) {
            this.sound.play(soundId);
        }

        if (countryId) {
            this.showMapEventPulse(countryId, pulseType);
        }
    }

    async start(companyName, country, build) {
        await initCampaign();
        await initGeopolitics();
        initBoard(this.state);
        const techRoute = build?.techRoute || 'llm';
        const ceoName = build?.ceoName?.trim?.() || t('company.default_ceo_name', 'Alex Kim');
        const ceoAvatar = build?.ceoAvatar || '👨‍💼';
        const ceoNationality = build?.ceoNationality || 'kr';
        this.state.player.ceoName = ceoName;
        this.state.player.ceoAvatar = ceoAvatar;
        this.state.player.ceoNationality = ceoNationality;
        this.state.player.companyName = companyName;
        this.state.player.country = country;
        this.state.player.techRoute = techRoute;
        this.state.player.build = build || {};
        if (DEMO) this.state.player.build.demoMaxYear = DEMO.maxYear;
        this.state.player.foundedDate = { ...this.time.currentDate };
        this.state.gameStarted = true;
        this.state.legacy.activeBonus = build?.legacyBonus?.id || null;

        // Apply build bonuses (from character creation steps)
        if (build) {
            this.state.resources.funds = build.funds ?? 500000;
            this.state.economy.cloudGPUs = build.gpu ?? 10;
            this.state.resources.computing = build.gpu ?? 10;
            this.state.reputation.investorTrust = build.investorTrust ?? 50;
            this.state.reputation.publicImage = build.publicImage ?? 0;
            this.state.economy.ownershipPct = build.ownershipPct ?? 100;
            this.state.resources.data = build.data ?? 5;
            this.state.economy.dataAssets = build.data ?? 5;

            // Store modifiers for ongoing effects
            this.state.player.modifiers = build.modifiers || {};
        }

        // Apply tech route starting bonuses
        this._applyTechRouteBonus(techRoute);
        this._applyLegacyStartBonus(build);

        // Starting bonuses based on country
        const countryData = COUNTRIES[country];
        if (countryData) {
            this.state.global.countryFavorability[country] = countryData.aiFavorability;
        }

        // Track country modifiers separately from character-build modifiers.
        if (countryData) {
            this.state.player.countryModifiers = {
                ...(countryData.bonuses || {}),
                ...(countryData.penalties || {})
            };
            this.state.player.countryBonuses = { ...this.state.player.countryModifiers };
            this.state._countryPolicy = getCountryPolicy(country);
            this.state.geopolitics.regionalMarket = calculateRegionalMarketShare(this.state);
            const policyEffects = getCountryPolicyEffects(country);
            this.state.player.countryBonuses.gpuAccess = policyEffects.gpuMod;
            this.state.player.countryBonuses.talentPool = policyEffects.talentMod;
            if (this.state.player.countryModifiers.startupSpeed) {
                const startupBonus = Math.max(0, Math.round(((this.state.player.countryModifiers.startupSpeed || 1) - 1) * 50_000));
                this.state.resources.funds += startupBonus;
            }
        }

        // Generate initial talent market
        this._refreshTalentMarket();

        // Give starter talents based on build
        const starterCount = build?.talents || 2;
        const talentQuality = build?.talentQuality || 3;
        for (let i = 0; i < starterCount; i++) {
            const starterLevel = Math.min(10, Math.max(2, talentQuality + this._rollCountryTalentLevelBonus({ starter: true })));
            const t = this._applyCountryTalentModifiers(generateTalent(country, starterLevel));
            this.state.talents.push(t);
        }

        this.state.addNews({
            key: 'news.company_founded',
            fallback: '{company} 설립! {country}에서 AI 개발을 시작합니다.',
            params: {
                company: companyName,
                country: {
                    __i18nKey: `country.${countryData.id}.name`,
                    fallback: _localizedCountryName(countryData)
                }
            }
        }, 'success');
        this.state.addNews({
            key: 'news.ceo_takes_helm',
            fallback: '{ceo}이(가) {company}의 첫 항해를 시작합니다.',
            params: {
                ceo: t('news.ceo_prefix', 'CEO {name}', { name: ceoName }),
                company: companyName
            }
        }, 'info');
        logger.info('game', 'Game started', { company: companyName, country, techRoute, funds: this.state.resources.funds });
        await this.stats.recordGameStart(this.state);
        await this.achievements.checkAll(this.state);
        syncStateEconomyCompatibility(this.state, this.time.currentDate.year);
        this._ensureDataState();
        void this._refreshSteamProfile();
        this._updateSteamRichPresence('map');
        this.state.monthlyReport = buildMonthlyReportData({ state: this.state, time: this.time }, null);
        this._monthSnapshot = createMonthSnapshot(this.state);

        // Load real world map data from CDN
        await initMapData();

        // Start auto-save
        this.saveManager.startAutosave(this);

        // Start BGM
        this.sound.startMusic();

        this.renderAll();

        // Start tutorial for first-time players
        if (await this.tutorial.shouldShow()) {
            setTimeout(() => this.tutorial.askToStart(), 500);
        }
    }

    _applyTechRouteBonus(route) {
        const completeTech = (id) => {
            const t = this.state.technologies[id];
            if (t) { t.progress = 100; t.completed = true; }
        };
        const boostTech = (id, pct) => {
            const t = this.state.technologies[id];
            if (t) t.progress = Math.max(t.progress, pct);
        };

        // All routes get deep_learning_basics completed (foundation)
        completeTech('deep_learning_basics');

        switch (route) {
            case 'llm':
                completeTech('transformer');
                boostTech('gpt_architecture', 40);
                break;
            case 'world':
                completeTech('cnn');
                boostTech('vision_transformer', 30);
                break;
            case 'generative':
                completeTech('gan');
                boostTech('diffusion', 40);
                break;
            case 'safety':
                completeTech('transformer');
                boostTech('reinforcement_learning', 50);
                break;
            case 'balanced':
                completeTech('transformer');
                completeTech('reinforcement_learning');
                break;
        }
    }

    _applyLegacyStartBonus(build) {
        const bonusId = build?.legacyBonus?.id;
        if (!bonusId) return;

        switch (bonusId) {
            case 'research_lab':
                this.state.player.modifiers.researchSpeed = (this.state.player.modifiers.researchSpeed || 1) * 1.05;
                break;
            case 'open_source_pioneer': {
                const techId = build?.legacyBonus?.unlockTech || _pickLegacyUnlockTech(this.state.player.techRoute);
                this._unlockTechImmediately(techId, 'legacy.unlocked_tech', '기술 유산으로 {name}을(를) 즉시 해금했습니다.');
                break;
            }
            case 'investor_trust':
                this.state.reputation.investorTrust = Math.min(100, (this.state.reputation.investorTrust || 0) + 10);
                break;
            case 'ai_legacy': {
                const model = {
                    id: 'legacy_open_source_assistant',
                    name: t('legacy.ai_model_name', '전설의 연구 도우미'),
                    source: 'opensource',
                    capabilities: { reasoning: 28, math: 18, coding: 16 },
                    performance: 35,
                    inferenceCost: 0,
                    monthlyCost: 0
                };
                assignInternalAISlot(this.state.internalAI, 'research_assist', model);
                break;
            }
        }
    }

    _unlockTechImmediately(techId, newsKey, fallback) {
        const techState = this.state.technologies?.[techId];
        const techData = TECH_TREE?.[techId];
        if (!techState || !techData || techState.completed) return false;

        techState.progress = 100;
        techState.completed = true;
        techState.researching = false;
        techState.assignedTalents = [];
        this.techTree?._applyTechEffects?.(techId);
        this.state.addNews({
            key: newsKey,
            fallback,
            params: {
                name: {
                    __i18nKey: `tech.${techId}.name`,
                    fallback: techData.name
                }
            }
        }, 'success');
        this.events?.processTechCompletion?.(techId);
        return true;
    }

    _getCountryModifiers() {
        return this.state.player?.countryModifiers || this.state.player?.countryBonuses || {};
    }

    _countryBonusMultiplier(value, strength = 1) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) return 1;
        if (numeric === 1) return 1;
        return 1 + ((numeric - 1) * strength);
    }

    _rollCountryTalentLevelBonus({ starter = false } = {}) {
        const countryMods = this._getCountryModifiers();
        let bonus = 0;
        const talentQualityChance = Math.min(0.9, Math.max(0, (Number(countryMods.talentQuality || 1) - 1) * (starter ? 2.4 : 1.7)));
        const educationChance = Math.min(0.8, Math.max(0, (Number(countryMods.aiEducation || 1) - 1) * (starter ? 2.1 : 1.35)));
        if (Math.random() < talentQualityChance) bonus += 1;
        if (Math.random() < educationChance) bonus += 1;
        return bonus;
    }

    _applyCountryTalentModifiers(talent) {
        if (!talent) return talent;
        if (talent.countryAdjusted) return talent;
        const countryMods = this._getCountryModifiers();
        const talentCostMult = Math.max(0.55, this._countryBonusMultiplier(countryMods.talentCost, 1));
        return {
            ...talent,
            salary: Math.max(1000, Math.round((talent.salary || 0) * talentCostMult)),
            countryAdjusted: true
        };
    }

    // rAF-driven render (decoupled from game ticks, max 60fps)
    _onRender() {
        syncStateEconomyCompatibility(this.state, this.time.currentDate.year);
        this._renderTopBarLive();
        this._updateProgressBars();
    }

    _onSpeedChange() {
        this._renderSpeedControls();
        this._updatePauseOverlay();
    }

    _onHour() {
        this.companies.processHourly(1);
        this.state.simulation.processedHours = Math.max(0, Number(this.state.simulation.processedHours || 0)) + 1;
        this.state.simulation.lastHourlyTick = { ...this.time.currentDate };
    }

    _onSixHours() {
        this.companies.processSixHourly(6);
        this.market.processSixHourly?.(6);
        this.state.simulation.lastStepTick = { ...this.time.currentDate };
    }

    _onDay() {
        this.state.simulation.lastDailyTick = { ...this.time.currentDate };
        this.techTree.processDailyResearch();

        // Train models (multi-phase pipeline)
        for (const model of this.state.models) {
            if (!model.training || model.trained) continue;

            const phase = TRAINING_PHASES[model.phaseIndex];
            if (!phase) continue;

            const assignedTalents = model.assignedTalents
                .map(tid => this.state.talents.find(t => t.id === tid))
                .filter(Boolean);

            // Calculate daily progress for this phase
            let dailyProgress = 0;
            const scale = PARAMETER_SCALES[model.scale] || PARAMETER_SCALES.medium;
            const arch = MODEL_ARCHITECTURES[model.architecture] || MODEL_ARCHITECTURES.transformer;
            const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
                countryBonuses: this.state.player.countryBonuses || {},
                colocation: this.state.economy.colocation,
                completedChipPrograms: this.state.economy.completedChipPrograms,
                customSiliconBonuses: this.state.economy.customSiliconBonuses
            });
            const codingAssistBonus = getInternalAIBonus(this.state.internalAI, 'coding_assist');
            const totalTrainingDays = Math.max(1, model.trainingDaysTarget || estimateTrainingDays({
                scale,
                architecture: arch,
                fleetStats,
                customSiliconBonuses: this.state.economy.customSiliconBonuses,
                availableTFLOPS: model.trainingTFLOPS || null
            }));
            const phaseDurationDays = Math.max(1, totalTrainingDays * (phase.durationPct / 100));
            const basePhaseProgress = 100 / phaseDurationDays;

            if (phase.primaryResource === 'compute') {
                // PFLOPS-driven pretraining
                dailyProgress = basePhaseProgress;
                const talentBonus = assignedTalents.reduce((s, t) => {
                    const relevant = t.specialty?.some(sp => phase.talentSpecialties.includes(sp));
                    return s + (relevant ? t.stats.research * 0.08 : t.stats.research * 0.02);
                }, 0);
                dailyProgress *= (1 + talentBonus * 0.04);
            } else {
                // Talent-driven phase
                for (const talent of assignedTalents) {
                    const relevant = talent.specialty?.some(sp => phase.talentSpecialties.includes(sp));
                    const relevance = relevant ? 1.5 : 0.8;
                    dailyProgress += (talent.stats.research * 0.35 + talent.stats.creativity * 0.2) * relevance;
                }
                const computeBonus = Math.min(1.35, 1 + fleetStats.totalTFLOPS / 4000);
                dailyProgress = (basePhaseProgress * Math.max(0.7, dailyProgress / Math.max(6, assignedTalents.length * 3))) * computeBonus;
            }

            // Architecture training efficiency
            if (arch) dailyProgress *= arch.trainingEfficiency;

            // Tech bonuses
            const completedTechs = this.techTree.getCompletedTechs();
            if (completedTechs.includes('gpu_cluster')) dailyProgress *= 1.2;
            if (completedTechs.includes('custom_ai_chip')) dailyProgress *= 1.15;
            if (codingAssistBonus > 0) dailyProgress *= (1 + codingAssistBonus);

            // Morale modifier
            if (assignedTalents.length > 0) {
                const avgMorale = assignedTalents.reduce((s, t) => s + t.morale, 0) / assignedTalents.length;
                dailyProgress *= (avgMorale / 100);
            }

            // Model quality modifier from character creation
            dailyProgress *= (this.state.player?.modifiers?.modelQuality || 1.0);
            dailyProgress *= model.dataFit || 0.5;
            model.phaseProgress += dailyProgress;

            // Daily cost (scaled by compute intensity)
            this.state.resources.funds -= Math.round((model.dailyCost || 100) * phase.computeIntensity);

            // Phase complete?
            if (model.phaseProgress >= 100) {
                model.phaseProgress = 100;
                model.phaseIndex++;

                // Skip optional phases without required tech
                while (model.phaseIndex < TRAINING_PHASES.length) {
                    const nextPhase = TRAINING_PHASES[model.phaseIndex];
                    if (nextPhase.optional && nextPhase.requiredTech.length > 0 &&
                        !nextPhase.requiredTech.every(t => completedTechs.includes(t))) {
                        model.skippedPhases.push(nextPhase.id);
                        this.state.addNews(t('news.training_phase_skipped', '"{name}" {phase} 단계 생략 (기술 부족)', {
                            name: model.name,
                            phase: _localizedTrainingPhaseName(nextPhase)
                        }), 'warning');
                        model.phaseIndex++;
                    } else {
                        break;
                    }
                }

                if (model.phaseIndex < TRAINING_PHASES.length) {
                    model.phase = TRAINING_PHASES[model.phaseIndex].id;
                    model.phaseProgress = 0;
                    this.state.addNews(
                        t('news.training_phase_entered', '"{name}" {phase} 단계 진입', {
                            name: model.name,
                            phase: `${TRAINING_PHASES[model.phaseIndex].icon} ${_localizedTrainingPhaseName(TRAINING_PHASES[model.phaseIndex])}`
                        }), 'info'
                    );
                }
            }

            // All phases done?
            if (model.phaseIndex >= TRAINING_PHASES.length) {
                model.training = false;
                model.trained = true;
                model.phase = null;
                model.trainedDate = { ...this.time.currentDate };
                model.trainingTFLOPS = 0;
                for (const t of assignedTalents) t.assignment = null;
                model.assignedTalents = [];
                this._evaluateModel(model);
                this.state.addNews(
                    t('news.model_training_completed', '모델 "{name}" 훈련 완료! 종합: {score}점', {
                        name: model.name,
                        score: model.compositeScore
                    }), 'success'
                );
                this.triggerSuccessImpact('normal', { soundId: 'model_trained' });
                this.time.requestAutoPause();
                this.renderAll(); // 즉시 UI 갱신
            }

            // Update overall progress & legacy progress field
            const completedPct = TRAINING_PHASES.slice(0, model.phaseIndex)
                .reduce((s, p) => s + p.durationPct, 0);
            const curPct = (TRAINING_PHASES[model.phaseIndex]?.durationPct || 0) * (model.phaseProgress / 100);
            model.overallProgress = Math.min(100, completedPct + curPct);
            model.progress = model.overallProgress;
        }

        // Check historical events for today's date
        this.events.processDay(this.time.getDateInt());
        if (this.events.hasPendingEvent()) {
            this._showEventPopup();
        }
    }

    _updateProgressBars() {
        const researching = this.techTree.getResearchingTechs();
        const researchProgress = new Map(researching.map(entry => [entry.id, entry.state?.progress || entry.progress || 0]));

        document.querySelectorAll('.ra-item[data-tech-id]').forEach(el => {
            const progress = researchProgress.get(el.dataset.techId);
            if (progress === undefined) return;
            const fill = el.querySelector('.progress-fill');
            const pct = el.querySelector('.ra-pct');
            if (fill) fill.style.width = `${progress}%`;
            if (pct) pct.textContent = `${Math.floor(progress)}%`;
        });

        document.querySelectorAll('.research-tree-node.tc-researching[data-tech-id]').forEach(node => {
            const progress = researchProgress.get(node.dataset.techId);
            if (progress === undefined) return;
            const fill = node.querySelector('.tc-progress-fill');
            const pct = node.querySelector('.tc-progress span');
            if (fill) fill.style.width = `${progress}%`;
            if (pct) pct.textContent = `${Math.floor(progress)}%`;
        });

        // Update tech node progress bars
        document.querySelectorAll('.tech-node.researching .progress-fill').forEach(fill => {
            const node = fill.closest('.tech-node');
            if (node) {
                const techName = node.querySelector('.tech-name')?.textContent;
                const tech = Object.values(this.state.technologies).find(t => {
                    const data = this.techTree.getTechData(t.id);
                    return data && data.name === techName && t.researching;
                });
                if (tech) fill.style.width = `${tech.progress}%`;
            }
        });
        // Update model training progress
        document.querySelectorAll('.model-card.training .progress-fill').forEach(fill => {
            const card = fill.closest('.model-card');
            const modelId = card?.dataset?.modelId;
            const model = modelId ? this.state.models.find(m => m.id === modelId) : null;
            if (model) fill.style.width = `${model.progress}%`;
        });
    }

    _onMonth() {
        this.state.simulation.lastMonthlyTick = { ...this.time.currentDate };
        if (!this._monthSnapshot) {
            this._monthSnapshot = createMonthSnapshot(this.state);
        }
        for (const model of this.state.models) {
            this._normalizeModelServiceState(model);
            if (model.deployed && model.serviceChannels.some(channel => channel?.active)) {
                model.serviceMonths = Math.max(0, Number(model.serviceMonths || 0)) + 1;
            }
        }
        this.state.reputation.publicImage = (this.state.reputation.publicImage || 0) + (getInternalAIBonus(this.state.internalAI, 'safety_audit') * 2);
        this._syncOpenSourceModels();
        this.economy.processMonthly();
        this.companies.processMonthly();
        this.events.processMonthly();
        this._processDataMonthly();
        const geoCycle = processGeopoliticsCycle(this.state);
        this._pendingQuarterlyGeopoliticsEvents = Array.isArray(geoCycle.quarterlyEvents)
            ? geoCycle.quarterlyEvents
            : [];
        // Collect geopolitical effects, then show as a single aggregated event
        const geoEffectLines = [];
        let geoTotalSubsidy = 0;
        for (const event of geoCycle.monthlyEvents || []) {
            if (event.type === 'subsidy') {
                const isHomeCountry = event.country === this.state.player.country;
                if (isHomeCountry) {
                    this.state.resources.funds += event.amount;
                    geoTotalSubsidy += event.amount;
                    geoEffectLines.push(`💰 ${event.title} (+$${event.amount.toLocaleString()})`);
                }
                // Other countries' subsidies are internal to competitors — not shown
            } else if (event.type === 'policy_change') {
                const policy = this.state._countryPolicy || getCountryPolicy(this.state.player.country);
                const prevLevel = policy.regulationLevel || 5;
                policy.regulationLevel = Math.max(1, Math.min(10, prevLevel + Number(event.regulationDelta || 0)));
                this.state._countryPolicy = policy;
                this.state.geopolitics.policyHistory.push({
                    type: event.type,
                    regulationLevel: policy.regulationLevel,
                    date: { year: this.time.currentDate.year, month: this.time.currentDate.month }
                });
                geoEffectLines.push(`📋 ${event.title} (${t('geo.effect.regulation', '규제')} ${prevLevel}→${policy.regulationLevel})`);
            } else if (event.type === 'export_control') {
                this.state.geopolitics.activeControls = event.affectedRegions || [];
                const prevTension = Math.round(this.state.global.geopoliticalTension || 0);
                this.state.global.geopoliticalTension = Math.min(100, prevTension + 5);
                geoEffectLines.push(`🛡️ ${event.title} (${t('geo.effect.tension', '긴장도')} ${prevTension}%→${Math.round(this.state.global.geopoliticalTension)}%)`);
            }
        }
        // Monthly geo changes → news ticker only (quiet); quarterly summary → event popup
        if (geoEffectLines.length > 0) {
            for (const line of geoEffectLines) {
                this.state.addNews(line, 'info');
            }
        }
        this.market.processMonthly();
        const baselineRegionalMarket = calculateRegionalMarketShare(this.state);
        this.state.geopolitics.regionalMarket = Object.fromEntries(
            Object.entries(baselineRegionalMarket).map(([regionId, entry]) => ([
                regionId,
                {
                    ...(this.state.geopolitics.regionalMarket?.[regionId] || {}),
                    ...entry
                }
            ]))
        );
        processPersistentEffects(this.state);
        const serviceIncidents = processMonthlyServiceOps(this.state, this.time.currentDate);
        for (const incident of serviceIncidents) {
            // Queue as a proper event with choices through the event system
            const incidentEvent = createIncidentEvent(incident);
            incidentEvent.type = 'decision';
            incidentEvent.category = 'company';
            incidentEvent.icon = incident.severity === 'critical' ? '🚨' : '⚠️';
            this.events.eventQueue.push(incidentEvent);
        }
        const regulationEvent = checkRegulationTrigger(this.state, this.time.currentDate);
        if (regulationEvent) {
            regulationEvent.type = 'decision';
            regulationEvent.category = 'company';
            regulationEvent.icon = '🏛️';
            this.events.eventQueue.push(regulationEvent);
        }
        if (this.events.eventQueue.length > 0 && !this.events.hasPendingEvent()) {
            this.events._processQueue();
        }
        const safetyStatus = processMonthlySafety(this.state);
        processMonthlyBoardCulture(this.state);
        if (safetyStatus.boardPressure >= 15) {
            this.state.addNews(
                t('news.board_pressure', '이사회가 운영과 안전 리스크에 대한 압박을 강화하고 있습니다.'),
                'warning'
            );
        }
        const boardStatus = (this.time.currentDate.month || 1) % 3 === 0 ? processQuarterlyBoard(this.state) : null;
        if (boardStatus) {
            this.state.addNews(
                {
                    key: 'board.pressure',
                    fallback: `이사회 압박: ${boardStatus.avgSatisfaction}%`,
                    params: {}
                },
                'warning'
            );
        }
        this.market.getGlobalAILevel();
        this.state.devLog ||= [];
        this.state.devLog.push({
            year: this.time.currentDate.year,
            month: this.time.currentDate.month,
            funds: Math.round(this.state.resources.funds || 0),
            monthlyIncome: Math.round(this.state.resources.monthlyIncome || 0),
            monthlyExpense: Math.round(this.state.resources.monthlyExpense || 0),
            valuation: Math.round(this.state.economy?.valuation || 0),
            marketShare: Number((this.state.reputation?.marketShare || 0).toFixed(2)),
            bestModel: Math.round(this.victory?._getPlayerBestPerformance?.() || 0),
            safety: Math.round(this.state.safety?.posture || 0),
            boardConfidence: Math.round(this.state.board?.confidence || 0),
            serviceReliability: Math.round(this.state.serviceOps?.reliability || 0),
            act: this.state.campaign?.currentAct || 'startup'
        });
        this.state.devLog = this.state.devLog.slice(-240);
        if (this.state.global.geopoliticalTension >= 80) {
            this.triggerGlitch('danger');
        } else if (this.state.global.geopoliticalTension >= 60) {
            this.triggerGlitch('warning');
        }

        if ((this.time.currentDate.month || 1) % 6 === 0) {
            this._refreshTalentMarket();
        }

        const actTransition = checkActTransition(this.state);
        if (actTransition) {
            this.state.campaign.currentAct = actTransition.to;
            this.state.campaign.actHistory.push({
                actId: actTransition.to,
                enteredDate: { year: this.time.currentDate.year, month: this.time.currentDate.month }
            });
            this.state.campaign.actTransitionCount += 1;
            // Act transition splash removed — seamless gameplay without stage breaks
        }

        this.state.monthlyReport = buildMonthlyReportData(
            { state: this.state, time: this.time },
            this._monthSnapshot
        );
        this._monthSnapshot = createMonthSnapshot(this.state);

        // Talent morale & loyalty
        const moraleDecayMod = this.state.player?.modifiers?.moralDecayReduction || 1.0;
        const talentsToRemove = [];
        for (const talent of this.state.talents) {
            talent.monthsWorked++;
            // Initialize loyalty for old saves
            if (talent.loyalty === undefined) talent.loyalty = 70;

            // Morale
            if (talent.assignment) talent.morale = Math.max(0, talent.morale - (1 * moraleDecayMod));
            else talent.morale = Math.min(100, talent.morale + 2);

            // Loyalty changes
            // +loyalty: good morale, long tenure, salary satisfaction
            if (talent.morale >= 70) talent.loyalty = Math.min(100, talent.loyalty + 0.5);
            else if (talent.morale < 30) talent.loyalty = Math.max(0, talent.loyalty - 2);
            // Slow natural loyalty growth from tenure
            if (talent.monthsWorked > 12) talent.loyalty = Math.min(100, talent.loyalty + 0.2);

            const safetyTechs = Object.values(this.state.technologies).filter(tech => tech.completed && tech.category === 'safety').length;
            const completedTechs = Object.values(this.state.technologies).filter(tech => tech.completed).length;
            const safetyRatio = completedTechs > 0 ? safetyTechs / completedTechs : 0;
            if (talent.ideology === 'safety' && safetyRatio < 0.1) {
                talent.ideologyFrustration = (talent.ideologyFrustration || 0) + 1;
            }
            if (talent.ideology === 'accel' && safetyRatio > 0.4) {
                talent.ideologyFrustration = (talent.ideologyFrustration || 0) + 1;
            }
            if (talent.ideologyFrustration >= 6 && talent.level >= 7) {
                this.state.addNews(
                    t('news.board_revolt_imminent', '{name}이(가) 이사회의 불만을 키우고 있습니다.', { name: talent.name }),
                    'warning'
                );
                this.triggerGlitch('danger');
            }
            if (talent.personality?.effects?.conflictChance && Math.random() < talent.personality.effects.conflictChance * 0.08) {
                const opponent = this.state.talents.find(other => other.id !== talent.id && other.ideology !== talent.ideology);
                if (opponent) {
                    talent.morale = Math.max(0, talent.morale - 4);
                    opponent.morale = Math.max(0, opponent.morale - 4);
                    this.state.addNews(
                        t('news.talent_conflict', '{name}과(와) {other} 사이에 내부 갈등이 발생했습니다.', {
                            name: talent.name,
                            other: opponent.name
                        }),
                        'warning'
                    );
                }
            }
            if (talent.personality?.effects?.loyaltyDecay) {
                talent.loyalty = Math.max(0, Math.min(100, talent.loyalty - (talent.personality.effects.loyaltyDecay * 10)));
            }
            // Low loyalty + high skill = departure risk
            if (talent.loyalty < 25 && talent.level >= 5 && Math.random() < 0.15) {
                // Talent quits!
                talentsToRemove.push(talent);
                if (talent.assignment) this.techTree.removeTalentFromResearch(talent.assignment, talent.id);

                // High-level departures may start rival company
                if (talent.level >= 7 && Math.random() < 0.4) {
                    this.state.addNews(
                        t('news.talent_left_for_rival', '{name}이(가) 퇴사 후 경쟁 스타트업을 설립했습니다! (충성도 {loyalty}%)', {
                            name: talent.name,
                            loyalty: Math.round(talent.loyalty)
                        }),
                        'danger'
                    );
                    this.achievements.unlock('talent_exodus');
                    // Boost a random competitor
                    const comp = this.state.competitors[Math.floor(Math.random() * this.state.competitors.length)];
                    if (comp) { comp.aiLevel += 2; comp.marketShare += 1; }
                } else {
                    this.state.addNews(
                        t('news.talent_departed_low_loyalty', '{name}이(가) 낮은 충성도({loyalty}%)로 퇴사했습니다.', {
                            name: talent.name,
                            loyalty: Math.round(talent.loyalty)
                        }),
                        'warning'
                    );
                }
            }

            // Random skill growth
            if (Math.random() < 0.1) {
                const stat = ['research', 'creativity', 'collaboration'][Math.floor(Math.random() * 3)];
                talent.stats[stat] = Math.min(10, talent.stats[stat] + 0.1);
            }
        }
        // Remove departed talents
        for (const departedTalent of talentsToRemove) {
            const idx = this.state.talents.indexOf(departedTalent);
            if (idx !== -1) this.state.talents.splice(idx, 1);
        }

        if ((this.time.currentDate.month || 1) % 3 === 0 && this.state.talents.length > 0 && Math.random() < 0.05) {
            const target = [...this.state.talents]
                .sort((a, b) => (a.loyalty ?? 70) - (b.loyalty ?? 70) || b.level - a.level)[0];
            if (target && (target.loyalty ?? 70) < 55) {
                const rival = this.state.competitors[Math.floor(Math.random() * this.state.competitors.length)];
                const loyalty = target.loyalty ?? 70;
                const successChance = loyalty < 30 ? 0.65 : loyalty < 45 ? 0.35 : 0.15;
                if (rival && Math.random() < successChance) {
                    const idx = this.state.talents.indexOf(target);
                    if (idx !== -1) this.state.talents.splice(idx, 1);
                    rival.aiLevel += 1;
                    rival.marketShare += 0.4;
                    this.state.addNews(t('news.talent_scouted', '{company}가 {name}을(를) 스카우트했습니다!', {
                        company: rival.name,
                        name: target.name
                    }), 'warning');
                }
            }
        }

        this._processDatacenterConstructionEvents();

        // Datacenter construction progress
        const dcs = this.state.economy.datacenters || [];
        for (const dc of dcs) {
            if (!dc.operational && dc.buildMonthsLeft > 0) {
                dc.buildMonthsLeft--;
                if (dc.buildMonthsLeft <= 0) {
                    dc.operational = true;
                    // Datacenter provides rack slots only — no auto-fill GPUs
                    syncStateEconomyCompatibility(this.state, this.time.currentDate.year);
                    this.state.addNews(t('compute.datacenter_ready', '{name} 건설 완료! GPU {count}대 설치 가능.', {
                        name: _localizedDatacenterName(dc.tierId, dc.name),
                        count: dc.gpus
                    }), 'success');
                }
            }
        }
        this._advanceDatacenterOperationalEffects();
        syncStateEconomyCompatibility(this.state, this.time.currentDate.year);

        const chipResult = processChipProgramsMonthly(this.state, { rng: Math.random });
        if (chipResult.completed > 0) {
            const latest = this.state.economy.completedChipPrograms.at(-1);
            this.state.addNews(t('chip.news.completed', '내부 칩 프로그램 완료! {chip}이(가) 운영에 투입됩니다.', {
                chip: latest?.gpu?.name || t('chip.program_title', '내부 칩 프로그램')
            }), 'success');
        }

        // Check events
        if (this.events.hasPendingEvent()) {
            this._showEventPopup();
        }

        // Check victory/defeat conditions
        this.victory.checkMonthly(this.time);
        this.achievements.checkAll(this.state);
        this.stats.updateSnapshot(this.state);

        // Full re-render on month change (resource totals, panels, etc.)
        this.renderAll();
    }

    _onQuarter() {
        this.state.simulation.lastQuarterlyTick = { ...this.time.currentDate };
        this._processDatacenterOperationalEvents();
        const quarterlyEvents = Array.isArray(this._pendingQuarterlyGeopoliticsEvents)
            ? [...this._pendingQuarterlyGeopoliticsEvents]
            : [];
        this._pendingQuarterlyGeopoliticsEvents = [];
        // Aggregate quarterly geopolitical events into a single event popup
        const qGeoLines = [];
        for (const event of quarterlyEvents) {
            const effectDetail = event.type === 'export_control'
                ? ` (${t('geo.effect.supply_chain', '공급망 압박')})`
                : '';
            qGeoLines.push(`${event.title}${effectDetail}`);
        }
        const blocEntries = Object.values(this.state.stateActors?.blocs || {});
        const topBloc = blocEntries.sort((a, b) => Number(b.tension || 0) - Number(a.tension || 0))[0];
        if (topBloc && Number(topBloc.tension || 0) >= 20) {
            const blocName = topBloc.name?.[getLocale()] || topBloc.name?.ko || topBloc.id;
            qGeoLines.push(`⚡ ${t('geo.quarterly_tension_summary', '{bloc}의 분기 긴장이 고조되고 있습니다. 공급망과 규제를 주시하세요.', { bloc: blocName })}`);
        }
        if (qGeoLines.length > 0) {
            this.events.eventQueue.push({
                id: `geo_quarterly_${this.time.currentDate.year}_Q${Math.ceil((this.time.currentDate.month || 1) / 3)}`,
                type: 'world',
                category: 'geopolitical',
                icon: '🌐',
                title: t('geo.quarterly_summary', '분기 지정학 보고'),
                description: qGeoLines.join('<br>')
            });
            if (!this.events.hasPendingEvent()) {
                this.events._processQueue();
            }
        }
    }

    _onYear() {
        const year = this.time.currentDate.year || 2017;
        for (const event of GPU_EVENTS.filter(entry => entry.year === year)) {
            const gpu = getGpuById(event.gpuId);
            if (!gpu) continue;
            this.state.addNews(t(event.newsKey, '{gpu} 출시! {tflops} TFLOPS 세대가 시장에 등장했습니다.', {
                gpu: gpu.name,
                tflops: gpu.tflops
            }), 'info');
        }
        this.state.addNews(t('news.new_year_started', '{year}년이 시작되었습니다.', {
            year: this.time.currentDate.year
        }), 'info');
    }

    _evaluateModel(model) {
        const arch = MODEL_ARCHITECTURES[model.architecture] || MODEL_ARCHITECTURES.transformer;
        const scale = PARAMETER_SCALES[model.scale] || PARAMETER_SCALES.medium;
        const completedTechs = this.techTree.getCompletedTechs();
        const safetyAuditBonus = getInternalAIBonus(this.state.internalAI, 'safety_audit');

        for (const capId of Object.keys(CAPABILITY_BENCHMARKS)) {
            let score = arch.baseCapabilities[capId] || 0;

            // Scale multiplier (bigger = better)
            score *= (0.3 + scale.capMult * 0.7);

            // Architecture strength/weakness
            if (arch.strengths[capId]) score *= arch.strengths[capId];
            if (arch.weaknesses[capId]) score *= arch.weaknesses[capId];

            // Data quality bonus (0.5x to 1.0x based on relevant data)
            const relevantTypes = CAP_DATA_MAP[capId] || [];
            if (relevantTypes.length > 0) {
                const totalRelevant = relevantTypes.reduce((s, dt) => s + (model.dataMix[dt] || 0), 0);
                const dataBonus = Math.min(1.0, totalRelevant / Math.max(1, scale.dataReqTB * 0.3));
                const profile = this._getDataTrainingProfile(model.dataMix || {});
                const qualityMod = Math.max(0.72, 0.82 + (profile.effectiveQuality * 0.34));
                score *= (0.5 + dataBonus * 0.5) * qualityMod;
                if (capId === 'safety' && profile.avgBias > 0) {
                    score *= Math.max(0.7, 1 - (profile.avgBias / 260));
                }
            }

            // Tech bonuses
            const bonuses = TECH_CAP_BONUSES[capId] || {};
            for (const [techId, val] of Object.entries(bonuses)) {
                if (completedTechs.includes(techId)) score += val;
            }

            // Skipped phase penalties
            if (model.skippedPhases?.includes('alignment')) {
                if (capId === 'safety') score *= 0.4;
            }

            // Random variance (+/-10%)
            score *= (0.9 + Math.random() * 0.2);
            score *= model.computeQualityBonus || 1;
            if (capId === 'safety' && safetyAuditBonus > 0) {
                score *= (1 + (safetyAuditBonus * 0.5));
            }

            model.capabilities[capId] = Math.round(Math.max(0, Math.min(100, score)));
        }

        // Composite score
        let composite = 0;
        for (const [capId, weight] of Object.entries(BENCHMARK_WEIGHTS)) {
            composite += model.capabilities[capId] * weight;
        }
        model.compositeScore = Math.round(composite);

        // Legacy compatibility
        model.performance = model.compositeScore;
        model.safetyScore = model.capabilities.safety;
    }

    _refreshTalentMarket() {
        this.talentMarket = [];
        const country = this.state.player.country || 'us';
        const countryData = COUNTRIES[country];
        const countryMods = this._getCountryModifiers();
        const basePoolSize = countryData ? countryData.stats.talentPool : 5;
        const quantityMult = this._countryBonusMultiplier(countryMods.talentQuantity, 0.9);
        const shortageMult = Math.max(1, Number(countryMods.talentShortage || 1));
        const poolSize = Math.max(4, Math.round((basePoolSize + 3) * quantityMult / shortageMult));

        for (let i = 0; i < poolSize; i++) {
            const talentCountry = Math.random() < 0.6 ? country :
                Object.keys(COUNTRIES)[Math.floor(Math.random() * Object.keys(COUNTRIES).length)];
            const levelRoll = Math.floor(Math.random() * 7) + 2;
            const levelBonus = talentCountry === country ? this._rollCountryTalentLevelBonus() : 0;
            const talent = generateTalent(talentCountry, Math.min(10, Math.max(2, levelRoll + levelBonus)));
            this.talentMarket.push(this._applyCountryTalentModifiers(talent));
        }
    }

    hireTalent(talentId) {
        const idx = this.talentMarket.findIndex(t => t.id === talentId);
        if (idx === -1) return false;

        const talent = this._applyCountryTalentModifiers(this.talentMarket[idx]);
        const hiringCost = talent.salary * 3;

        if (this.state.resources.funds < hiringCost) {
            this.state.addNews(t('news.hire_insufficient_funds', '자금이 부족하여 채용할 수 없습니다.'), 'danger');
            return false;
        }

        this.state.resources.funds -= hiringCost;
        this.state.talents.push(talent);
        this.talentMarket.splice(idx, 1);
        this.state.addNews(t('news.hired_talent', '{name}을(를) 채용했습니다!', { name: talent.name }), 'success');
        this.renderAll();
        return true;
    }

    fireTalent(talentId) {
        const idx = this.state.talents.findIndex(t => t.id === talentId);
        if (idx === -1) return;
        const talent = this.state.talents[idx];
        if (talent.assignment) {
            this.techTree.cancelResearch(talent.assignment);
        }
        this.state.talents.splice(idx, 1);
        this.state.addNews(t('news.fired_talent', '{name}을(를) 해고했습니다.', { name: talent.name }), 'info');
        this.renderAll();
    }

    createModel(name, architectureId, scaleId) {
        const arch = MODEL_ARCHITECTURES[architectureId];
        const scale = PARAMETER_SCALES[scaleId];
        const scaleReq = getParameterScaleRequirements(scale);
        if (!arch || !scale) { this.state.addNews(t('news.invalid_arch_or_scale', '잘못된 아키텍처 또는 규모입니다.'), 'danger'); return null; }
        const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const computeBudget = getComputeBudget({ fleetStats, models: this.state.models });

        // Validate tech requirements
        const completedTechs = this.techTree.getCompletedTechs();
        for (const reqTech of arch.requiredTech) {
            if (!completedTechs.includes(reqTech)) {
                this.state.addNews(t('news.missing_required_tech', '필요 기술이 부족합니다.'), 'danger');
                return null;
            }
        }
        for (const reqTech of scaleReq.requiresTech) {
            if (!completedTechs.includes(reqTech)) {
                this.state.addNews(t('models.scale_tech_required', '"{scale}" 규모 모델에는 "{tech}" 연구가 필요합니다.', {
                    scale: `${_localizedParameterScaleName(scale)} (${scale.params})`,
                    tech: _localizedTechName(reqTech)
                }), 'warning');
                return null;
            }
        }

        // Validate scale vs architecture max
        if (SCALE_ORDER.indexOf(scaleId) > SCALE_ORDER.indexOf(arch.maxScale)) {
            this.state.addNews(t('news.scale_not_supported', '{arch}은(는) {scale} 규모를 지원하지 않습니다.', {
                arch: _localizedArchitectureName(arch),
                scale: _localizedParameterScaleName(scale)
            }), 'danger');
            return null;
        }

        // Check compute
        if (fleetStats.totalTFLOPS < scaleReq.minTFLOPS) {
            this.state.addNews(t('models.min_tflops_warning', '연산력 부족 (필요: {required} TFLOPS, 보유: {owned} TFLOPS)', {
                required: Math.round(scaleReq.minTFLOPS).toLocaleString(),
                owned: Math.round(fleetStats.totalTFLOPS).toLocaleString()
            }), 'danger');
            return null;
        }
        if ((scaleReq.minVRAM || 0) > fleetStats.maxVRAM) {
            this.state.addNews(t('models.min_vram_warning', 'VRAM이 부족합니다. 최소 {required}GB 필요 (현재 최대 {owned}GB)', {
                required: scaleReq.minVRAM,
                owned: fleetStats.maxVRAM
            }), 'warning');
            return null;
        }

        const baseDailyCost = 200;
        const model = {
            id: `model_${Date.now()}`,
            name,
            architecture: architectureId,
            scale: scaleId,
            // Legacy compat
            size: scaleId === 'tiny' || scaleId === 'small' ? 'small' :
                  scaleId === 'medium' ? 'medium' :
                  scaleId === 'large' ? 'large' : 'xlarge',
            // Training pipeline
            phase: null, phaseIndex: -1, phaseProgress: 0, overallProgress: 0,
            training: false, trained: false, deployed: false,
            skippedPhases: [],
            assignedTalents: [],
            // Data
            dataMix: {},
            // Capabilities (filled after training)
            capabilities: { language: 0, reasoning: 0, coding: 0, math: 0, multimodal: 0, safety: 0, speed: 0 },
            compositeScore: 0,
            // Legacy compat
            performance: 0, safetyScore: 0, progress: 0,
            // Deployment
            deploymentStrategy: null,
            monthlyRevenue: 0, users: 0, unemploymentImpact: {},
            inferenceCost: 0,
            serviceChannels: [],
            totalAllocatedTFLOPS: 0,
            totalMonthlyRevenue: 0,
            serviceMonths: 0,
            trainingTFLOPS: 0,
            serviceQuality: 0,
            // Costs
            trainingCost: Math.round(100 * scale.trainingCostMult),
            dailyCost: Math.round(baseDailyCost * scale.dailyCostMult),
            computeReq: scale.computeReq,
            requiredPFLOPS: scale.requiredPFLOPS || 1,
            trainingDaysTarget: null,
            dataFit: 0,
            computeQualityBonus: 1,
            // Metadata
            createdDate: { ...this.time.currentDate },
            trainedDate: null, deployedDate: null,
            generation: this.state.models.filter(m => m.architecture === architectureId).length + 1,
        };

        this.state.models.push(model);
        this.state.addNews(t('news.model_designed', '모델 "{name}" ({architecture}, {scale}) 설계 완료.', {
            name,
            architecture: `${arch.icon} ${_localizedArchitectureName(arch)}`,
            scale: _localizedParameterScaleName(scale)
        }), 'info');
        this.renderAll();
        return model;
    }

    startTraining(modelId, talentIds, dataMix = {}, trainingTFLOPS = null) {
        const model = this.state.models.find(m => m.id === modelId);
        if (!model || model.training || model.trained) return false;
        const arch = MODEL_ARCHITECTURES[model.architecture] || MODEL_ARCHITECTURES.transformer;
        const scale = PARAMETER_SCALES[model.scale] || PARAMETER_SCALES.medium;
        const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const allocatedData = Object.values(dataMix).reduce((sum, value) => sum + value, 0);
        const requiredData = scale.dataReqTB || 0;
        const dataFit = calculateDataMixFit(arch, dataMix, this.state.economy.dataAssets);
        const dataProfile = this._getDataTrainingProfile(dataMix);
        const scaleReq = getParameterScaleRequirements(scale);
        const computeBudget = getComputeBudget({ fleetStats, models: this.state.models });
        const dataRefineBonus = getInternalAIBonus(this.state.internalAI, 'data_refine');
        const minTrainingTFLOPS = Math.max(1, Number(scaleReq.minTFLOPS || 1));
        const maxTrainingTFLOPS = Math.max(0, Number(computeBudget.availableTFLOPS || 0));
        const requestedTrainingTFLOPS = Math.max(1, Number(trainingTFLOPS ?? (maxTrainingTFLOPS || fleetStats.totalTFLOPS || 1)));

        if (allocatedData <= 0) {
            this.state.addNews(t('models.need_training_data', '훈련용 데이터를 최소 1TB 이상 배분해야 합니다.'), 'warning');
            return false;
        }
        if (allocatedData > getTotalDataTB(this.state.economy.dataAssets)) {
            this.state.addNews(t('models.data_exceeds_inventory', '배정한 데이터가 보유량을 초과합니다.'), 'danger');
            return false;
        }
        if (maxTrainingTFLOPS < minTrainingTFLOPS) {
            this.state.addNews(t('models.training_compute_shortage', '훈련에 필요한 연산력이 부족합니다. 최소 {required} TFLOPS가 필요합니다.', {
                required: Math.round(minTrainingTFLOPS).toLocaleString()
            }), 'danger');
            return false;
        }

        const resolvedTrainingTFLOPS = Math.max(minTrainingTFLOPS, Math.min(maxTrainingTFLOPS, requestedTrainingTFLOPS));

        model.training = true;
        model.assignedTalents = talentIds;
        model.dataMix = dataMix;
        model.dataFit = Math.min(1.45, dataFit * (1 + dataRefineBonus) * Math.max(0.85, 0.8 + (dataProfile.effectiveQuality * 0.4)));
        model.phaseIndex = 0;
        model.phase = TRAINING_PHASES[0].id;
        model.phaseProgress = 0;
        model.overallProgress = 0;
        model.trainingTFLOPS = resolvedTrainingTFLOPS;
        model.allocatedTFLOPS = resolvedTrainingTFLOPS;
        model.trainingDaysTarget = Math.max(1, Math.ceil(estimateTrainingDays({
            scale,
            architecture: arch,
            fleetStats,
            customSiliconBonuses: this.state.economy.customSiliconBonuses,
            availableTFLOPS: resolvedTrainingTFLOPS,
            computeBudget
        }) * (allocatedData < requiredData ? 1.25 : 1) / Math.max(0.55, model.dataFit)));
        model.computeQualityBonus = getModelComputeQualityBonus({ scale, fleetStats });
        model.dataProfile = dataProfile;
        model.dailyCost = Math.max(
            Math.round((fleetStats.monthlyCost / 30) * Math.max(0.5, Math.min(1.4, (scale.requiredPFLOPS || 1) / 500))),
            Math.round((200 * scale.dailyCostMult) / Math.max(0.65, dataFit))
        );

        for (const tid of talentIds) {
            const t = this.state.talents.find(t => t.id === tid);
            if (t) t.assignment = `model_${modelId}`;
        }
        this.state.addNews(t('news.model_training_started', '모델 "{name}" 훈련 시작! (단계: {phase})', {
            name: model.name,
            phase: `${TRAINING_PHASES[0].icon} ${_localizedTrainingPhaseName(TRAINING_PHASES[0])}`
        }), 'info');
        if (allocatedData < requiredData) {
            this.state.addNews(t('models.low_data_warning', '권장 데이터보다 부족합니다. 훈련이 느려지고 성능이 낮아질 수 있습니다.'), 'warning');
        }
        this.renderAll();
        return true;
    }

    deployModel(modelId, strategyId) {
        const model = this.state.models.find(m => m.id === modelId);
        if (!model || !model.trained || model.deployed) return;

        const strategy = DEPLOYMENT_STRATEGIES[strategyId];
        if (!strategy) return;
        const initialChannelType = strategyId === 'open_source' ? 'open_source' : strategyId;

        // Check tech requirements
        if (strategy.requirements.techCompleted) {
            const completedTechs = this.techTree.getCompletedTechs();
            for (const techId of strategy.requirements.techCompleted) {
                if (!completedTechs.includes(techId)) {
                    this.state.addNews(t('news.deploy_missing_tech', '배포 전략 요구 기술이 부족합니다.'), 'danger');
                    return;
                }
            }
        }
        const missingServiceTechs = this._getServiceChannelMissingTechs(initialChannelType);
        if (missingServiceTechs.length > 0) {
            this.state.addNews(this._getServiceChannelRequirementText(initialChannelType), 'warning');
            return;
        }
        // Check capability requirements
        if (strategy.requirements.minCapability) {
            for (const [cap, minVal] of Object.entries(strategy.requirements.minCapability)) {
                if ((model.capabilities[cap] || 0) < minVal) {
                    this.state.addNews(t('news.deploy_missing_capability', '{capability} 능력이 부족합니다 (필요: {required})', {
                        capability: _localizedCapabilityName(cap),
                        required: minVal
                    }), 'danger');
                    return;
                }
            }
        }

        model.deployed = true;
        model.deployedDate = { ...this.time.currentDate };
        model.deploymentStrategy = strategyId;
        model.deployedAsOpenSource = strategyId === 'open_source';
        this._normalizeModelServiceState(model);

        // Revenue based on strategy capability weights
        let capScore = 0;
        for (const [cap, weight] of Object.entries(strategy.capWeights)) {
            capScore += (model.capabilities[cap] || 0) * weight;
        }
        const scale = PARAMETER_SCALES[model.scale] || PARAMETER_SCALES.medium;
        const countryMods = this._getCountryModifiers();
        let revenueMod = this.state.player?.modifiers?.deployRevenue || 1.0;
        if (strategyId === 'open_source') revenueMod *= (this.state.player?.modifiers?.openSourceRevenue || 1.0);
        if (strategyId === 'government' || strategyId === 'defense') revenueMod *= (this.state.player?.modifiers?.govContractRevenue || 1.0);
        revenueMod *= this._countryBonusMultiplier(countryMods.marketSize, 1.0);
        revenueMod *= this._countryBonusMultiplier(countryMods.regulationFreedom, 1.0);
        revenueMod /= Math.max(1, Number(countryMods.regulationPenalty || 1));
        if (strategyId === 'enterprise' || strategyId === 'government') {
            revenueMod *= this._countryBonusMultiplier(countryMods.industrialAI, 1.0);
            revenueMod *= this._countryBonusMultiplier(countryMods.manufacturingAI, 0.85);
        }
        if (strategyId === 'consumer_chat') {
            revenueMod *= this._countryBonusMultiplier(countryMods.mobileInnovation, 1.0);
        }
        if (strategyId === 'government' || strategyId === 'defense') {
            revenueMod *= this._countryBonusMultiplier(countryMods.digitalGov, 1.0);
            revenueMod *= this._countryBonusMultiplier(countryMods.defense, 1.0);
            revenueMod *= this._countryBonusMultiplier(countryMods.cybersecurity, 0.8);
        }
        const revenueBase = capScore < 20 ? capScore * 100 :
            capScore < 50 ? capScore * 300 :
                capScore < 80 ? capScore * 800 :
                    capScore * 2000;
        const scaleMultiplier = 0.6 + (scale.capMult || 0.5) * 0.8;
        const currentYear = this.time.currentDate.year || 2017;
        const relativePerformance = getRelativePerformance(model, currentYear);
        const performanceMultiplier = _relativePerformanceRevenueMultiplier(relativePerformance);
        model.monthlyRevenue = Math.round(revenueBase * scaleMultiplier * strategy.revenueMult * revenueMod * performanceMultiplier);
        model.totalMonthlyRevenue = model.monthlyRevenue;
        model.inferenceCost = Math.round((scale.dailyCostMult * 100 * 30) * (this.state.economy.customSiliconBonuses?.inferenceCostMult || 1));

        // Open source: no revenue, no compute, no inference cost (weights are public)
        if (strategyId === 'open_source') {
            model.monthlyRevenue = 0;
            model.totalMonthlyRevenue = 0;
            model.inferenceCost = 0;
        }

        const deployFleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        model.serviceChannels = this._upsertModelServiceChannel(model, initialChannelType, {
            active: true,
            allocatedTFLOPS: strategyId === 'open_source' ? 0 : this._getDefaultChannelAllocation(initialChannelType, model, deployFleetStats)
        });
        if (strategyId === 'open_source') {
            model.totalAllocatedTFLOPS = 0;
        }

        // Reputation / market share
        this.state.reputation.marketShare += strategy.marketShareGain * model.compositeScore;
        if (strategy.reputationGain) this.state.reputation.corporate = (this.state.reputation.corporate || 0) + strategy.reputationGain;
        if (strategy.publicImagePenalty) this.state.reputation.publicImage = (this.state.reputation.publicImage || 0) + strategy.publicImagePenalty;

        // Unemployment impact
        model.unemploymentImpact = {};
        for (const [industry, rate] of Object.entries(strategy.unemploymentImpact || {})) {
            model.unemploymentImpact[industry] = model.compositeScore * rate;
        }

        this._syncOpenSourceModels();
        this._refreshServiceEconomySnapshot();

        const trustGain = relativePerformance >= 1.5 ? 10
            : relativePerformance >= 1.2 ? 7
            : relativePerformance >= 1.0 ? 3
            : 1;
        this.state.reputation.investorTrust = Math.min(100, this.state.reputation.investorTrust + trustGain);

        this.state.addNews(
            t('news.model_deployed', '모델 "{name}" {strategy}으로 배포! 월 수익: {revenue}', {
                name: model.name,
                strategy: `${strategy.icon} ${_localizedDeploymentStrategyName(strategy)}`,
                revenue: `$${Math.round(model.monthlyRevenue || 0).toLocaleString()}`
            }), 'success'
        );
        this.achievements.checkAll(this.state);
        this.renderAll();
    }

    // ===== RENDERING =====

    renderAll() {
        this.state.models.forEach(model => this._normalizeModelServiceState(model));
        this._syncOpenSourceModels();
        this.renderTopBar();
        this.updateWorldMap();
        this.renderContent();
        this._renderRightPanel();
        this._renderBottomLog();
        // updateStickyInfoBar(this.state); // TopBar에 통합됨
        this._updateBadges();
        if (this.state.gameOver) this._showGameOver();
    }

    _renderRightPanel() {
        const rp = document.getElementById('right-panel');
        if (!rp) return;

        const s = this.state;
        const researching = this.techTree.getResearchingTechs();
        const trainingModels = s.models.filter(m => m.training);
        const readyModels = s.models.filter(m => m.trained && !m.deployed);
        const idleTalents = s.talents.filter(t => !t.assignment);

        // Build priorities
        const priorities = [];
        if (researching.length === 0) priorities.push({ text: t('right.priority.start_research', '연구를 시작하세요'), sub: t('right.priority.start_research_sub', '기술 탭에서 연구 배치'), tab: 'research', icon: 'research', cls: '' });
        if (idleTalents.length > 0) priorities.push({ text: t('right.priority.idle_talents', '대기 인재 {count}명', { count: idleTalents.length }), sub: t('right.priority.idle_talents_sub', '배치하거나 연구에 투입'), tab: 'talent', icon: 'talent', cls: 'rp-warn' });
        if (readyModels.length > 0) priorities.push({ text: t('right.priority.ready_model', '{name} 배포 대기', { name: readyModels[0].name }), sub: t('right.priority.ready_model_sub', '배포 전략을 선택하세요'), tab: 'models', icon: 'rocket', cls: '' });
        const eco = s.economy;
        if (eco.runway !== Infinity && eco.runway < 6) priorities.push({
            text: t('right.priority.runway', '런웨이 {count}개월', { count: eco.runway }),
            sub: t('right.priority.runway_sub', '투자 유치 또는 비용 절감'),
            tab: 'company',
            icon: 'alert',
            cls: 'rp-danger',
            tooltip: this._runwayTooltipData()
        });
        if (s.getMonthlyBalance() < 0 && eco.runway > 6) priorities.push({ text: t('right.priority.monthly_deficit', '월간 적자 발생'), sub: t('right.priority.monthly_deficit_sub', '수익 모델 또는 비용 최적화'), tab: 'company', icon: 'trendDown', cls: 'rp-warn' });

        // Build alerts
        const alerts = [];
        if (eco.runway !== Infinity && eco.runway < 3) alerts.push({
            text: t('right.alert.cash_crisis', '자금 위기'),
            sub: t('right.alert.cash_crisis_sub', '{count}개월 남음', { count: eco.runway }),
            icon: 'flame',
            type: 'danger',
            tooltip: this._runwayTooltipData()
        });
        const aiF = s.global.aiFavorability;
        if (aiF < 30) alerts.push({
            text: t('right.alert.ai_backlash', 'AI 반감 확산'),
            sub: t('right.alert.ai_backlash_sub', '호감도 {value}%', { value: Math.round(aiF) }),
            icon: 'alert',
            type: 'warning',
            tooltip: this._aiFavorabilityTooltipData()
        });

        rp.innerHTML = `
            <div class="rp-section">
                <div class="rp-section-title">${icon('target', 13)} ${t('right.priorities', '우선순위')}</div>
                ${priorities.length > 0 ? priorities.slice(0, 3).map(p => `
                    <div class="rp-item rp-priority ${p.cls}" onclick="game.switchTab('${p.tab}')" ${p.tooltip ? `data-term-tooltip="${p.tooltip}" tabindex="0"` : ''}>
                        ${icon(p.icon, 14)}
                        <div>
                            <div class="rp-item-text">${p.text}</div>
                            <div class="rp-item-sub">${p.sub}</div>
                        </div>
                    </div>
                `).join('') : `<div class="rp-empty">${t('right.all_systems_nominal', '모든 시스템 정상')}</div>`}
            </div>

            <div class="rp-section">
                <div class="rp-section-title">${icon('research', 13)} ${t('right.active_research', '활성 연구')}</div>
                ${researching.length > 0 ? researching.slice(0, 3).map(r => `
                    <div class="rp-item" onclick="game.switchTab('research')">
                        ${icon('zap', 13)}
                        <div style="flex:1">
                            <div class="rp-item-text">${_localizedTechName(r.id)}</div>
                            <div class="rp-progress"><div class="rp-progress-fill" style="width:${r.state?.progress || 0}%;background:var(--accent)"></div></div>
                        </div>
                        <span class="rp-item-sub">${Math.floor(r.state?.progress || 0)}%</span>
                    </div>
                `).join('') : `
                    <div class="rp-empty">${t('right.no_research', '연구 없음')}</div>
                    <button class="rp-action-btn" onclick="game.switchTab('research')">${icon('zap', 13)} ${t('research.start_action', '연구 시작')}</button>
                `}
            </div>

            <div class="rp-section">
                <div class="rp-section-title">${icon('model', 13)} ${t('right.models_status', '모델 현황')}</div>
                ${trainingModels.length > 0 ? trainingModels.slice(0, 2).map(m => {
                    const phase = m.phase ? (typeof TRAINING_PHASES !== 'undefined' ? TRAINING_PHASES.find(p => p.id === m.phase) : null) : null;
                    return `
                    <div class="rp-item" onclick="game.switchTab('models')">
                        ${icon('model', 13)}
                        <div style="flex:1">
                            <div class="rp-item-text">${m.name}</div>
                            <div class="rp-progress"><div class="rp-progress-fill" style="width:${m.overallProgress || 0}%;background:var(--warning)"></div></div>
                        </div>
                        <span class="rp-item-sub">${Math.floor(m.overallProgress || 0)}%</span>
                    </div>`;
                }).join('') : readyModels.length > 0 ? readyModels.slice(0, 1).map(m => `
                    <div class="rp-item" onclick="game.switchTab('models')">
                        ${icon('check', 13)}
                        <div>
                            <div class="rp-item-text">${t('right.ready_to_deploy', '{name} — 배포 대기', { name: m.name })}</div>
                            <div class="rp-item-sub">${t('models.composite_short', '종합')} ${m.compositeScore}${t('world.points', '점')}</div>
                        </div>
                    </div>
                `).join('') : `<div class="rp-empty">${t('right.no_models', '모델 없음')}</div>`}
            </div>

            ${alerts.length > 0 ? `
                <div class="rp-section" style="border-color:rgba(239,83,80,0.2)">
                    <div class="rp-section-title" style="color:var(--danger)">${icon('alert', 13)} ${t('news.filter.warning', '경고')}</div>
                    ${alerts.map(a => `
                        <div class="rp-item rp-priority rp-danger" ${a.tooltip ? `data-term-tooltip="${a.tooltip}" tabindex="0"` : ''}>
                            ${icon(a.icon, 14)}
                            <div>
                                <div class="rp-item-text" style="color:var(--${a.type})">${a.text}</div>
                                <div class="rp-item-sub">${a.sub}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    _renderBottomLog() {
        const bl = document.getElementById('bottom-log');
        if (!bl) return;

        const recent = this.state.newsLog.slice(0, 5);
        const daysUntilMonth = 30 - (this.time.currentDate.day || 1);

        bl.innerHTML = `
            <div class="bl-items">
                ${recent.map(n => `
                    <div class="bl-item">
                        <span class="bl-dot ${n.type}"></span>
                        <span class="bl-date">${n.date?.month || ''}/${n.date?.day || ''}</span>
                        <span class="bl-msg">${n.message}</span>
                    </div>
                `).join('')}
                ${recent.length === 0 ? `<span style="color:var(--text-tertiary);font-style:italic">${t('bottomlog.waiting', '이벤트 대기 중...')}</span>` : ''}
            </div>
            <div class="bl-right">${icon('clock', 11)} ${t('bottomlog.settlement', '정산 {count}일 후', { count: daysUntilMonth })}</div>
        `;
    }

    updateWorldMap() {
        const mapEl = document.getElementById('world-map-bg');
        if (!mapEl) return;

        // Globe 3D 모드 (기본)
        if (this.mapModePreference === 'globe' && this._ensureGlobeMap(mapEl)) {
            this.globeMap.applyState(this.state);
            this._ensureMapModeBar(mapEl);
            return;
        }

        // WebGL 플랫 3D 모드 (레거시)
        if (this.mapModePreference === 'webgl' && this._ensureWebGLMap(mapEl)) {
            this.webglMap.renderMap(this.state, this.state.player.country, this.state.competitors);
            return;
        }

        this.destroyWorldMap();
        mapEl.classList.remove('world-map-bg--webgl');
        mapEl.innerHTML = renderWorldMap(this.state, this.state.player.country, this.state.competitors);
        
        if (!this._mapEventsAttached) {
            this._setupMapControls(mapEl);
            this._mapEventsAttached = true;
        }
        
        this._applyMapTransform();
        this._applySvgMapHoverState();
    }

    _ensureMapModeBar(mapEl) {
        if (!mapEl || !this.globeMap) return;
        let bar = mapEl.querySelector('.map-mode-bar');
        if (bar) return; // already exists
        bar = document.createElement('div');
        bar.className = 'map-mode-bar';
        bar.innerHTML = Object.values(MAP_MODES).map(mode => `
            <button class="map-mode-btn ${mode.id === (this.globeMap.getMapMode?.() || 'default') ? 'active' : ''}"
                    data-mode="${mode.id}" title="${mode.desc || mode.fallback}">
                ${mode.icon} ${mode.fallback}
            </button>
        `).join('');
        bar.addEventListener('click', (e) => {
            const btn = e.target.closest('.map-mode-btn');
            if (!btn) return;
            const mode = btn.dataset.mode;
            this.globeMap.setMapMode(mode);
            bar.querySelectorAll('.map-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        });
        mapEl.appendChild(bar);
    }

    _ensureGlobeMap(mapEl) {
        if (this._globeMapDisabled) return false;
        if (this.globeMap) return true;

        try {
            mapEl.innerHTML = '';
            mapEl.classList.add('world-map-bg--webgl');
            this.globeMap = new GlobeMap(mapEl);
            this.globeMap.applyControlSettings?.({
                edgePan: this.settings?.controls?.edgePan,
                zoomSpeed: this.settings?.controls?.zoomSpeed,
                panSpeed: this.settings?.controls?.panSpeed,
                reducedMotion: this.settings?.display?.reducedMotion
            });

            // 이벤트 콜백 연결
            this.globeMap.onClick = (countryId, name) => {
                this.showCountryInfo(countryId);
            };
            this.globeMap.onHover = (countryId, name, x, y) => {
                this.setMapHoverCountry(countryId, name);
            };
            this.globeMap.onHoverEnd = () => {
                this.setMapHoverCountry(null);
            };

            return true;
        } catch (error) {
            console.warn('Globe map unavailable:', error);
            this.globeMap = null;
            this._globeMapDisabled = true;
            return false;
        }
    }

    _ensureWebGLMap(mapEl) {
        if (this._webglMapDisabled) return false;
        if (this.webglMap?.renderer) return true;

        try {
            mapEl.innerHTML = '';
            this.webglMap = new WebGLMap('world-map-bg');
            if (!this.webglMap?.renderer) {
                throw new Error('WebGL map renderer failed to initialize');
            }
            this.webglMap.applySettings?.({
                edgePan: this.settings?.controls?.edgePan,
                zoomSpeed: this.settings?.controls?.zoomSpeed,
                panSpeed: this.settings?.controls?.panSpeed,
                reducedMotion: this.settings?.display?.reducedMotion
            });
            return true;
        } catch (error) {
            console.warn('WebGL map unavailable, falling back to SVG map:', error);
            this.webglMap?.destroy?.();
            this.webglMap = null;
            this._webglMapDisabled = true;
            return false;
        }
    }

    destroyWorldMap() {
        this.globeMap?.dispose?.();
        this.globeMap = null;
        this.webglMap?.destroy?.();
        this.webglMap = null;
    }

    async setMapMode(mode) {
        this.mapModePreference = mode === 'svg' ? 'svg' : mode === 'globe' ? 'globe' : 'webgl';
        this.settings = saveGameSettingsSync({
            ...this.settings,
            display: {
                ...this.settings.display,
                mapRenderer: this.mapModePreference
            }
        });
        if (this.mapModePreference === 'webgl') {
            this._webglMapDisabled = false;
        } else if (this.mapModePreference === 'globe') {
            this._globeMapDisabled = false;
        }
        this.destroyWorldMap();
        _syncLegacySettingMirrors(this.settings);
        await storageSetItem(MAP_MODE_KEY, this.mapModePreference);
        this.updateWorldMap();
    }

    showMapEventPulse(countryId, type = 'info') {
        if (!countryId) return;
        // Globe 모드 펄스
        if (this.mapModePreference === 'globe' && this.globeMap) {
            const pulseColor = type === 'danger' ? 0xef4444 : type === 'warning' ? 0xeab308 : type === 'success' ? 0x22c55e : 0x00e5ff;
            this.globeMap.showPulse(countryId, pulseColor);
            return;
        }
        if (this.mapModePreference === 'webgl' && this.webglMap?.renderer) {
            this.webglMap.showMapEventPulse?.(countryId, type);
            return;
        }
        showSvgMapEventPulse(countryId, type);
    }

    _setupMapControls(mapEl) {
        mapEl.addEventListener('wheel', (e) => {
            e.preventDefault();

            const zoomSpeed = 0.1;
            const delta = e.deltaY > 0 ? -1 : 1;

            const rect = mapEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            let newScale = this.mapTransform.scale * (1 + delta * zoomSpeed);
            newScale = Math.max(1, Math.min(newScale, 15));

            const scaleChange = newScale / this.mapTransform.scale;

            this.mapTransform.x = mouseX - (mouseX - this.mapTransform.x) * scaleChange;
            this.mapTransform.y = mouseY - (mouseY - this.mapTransform.y) * scaleChange;
            this.mapTransform.scale = newScale;
            this._clampMapPosition();
            this._applyMapTransform();
        });

        mapEl.addEventListener('mousedown', (e) => {
            this.isDraggingMap = true;
            this.wasDraggingMap = false;
            this.lastDragPos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDraggingMap) return;

            const dx = e.clientX - this.lastDragPos.x;
            const dy = e.clientY - this.lastDragPos.y;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                this.wasDraggingMap = true;
            }

            this.mapTransform.x += dx;
            this.mapTransform.y += dy;
            this.lastDragPos = { x: e.clientX, y: e.clientY };
            this._clampMapPosition();
            this._applyMapTransform();
        });

        window.addEventListener('mouseup', () => {
            this.isDraggingMap = false;
        });

        mapEl.addEventListener('mouseleave', () => {
            if (!this.isDraggingMap) {
                this.clearMapHoverCountry();
            }
        });
    }

    setMapHoverCountry(countryId) {
        this._mapHoverCountry = countryId || null;
        this._applySvgMapHoverState();
    }

    clearMapHoverCountry(countryId = null) {
        if (countryId && this._mapHoverCountry !== countryId) return;
        this._mapHoverCountry = null;
        this._applySvgMapHoverState();
    }

    _applySvgMapHoverState() {
        const svg = document.querySelector('#world-map-bg svg');
        if (!svg) return;

        svg.querySelectorAll('.map-label[data-country]').forEach(label => {
            const countryId = label.getAttribute('data-country');
            const isAlwaysVisible = label.classList.contains('is-always-visible');
            label.classList.toggle('is-visible', isAlwaysVisible || (!!this._mapHoverCountry && countryId === this._mapHoverCountry));
        });

        svg.querySelectorAll('.map-country[data-country]').forEach(path => {
            const countryId = path.getAttribute('data-country');
            path.classList.toggle('is-hovered', !!this._mapHoverCountry && countryId === this._mapHoverCountry);
        });
    }

    _clampMapPosition() {
        const mapEl = document.getElementById('world-map-bg');
        if (!mapEl) return;
        const mapWidthPx = mapEl.clientWidth * this.mapTransform.scale;
        const mapHeightPx = mapEl.clientHeight * this.mapTransform.scale;
        this.mapTransform.x = Math.max(-mapWidthPx * 0.6, Math.min(mapWidthPx * 0.2, this.mapTransform.x));
        this.mapTransform.y = Math.max(-mapHeightPx * 0.4, Math.min(mapHeightPx * 0.2, this.mapTransform.y));
    }

    _applyMapTransform() {
        const svg = document.querySelector('#world-map-bg svg');
        if (svg) {
            svg.style.transform = `translate(${this.mapTransform.x}px, ${this.mapTransform.y}px) scale(${this.mapTransform.scale})`;
            svg.style.transformOrigin = '0 0';
            svg.style.transition = this.isDraggingMap ? 'none' : 'transform 0.1s ease-out';
        }
    }

    _getEventPulseCountry(event) {
        if (!event) return this.state.player.country;
        if (event.country && COUNTRIES[event.country]) return event.country;
        const effectCountryId = Object.keys(event.effects?.countryEffects || {}).find(countryId => COUNTRIES[countryId]);
        return effectCountryId || this.state.player.country;
    }

    showCountryInfo(countryId) {
        if (this.wasDraggingMap) {
            this.wasDraggingMap = false;
            return;
        }
        
        const country = COUNTRIES[countryId];
        if (!country) return;

        const compsHere = this.state.competitors.filter(c => c.country === countryId);
        const isHome = countryId === this.state.player.country;
        const fav = this.state.global.countryFavorability?.[countryId] ?? country.aiFavorability;
        const tension = Math.round(this.state.global.geopoliticalTension || 0);
        const renderModifierLine = (key, value, negative = false) => {
            const numeric = Number(value) || 1;
            const valueText = numeric < 1
                ? t('country.reduction_pct', '{value}% 절감', { value: Math.round((1 - numeric) * 100) })
                : `x${numeric}`;
            return `
                <li style="margin-bottom:8px">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                        <span>${_bonusLabel(key)}</span>
                        <strong style="color:${negative ? '#fca5a5' : '#e2e8f0'}">${valueText}</strong>
                    </div>
                    <div style="font-size:0.74rem;color:${negative ? '#fca5a5' : '#94a3b8'};margin-top:2px">${_bonusEffectLabel(key)}</div>
                </li>
            `;
        };

        const fmtPop = country.population >= 1000 ? `${(country.population / 1000).toFixed(2)}B` :
                        country.population >= 1 ? `${country.population.toFixed(1)}M` :
                        `${Math.round(country.population * 1000)}K`;
        const fmtGDP = country.gdp >= 1000 ? `$${(country.gdp / 1000).toFixed(2)}T` : `$${country.gdp}B`;
        const fmtGDPpc = country.gdpPerCapita >= 1000 ? `$${(country.gdpPerCapita / 1000).toFixed(1)}K` : `$${country.gdpPerCapita}`;

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content country-info-popup">
                <h3 style="display:flex;align-items:center;gap:8px">${this._flag(country.flag)} ${_localizedCountryName(country)} ${isHome ? `<span style="color:var(--accent)">★ ${t('world.home_hq', '본사')}</span>` : ''}</h3>
                <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:8px">${_localizedCountryDescription(country)}</p>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;font-size:0.8rem">
                    <div style="background:rgba(255,255,255,0.05);padding:6px 8px;border-radius:6px;text-align:center">
                        <div style="color:#64748b">${t('country.population', '인구')}</div>
                        <div style="color:#e2e8f0;font-weight:bold;font-size:1rem">${fmtPop}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05);padding:6px 8px;border-radius:6px;text-align:center">
                        <div style="color:#64748b">${t('country.gdp', 'GDP')}</div>
                        <div style="color:#e2e8f0;font-weight:bold;font-size:1rem">${fmtGDP}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05);padding:6px 8px;border-radius:6px;text-align:center">
                        <div style="color:#64748b">${t('country.gdp_per_capita', '1인당 GDP')}</div>
                        <div style="color:#e2e8f0;font-weight:bold;font-size:1rem">${fmtGDPpc}</div>
                    </div>
                </div>
                ${country.aiRank > 0 ? `<div style="font-size:0.8rem;color:#fbbf24;margin-bottom:8px;display:flex;align-items:center;gap:4px">${icon('trophy', 14)} ${t('country.ai_rank', '글로벌 AI 지수')} ${country.aiRank}${t('country.rank_suffix', '위')}</div>` : ''}

                <div class="country-detail-stats">
                    <div class="stat-row"><span>${t('country.ai_investment', 'AI 투자')}</span><span>${this._countryStatBar(country.stats.investment, 'var(--accent)')}</span></div>
                    <div class="stat-row"><span>${t('country.regulation_level', '규제 수준')}</span><span>${this._countryStatBar(country.stats.regulation, 'var(--warning)')}</span></div>
                    <div class="stat-row"><span>${t('country.talent_pool', '인재 풀')}</span><span>${this._countryStatBar(country.stats.talentPool, 'var(--accent)')}</span></div>
                    <div class="stat-row"><span>${t('creation.stat.infrastructure', '인프라')}</span><span>${this._countryStatBar(country.stats.infrastructure, 'var(--accent)')}</span></div>
                    <div class="stat-row"><span>${t('bonus.dataAccess', '데이터 접근')}</span><span>${this._countryStatBar(country.stats.dataAccess, '#ce93d8')}</span></div>
                    <div class="stat-row"><span>${t('bonus.semiconductor', '반도체')}</span><span>${this._countryStatBar(country.stats.semiconductor, 'var(--success)')}</span></div>
                    <div class="stat-row"><span>${t('country.ai_favorability', 'AI 호감도')}</span><span class="${fav < 40 ? 'negative' : ''}">${Math.round(fav)}%</span></div>
                    <div class="stat-row"><span>${t('country.geopolitical_tension', '지정학 긴장')}</span><span class="${tension >= 70 ? 'negative' : tension >= 45 ? 'warning' : ''}">${tension}%</span></div>
                </div>
                ${compsHere.length > 0 ? `
                    <h4 style="margin-top:12px">${t('country.local_companies', '소재 기업')}</h4>
                    ${compsHere.map(c => `
                        <div class="stat-row">
                            <span style="color:${c.color}">${c.name}</span>
                            <span>${t('game.models', '모델')}: ${c.currentModel.name} (${c.currentModel.performance}${t('world.points', '점')}) | ${t('world.market_share', '점유')}: ${c.marketShare.toFixed(1)}%</span>
                        </div>
                    `).join('')}
                ` : ''}
                ${country.bonuses && Object.keys(country.bonuses).length > 0 ? `
                    <h4 style="margin-top:12px">${t('country.bonuses', '국가 보너스')}</h4>
                    <ul style="font-size:0.85rem;color:#94a3b8;padding-left:16px">
                        ${Object.entries(country.bonuses).map(([k, v]) => renderModifierLine(k, v, false)).join('')}
                    </ul>
                ` : ''}
                ${country.penalties && Object.keys(country.penalties).length > 0 ? `
                    <h4 style="margin-top:8px;color:#ef5350">${t('country.penalties', '페널티')}</h4>
                    <ul style="font-size:0.85rem;color:#ef9a9a;padding-left:16px">
                        ${Object.entries(country.penalties).map(([k, v]) => renderModifierLine(k, v, true)).join('')}
                    </ul>
                ` : ''}
                ${country.isEU ? `<p style="font-size:0.8rem;color:#22c55e;margin-top:8px;display:flex;align-items:center;gap:4px">${icon('shield', 14)} ${t('country.eu_member', 'EU 회원국 - EU 규제 프레임워크 적용')}</p>` : ''}
                ${country.tier ? `<p style="font-size:0.75rem;color:#64748b;margin-top:4px">${t('country.tier', 'Tier')} ${country.tier} | ${_localizedRegionName(country.region)}</p>` : ''}
                <div class="popup-buttons">
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.close', '닫기')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _localizeCampaignText(entry, fallback = '') {
        if (!entry) return fallback;
        if (typeof entry === 'string') return entry;
        const locale = getLocale?.() || 'ko';
        return entry[locale] || entry.ko || entry.en || fallback;
    }

    _showActTransition(transition) {
        const act = transition?.actData;
        if (!act) return;
        const app = document.getElementById('app');
        if (!app) return;
        applyMoodToDocument(document, transition?.to || this.state.campaign?.currentAct || 'startup');

        document.querySelector('.act-transition-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'act-transition-overlay';
        overlay.innerHTML = `
            <div class="act-transition-content" style="--act-color:${act.themeColor || 'var(--accent)'}">
                <div class="act-transition-icon">${act.icon || '✨'}</div>
                <h1 class="act-transition-title">${this._localizeCampaignText(act.name, t('act.transition', '새로운 시대가 시작됩니다'))}</h1>
                <p class="act-transition-desc">${this._localizeCampaignText(act.description, '')}</p>
                <button class="btn btn-primary" onclick="this.closest('.act-transition-overlay')?.remove()">
                    ${t('common.continue', '계속')}
                </button>
            </div>
        `;
        app.appendChild(overlay);
        setTimeout(() => overlay.remove(), 10000);
    }

    renderTopBar() {
        const topBar = document.getElementById('top-bar');
        if (!topBar) return;
        applyMoodToDocument(document, this.state.campaign?.currentAct || 'startup');

        const balance = this.state.getMonthlyBalance();
        const balanceClass = balance >= 0 ? 'positive' : 'negative';
        const balanceSign = balance >= 0 ? '+' : '';

        const eco = this.state.economy;
        const runway = eco.runway;
        const runwayWarn = runway !== Infinity && runway < 12;
        const runwayColor = runway < 3 ? 'var(--danger)' : runway < 6 ? 'var(--warning)' : 'var(--text-secondary)';
        const fundsHealthClass = getFundsHealthClass(balance, runway);
        const aiF = Math.round(this.state.global.aiFavorability);
        const fleetStats = getFleetStats(eco.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: eco.colocation,
            completedChipPrograms: eco.completedChipPrograms,
            customSiliconBonuses: eco.customSiliconBonuses
        });
        const totalData = getTotalDataTB(eco.dataAssets);
        const serviceOverview = this._getServiceOverview();
        const avgMorale = Math.round(this.state.talents.reduce((sum, talent) => sum + talent.morale, 0) / (this.state.talents.length || 1));

        // KPI delta tracking — compare with last month snapshot
        const prev = this._topbarPrevSnapshot || {};
        const _delta = (cur, prevVal) => {
            if (prevVal == null || !this.state.gameStarted) return '';
            const d = cur - prevVal;
            if (Math.abs(d) < 0.5) return '';
            const sign = d > 0 ? '+' : '';
            const cls = d > 0 ? 'kpi-delta-up' : 'kpi-delta-down';
            return `<span class="${cls}">${sign}${this._shortNum(d)}</span>`;
        };
        const fundsDelta = _delta(this.state.resources.funds, prev.funds);
        const tflopsDelta = _delta(fleetStats.totalTFLOPS, prev.tflops);
        const talentDelta = _delta(this.state.talents.length, prev.talents);
        const valuationDelta = _delta(eco.valuation, prev.valuation);
        // Save current snapshot for next render
        this._topbarPrevSnapshot = {
            funds: this.state.resources.funds,
            tflops: fleetStats.totalTFLOPS,
            talents: this.state.talents.length,
            valuation: eco.valuation,
            users: serviceOverview.users,
            safety: this.state.safety?.posture || 0
        };
        const runwayValueText = this._runwayValueText();
        const natFlag = CEO_NATIONALITIES?.find(n => n.id === this.state.player.ceoNationality)?.flag || '';
        const ceoLabel = `CEO ${natFlag} ${this.state.player.ceoName || t('company.default_ceo_name', 'Alex Kim')}`;
        const steamPlayerLabel = this._steamProfile?.available
            ? `${icon('trophy', 10)} Steam · ${_escapeHtmlAttr(this._steamProfile.name || 'Steam Player')}`
            : '';
        // Act badge removed — seamless gameplay without visible stage markers
        const actBadge = '';
        const revenueBreakdown = renderBreakdownTooltip({
            title: t('report.revenue', '매출'),
            ...collectBreakdown('revenue', this.state)
        }).replace(/"/g, '&quot;');
        const expenseBreakdown = renderBreakdownTooltip({
            title: t('report.expenses', '비용'),
            ...collectBreakdown('expenses', this.state)
        }).replace(/"/g, '&quot;');
        const safetyBreakdown = renderBreakdownTooltip({
            title: t('safety.label', '안전 태세'),
            ...collectBreakdown('safetyScore', this.state)
        }).replace(/"/g, '&quot;');

        topBar.innerHTML = `
            <div class="top-left">
                <div style="display:flex;flex-direction:column;gap:2px;margin-right:18px;min-width:0">
                    <span class="game-title" style="display:flex;align-items:center;gap:8px;margin-right:0;">
                        ${(this.state.player.ceoAvatar?.startsWith('http') || this.state.player.ceoAvatar?.startsWith('data:'))
                            ? `<img src="${this.state.player.ceoAvatar}" style="width:28px;height:28px;border-radius:999px;border:1px solid rgba(79,195,247,0.25);background:#1a2332">`
                            : `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:rgba(79,195,247,0.1);border:1px solid rgba(79,195,247,0.25);font-size:0.95rem">${this.state.player.ceoAvatar || '👨‍💼'}</span>`
                        }
                        <span style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0">
                            <span>${this.state.player.companyName || 'AGI Manager'}</span>
                            <span style="font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.08em;color:var(--text-secondary);text-transform:uppercase">${ceoLabel}</span>
                            ${steamPlayerLabel ? `<span style="font-family:var(--font-mono);font-size:0.56rem;letter-spacing:0.06em;color:var(--gold);text-transform:uppercase">${steamPlayerLabel}</span>` : ''}
                        </span>
                    </span>
                </div>
                
                <div id="funds-res-group" class="res-group ${fundsHealthClass}" data-rich-tooltip="${this._fundsTooltip()}">
                    <div class="res-main">${icon('funds', 14)} <span class="res-big" id="live-funds">${this._termValue('funds', this._shortNum(this.state.resources.funds), {
                        breakdown: [
                            { label: t('company.monthly_income', '월 수입'), value: `$${Math.round(this.state.resources.monthlyIncome || 0).toLocaleString()}` },
                            { label: t('company.monthly_expense', '월 지출'), value: `$${Math.round(this.state.resources.monthlyExpense || 0).toLocaleString()}` },
                            { label: t('company.monthly_balance', '월 수지'), value: `${balanceSign}$${Math.round(Math.abs(balance)).toLocaleString()}` }
                        ]
                    })}</span></div>
                    <div class="res-sub"><span class="${balanceClass}">${balanceSign}${this._shortNum(Math.abs(balance))}${t('topbar.per_month', '/월')}</span>${runwayWarn ? ` · <span style="color:${runwayColor}">${this._termValue('runway', runwayValueText, {
                        breakdown: [
                            { label: t('company.funds_on_hand', '보유 자금'), value: `$${Math.round(this.state.resources.funds || 0).toLocaleString()}` },
                            { label: t('company.monthly_balance', '월 수지'), value: `${balance >= 0 ? '+' : ''}$${Math.round(balance).toLocaleString()}` }
                        ]
                    })}</span>` : ''}</div>
                </div>
                <div class="res-group" data-rich-tooltip="${buildTooltip(t('topbar.compute_data', '컴퓨팅 & 데이터'), [{label:t('topbar.owned_gpu', '보유 GPU'),value:fleetStats.ownedCount+t('topbar.gpu_unit', '대')},{label:t('topbar.cloud', '클라우드'),value:fleetStats.cloudCount+t('topbar.gpu_unit', '대')},{label:t('compute.total_tflops', '총 TFLOPS'),value:fleetStats.totalTFLOPS.toLocaleString()},{label:t('compute.max_vram', '최대 VRAM'),value:fleetStats.maxVRAM+'GB'},{label:t('topbar.data', '데이터'),value:totalData+'TB'},{label:t('topbar.monthly_cost', '월 비용'),value:'$'+fleetStats.monthlyCost.toLocaleString(),color:'var(--danger)'}]).replace(/"/g,'&quot;')}">
                    <div class="res-main">${icon('gpu', 14)} <span class="res-big">${this._termValue('tflops', fleetStats.totalTFLOPS.toLocaleString(), {
                        breakdown: [
                            { label: t('topbar.owned_gpu', '보유 GPU'), value: `${fleetStats.ownedCount}${t('topbar.gpu_unit', '대')}` },
                            { label: t('topbar.cloud', '클라우드'), value: `${fleetStats.cloudCount}${t('topbar.gpu_unit', '대')}` },
                            { label: t('topbar.monthly_cost', '월 비용'), value: `$${Math.round(fleetStats.monthlyCost || 0).toLocaleString()}` }
                        ]
                    })}</span></div>
                    <div class="res-sub">${icon('data', 11)} ${totalData}TB · ${this._termValue('vram', `${fleetStats.maxVRAM}GB`, {
                        breakdown: [
                            { label: t('topbar.owned_gpu', '보유 GPU'), value: `${fleetStats.totalCount}${t('topbar.gpu_unit', '대')}` },
                            { label: t('compute.total_tflops', '총 TFLOPS'), value: fleetStats.totalTFLOPS.toLocaleString() }
                        ]
                    })}${tflopsDelta ? ` · ${tflopsDelta}` : ''}</div>
                </div>
                <div class="res-group" data-rich-tooltip="${buildTooltip(t('game.talent', '인재'), [{label:t('topbar.assigned_research', '연구 배치'),value:this.state.talents.filter(t=>t.assignment).length+t('creation.stat.people', '명')},{label:t('topbar.idle', '대기'),value:this.state.talents.filter(t=>!t.assignment).length+t('creation.stat.people', '명')},{label:t('topbar.avg_morale', '평균 사기'),value:Math.round(this.state.talents.reduce((s,t)=>s+t.morale,0)/(this.state.talents.length||1))+'%'}]).replace(/"/g,'&quot;')}">
                    <div class="res-main">${icon('talent', 14)} <span class="res-big">${this.state.talents.length}${t('creation.stat.people', '명')}</span></div>
                    <div class="res-sub">${t('topbar.assigned', '배치')} ${this.state.talents.filter(t=>t.assignment).length} · ${this._termValue('morale', `${avgMorale}%`, {
                        breakdown: [
                            { label: t('topbar.idle', '대기'), value: `${this.state.talents.filter(t=>!t.assignment).length}` },
                            { label: t('talent.loyalty', '충성'), value: `${Math.round(this.state.talents.reduce((sum, talent) => sum + (talent.loyalty || 0), 0) / (this.state.talents.length || 1))}%` }
                        ]
                    })}${talentDelta ? ` · ${talentDelta}` : ''}</div>
                </div>
                <div class="res-group" data-rich-tooltip="${revenueBreakdown}">
                    <div class="res-main">${icon('rocket', 14)} <span class="res-big">${this._termValue('serviceUsers', Math.round(serviceOverview.users).toLocaleString(), {
                        breakdown: [
                            { label: t('models.service.total_revenue', '총 서비스 수익'), value: `$${Math.round(serviceOverview.revenue || 0).toLocaleString()}${t('topbar.per_month', '/월')}` },
                            { label: t('models.service.compute_allocated', '서비스 할당'), value: `${Math.round(serviceOverview.allocatedTFLOPS || 0).toLocaleString()} TF` }
                        ]
                    })}</span></div>
                    <div class="res-sub">${t('models.service.active', '서비스')} · $${this._shortNum(serviceOverview.revenue)}${t('topbar.per_month', '/월')}</div>
                </div>
                <div class="res-group" data-rich-tooltip="${expenseBreakdown}">
                    <div class="res-main">${icon('diamond', 14)} <span class="res-big" id="live-valuation">${this._termValue('valuation', this._shortNum(eco.valuation), {
                        breakdown: [
                            { label: t('company.market_share', '시장 점유율'), value: `${Number(this.state.reputation?.marketShare || 0).toFixed(1)}%` },
                            { label: t('company.investor_trust', '투자자 신뢰도'), value: String(Number(this.state.reputation?.investorTrust || 0)) },
                            { label: t('safety.short', '안전'), value: String(Math.round(Number(this.state.safety?.posture || 0))) }
                        ]
                    })}</span></div>
                    <div class="res-sub">${this._termLabel('fundingRound', getFundingRoundName(FUNDING_ROUNDS[eco.fundingStage]), {
                        value: getFundingRoundName(FUNDING_ROUNDS[eco.fundingStage]),
                        extraLines: [
                            t('company.funding_round_hint', '높은 라운드로 갈수록 더 큰 자금과 더 엄격한 기대가 따라옵니다.')
                        ]
                    })}${valuationDelta ? ` · ${valuationDelta}` : ''}</div>
                </div>
                <div class="res-group" data-rich-tooltip="${safetyBreakdown}">
                    <div class="res-main">${icon('shield', 14)} <span class="res-big">${this._termValue('safetyScore', String(this.state.safety?.posture || 0), {
                        breakdown: [
                            { label: t('company.market_share', '시장 점유율'), value: `${Number(this.state.reputation?.marketShare || 0).toFixed(1)}%` },
                            { label: t('company.investor_trust', '투자자 신뢰도'), value: String(Number(this.state.reputation?.investorTrust || 0)) }
                        ]
                    })}</span></div>
                    <div class="res-sub">${this._termLabel('safetyScore', t('safety.short', '안전'))}</div>
                </div>
                <div class="res-group">
                    <div class="res-main">${icon('globe', 14)} <span class="res-big"><span class="term-link" tabindex="0" data-term-tooltip="${this._aiFavorabilityTooltipData()}">${aiF}%</span></span></div>
                    <div class="res-sub">${this._termLabel('aiFavorability', t('topbar.ai_favorability', 'AI 호감'))}</div>
                </div>
                <!-- 병목/위협은 우측 우선순위 패널에 표시 -->
            </div>

            <div class="top-right">
                <div class="time-control-panel">
                    <span class="date" id="live-date">${this.time.getDateString()}</span>
                    <div class="speed-controls" id="speed-controls">
                        <button class="speed-btn ${this.time.speed === 0 ? 'active' : ''}" onclick="game.time.togglePause()" title="Space">${icon('pause', 14)}</button>
                        <button class="speed-btn ${this.time.speed === 1 ? 'active' : ''}" onclick="game.time.setSpeed(1)" title="1">${icon('play', 14)}</button>
                        <button class="speed-btn ${this.time.speed === 2 ? 'active' : ''}" onclick="game.time.setSpeed(2)" title="2">2×</button>
                        <button class="speed-btn ${this.time.speed === 3 ? 'active' : ''}" onclick="game.time.setSpeed(3)" title="3">3×</button>
                        <button class="speed-btn ${this.time.speed === 4 ? 'active' : ''}" onclick="game.time.setSpeed(4)" title="4">4×</button>
                        <button class="speed-btn ${this.time.speed === 5 ? 'active' : ''}" onclick="game.time.setSpeed(5)" title="5">5×</button>
                    </div>
                </div>
            </div>
        `;
    }

    _shortNum(n) {
        const abs = Math.abs(n);
        const sign = n < 0 ? '-' : '';
        if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
        if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
        if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
        return `${sign}${Math.floor(abs)}`;
    }

    _getBottleneckLabel() {
        const b = detectBottleneck(this.state);
        return b.label || t('sib.none', '양호');
    }

    _getBottleneckColor() {
        const b = detectBottleneck(this.state);
        if (b.severity === 'critical') return 'var(--danger)';
        if (b.severity === 'warning') return 'var(--warning)';
        return 'var(--text-secondary)';
    }

    _getTopThreatLabel() {
        return detectTopThreat(this.state) || '-';
    }

    async _refreshSteamProfile() {
        try {
            const available = await steam.isAvailable();
            if (!available) {
                this._steamProfile = { available: false, name: null };
                return;
            }
            const name = await steam.getPlayerName();
            this._steamProfile = {
                available: true,
                name: name || 'Steam Player'
            };
            this.renderTopBar();
            this._updateSteamRichPresence();
        } catch {
            this._steamProfile = { available: false, name: null };
        }
    }

    _updateSteamRichPresence(tab = this.currentTab) {
        if (!this._steamProfile?.available || !this.state?.gameStarted) return;
        const tabLabel = t(`game.${tab}`, tab);
        const companyName = this.state.player.companyName || 'AGI Manager';
        const year = this.time?.currentDate?.year || 2017;
        void steam.setRichPresence(`${companyName} · ${tabLabel} · ${year}`);
    }

    _flag(countryCode) {
        return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent-dim);font-size:0.6rem;font-family:var(--font-display);font-weight:700;color:var(--accent);border:1px solid rgba(79,195,247,0.15);letter-spacing:0.5px;flex-shrink:0">${countryCode}</span>`;
    }

    _dataInventorySummary(limit = 3) {
        const dataState = this._ensureDataState();
        const entries = Object.entries(dataState.assets || {})
            .filter(([, asset]) => Number(asset?.tb || 0) > 0)
            .sort((a, b) => Number(b[1]?.tb || 0) - Number(a[1]?.tb || 0))
            .slice(0, limit);
        return entries.length > 0
            ? entries.map(([id, asset]) => `${_localizedDataTypeName(id)} ${Math.round(Number(asset?.tb || 0) * 10) / 10}TB`).join(', ')
            : t('models.no_data_assets', '보유 데이터 없음');
    }

    _ensureDataState() {
        normalizeDataStateCompatibility(this.state);
        return this.state.data;
    }

    _recalculateDataState(syncInventory = false) {
        return this._ensureDataState();
    }

    _getDataMethod(methodId) {
        return DATA_ACQUISITION_METHODS.find(method => method.id === methodId) || DATA_ACQUISITION_METHODS[0];
    }

    _getDataMethodAvailability(method) {
        const serviceOverview = this._getServiceOverview();
        const missing = [];
        const requirements = method?.requirements || {};
        const reputationFloor = Math.max(
            Number(this.state.reputation.corporate || 0),
            Number(this.state.reputation.publicImage || 0)
        );
        const hasActiveService = Number(serviceOverview.users || 0) > 0
            || this.state.models.some(model => (model?.serviceChannels || []).some(channel => channel?.active));

        if (requirements.minReputation != null && reputationFloor < Number(requirements.minReputation || 0)) {
            missing.push(t('data.require.reputation', '평판 {value}+ 필요', { value: requirements.minReputation }));
        }
        if (requirements.tech && !this.state.technologies?.[requirements.tech]?.completed) {
            missing.push(t('data.require.tech', '기술 필요: {tech}', { tech: _localizedTechName(requirements.tech) }));
        }
        if (requirements.deployedModels != null) {
            const deployedModels = this.state.models.filter(model => model?.deployed || model?.trained).length;
            if (deployedModels < Number(requirements.deployedModels || 0)) {
                missing.push(t('data.require.model', '배포된 모델 {count}+ 필요', { count: requirements.deployedModels }));
            }
        }
        if (requirements.activeServices != null && !hasActiveService) {
            missing.push(t('data.require.service', '활성 서비스 필요'));
        }

        const available = missing.length === 0;
        return {
            available,
            reasons: missing,
            label: available ? t('common.available', '사용 가능') : missing[0] || t('common.locked', '잠김')
        };
    }

    _getDataMethodPreview(methodId, typeId, amountTB) {
        const method = this._getDataMethod(methodId);
        const dataState = this._ensureDataState();
        const resolvedTypeId = DATA_TYPES[typeId] ? typeId : 'web_text';
        const type = DATA_TYPES[resolvedTypeId] || DATA_TYPES.web_text;
        const typeProfile = dataState.assets?.[resolvedTypeId] || DATA_TYPE_PROFILES[resolvedTypeId] || DATA_TYPE_PROFILES.web_text;
        const amount = method.id === 'userLogs' ? 1 : Math.max(0.5, Number(amountTB || 1));
        const baseCost = Math.round(amount * Number(method.costPerTB || 0));
        const computeCost = Math.round(amount * Number(method.computeCostPerTB || 0));
        const totalCost = baseCost + computeCost;
        const quality = Math.round((Number(method.qualityBase || typeProfile.quality) + Number(typeProfile.quality || 0)) / 2);
        const freshness = Math.round((Number(method.freshnessBase || typeProfile.freshness) + Number(typeProfile.freshness || 0)) / 2);
        const bias = Math.round((Number(method.biasRisk || typeProfile.bias) + Number(typeProfile.bias || 0)) / 2);
        const legal = Math.round((Number(method.legalSensitivity || typeProfile.legal) + Number(typeProfile.legal || 0)) / 2);
        const durationMonths = method.id === 'userLogs' ? 0 : Math.max(0, Number(method.monthsToAcquire || 0));
        const availableTB = Number(type?.availableTB || 0);
        return {
            method,
            type,
            amount,
            totalCost,
            baseCost,
            computeCost,
            quality,
            freshness,
            bias,
            legal,
            durationMonths,
            availableTB,
            riskLabel: method.riskLevel === 0 ? t('data.risk.none', '없음')
                : method.riskLevel === 1 ? t('data.risk.low', '낮음')
                    : method.riskLevel === 2 ? t('data.risk.medium', '보통')
                        : t('data.risk.high', '높음')
        };
    }

    _recordDataGain(typeId, amountTB, sourceId = 'purchase', profile = null) {
        addDataAsset(this.state, typeId, amountTB, sourceId, profile || {});
        return this._ensureDataState();
    }

    _refreshMonthlyPassiveDataGain() {
        return Number(this._ensureDataState().monthlyPassiveGain || 0);
    }

    _completeDataAcquisition(acquisition) {
        if (!acquisition) return;
        const method = this._getDataMethod(acquisition.method);
        const preview = this._getDataMethodPreview(acquisition.method, acquisition.type, acquisition.tb);
        this.state.addNews(t('data.event.complete', '{method}으로 {type} {amount}TB 확보 완료.', {
            method: _localizedDataMethodName(method),
            type: _localizedDataTypeName(preview.type),
            amount: Math.round(preview.amount * 10) / 10
        }), acquisition.method === 'purchase' ? 'success' : 'info');
    }

    _processDataMonthly() {
        const result = processMonthlyData(this.state);
        for (const acquisition of result.completed || []) {
            this._completeDataAcquisition(acquisition);
        }
        this._ensureDataState();
        return result;
    }

    _getDataTrainingProfile(dataMix = {}) {
        return calculateTrainingDataQuality(this.state, dataMix);
    }

    _normalizeModelServiceState(model) {
        if (!model || typeof model !== 'object') return model;
        if (!Array.isArray(model.serviceChannels)) model.serviceChannels = [];
        // Get fleet capacity for clamping
        const fleetForClamp = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const maxTF = Math.max(0, Number(fleetForClamp.totalTFLOPS || 0));
        model.serviceChannels = model.serviceChannels
            .filter(channel => channel && channel.type && SERVICE_CHANNEL_META[channel.type])
            .map(channel => ({
                type: channel.type,
                active: Boolean(channel.active),
                allocatedTFLOPS: Math.min(Math.max(0, Number(channel.allocatedTFLOPS || 0)), maxTF),
                requiredTFLOPS: Math.max(0, Number(channel.requiredTFLOPS || 0)),
                monthlyRevenue: Math.max(0, Number(channel.monthlyRevenue || 0)),
                estimatedUsers: Math.max(0, Number(channel.estimatedUsers || 0)),
                priceMult: clampServicePriceMult(channel.priceMult, channel.type),
                targetComp: channel.targetComp || null,
                slot: channel.slot || null
            }));
        if (model.deployed && model.serviceChannels.length === 0 && model.deploymentStrategy) {
            const legacyType = model.deploymentStrategy === 'open_source' ? 'open_source' : model.deploymentStrategy;
            if (SERVICE_CHANNEL_META[legacyType]) {
                model.serviceChannels = [this._createServiceChannel(legacyType, model, {
                    active: true,
                    allocatedTFLOPS: this._getDefaultChannelAllocation(legacyType, model, fleetForClamp),
                    monthlyRevenue: Math.max(0, Number(model.monthlyRevenue || 0))
                })];
            }
        }
        // Recompute totalAllocatedTFLOPS from actual channels
        model.totalAllocatedTFLOPS = model.serviceChannels
            .filter(ch => ch.active)
            .reduce((sum, ch) => sum + Math.max(0, Number(ch.allocatedTFLOPS || 0)), 0);
        model.totalMonthlyRevenue = Math.max(0, Number(model.totalMonthlyRevenue ?? model.monthlyRevenue ?? 0));
        model.serviceMonths = Math.max(0, Number(model.serviceMonths || 0));
        model.trainingTFLOPS = Math.max(0, Number(model.trainingTFLOPS || 0));
        model.serviceQuality = Math.max(0, Number(model.serviceQuality || 0));
        return model;
    }

    _getDefaultChannelAllocation(type, model = {}, fleetStats = null) {
        const meta = SERVICE_CHANNEL_META[type] || { defaultAllocation: 50 };
        const performance = Math.max(1, Number(model.compositeScore || model.performance || 20));
        const idealAllocation = Math.max(10, Math.round((meta.defaultAllocation || 50) * Math.max(0.6, performance / 50)));
        // Clamp to actual fleet capacity so allocation never exceeds real TFLOPS
        if (fleetStats) {
            const totalTFLOPS = Math.max(0, Number(fleetStats.totalTFLOPS || 0));
            return Math.min(idealAllocation, Math.max(1, totalTFLOPS));
        }
        return idealAllocation;
    }

    _getServiceChannelMissingTechs(type) {
        const requiredTechs = SERVICE_CHANNEL_META[type]?.requiresTech || [];
        if (!requiredTechs.length) return [];
        const completedTechs = this.techTree.getCompletedTechs();
        return requiredTechs.filter(techId => !completedTechs.includes(techId));
    }

    _getServiceChannelRequirementText(type) {
        const missingTechs = this._getServiceChannelMissingTechs(type);
        if (!missingTechs.length) return '';
        return t('models.service.requires_tech', '필요 기술: {tech}', {
            tech: missingTechs.map(techId => _localizedTechName(techId)).join(', ')
        });
    }

    _getServiceChannelPriceBandLabel(type, priceMult) {
        const band = getServicePriceBand(priceMult, type);
        if (band === 'free') return t('service.price_free', '무료');
        if (band === 'cheap') return t('service.price_cheap', '저가');
        if (band === 'premium') return t('service.price_premium', '프리미엄');
        return t('service.price_standard', '표준');
    }

    _formatServiceChannelPrice(type, priceMult) {
        if (isFreeServiceChannel(type)) return t('service.price_free', '무료');
        return `${clampServicePriceMult(priceMult, type).toFixed(1)}×`;
    }

    _createServiceChannel(type, model = {}, overrides = {}) {
        const allocatedTFLOPS = Math.max(0, Number(overrides.allocatedTFLOPS ?? this._getDefaultChannelAllocation(type, model)));
        const priceMult = clampServicePriceMult(
            overrides.priceMult ?? (isFreeServiceChannel(type) ? 0 : 1),
            type
        );
        return {
            type,
            active: overrides.active !== undefined ? Boolean(overrides.active) : true,
            allocatedTFLOPS,
            requiredTFLOPS: Math.max(1, Number(overrides.requiredTFLOPS ?? allocatedTFLOPS)),
            monthlyRevenue: Math.max(0, Number(overrides.monthlyRevenue || 0)),
            estimatedUsers: Math.max(0, Number(overrides.estimatedUsers || 0)),
            priceMult,
            targetComp: overrides.targetComp || null,
            slot: overrides.slot || null
        };
    }

    _upsertModelServiceChannel(model, type, overrides = {}) {
        this._normalizeModelServiceState(model);
        const next = [...model.serviceChannels];
        const index = next.findIndex(channel => channel.type === type);
        const existing = index >= 0 ? next[index] : null;
        const merged = this._createServiceChannel(type, model, { ...existing, ...overrides });
        if (index >= 0) next[index] = merged;
        else next.push(merged);
        return next;
    }

    _refreshServiceEconomySnapshot() {
        if (!this.economy) return;
        const prevReputation = {
            investorTrust: this.state.reputation.investorTrust,
            publicImage: this.state.reputation.publicImage,
            marketShare: this.state.reputation.marketShare
        };
        this.economy._calculateRevenue?.();
        this.economy._calculateExpenses?.();
        Object.assign(this.state.reputation, prevReputation);
    }

    _getServiceOverview() {
        const totals = {
            users: 0,
            revenue: 0,
            allocatedTFLOPS: 0,
            satisfaction: 0,
            internalCost: this.state.internalAI?.totalMonthlyCost || 0
        };
        const models = this.state.models || [];
        let weightedSatisfaction = 0;
        for (const model of models) {
            this._normalizeModelServiceState(model);
            for (const channel of model.serviceChannels.filter(channel => channel.active)) {
                const users = Number(channel.estimatedUsers || 0);
                const revenue = Number(channel.monthlyRevenue || 0);
                const allocated = Number(channel.allocatedTFLOPS || 0);
                const required = Math.max(1, Number(channel.requiredTFLOPS || allocated || 1));
                totals.users += users;
                totals.revenue += revenue;
                totals.allocatedTFLOPS += allocated;
                weightedSatisfaction += users * Math.min(1, allocated / required);
            }
        }
        totals.satisfaction = totals.users > 0 ? weightedSatisfaction / totals.users : (this.state.service?.satisfaction || 0);
        return totals;
    }

    _buildCommunityOpenSourceModels() {
        const year = this.time?.currentDate?.year || 2017;
        const communityModels = [
            {
                id: 'os_bert_2019',
                name: 'Community NLP 2019',
                source: 'opensource',
                releasedYear: 2019,
                capabilities: { language: 25, reasoning: 15, coding: 8, math: 12, multimodal: 0, safety: 20, speed: 35 },
                performance: 20
            },
            {
                id: 'os_llm_2020',
                name: 'Community LLM 2020',
                source: 'opensource',
                releasedYear: 2020,
                capabilities: { language: 40, reasoning: 25, coding: 20, math: 20, multimodal: 5, safety: 22, speed: 32 },
                performance: 30
            },
            {
                id: 'os_llama2_2023',
                name: 'Community Llama 2',
                source: 'opensource',
                releasedYear: 2023,
                capabilities: { language: 55, reasoning: 40, coding: 35, math: 34, multimodal: 15, safety: 28, speed: 40 },
                performance: 46
            }
        ];
        return communityModels.filter(model => model.releasedYear <= year);
    }

    _syncOpenSourceModels() {
        const ownOpenSource = (this.state.models || [])
            .filter(model => model.deployed && model.deploymentStrategy === 'open_source')
            .map(model => ({
                id: `${model.id}_oss`,
                name: model.name,
                source: 'opensource',
                releasedYear: this.time?.currentDate?.year || 2017,
                capabilities: { ...model.capabilities },
                performance: model.compositeScore || model.performance || 0,
                inferenceCost: model.inferenceCost || 0
            }));
        const current = Array.isArray(this.state.openSourceModels) ? this.state.openSourceModels : [];
        const merged = [...this._buildCommunityOpenSourceModels(), ...current, ...ownOpenSource];
        this.state.openSourceModels = merged.filter((model, index, arr) =>
            model && arr.findIndex(entry => entry.id === model.id) === index
        );
    }

    _buildCompetitorServiceModel(competitor) {
        const currentModel = competitor?.currentModel || {};
        const perf = Math.max(1, Number(currentModel.performance || 0));
        return {
            id: `${competitor.id}_${currentModel.name || 'api'}`,
            name: `${competitor.name} ${currentModel.name || 'API'}`,
            competitorId: competitor.id,
            source: 'competitor',
            performance: perf,
            capabilities: {
                language: perf,
                reasoning: perf,
                coding: Math.max(10, Math.round(perf * 0.85)),
                math: Math.max(10, Math.round(perf * 0.8)),
                multimodal: Math.max(0, Math.round(perf * 0.5)),
                safety: Math.max(5, Math.round(perf * 0.7)),
                speed: Math.max(10, Math.round(perf * 0.9))
            },
            relation: competitor.relation || 0
        };
    }

    _getOwnInternalAICandidates() {
        return this.state.models
            .filter(model => model.deployed)
            .map(model => ({
                group: 'own',
                label: t('internal_ai.group.own', '자사 모델'),
                model: {
                    id: model.id,
                    name: model.name,
                    source: 'own',
                    deploymentStrategy: model.deploymentStrategy,
                    capabilities: { ...model.capabilities },
                    performance: model.compositeScore || model.performance || 0,
                    inferenceCost: model.inferenceCost || 0
                },
                meta: `$${Math.round((model.inferenceCost || 0) * 0.3).toLocaleString()}${t('topbar.per_month', '/월')}`
            }));
    }

    _getCompetitorInternalAICandidates() {
        return (this.state.competitors || [])
            .map(competitor => ({
                competitor,
                subscription: this.companies.canSubscribeToCompetitorModel(competitor.id)
            }))
            .filter(({ subscription }) => subscription?.eligible)
            .map(({ competitor, subscription }) => ({
                group: 'competitor',
                label: t('internal_ai.group.competitor', '경쟁사 API'),
                model: this._buildCompetitorServiceModel(competitor),
                meta: `$${subscription.monthlyCost.toLocaleString()}${t('topbar.per_month', '/월')}`
            }));
    }

    _getOpenSourceInternalAICandidates() {
        this._syncOpenSourceModels();
        return (this.state.openSourceModels || []).map(model => ({
            group: 'opensource',
            label: t('internal_ai.group.opensource', '오픈소스'),
            model: {
                ...model,
                source: 'opensource',
                inferenceCost: model.inferenceCost || Math.max(500, Math.round((model.performance || 10) * 20))
            },
            meta: t('internal_ai.opensource_cost', 'GPU 필요')
        }));
    }

    _fundsTooltip() {
        const s = this.state;
        const eco = s.economy;
        const inc = s.resources.monthlyIncome;
        const exp = s.resources.monthlyExpense;
        return buildTooltip(t('company.funds_on_hand', '보유 자금'), [
            { label: t('company.monthly_income', '월 수입'), value: '+$' + this._shortNum(inc), color: 'var(--success)' },
            { label: `  ${t('company.api', 'API')} ` + t('company.revenue', '수익'), value: '$' + this._shortNum(eco.revenue.api) },
            { label: `  ${t('company.b2b', 'B2B')} ` + t('company.contracts', '계약'), value: '$' + this._shortNum(eco.revenue.b2b) },
            { label: '  ' + t('company.consumer', '소비자'), value: '$' + this._shortNum(eco.revenue.consumer) },
            { label: t('company.monthly_expense', '월 지출'), value: '-$' + this._shortNum(exp), color: 'var(--danger)' },
            { label: '  ' + t('company.salary_cost', '인건비'), value: '$' + this._shortNum(eco.expenses.salaries) },
            { label: '  GPU', value: '$' + this._shortNum(eco.expenses.cloudCompute + eco.expenses.ownedGPUPower) },
            { label: '  ' + t('internal_ai.total_cost', '내부 AI 비용'), value: '$' + this._shortNum(eco.expenses.internalAI || 0) },
            { label: t('company.monthly_balance', '월 수지'), value: (inc - exp >= 0 ? '+' : '') + '$' + this._shortNum(inc - exp), color: inc - exp >= 0 ? 'var(--success)' : 'var(--danger)' },
        ]).replace(/"/g, '&quot;');
    }

    _termLabel(termId, fallbackLabel, options = {}) {
        return term(termId, fallbackLabel, options);
    }

    _termValue(termId, value, options = {}) {
        return termValue(termId, value, options);
    }

    _runwayValueText() {
        const runway = this.state.economy?.runway;
        if (runway === Infinity || !Number.isFinite(runway)) return '∞';
        return `${runway}${t('world.months', '개월')}`;
    }

    _runwayTooltipData() {
        const eco = this.state.economy;
        const balance = this.state.getMonthlyBalance();
        return escapeTooltipAttr(buildTermTooltipHtml('runway', {
            value: this._runwayValueText(),
            breakdown: [
                { label: t('company.funds_on_hand', '보유 자금'), value: `$${Math.round(this.state.resources.funds || 0).toLocaleString()}` },
                { label: t('company.monthly_income', '월 수입'), value: `$${Math.round(this.state.resources.monthlyIncome || 0).toLocaleString()}` },
                { label: t('company.monthly_expense', '월 지출'), value: `$${Math.round(this.state.resources.monthlyExpense || 0).toLocaleString()}` },
                { label: t('company.monthly_balance', '월 수지'), value: `${balance >= 0 ? '+' : ''}$${Math.round(balance).toLocaleString()}` }
            ],
            extraLines: [
                eco.runway === Infinity
                    ? t('company.runway_infinite_hint', '현재는 적자가 없어 런웨이가 사실상 무한대입니다.')
                    : t('company.runway_watch_hint', '런웨이가 짧아질수록 투자 유치와 비용 절감이 더 시급해집니다.')
            ]
        }));
    }

    _aiFavorabilityTooltipData() {
        const aiFavorability = Math.round(Number(this.state.global.aiFavorability || 0));
        const geopoliticalTension = Math.round(Number(this.state.global.geopoliticalTension || 0));
        return escapeTooltipAttr(buildTermTooltipHtml('aiFavorability', {
            value: `${aiFavorability}%`,
            breakdown: [
                { label: t('world.global_tension', '지정학 긴장도'), value: `${geopoliticalTension}%` },
                { label: t('safety.label', '안전 태세'), value: `${Math.round(Number(this.state.safety?.posture || 0))}` },
                { label: t('world.market_share', '시장 점유율'), value: `${Number(this.state.reputation?.marketShare || 0).toFixed(1)}%` }
            ],
            extraLines: [
                aiFavorability < 30
                    ? t('right.alert.ai_backlash_sub', '호감도 {value}%', { value: aiFavorability })
                    : t('topbar.ai_sentiment_hint', '대중 정서가 안정적일수록 규제와 반발 이벤트가 줄어듭니다.')
            ]
        }));
    }

    _researchSpeedTooltipData() {
        const researchMultiplier = Number(this.state.player?.modifiers?.researchSpeed || 1);
        const activeResearch = this.techTree.getResearchingTechs().length;
        const teamResearchPower = getTeamResearchPower(this.state.talents);
        return escapeTooltipAttr(buildTermTooltipHtml('researchSpeed', {
            value: `${researchMultiplier.toFixed(2)}x`,
            breakdown: [
                { label: t('company.team_research_power', '팀 연구력'), value: String(teamResearchPower) },
                { label: t('right.active_research', '활성 연구'), value: String(activeResearch) },
                { label: t('internal_ai.slot.research_assist', '연구 지원'), value: `${Math.round((getInternalAIBonus(this.state.internalAI, 'research_assist') || 0) * 100)}%` }
            ],
            extraLines: [
                t('research.speed_hint', '인재 배치, 문화, 내부 AI, 국가 보너스가 함께 반영됩니다.')
            ]
        }));
    }

    _chipProgramTooltipData() {
        const economy = this.state.economy || {};
        const activePrograms = economy.chipPrograms || [];
        const completedPrograms = economy.completedChipPrograms || [];
        const monthlyBurn = activePrograms.reduce((sum, program) => sum + Number(program?.monthlyBurn || 0), 0);
        return escapeTooltipAttr(buildTermTooltipHtml('chipProgram', {
            value: `${activePrograms.length}${t('common.items', '개')}`,
            breakdown: [
                { label: t('chip.active_programs', '진행 중'), value: String(activePrograms.length) },
                { label: t('chip.completed_programs', '완료'), value: String(completedPrograms.length) },
                { label: t('topbar.monthly_cost', '월 비용'), value: `$${Math.round(monthlyBurn).toLocaleString()}` }
            ],
            extraLines: [
                activePrograms.length > 0
                    ? t('chip.program_progress_hint', '완료되면 TFLOPS 효율과 공급망 안정성이 향상됩니다.')
                    : t('chip.program_idle_hint', '프로그램을 시작하면 장기적인 칩 자립 노선을 열 수 있습니다.')
            ]
        }));
    }

    _dataQualityTooltipData() {
        const dataState = this._ensureDataState();
        return escapeTooltipAttr(buildTermTooltipHtml('dataQuality', {
            value: `${Math.round(Number(dataState.avgQuality || 0))}%`,
            breakdown: [
                { label: t('data.summary.total', '총 데이터'), value: `${Math.round(Number(dataState.totalTB || 0) * 10) / 10} TB` },
                { label: t('data.summary.freshness', '평균 신선도'), value: `${Math.round(Number(dataState.avgFreshness || 0))}%` },
                { label: t('data.summary.legal', '법적 위험'), value: `${Math.round(Number(dataState.legalRiskScore || 0))}%` }
            ],
            extraLines: [
                t('data.quality_hint', '높은 품질은 학습 안정성과 벤치마크 성능을 동시에 끌어올립니다.')
            ]
        }));
    }

    _dataFreshnessTooltipData() {
        const dataState = this._ensureDataState();
        return escapeTooltipAttr(buildTermTooltipHtml('dataFreshness', {
            value: `${Math.round(Number(dataState.avgFreshness || 0))}%`,
            breakdown: [
                { label: t('data.summary.passive', '월간 자동 수집'), value: `${(dataState.monthlyPassiveGain || 0).toFixed(dataState.monthlyPassiveGain % 1 ? 1 : 0)} TB` },
                { label: t('data.pending', '진행 중인 획득'), value: String((dataState.pendingAcquisitions || []).length) },
                { label: t('data.summary.total', '총 데이터'), value: `${Math.round(Number(dataState.totalTB || 0) * 10) / 10} TB` }
            ],
            extraLines: [
                t('data.freshness_hint', '시간이 흐를수록 신선도가 줄어들며, 최신 로그와 신규 획득으로 다시 끌어올릴 수 있습니다.')
            ]
        }));
    }

    _legalRiskTooltipData() {
        const dataState = this._ensureDataState();
        return escapeTooltipAttr(buildTermTooltipHtml('legalRisk', {
            value: `${Math.round(Number(dataState.legalRiskScore || 0))}%`,
            breakdown: [
                { label: t('data.summary.passive', '월간 자동 수집'), value: `${(dataState.monthlyPassiveGain || 0).toFixed(dataState.monthlyPassiveGain % 1 ? 1 : 0)} TB` },
                { label: t('data.pending', '진행 중인 획득'), value: String((dataState.pendingAcquisitions || []).length) },
                { label: t('world.home_policy', '본국 정책'), value: this.state._countryPolicy?.type || '-' }
            ],
            extraLines: [
                t('data.legal_hint', '스크래핑과 사용자 로그는 가격이 낮지만 법적 민감도를 크게 끌어올릴 수 있습니다.')
            ]
        }));
    }

    _geopoliticalTensionTooltipData() {
        const homePolicy = this.state._countryPolicy || getCountryPolicy(this.state.player.country);
        const tension = Math.round(Number(this.state.global.geopoliticalTension || 0));
        return escapeTooltipAttr(buildTermTooltipHtml('geopoliticalTension', {
            value: `${tension}%`,
            breakdown: [
                { label: t('world.regulation', '규제'), value: `${Number(homePolicy?.regulationLevel || 0)}/10` },
                { label: t('world.gpu_access', 'GPU 접근성'), value: `${Number(homePolicy?.gpuAccess || 0)}/10` },
                { label: t('world.export_control', '수출 통제'), value: `${Number(homePolicy?.exportControl || 0)}/10` }
            ],
            extraLines: [
                tension >= 70
                    ? t('world.tension_alert', '긴장도가 높아 수출 통제와 공급망 압박이 강화되는 구간입니다.')
                    : t('world.tension_hint', '긴장도는 공급망, 외교, 시장 접근성을 함께 흔듭니다.')
            ]
        }));
    }

    _updateBadges() {
        // News badge
        const newsBadge = document.getElementById('badge-news');
        if (newsBadge) {
            if (this._unreadNewsCount > 0) {
                newsBadge.textContent = this._unreadNewsCount > 9 ? '9+' : this._unreadNewsCount;
                newsBadge.className = 'nav-badge has-count show';
            } else {
                newsBadge.className = 'nav-badge';
            }
        }

        // Talent badge (idle count)
        const talentBadge = document.getElementById('badge-talent');
        if (talentBadge) {
            const idle = this.state.talents.filter(t => !t.assignment).length;
            if (idle > 0) {
                talentBadge.textContent = idle;
                talentBadge.className = 'nav-badge has-count nav-badge--warning show';
            } else {
                talentBadge.className = 'nav-badge';
            }
        }

        // Models badge (trained but not deployed)
        const modelBadge = document.getElementById('badge-models');
        if (modelBadge) {
            const ready = this.state.models.filter(m => m.trained && !m.deployed).length;
            if (ready > 0) {
                modelBadge.textContent = ready;
                modelBadge.className = 'nav-badge has-count nav-badge--success show';
            } else {
                modelBadge.className = 'nav-badge';
            }
        }
    }

    _countryStatBar(value, color) {
        const pct = Math.round(value * 10);
        return `<span style="display:inline-flex;align-items:center;gap:6px;min-width:120px"><span style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden"><span style="display:block;width:${pct}%;height:100%;background:${color};border-radius:3px"></span></span><span style="font-family:var(--font-mono);font-size:0.78rem;width:20px;text-align:right">${value}</span></span>`;
    }

    // Lightweight live update (called by rAF — no innerHTML, just text updates)
    _renderTopBarLive() {
        const dateEl = document.getElementById('live-date');
        if (dateEl) dateEl.textContent = this.time.getDateString();

        // Animated value ticking for funds
        this.valueTracker.update('live-funds', this.state.resources.funds, 400, (v) => this._shortNum(v));
        const fundsGroup = document.getElementById('funds-res-group');
        if (fundsGroup) {
            fundsGroup.classList.remove('res-healthy', 'res-danger', 'res-critical', 'res-group--danger');
            fundsGroup.classList.add(getFundsHealthClass(this.state.getMonthlyBalance(), this.state.economy.runway));
        }
    }

    // Update speed button active states
    _renderSpeedControls() {
        const container = document.getElementById('speed-controls');
        if (!container) return;
        const btns = container.querySelectorAll('.speed-btn');
        btns.forEach((btn, i) => {
            btn.classList.toggle('active', i === this.time.speed);
        });
        const label = document.getElementById('speed-label');
        if (label) label.textContent = this.time.getSpeedLabel();
    }

    // Show/hide pause overlay
    _updatePauseOverlay() {
        const overlay = document.getElementById('pause-overlay');
        if (!overlay) return;
        if (this.time.isPaused()) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    renderContent() {
        const panel = document.getElementById('content-panel');
        if (!panel) return;

        if (this.currentTab === 'map') {
            panel.classList.add('hidden');
            panel.classList.remove('fullscreen-tab');
            return;
        }

        panel.classList.remove('hidden');

        // Research tab goes fullscreen
        if (this.currentTab === 'research') {
            panel.classList.add('fullscreen-tab');
        } else {
            panel.classList.remove('fullscreen-tab');
        }

        switch (this.currentTab) {
            case 'company': this._renderCompany(panel); break;
            case 'research': this._renderResearch(panel); break;
            case 'talent': this._renderTalent(panel); break;
            case 'models': this._renderModels(panel); break;
            case 'gpu': this._renderGpu(panel); break;
            case 'data': this._renderData(panel); break;
            case 'leaderboard': this._renderLeaderboard(panel); break;
            case 'world': this._renderWorld(panel); break;
            case 'news': this._renderNews(panel); break;
            default: panel.classList.add('hidden');
        }
    }

    switchTab(tab) {
        if (tab === this.currentTab) return;
        this.sound.play('tab_switch');

        // Track news reading
        if (tab === 'news') { this._unreadNewsCount = 0; this._lastViewedNewsTab = true; }

        // Update nav active state
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');

        const panel = document.getElementById('content-panel');
        const mapEl = document.getElementById('world-map-bg');

        // Animated tab transition
        const doSwitch = () => {
            this.currentTab = tab;
            this.renderContent();
            this._updateSteamRichPresence(tab);
            // Map stays interactive — just lower z-index when panel is open
            if (mapEl) mapEl.style.pointerEvents = 'auto';
            this._updateBadges();

            if (tab !== 'map' && panel) {
                panel.classList.remove('panel-exit');
                panel.classList.add('panel-enter');
                const onEnd = () => { panel.classList.remove('panel-enter'); panel.removeEventListener('animationend', onEnd); };
                panel.addEventListener('animationend', onEnd);
            }
        };

        if (panel && !panel.classList.contains('hidden') && this.currentTab !== 'map') {
            // Fade out current, then switch
            panel.classList.add('panel-exit');
            setTimeout(doSwitch, 120);
        } else {
            doSwitch();
        }
    }

    _renderCompany(el) {
        try { return this._renderCompanyInner(el); } catch(e) {
            console.error('[Company Tab Error]', e);
            el.innerHTML = `<div style="padding:20px;color:#ef4444"><h3>회사 탭 렌더링 오류</h3><pre style="font-size:0.7rem;color:#94a3b8;white-space:pre-wrap">${e.message}\n${e.stack}</pre></div>`;
        }
    }
    _renderCompanyInner(el) {
        const s = this.state;
        const eco = s.economy;
        const country = COUNTRIES[s.player.country];
        const leaderboard = this.companies.getLeaderboard();
        const activeCompanyTab = getCompanyTabById(this._companyTab);
        this._companyTab = activeCompanyTab.id;
        const balance = s.getMonthlyBalance();
        const fmt = (n) => this._shortNum(n);
        const fmtFull = (n) => '$' + Math.floor(n).toLocaleString();
        const completedChipPrograms = eco.completedChipPrograms || [];
        const fleetStats = getFleetStats(eco.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: eco.colocation,
            completedChipPrograms,
            customSiliconBonuses: eco.customSiliconBonuses,
            datacenters: eco.datacenters
        });
        const totalData = getTotalDataTB(eco.dataAssets);

        // Funding round info
        const currentRound = FUNDING_ROUNDS[eco.fundingStage];
        const nextCheck = this.economy.canRaise();
        const terms = this.economy.getEstimatedTerms();
        const teamResearchPower = getTeamResearchPower(s.talents);
        const termTier = terms ? getRelativePerformanceTier(terms.bestModelRelativePerformance || 0) : null;

        // Runway display
        const runwayText = eco.runway === Infinity ? '∞' :
            eco.runway <= 0 ? `<span class="negative">0${t('world.months', '개월')}</span>` :
            eco.runway < 6 ? `<span class="negative">${eco.runway}${t('world.months', '개월')}</span>` :
            eco.runway < 12 ? `<span class="warning-text">${eco.runway}${t('world.months', '개월')}</span>` :
            `${eco.runway}${t('world.months', '개월')}`;
        const runwayValueText = this._runwayValueText();

        const fleetRows = (eco.gpuFleet || []).map(slot => {
            const gpu = getGpuById(slot.gpuId, { completedChipPrograms });
            if (!gpu) return '';
            const sourceLabel = slot.source === 'cloud'
                ? `${t('compute.cloud', '클라우드')} · ${(slot.provider || 'aws').toUpperCase()}`
                : slot.source === 'colocation'
                    ? t('compute.colocation', '코로케이션')
                    : t('compute.owned', '보유');
            const monthly = slot.source === 'cloud'
                ? Math.round((slot.monthlyUnitCost || gpu.cloudMonthly || BALANCE.ECONOMY.GPU_CLOUD_MONTHLY) * slot.count)
                : Math.round(((gpu.powerWatt || 300) / 300) * BALANCE.ECONOMY.GPU_POWER_COST * slot.count);
            return `
                <div class="company-list-item">
                    <div>
                        <div class="company-list-item__title">${this._termLabel(`gpu_${gpu.id}`, gpu.name)} × ${slot.count}</div>
                        <div class="company-list-item__meta">${sourceLabel} · ${this._termValue('tflops', `${gpu.tflops} TFLOPS`)} · ${this._termValue('vram', `${gpu.vram}GB`)}</div>
                    </div>
                    <div class="company-list-item__value">${t('compute.monthly_total', '월 {cost}', { cost: `$${monthly.toLocaleString()}` })}</div>
                </div>`;
        }).join('');

        const pendingRows = (eco.pendingGpuOrders || []).map(order => {
            const gpu = getGpuById(order.gpuId, { completedChipPrograms });
            return `
                <div class="stat-row" style="font-size:0.8rem">
                    <span>${gpu ? this._termLabel(`gpu_${gpu.id}`, gpu.name) : order.gpuId} × ${order.count}</span>
                    <span>${t('compute.arrives_in_months', '{months}개월 후 도착', { months: order.monthsRemaining })}</span>
                </div>`;
        }).join('');

        const dataRows = Object.entries(DATA_TYPES).map(([id, dataType]) => {
            const owned = eco.dataAssets?.[id] || 0;
            return `
                <div class="stat-row">
                    <span>${dataType.icon || ''} ${this._termLabel(`data_${id}`, _localizedDataTypeName(dataType))}</span>
                    <span>${owned}TB</span>
                </div>`;
        }).join('');
        const companyTabs = COMPANY_TABS.map(tab => ({
            id: tab.id,
            label: t(tab.labelKey, tab.fallback)
        }));

        const fundingHistoryHtml = eco.fundingHistory.length > 0 ? `
            <h4 style="margin-top:12px">${t('company.funding_history', '투자 이력')}</h4>
            ${eco.fundingHistory.map(h => `
                <div class="stat-row" style="font-size:0.8rem">
                    <span>${h.round} (${h.date?.year || ''}/${h.date?.month || ''})</span>
                    <span>${fmt(h.amount)} | ${t('company.ownership', '지분율')} ${h.ownership}%</span>
                </div>
            `).join('')}
        ` : '';

        const fundraisingBodyHtml = eco.fundraisingActive ? `
            <div style="margin-bottom:10px">
                <div style="color:var(--accent);font-weight:bold;margin-bottom:4px">
                    ${t('company.fundraising_in_progress', '{name} 투자 유치 진행 중...', { name: getFundingRoundName(eco.fundraisingTarget) })}
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${eco.fundraisingProgress}%"></div></div>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${Math.floor(eco.fundraisingProgress)}% ${t('company.completed', '완료')}</div>
                <button class="btn btn-small btn-danger" style="margin-top:6px" onclick="game.economy.cancelFundraising(); game.renderAll()">${t('company.cancel_fundraising', '유치 중단')}</button>
            </div>
        ` : terms ? `
            <div style="margin-bottom:8px">
                <div style="font-size:0.85rem;margin-bottom:6px">${t('company.next_round', '다음 라운드')}: <b style="color:var(--accent)">${getFundingRoundName(terms.round)}</b></div>
                <div class="stat-row"><span>${t('company.estimated_raise', '예상 투자금')}</span><span style="color:var(--success)">${fmt(terms.estimatedRaise)}</span></div>
                <div class="stat-row"><span>${t('company.estimated_dilution', '예상 희석')}</span><span>${terms.estimatedDilution}%</span></div>
                <div class="stat-row"><span>${t('company.pre_money', 'Pre-money 밸류')}</span><span>${fmt(terms.preMoneyValuation)}</span></div>
                <div class="stat-row"><span>${t('company.model_bonus', '모델 보너스')}</span><span>${terms.bestModelName ? t('company.model_bonus_value', '{name} · {percent}% · {label}', {
                    name: terms.bestModelName,
                    percent: getRelativePerformancePercent(terms.bestModelRelativePerformance || 0),
                    label: t(termTier?.key || 'benchmark.tier.market_fit', termTier?.fallback || '시장 수준')
                }) : t('company.model_bonus_none', '배포 모델 없음 · 기본 투자 조건')}</span></div>
                <div class="stat-row"><span>${t('company.term_quality', '투자 조건 품질')}</span><span style="color:${terms.termQuality > 60 ? 'var(--success)' : terms.termQuality > 30 ? 'var(--warning)' : 'var(--danger)'}">${terms.termQuality}%</span></div>
            </div>
            ${nextCheck.canRaise ? `
                <button class="btn btn-primary" onclick="game.economy.startFundraising(); game.renderAll()">${t('company.start_fundraising', '투자 유치 시작')}</button>
            ` : `
                <div style="font-size:0.8rem;color:var(--danger)">
                    <b>${t('company.requirements_missing', '요구사항 미달:')}</b>
                    <ul style="padding-left:16px;margin-top:4px">${nextCheck.missingReqs.map(r => `<li>${r}</li>`).join('')}</ul>
                </div>
            `}
        ` : `<div style="color:var(--text-secondary)">${t('company.no_more_rounds', '추가 투자 라운드 없음')}</div>`;

        const overviewPanelsHtml = renderCompanyOverviewPanels({
            company: {
                title: `${icon('company')} ${t('company.overview', '회사 현황')}`,
                rows: [
                    { label: t('company.name', '회사명'), value: s.player.companyName },
                    { label: t('company.ceo', 'CEO'), value: `${(s.player.ceoAvatar?.startsWith('http') || s.player.ceoAvatar?.startsWith('data:')) ? `<img src="${s.player.ceoAvatar}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle">` : (s.player.ceoAvatar || '👨‍💼')} ${s.player.ceoName || t('company.default_ceo_name', 'Alex Kim')}` },
                    { label: t('company.hq', '본사'), value: `<span style="display:flex;align-items:center;gap:4px">${country ? this._flag(country.flag) : ''} ${_localizedCountryName(country) || ''}</span>` },
                    { label: this._termLabel('fundingRound', t('company.stage', '단계'), { value: getFundingRoundName(currentRound) }), value: this._termLabel(`funding_${currentRound?.id || 'bootstrap'}`, getFundingRoundName(currentRound), { value: getFundingRoundName(currentRound) }), valueStyle: 'color:var(--accent)' },
                    { label: this._termLabel('valuation', t('company.valuation', '기업가치'), { value: fmt(eco.valuation) }), value: this._termValue('valuation', fmt(eco.valuation), {
                        breakdown: [
                            { label: t('company.market_share', '시장 점유율'), value: `${s.reputation.marketShare.toFixed(1)}%` },
                            { label: t('company.investor_trust', '투자자 신뢰도'), value: String(s.reputation.investorTrust) },
                            { label: t('safety.short', '안전'), value: String(Math.round(Number(s.safety?.posture || 0))) }
                        ]
                    }), valueStyle: 'color:var(--accent);font-weight:bold' },
                    { label: t('company.ownership', '지분율'), value: `${eco.ownershipPct}%` },
                    { label: t('company.total_raised', '누적 투자'), value: fmt(eco.totalRaised) },
                    { label: t('company.headcount', '인원'), value: `${s.talents.length}${t('creation.stat.people', '명')}` },
                    { label: this._termLabel('researchPower', t('company.team_research_power', '팀 연구력'), { value: String(teamResearchPower) }), value: String(teamResearchPower) },
                    { label: this._termLabel('marketShare', t('company.market_share', '시장 점유율'), { value: `${s.reputation.marketShare.toFixed(1)}%` }), value: `${s.reputation.marketShare.toFixed(1)}%` },
                    { label: t('company.investor_trust', '투자자 신뢰도'), value: String(s.reputation.investorTrust) }
                ,   { label: this._termLabel('boardConfidence', t('board.confidence', '이사회 신뢰'), { value: `${Math.round(Number(s.board?.confidence || 0))}%` }), value: `${Math.round(Number(s.board?.confidence || 0))}%`, valueClassName: Number(s.board?.confidence || 0) < 35 ? 'negative' : '' }
                ]
            },
            finance: {
                title: `${icon('funds')} ${t('company.finance', '재무')}`,
                fundsOnHand: {
                    label: this._termLabel('funds', t('company.funds_on_hand', '보유 자금'), { value: fmtFull(s.resources.funds) }),
                    value: this._termValue('funds', fmtFull(s.resources.funds)),
                    rowClassName: 'highlight',
                    valueStyle: 'font-weight:bold;font-size:1.1rem'
                },
                runway: { label: this._termLabel('runway', t('company.runway', '런웨이'), { value: runwayValueText }), value: `<span class="term-link" tabindex="0" data-term-tooltip="${this._runwayTooltipData()}">${runwayText}</span>` },
                incomeTitle: t('company.income_monthly', '수입 (월 {value})', { value: fmtFull(s.resources.monthlyIncome) }),
                incomeRows: [
                    { label: `${t('company.api', 'API')} ${t('company.revenue', '수익')}`, value: fmtFull(eco.revenue.api), labelStyle: 'padding-left:8px', valueClassName: 'positive' },
                    { label: `${t('company.b2b', 'B2B')} ${t('company.contracts', '계약')}`, value: fmtFull(eco.revenue.b2b), labelStyle: 'padding-left:8px', valueClassName: 'positive' },
                    { label: t('company.consumer_products', '소비자 제품'), value: fmtFull(eco.revenue.consumer), labelStyle: 'padding-left:8px', valueClassName: 'positive' },
                    { label: t('company.licensing', '라이선싱'), value: fmtFull(eco.revenue.licensing), labelStyle: 'padding-left:8px', valueClassName: 'positive' }
                ],
                expenseTitle: t('company.expense_monthly', '지출 (월 {value})', { value: fmtFull(s.resources.monthlyExpense) }),
                expenseRows: [
                    { label: t('company.salary_cost', '인건비'), value: fmtFull(eco.expenses.salaries), labelStyle: 'padding-left:8px', valueClassName: 'negative' },
                    { label: t('company.cloud_gpu', '클라우드 GPU'), value: fmtFull(eco.expenses.cloudCompute), labelStyle: 'padding-left:8px', valueClassName: 'negative' },
                    { label: t('company.owned_gpu_power', '보유 GPU 전력'), value: fmtFull(eco.expenses.ownedGPUPower), labelStyle: 'padding-left:8px', valueClassName: 'negative' },
                    { label: t('company.overhead', '오버헤드'), value: fmtFull(eco.expenses.overhead), labelStyle: 'padding-left:8px', valueClassName: 'negative' },
                    { label: t('company.marketing', '마케팅'), value: fmtFull(eco.expenses.marketing), labelStyle: 'padding-left:8px', valueClassName: 'negative' },
                    eco.expenses.modelInference ? { label: t('company.model_inference', '모델 추론'), value: fmtFull(eco.expenses.modelInference), labelStyle: 'padding-left:8px', valueClassName: 'negative' } : null
                ].filter(Boolean),
                balance: {
                    label: t('company.monthly_balance', '월 수지'),
                    value: `${balance >= 0 ? '+' : ''}${fmtFull(balance)}`,
                    rowClassName: 'highlight',
                    rowStyle: 'margin-top:4px',
                    valueClassName: balance >= 0 ? 'positive' : 'negative',
                    valueStyle: 'font-weight:bold'
                }
            },
            fundraising: {
                title: `${icon('trendUp')} ${t('company.fundraising', '투자 유치')}`,
                bodyHtml: `${fundraisingBodyHtml}${fundingHistoryHtml}`
            },
            leaderboard: {
                title: `${icon('trophy')} ${t('company.ai_leaderboard', 'AI 리더보드')}`,
                entries: leaderboard.map((entry, index) => ({
                    rank: index + 1,
                    rankClassName: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'normal',
                    name: entry.name,
                    meta: `${t('company.performance', '성능')} ${entry.performance} | ${t('world.market_share', '점유')} ${entry.marketShare.toFixed(1)}%`,
                    highlight: entry.isPlayer
                }))
            },
            globalStatus: {
                title: `${icon('globe')} ${t('company.global_status', '글로벌 현황')}`,
                aiFavorability: {
                    label: this._termLabel('aiFavorability', t('country.ai_favorability', 'AI 호감도'), { value: `${s.global.aiFavorability.toFixed(0)}%` }),
                    value: `<span class="term-link" tabindex="0" data-term-tooltip="${this._aiFavorabilityTooltipData()}">${s.global.aiFavorability.toFixed(0)}%</span>`,
                    valueClassName: s.global.aiFavorability < 40 ? 'negative' : ''
                },
                aiLevel: {
                    label: this._termLabel('aiLevel', t('company.global_ai_level', '글로벌 AI 수준'), { value: String(s.global.globalAILevel) }),
                    value: String(s.global.globalAILevel)
                },
                unemploymentTitle: t('company.unemployment_by_industry', '산업별 실업률'),
                unemploymentRows: Object.entries(s.global.unemploymentByIndustry).map(([industryId, value]) => ({
                    label: _localizedIndustryName(industryId),
                    value: `${value.toFixed(1)}%`,
                    valueClassName: value > 10 ? 'negative' : ''
                }))
            }
        });

        const gpuPanelsHtml = renderCompanyGpuPanels({
            summary: {
                title: `${icon('gpu')} ${t('company.tab_gpu', 'GPU')}`,
                rows: [
                    { label: t('company.total_gpu', '총 GPU'), value: `${fleetStats.totalCount}${t('topbar.gpu_unit', '대')}`, valueStyle: 'font-weight:bold' },
                    { label: this._termLabel('tflops', t('compute.total_tflops', '총 TFLOPS'), { value: fleetStats.totalTFLOPS.toLocaleString() }), value: this._termValue('tflops', fleetStats.totalTFLOPS.toLocaleString()), valueStyle: 'font-weight:bold' },
                    { label: this._termLabel('vram', t('compute.max_vram', '최대 VRAM'), { value: `${fleetStats.maxVRAM}GB` }), value: this._termValue('vram', `${fleetStats.maxVRAM}GB`) },
                    { label: t('topbar.owned_gpu', '보유 GPU'), value: `${fleetStats.ownedCount}${t('topbar.gpu_unit', '대')}`, labelStyle: 'padding-left:8px' },
                    { label: t('company.cloud_gpu', '클라우드 GPU'), value: `${fleetStats.cloudCount}${t('topbar.gpu_unit', '대')}`, labelStyle: 'padding-left:8px' },
                    { label: this._termLabel('colocation', t('compute.colocation', '코로케이션'), { value: `${fleetStats.colocationCount}${t('topbar.gpu_unit', '대')}` }), value: `${fleetStats.colocationCount}${t('topbar.gpu_unit', '대')} / ${eco.colocation?.racks || 0}${t('compute.rack_unit', '랙')}`, labelStyle: 'padding-left:8px' },
                    { label: t('company.gpu_price', 'GPU 시세'), value: `$${eco.gpuMarketPrice.toLocaleString()}/${t('topbar.gpu_unit', '대')}` },
                    { label: t('topbar.monthly_cost', '월 비용'), value: fmtFull(fleetStats.monthlyCost) }
                ],
                actions: [
                    { label: t('company.manage_gpu', 'GPU 관리'), onclick: "game._showComputeDialog('market')" },
                    { label: t('chip.start_program', '프로그램 시작'), onclick: 'game._showChipProgramStartDialog()' }
                ]
            },
            fleet: {
                title: `${icon('list')} ${t('compute.current_fleet', '현재 장비')}`,
                itemsHtml: fleetRows,
                emptyText: t('compute.no_fleet', '아직 운영 중인 장비가 없습니다.'),
                pendingTitle: t('compute.pending_orders', '배송 대기'),
                pendingHtml: pendingRows
            },
            chipPrograms: {
                title: `${icon('chip') || '🧩'} ${t('chip.program_title', '내부 칩 프로그램')}`,
                bodyHtml: this._renderChipProgramsPanel({ compact: true })
            }
        });

        const dataPanelsHtml = renderCompanyDataPanels({
            summary: {
                title: `${icon('data')} ${t('company.tab_data', '데이터')}`,
                rows: [
                    { label: t('company.training_data', '학습 데이터'), value: `${totalData}TB`, valueStyle: 'font-weight:bold' },
                    { label: t('models.data_mix', '데이터 구성'), value: this._dataInventorySummary(), valueStyle: 'text-align:right;max-width:220px' },
                    { label: this._termLabel('dataQuality', t('company.data_type_count', '보유 데이터 타입'), { value: `${Object.values(eco.dataAssets || {}).filter(value => value > 0).length}${t('company.data_type_unit', '종')}` }), value: `${Object.values(eco.dataAssets || {}).filter(value => value > 0).length}${t('company.data_type_unit', '종')}` }
                ],
                actions: [
                    { label: t('company.buy_data_market', '데이터 마켓'), onclick: 'game._showDataMarketDialog()' },
                    { label: t('company.open_models', '모델 탭 열기'), onclick: "game.switchTab('models')" }
                ]
            },
            inventory: {
                title: `${icon('list')} ${t('company.data_inventory', '데이터 인벤토리')}`,
                itemsHtml: dataRows,
                emptyText: t('company.data_empty', '아직 확보한 데이터가 없습니다.')
            }
        });
        const playerBestModel = getBestDeployedModel(s.models, this.time.currentDate.year) || s.models.find(model => model.deployed || model.trained) || null;
        const playerPerformance = Math.round(playerBestModel?.compositeScore || playerBestModel?.performance || 0);
        const sortedCompetitors = [...(s.competitors || [])]
            .sort((left, right) => Number(right.aiLevel || 0) - Number(left.aiLevel || 0));
        const playerRank = 1 + sortedCompetitors.filter(
            competitor => Number(competitor.currentModel?.performance || competitor.aiLevel || 0) > playerPerformance
        ).length;
        const competitorRowsHtml = sortedCompetitors.map(competitor => {
            const currentModel = competitor.currentModel || competitor.modelsReleased?.[competitor.modelsReleased.length - 1] || null;
            const doctrineLabel = _localeFallbackText(competitor.doctrine?.label) || competitor.doctrine?.type || '-';
            return `
                <div class="company-list-item">
                    <div>
                        <div class="company-list-item__title">${_localizedCompetitorName(competitor)}</div>
                        <div class="company-list-item__meta">${competitor.doctrine?.type ? this._termLabel(`doctrine_${competitor.doctrine.type}`, doctrineLabel) : doctrineLabel} · ${this._termLabel('relation', t('diplomacy.relation', '관계'))} ${_relationLabel(competitor.relation)}</div>
                        <div class="company-list-item__meta">${currentModel?.name || t('leaderboard.no_model', '모델 없음')} · ${t('company.performance', '성능')} ${Math.round(currentModel?.performance || competitor.aiLevel || 0)}</div>
                    </div>
                    <div class="company-list-item__value">${competitor.marketShare?.toFixed?.(1) || '0.0'}%</div>
                </div>
            `;
        }).join('');
        const strongestCompetitor = sortedCompetitors[0] || null;
        const competitorPanelsHtml = `
            <div class="panel">
                <h3>${icon('trophy')} ${t('company.tab_competitors', '경쟁사 분석')}</h3>
                <div class="stat-row"><span>${t('company.market_position', '현재 시장 순위')}</span><span>#${playerRank}</span></div>
                <div class="stat-row"><span>${t('company.top_competitor', '가장 위협적인 경쟁사')}</span><span>${strongestCompetitor ? _localizedCompetitorName(strongestCompetitor) : '-'}</span></div>
                <div class="stat-row"><span>${t('company.player_best_model', '주력 모델')}</span><span>${playerBestModel?.name || t('leaderboard.no_model', '모델 없음')} (${playerPerformance})</span></div>
                <div class="stat-row"><span>${t('company.competitor_gap', '선두와 격차')}</span><span>${strongestCompetitor ? Math.max(0, Math.round((strongestCompetitor.currentModel?.performance || strongestCompetitor.aiLevel || 0) - playerPerformance)) : 0}</span></div>
            </div>
            <div class="panel">
                <h3>${icon('company')} ${t('company.competitor_matrix', '경쟁사 매트릭스')}</h3>
                ${competitorRowsHtml || `<p class="company-empty-state">${t('company.no_competitors', '표시할 경쟁사 정보가 없습니다.')}</p>`}
            </div>
        `;
        const ideologyCounts = (s.talents || []).reduce((counts, talent) => {
            const key = talent.ideologyProfile?.id || talent.ideology || 'neutral';
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});
        const managementPanelsHtml = `
            <div class="panel">
                <h3>${icon('shield')} ${t('company.tab_management', '경영')}</h3>
                <div class="stat-row"><span>${t('board.confidence', '이사회 신뢰')}</span><span>${Math.round(s.board?.confidence || 0)}</span></div>
                <div class="stat-row"><span>${t('board.pressure', '이사회 압박')}</span><span>${Math.round(s.board?.pressure || 0)}</span></div>
                <div class="stat-row"><span>${t('board.seats', '이사회 좌석')}</span><span>${Math.round(s.board?.seats || 0)}</span></div>
                <div class="stat-row"><span>${t('safety.label', '안전')}</span><span>${Math.round(s.safety?.posture || 0)}</span></div>
                <div style="margin-top:10px">
                    ${(s.board?.members || []).map(member => `
                        <div class="stat-row" style="font-size:0.8rem">
                            <span>${member.name || member.id}</span>
                            <span>${t(`board.member.${member.type}`, member.type)} · ${Math.round(member.satisfaction || 0)}%</span>
                        </div>
                    `).join('') || `<p class="company-empty-state">${t('board.no_members', '이사회 구성원이 없습니다.')}</p>`}
                </div>
            </div>
            <div class="panel">
                <h3>${icon('talent')} ${t('company.culture_panel', '회사 문화')}</h3>
                <div class="stat-row"><span>${t('culture.mission', '미션')}</span><span>${Math.round(s.culture?.mission || 0)}</span></div>
                <div class="stat-row"><span>${t('culture.speed', '속도')}</span><span>${Math.round(s.culture?.speed || 0)}</span></div>
                <div class="stat-row"><span>${t('culture.discipline', '규율')}</span><span>${Math.round(s.culture?.discipline || 0)}</span></div>
                <div class="stat-row"><span>${t('culture.safety', '안전 문화')}</span><span>${Math.round(s.culture?.safety || 0)}</span></div>
                <div class="stat-row"><span>${t('culture.academic', '학술')}</span><span>${Math.round(s.culture?.academic || 0)}</span></div>
                <div class="stat-row"><span>${t('culture.secrecy', '보안')}</span><span>${Math.round(s.culture?.secrecy || 0)}</span></div>
                <div class="stat-row"><span>${t('culture.accountability', '투명성')}</span><span>${Math.round(s.culture?.accountability || 0)}</span></div>
                <h4 style="margin-top:10px">${t('company.ideology_distribution', '인재 성향 분포')}</h4>
                ${Object.entries(ideologyCounts).map(([key, count]) => `
                    <div class="stat-row" style="font-size:0.8rem">
                        <span>${_localizedIdeologyProfile(null, key)}</span>
                        <span>${count}${t('creation.stat.people', '명')}</span>
                    </div>
                `).join('') || `<p class="company-empty-state">${t('company.no_talent_data', '표시할 인재 데이터가 없습니다.')}</p>`}
            </div>
        `;
        const activeServiceEntries = (s.models || []).flatMap(model =>
            (model.serviceChannels || [])
                .filter(channel => channel?.active)
                .map(channel => {
                    const quality = Math.max(0, Math.round(((Number(channel.allocatedTFLOPS || 0) / Math.max(1, Number(channel.requiredTFLOPS || 1))) || 0) * 100));
                    const sla = Math.round(Number(channel.ops?.sla || 95));
                    const saturation = Math.round(Number(channel.ops?.infraSaturation || 0));
                    const riskState = sla < 70 || saturation > 80;
                    return `
                        <div class="company-list-item">
                            <div>
                                <div class="company-list-item__title">${model.name}</div>
                                <div class="company-list-item__meta">${_localizedDeploymentStrategyName(channel.type)} · ${Number(channel.allocatedTFLOPS || 0)} TFLOPS · SLA ${sla}% · ${t('service.saturation', '포화도')} ${saturation}% ${riskState ? `<span class="tag tag-danger">${t('service.danger', '위험')}</span>` : ''}</div>
                            </div>
                            <div class="company-list-item__value">${quality}%</div>
                        </div>
                    `;
                })
        ).join('');
        const incidentHistoryHtml = (s.serviceOps?.incidentHistory || s.serviceOps?.incidents || []).slice(-5).reverse().map(incident => `
            <div class="stat-row" style="font-size:0.8rem">
                <span>${incident.label || incident.id}</span>
                <span>${incident.severity || '-'}</span>
            </div>
        `).join('');
        const servicesPanelsHtml = `
            <div class="panel">
                <h3>${icon('diamond')} ${t('company.tab_services', '서비스 운영')}</h3>
                <div class="stat-row"><span>${t('service.reliability', '신뢰도')}</span><span>${Math.round(s.serviceOps?.reliability || 0)}%</span></div>
                <div class="stat-row"><span>${t('service.total_users', '총 사용자')}</span><span>${Math.round(s.service?.totalUsers || 0).toLocaleString()}</span></div>
                <div class="stat-row"><span>${t('service.satisfaction', '만족도')}</span><span>${Math.round((s.service?.satisfaction || 0) * 100)}%</span></div>
                <div class="stat-row"><span>${t('service.incident_count', '최근 사고')}</span><span>${(s.serviceOps?.incidentHistory || s.serviceOps?.incidents || []).length}</span></div>
            </div>
            <div class="panel">
                <h3>${icon('list')} ${t('service.active_services', '활성 서비스')}</h3>
                ${activeServiceEntries || `<p class="company-empty-state">${t('service.no_active_services', '아직 운영 중인 서비스가 없습니다.')}</p>`}
                ${incidentHistoryHtml ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><h4>${t('service.recent_incidents', '최근 사고')}</h4>${incidentHistoryHtml}</div>` : ''}
            </div>
        `;
        const reportPanelsHtml = `
            <div class="panel">
                <h3>${icon('barChart')} ${t('company.report', '보고서')}</h3>
                ${renderMonthlyReportHtml(this.state.monthlyReport || buildMonthlyReportData({ state: this.state, time: this.time }, null))}
            </div>
        `;

        el.innerHTML = renderCompanyPanelHtml({
            activeTabId: activeCompanyTab.id,
            tabs: companyTabs,
            panelsByTabId: {
                overview: overviewPanelsHtml,
                gpu: gpuPanelsHtml,
                data: dataPanelsHtml,
                competitors: competitorPanelsHtml,
                management: managementPanelsHtml,
                services: servicesPanelsHtml,
                report: reportPanelsHtml
            }
        });
    }

    _getLeaderboardEntries(metricId = 'overall') {
        const currentYear = this.time.currentDate.year || 2017;
        const expectations = getMarketExpectations(currentYear);
        const expectedValue = metricId === 'overall'
            ? Math.round(Object.values(expectations).reduce((sum, value) => sum + value, 0) / Math.max(1, Object.keys(expectations).length))
            : Math.round(expectations[metricId] || 0);

        const playerModels = (this.state.models || []).filter(model => model.trained || model.deployed);
        const playerModel = playerModels.reduce((best, model) => {
            if (!best) return model;
            if (metricId === 'overall') {
                return (model.compositeScore || model.performance || 0) > (best.compositeScore || best.performance || 0) ? model : best;
            }
            const score = getModelBenchmarks(model).find(benchmark => benchmark.id === metricId)?.score || 0;
            const bestScore = getModelBenchmarks(best).find(benchmark => benchmark.id === metricId)?.score || 0;
            return score > bestScore ? model : best;
        }, null);

        const entries = [
            ...this.state.competitors.map(competitor => {
                const score = Math.round(competitor?.currentModel?.performance || competitor?.aiLevel || 0);
                return {
                    company: competitor.name,
                    model: competitor?.currentModel?.name || '-',
                    score,
                    relative: expectedValue > 0 ? score / expectedValue : 0,
                    isPlayer: false
                };
            }),
            {
                company: this.state.player.companyName || t('company.default_name', 'My Company'),
                model: playerModel?.name || t('leaderboard.no_model', '모델 없음'),
                score: metricId === 'overall'
                    ? Math.round(playerModel?.compositeScore || playerModel?.performance || 0)
                    : Math.round(getModelBenchmarks(playerModel || {}).find(benchmark => benchmark.id === metricId)?.score || 0),
                relative: expectedValue > 0
                    ? (metricId === 'overall'
                        ? Math.max(0, getRelativePerformance(playerModel || {}, currentYear))
                        : (Math.round(getModelBenchmarks(playerModel || {}).find(benchmark => benchmark.id === metricId)?.score || 0) / expectedValue))
                    : 0,
                isPlayer: true
            }
        ];

        return {
            metricId,
            expectedValue,
            entries: entries
                .sort((a, b) => b.score - a.score)
                .map((entry, index) => ({
                    ...entry,
                    rank: index + 1
                }))
        };
    }

    _renderLeaderboard(el) {
        const metricId = this._leaderboardMetric || 'overall';
        const metrics = [
            { id: 'overall', label: t('leaderboard.metric.overall', '종합') },
            ...BENCHMARKS.map(benchmark => ({
                id: benchmark.id,
                label: _localizedBenchmarkName(benchmark)
            }))
        ];
        const leaderboard = this._getLeaderboardEntries(metricId);
        const metricLabel = metrics.find(metric => metric.id === metricId)?.label || t('leaderboard.metric.overall', '종합');

        el.innerHTML = `
            <div class="models-section">
                <h3>${icon('trophy')} ${t('game.leaderboard', '리더보드')}</h3>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 16px">
                    ${metrics.map(metric => `
                        <button class="btn btn-small ${metric.id === metricId ? 'btn-primary' : ''}"
                            onclick="game._leaderboardMetric='${metric.id}';game.renderContent()">
                            ${metric.label}
                        </button>
                    `).join('')}
                </div>
                <div class="panel-grid" style="grid-template-columns:1fr">
                    <div class="panel">
                        <h3>${icon('barChart')} ${t('leaderboard.current_metric', '{metric} 리더보드', { metric: metricLabel })}</h3>
                        <div class="stat-row">
                            <span>${t('leaderboard.market_expectation', '시장 기대치')}</span>
                            <span>${leaderboard.expectedValue > 0 ? leaderboard.expectedValue : '-'}</span>
                        </div>
                        <div style="display:grid;gap:8px;margin-top:12px">
                            ${leaderboard.entries.map(entry => `
                                <div class="stat-row ${entry.isPlayer ? 'highlight' : ''}" style="gap:12px;align-items:flex-start">
                                    <span style="display:flex;align-items:center;gap:8px;min-width:180px">
                                        <span class="rank-badge ${entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : 'normal'}">${entry.rank}</span>
                                        ${entry.isPlayer ? '★ ' : ''}${entry.company}
                                    </span>
                                    <span style="flex:1;color:var(--text-secondary)">${entry.model}</span>
                                    <span style="font-family:var(--font-mono)">${entry.score}</span>
                                    <span style="font-family:var(--font-mono);color:${entry.relative >= 1 ? 'var(--success)' : entry.relative >= 0.8 ? 'var(--warning)' : 'var(--text-secondary)'}">${Math.round(entry.relative * 100)}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _chipProgramDisplayName(programOrTemplate) {
        const generation = programOrTemplate?.generation || 1;
        const type = programOrTemplate?.type || 'inference_accelerator';
        const typeKey = type === 'training_accelerator'
            ? 'chip.type_training'
            : type === 'balanced_internal'
                ? 'chip.type_balanced'
                : 'chip.type_inference';
        return `${t(typeKey, '추론 가속기')} v${generation}`;
    }

    _chipPhaseLabel(phase) {
        return t(`chip.phase_${phase}`, phase);
    }

    _chipFoundryLabel(foundryMode) {
        return t(`chip.foundry_${foundryMode === 'partner' ? 'partner' : foundryMode === 'own' ? 'own' : 'external'}`, foundryMode);
    }

    _computeLocationLabel(slot) {
        const location = slot?.location || (slot?.source === 'cloud' ? 'cloud' : slot?.source === 'colocation' ? 'colocation' : 'warehouse');
        if (location === 'cloud') return t('compute.cloud', '클라우드');
        if (location === 'colocation') return t('compute.colocation', '코로케이션');
        if (location === 'datacenter') {
            const datacenter = (this.state.economy.datacenters || []).find(entry => entry?.id === slot?.datacenterId);
            if (datacenter?.locationId) {
                return `${t('compute.datacenter', '데이터센터')} · ${_localizedDatacenterLocationName(datacenter.locationId)}`;
            }
            return t('compute.datacenter', '데이터센터');
        }
        return t('compute.warehouse', '창고');
    }

    _chipUnlockBlockerLabel(blocker, unlock) {
        if (blocker === 'hw_talent_count') {
            return t('chip.unlock_requirement', '해금 조건: {tech} 연구 완료 + HW 전문 인재 {count}명', {
                tech: unlock.requiredTechs.map(techId => _localizedTechName(techId)).join(' + '),
                count: unlock.requiredHwTalents
            });
        }
        if (blocker === 'insufficient_funds') {
            return t('chip.insufficient_funds', '자금 부족 ({cost} 필요, 보유 {funds})', {
                cost: `$${Math.round(unlock.startCost || 0).toLocaleString()}`,
                funds: `$${Math.round(unlock.availableFunds || 0).toLocaleString()}`
            });
        }
        if (blocker === 'previous_completion') {
            return t('chip.previous_completion_required', '이전 세대 내부 칩 프로그램 완료가 필요합니다.');
        }
        if (blocker === 'chip_program_limit') {
            return t('chip.program_limit_reached', '이미 진행 중인 칩 프로그램이 있습니다.');
        }
        if (blocker.startsWith('tech.')) {
            return _localizedTechName(blocker.slice(5));
        }
        return t('company.requirements_missing', '요구사항 미달');
    }

    _chipBenefitSummary(bonuses) {
        const lines = [];
        if ((bonuses?.inferenceCostMult || 1) < 1) {
            lines.push(`${t('chip.benefit_inference_cost', '추론 비용 절감')} ${(100 - bonuses.inferenceCostMult * 100).toFixed(0)}%`);
        }
        if ((bonuses?.trainingSpeedMult || 1) < 1) {
            lines.push(`${t('chip.benefit_training_speed', '훈련 속도 개선')} ${(100 - bonuses.trainingSpeedMult * 100).toFixed(0)}%`);
        }
        if ((bonuses?.powerCostMult || 1) < 1) {
            lines.push(`${t('chip.benefit_power_cost', '전력 비용 절감')} ${(100 - bonuses.powerCostMult * 100).toFixed(0)}%`);
        }
        return lines.join(' · ');
    }

    _getComputeDashboardContext() {
        const eco = this.state.economy;
        const completedTechs = this.techTree.getCompletedTechs();
        const completedChipPrograms = eco.completedChipPrograms || [];
        const currentYear = this.time.currentDate.year || 2017;
        const fleetStats = getFleetStats(eco.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: eco.colocation,
            completedChipPrograms,
            customSiliconBonuses: eco.customSiliconBonuses,
            datacenters: eco.datacenters
        });
        const colocationCapacity = (eco.colocation?.racks || 0) * (eco.colocation?.capacityPerRack || 50);
        const operationalDatacenters = (eco.datacenters || []).filter(datacenter => datacenter?.operational);
        const datacenterCapacity = operationalDatacenters.reduce((sum, datacenter) => sum + Math.max(0, Number(datacenter.gpus || 0)), 0);
        const availableGpus = getAvailableGPUs({ year: currentYear, completedTechs, completedChipPrograms });
        const providerInfo = {
            aws: { label: t('compute.provider_aws', 'AWS'), termMonths: 12 },
            gcp: { label: t('compute.provider_gcp', 'GCP'), termMonths: 12 },
            azure: { label: t('compute.provider_azure', 'Azure'), termMonths: 36 }
        };

        return {
            eco,
            completedChipPrograms,
            fleetStats,
            colocationCapacity,
            datacenterCapacity,
            operationalDatacenters,
            availableOwned: availableGpus.filter(gpu => !gpu.cloudOnly),
            availableCloud: availableGpus.filter(gpu => gpu.cloudMonthly || gpu.cloudOnly),
            providerInfo
        };
    }

    _renderGpu(el) {
        const {
            eco,
            completedChipPrograms,
            fleetStats,
            colocationCapacity,
            datacenterCapacity,
            operationalDatacenters,
            providerInfo
        } = this._getComputeDashboardContext();

        const summaryCards = [
            {
                label: this._termLabel('tflops', t('compute.total_tflops', '총 TFLOPS')),
                value: Math.round(fleetStats.totalTFLOPS).toLocaleString(),
                tone: 'accent'
            },
            {
                label: t('compute.total_gpu', '총 GPU'),
                value: `${fleetStats.totalCount}${t('topbar.gpu_unit', '대')}`,
                tone: 'muted'
            },
            {
                label: this._termLabel('vram', t('compute.max_vram', '최대 VRAM')),
                value: `${fleetStats.maxVRAM}GB`,
                tone: 'warning'
            },
            {
                label: t('topbar.monthly_cost', '월 비용'),
                value: `$${Math.round(fleetStats.monthlyCost).toLocaleString()}`,
                tone: fleetStats.monthlyCost > 0 ? 'danger' : 'muted'
            },
            {
                label: t('compute.cloud_gpu', '클라우드 GPU'),
                value: `${fleetStats.cloudCount}${t('topbar.gpu_unit', '대')}`,
                tone: fleetStats.cloudCount > 0 ? 'success' : 'muted'
            },
            {
                label: t('compute.warehouse_gpu', '창고 GPU'),
                value: `${fleetStats.warehouseCount}${t('topbar.gpu_unit', '대')}`,
                tone: fleetStats.warehouseCount > 0 ? 'warning' : 'muted'
            }
        ];
        const fleetRows = (eco.gpuFleet || []).map(slot => {
            const gpu = getGpuById(slot.gpuId, { completedChipPrograms });
            if (!gpu) return '';
            const providerLabel = slot.source === 'cloud' ? ` · ${(slot.provider || 'aws').toUpperCase()}` : '';
            const locationLabel = this._computeLocationLabel(slot);
            const monthlyCost = slot.source === 'cloud'
                ? Math.round((slot.monthlyUnitCost || gpu.cloudMonthly || BALANCE.ECONOMY.GPU_CLOUD_MONTHLY) * slot.count)
                : (slot.location && slot.location !== 'warehouse')
                    ? Math.round((((gpu.powerWatt || 300) / 300) * BALANCE.ECONOMY.GPU_POWER_COST * slot.count))
                    : 0;
            const isWarehouse = (slot.location || 'warehouse') === 'warehouse' && slot.source === 'owned';
            return `
                <div class="company-list-item">
                    <div>
                        <div class="company-list-item__title">${this._termLabel(`gpu_${gpu.id}`, gpu.name)} × ${slot.count}</div>
                        <div class="company-list-item__meta">${locationLabel}${providerLabel} · ${gpu.tflops} TFLOPS · ${gpu.vram}GB VRAM</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        ${isWarehouse ? `
                            ${colocationCapacity > fleetStats.colocationCount
                                ? `<button class="btn btn-xs" onclick="game._moveGpuLocation('${slot.gpuId}',1,'warehouse','colocation');game.renderContent()">${t('compute.install_colocation', '코로케이션 설치')}</button>` : ''}
                            ${datacenterCapacity > fleetStats.datacenterCount
                                ? `<button class="btn btn-xs btn-primary" onclick="game._moveGpuLocation('${slot.gpuId}',1,'warehouse','datacenter');game.renderContent()">${t('compute.install_datacenter', 'DC 설치')}</button>` : ''}
                        ` : ''}
                        <span class="company-list-item__value">$${monthlyCost.toLocaleString()}/m</span>
                    </div>
                </div>
            `;
        }).join('');
        const cloudSummaryHtml = Object.entries(providerInfo).map(([provider, info]) => {
            const slots = (eco.gpuFleet || []).filter(slot => slot.source === 'cloud' && (slot.provider || 'aws') === provider);
            const totalCount = slots.reduce((sum, slot) => sum + Number(slot.count || 0), 0);
            const mix = slots.map(slot => {
                const gpu = getGpuById(slot.gpuId, { completedChipPrograms });
                return gpu ? `${gpu.name} × ${slot.count}` : '';
            }).filter(Boolean).join(' · ');
            return `
                <div class="cloud-provider-card">
                    <div class="cloud-provider-card__head">
                        <strong>${info.label}</strong>
                        <span>${totalCount > 0 ? `${totalCount}${t('topbar.gpu_unit', '대')}` : t('compute.dashboard.empty_provider', '없음')}</span>
                    </div>
                    <div class="cloud-provider-card__meta">${mix || t('compute.dashboard.empty_provider', '없음')}</div>
                </div>
            `;
        }).join('');
        const datacenterSummaryHtml = `
            <div class="stat-row"><span>${this._termLabel('colocation', t('compute.colocation_usage', '코로케이션 GPU'))}</span><span>${fleetStats.colocationCount}${t('topbar.gpu_unit', '대')} / ${colocationCapacity}${t('topbar.gpu_unit', '대')}</span></div>
            <div class="stat-row"><span>${this._termLabel('datacenter', t('compute.datacenter_capacity', '데이터센터 GPU'))}</span><span>${fleetStats.datacenterCount}${t('topbar.gpu_unit', '대')} / ${datacenterCapacity}${t('topbar.gpu_unit', '대')}</span></div>
            ${operationalDatacenters.length > 0
                ? operationalDatacenters.map(datacenter => `
                    <div class="company-list-item">
                        <div>
                            <div class="company-list-item__title">${datacenter.name || _localizedDatacenterName(datacenter.tierId, datacenter.name)}</div>
                            <div class="company-list-item__meta">${t('compute.rack_capacity', '랙 용량: GPU {count}대', { count: datacenter.gpus || 0 })}</div>
                        </div>
                        <div class="company-list-item__value">$${Math.round(datacenter.monthlyCost || 0).toLocaleString()}/m</div>
                    </div>
                `).join('')
                : `<p class="company-empty-state">${t('compute.dashboard.no_datacenter', '운영 중인 데이터센터가 없습니다.')}</p>`}
        `;
        const chipProgramsHtml = (eco.chipPrograms?.length || eco.completedChipPrograms?.length)
            ? this._renderChipProgramsPanel({ compact: true, showActions: false })
            : `<p class="company-empty-state">${t('compute.dashboard.no_chip_programs', '진행 중인 칩 프로그램이 없습니다.')}</p>`;

        el.innerHTML = `
            <div class="models-section infra-dashboard">
                <div class="section-header">
                    <h3>${icon('gpu')} ${t('compute.dashboard.title', 'GPU / 인프라')}</h3>
                </div>
                <div class="dashboard-summary-grid data-summary-grid">
                    ${summaryCards.map(card => `
                        <article class="data-summary-card data-summary-card--${card.tone}">
                            <div class="data-summary-card__label">${card.label}</div>
                            <div class="data-summary-card__value">${card.value}</div>
                        </article>
                    `).join('')}
                </div>
                <div class="panel-grid gpu-dashboard-grid">
                    <section class="panel wide gpu-dashboard-panel">
                        <h3>${icon('list', 14)} ${t('compute.current_fleet', '보유 장비')}</h3>
                        <div class="gpu-dashboard-list">${fleetRows || `<p class="company-empty-state">${t('compute.no_fleet', '보유 장비가 없습니다.')}</p>`}</div>
                    </section>
                    <section class="panel gpu-dashboard-panel">
                        <h3>${icon('cloud', 14)} ${t('compute.cloud_gpu', '클라우드 GPU')}</h3>
                        <div class="gpu-dashboard-summary">${cloudSummaryHtml}</div>
                    </section>
                    <section class="panel gpu-dashboard-panel">
                        <h3>${icon('company', 14)} ${t('compute.datacenter_section', '데이터센터')}</h3>
                        <div class="gpu-dashboard-summary">${datacenterSummaryHtml}</div>
                    </section>
                    <section class="panel wide gpu-dashboard-panel">
                        <h3>${icon('chip', 14)} ${t('chip.program_title', '칩 프로그램')}</h3>
                        <div class="gpu-dashboard-summary">${chipProgramsHtml}</div>
                    </section>
                </div>
                <div class="dashboard-action-row infra-actions">
                    <button class="btn btn-small btn-primary" onclick="game._showComputeDialog('market')">${t('compute.dashboard.purchase', 'GPU 구매')}</button>
                    <button class="btn btn-small" onclick="game._showCloudGpuDialog()">${t('compute.dashboard.cloud_manage', '클라우드 관리')}</button>
                    <button class="btn btn-small" onclick="game._buildDatacenterDialog()">${t('compute.dashboard.datacenter_build', '데이터센터 건설')}</button>
                </div>
            </div>
        `;
    }

    _renderData(el) {
        const dataState = this._ensureDataState();
        const totalTB = Math.max(0, Number(dataState.totalTB || 0));
        const fmtTB = (value) => {
            const n = Math.max(0, Number(value || 0));
            return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
        };
        const summaryCards = [
            {
                label: this._termLabel('dataAsset', t('data.summary.total', '총 데이터')),
                value: `${fmtTB(totalTB)} TB`,
                tone: 'accent'
            },
            {
                label: `<span class="term-link" tabindex="0" data-term-tooltip="${this._dataQualityTooltipData()}">${t('data.summary.quality', '평균 품질')}</span>`,
                value: `${Math.round(dataState.avgQuality || 0)}%`,
                tone: 'success'
            },
            {
                label: `<span class="term-link" tabindex="0" data-term-tooltip="${this._dataFreshnessTooltipData()}">${t('data.summary.freshness', '평균 신선도')}</span>`,
                value: `${Math.round(dataState.avgFreshness || 100)}%`,
                tone: dataState.avgFreshness <= 40 ? 'danger' : 'warning'
            },
            {
                label: `<span class="term-link" tabindex="0" data-term-tooltip="${this._legalRiskTooltipData()}">${t('data.summary.legal', '법적 위험')}</span>`,
                value: `${Math.round(dataState.legalRiskScore || 0)}%`,
                tone: dataState.legalRiskScore >= 60 ? 'danger' : dataState.legalRiskScore >= 30 ? 'warning' : 'muted'
            }
        ];
        const typeRows = Object.entries(dataState.assets || {})
            .sort((a, b) => Number(b[1]?.tb || 0) - Number(a[1]?.tb || 0))
            .map(([typeId, asset]) => {
                const typeDef = DATA_TYPES[typeId] || { icon: '•' };
                const tb = Math.max(0, Number(asset?.tb || 0));
                const pct = totalTB > 0 ? Math.round((tb / totalTB) * 100) : 0;
                return `
                    <div class="data-type-row">
                        <div class="data-type-row__head">
                            <div class="data-type-row__title">${typeDef.icon || ''} ${this._termLabel(`data_${typeId}`, _localizedDataTypeName(typeDef))}</div>
                            <div class="data-type-row__meta">${fmtTB(tb)} TB · ${pct}%</div>
                        </div>
                        <div class="progress-bar small data-type-row__bar">
                            <div class="progress-fill" style="width:${pct}%"></div>
                        </div>
                        <div class="data-type-row__foot">
                            <span>${t('data.meta.quality', '품질')} ${Math.round(asset?.quality || 0)}%</span>
                            <span>${t('data.meta.freshness', '신선도')} ${Math.round(asset?.freshness || 0)}%</span>
                            <span>${t('data.meta.bias', '편향')} ${Math.round(asset?.bias || 0)}%</span>
                            <span>${t('data.meta.legal', '법적')} ${Math.round(asset?.legal || 0)}%</span>
                        </div>
                    </div>
                `;
            }).join('');
        const pending = Array.isArray(dataState.pendingAcquisitions) ? dataState.pendingAcquisitions : [];
        const pendingHtml = pending.length > 0 ? pending.map(acq => {
            const method = this._getDataMethod(acq.method);
            const progress = Number(acq.totalMonths || 0) > 0
                ? Math.max(0, Math.min(100, Math.round(100 - ((Number(acq.monthsRemaining || 0) / Math.max(1, Number(acq.totalMonths || 1))) * 100))))
                : 100;
            const monthsRemaining = Math.max(0, Number(acq.monthsRemaining || 0));
            return `
                <div class="data-pending-card">
                    <div class="data-pending-card__head">
                        <span>${method.icon} ${this._termLabel(`dataMethod_${method.id}`, _localizedDataMethodName(method), { description: _localizedDataMethodDescription(method) })}</span>
                        <span>${this._termLabel(`data_${acq.type}`, _localizedDataTypeName(DATA_TYPES[acq.type] || acq.type))} ${Math.round(Number(acq.tb || 0) * 10) / 10}TB</span>
                    </div>
                    <div class="data-pending-card__meta">
                        <span>${t('data.pending.months', '{months}개월 남음', { months: monthsRemaining })}</span>
                        <span>${Math.round(progress)}%</span>
                    </div>
                    <div class="progress-bar small">
                        <div class="progress-fill" style="width:${progress}%"></div>
                    </div>
                </div>
            `;
        }).join('') : `<p class="company-empty-state">${t('data.dashboard.no_pending', '진행 중인 획득이 없습니다.')}</p>`;

        el.innerHTML = `
            <div class="models-section data-dashboard">
                <div class="section-header data-dashboard__header">
                    <h3>${icon('data')} ${t('game.data', '데이터')}</h3>
                </div>
                <div class="dashboard-summary-grid data-summary-grid">
                    ${summaryCards.map(card => `
                        <article class="data-summary-card data-summary-card--${card.tone}">
                            <div class="data-summary-card__label">${card.label}</div>
                            <div class="data-summary-card__value">${card.value}</div>
                        </article>
                    `).join('')}
                </div>
                <div class="panel-grid data-dashboard-grid">
                    <section class="panel wide data-panel">
                        <h3>${icon('barChart', 14)} ${t('data.breakdown', '타입별 보유량')}</h3>
                        ${typeRows || `<p class="company-empty-state">${t('data.empty', '아직 확보한 데이터가 없습니다.')}</p>`}
                    </section>
                    <section class="panel data-panel">
                        <h3>${icon('clock', 14)} ${t('data.pending', '진행 중인 획득')}</h3>
                        <div class="data-pending-list">${pendingHtml}</div>
                        ${dataState.monthlyPassiveGain > 0 ? `<div class="data-passive-banner">${icon('trendUp', 12)} ${t('data.passive.banner', '자동 수집 활성화: {gain} TB/월', { gain: (dataState.monthlyPassiveGain || 0).toFixed(dataState.monthlyPassiveGain % 1 ? 1 : 0) })}</div>` : ''}
                    </section>
                </div>
                <div class="dashboard-action-row">
                    <button class="btn btn-small btn-primary" onclick="game._showDataMarketDialog()">${t('data.dashboard.acquire', '데이터 획득')}</button>
                    <button class="btn btn-small" onclick="game.switchTab('models')">${t('data.dashboard.open_models', '모델 탭')}</button>
                </div>
            </div>
        `;
    }

    _refreshComputePanels() {
        this.renderAll();
        if (this.currentTab === 'gpu') this.renderContent();
        const popup = document.getElementById('popup');
        if (popup?.classList.contains('show') && String(popup.dataset?.panel || '').startsWith('gpu-')) {
            this._showComputeDialog(popup.dataset.computeView || 'market');
        }
    }

    _refreshDataPanels() {
        this.renderAll();
        if (this.currentTab === 'data') this.renderContent();
        if (document.getElementById('popup')?.classList.contains('show') && document.getElementById('popup')?.dataset?.panel === 'data') {
            this._showDataMarketDialog();
        }
    }

    _adjustCloudGpu(gpuId, provider, termMonths, delta) {
        this.economy.adjustCloudGPUs({ gpuId, provider, termMonths, delta });
        this._refreshComputePanels();
    }

    _moveGpuLocation(gpuId, count, fromLocation, toLocation) {
        if (!this.economy.relocateGPUs({ gpuId, count, fromLocation, toLocation })) {
            this.state.addNews(t('compute.install_failed', 'GPU를 선택한 위치로 설치할 수 없습니다.'), 'warning');
        }
        this._refreshComputePanels();
    }

    _renderChipProgramsPanel({ compact = false, showActions = !compact } = {}) {
        const eco = this.state.economy;
        const activePrograms = eco.chipPrograms || [];
        const completedPrograms = eco.completedChipPrograms || [];
        const catalog = getChipProgramCatalog();
        const availableTemplates = catalog.map(template => ({
            template,
            unlock: canStartChipProgram(this.state, { templateId: template.id, foundryMode: template.defaultFoundryMode })
        }));

        const activeHtml = activePrograms.length > 0
            ? activePrograms.map(program => `
                <div class="compute-section" style="padding:10px">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
                        <div>
                            <div style="font-weight:700"><span class="term-link" tabindex="0" data-term-tooltip="${this._chipProgramTooltipData()}">${this._chipProgramDisplayName(program)}</span></div>
                            <div style="font-size:0.75rem;color:var(--text-secondary)">${this._chipPhaseLabel(program.phase)} · ${program.progress.toFixed(0)}%</div>
                            <div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:4px">${this._chipBenefitSummary(program.currentBenefits || program.expectedBenefits)}</div>
                            <div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px">${t('chip.estimated_cost', '예상 비용')}: $${Math.round(program.totalSpent || 0).toLocaleString()} · ${t('topbar.monthly_cost', '월 비용')}: $${Math.round(program.monthlyBurn || 0).toLocaleString()} · ${this._chipFoundryLabel(program.foundryMode)}</div>
                        </div>
                        <div style="text-align:right;font-size:0.75rem;color:var(--text-secondary)">
                            <div>${t('chip.target_tflops', '목표 TFLOPS')}: ${Math.round(program.targetTFLOPS || 0)}</div>
                            <div>${t('chip.target_vram', '목표 VRAM')}: ${Math.round(program.targetVRAM || 0)}GB</div>
                            <div>${t('topbar.assigned', '배치')}: ${program.assignedTalents?.length || 0}</div>
                        </div>
                    </div>
                </div>
            `).join('')
            : `<p class="company-empty-state">${t('chip.no_active_programs', '아직 진행 중인 내부 칩 프로그램이 없습니다.')}</p>`;

        const completedHtml = completedPrograms.length > 0
            ? completedPrograms.slice(-2).reverse().map(program => `
                <div class="company-list-item">
                    <div>
                        <div class="company-list-item__title"><span class="term-link" tabindex="0" data-term-tooltip="${this._chipProgramTooltipData()}">${program.gpu?.name || this._chipProgramDisplayName(program)}</span></div>
                        <div class="company-list-item__meta">${this._chipBenefitSummary(program.bonuses || {})}</div>
                    </div>
                    <div class="company-list-item__value">${program.gpu?.tflops || 0} TFLOPS</div>
                </div>
            `).join('')
            : '';

        const unlockSummary = availableTemplates.map(({ template, unlock }) => `
            <div class="stat-row" style="font-size:0.78rem">
                <span><span class="term-link" tabindex="0" data-term-tooltip="${this._chipProgramTooltipData()}">${this._chipProgramDisplayName(template)}</span></span>
                <span>${unlock.ok ? t('research.available', '가능') : t('research.locked', '잠김')}</span>
            </div>
        `).join('');

        return `
            ${activeHtml}
            ${completedHtml ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><h4>${t('chip.completed_programs', '완료된 칩')}</h4>${completedHtml}</div>` : ''}
            ${compact ? '' : `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><h4>${t('chip.available_programs', '가능한 프로그램')}</h4>${unlockSummary}</div>`}
            ${showActions ? `<div class="company-action-row" style="margin-top:10px">
                <button class="btn btn-small" onclick="game._showChipProgramStartDialog()">${t('chip.start_program', '프로그램 시작')}</button>
            </div>` : ''}
        `;
    }

    _showChipProgramStartDialog(templateId = null) {
        const catalog = getChipProgramCatalog();
        const defaultTemplate = catalog.find(template => canStartChipProgram(this.state, { templateId: template.id }).ok) || catalog[0];
        const template = catalog.find(entry => entry.id === templateId) || defaultTemplate;
        if (!template) return;

        const foundryOptions = [
            { id: 'external', tech: 'foundry_external' },
            { id: 'partner', tech: 'foundry_partnership' },
            { id: 'own', tech: 'own_fab' }
        ].filter(option => this.state.technologies[option.tech]?.completed || option.id === template.defaultFoundryMode);
        const selectedFoundry = foundryOptions.find(option => option.id === template.defaultFoundryMode)?.id || foundryOptions[0]?.id || 'external';
        const unlock = canStartChipProgram(this.state, { templateId: template.id, foundryMode: selectedFoundry });
        const preview = previewChipProgram(template.id, {
            state: this.state,
            countryModifiers: this._getCountryModifiers(),
            foundryMode: selectedFoundry,
            targetTFLOPS: template.defaultTargetTFLOPS,
            targetVRAM: template.defaultTargetVRAM,
            powerEfficiency: 'balanced'
        });

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content" style="max-width:680px">
                <h3>${icon('chip') || '🧩'} ${t('chip.program_title', '내부 칩 프로그램')}</h3>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
                    ${catalog.map(entry => `
                        <button class="btn btn-small ${entry.id === template.id ? 'btn-primary' : ''}" onclick="game._showChipProgramStartDialog('${entry.id}')">${this._chipProgramDisplayName(entry)}</button>
                    `).join('')}
                </div>
                <div class="compute-section" style="margin-top:12px">
                    <div class="compute-section__head">
                        <h4><span class="term-link" tabindex="0" data-term-tooltip="${this._chipProgramTooltipData()}">${this._chipProgramDisplayName(template)}</span></h4>
                        <span style="font-size:0.75rem;color:var(--text-tertiary)">${t('chip.unlock_requirement', '해금 조건: {tech} 연구 완료 + HW 전문 인재 {count}명', { tech: unlock.requiredTechs.map(techId => _localizedTechName(techId)).join(' + '), count: unlock.requiredHwTalents })}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
                        <label style="display:flex;flex-direction:column;gap:6px">
                            <span>${t('chip.target_tflops', '목표 TFLOPS')} <strong id="chip-target-tflops-value">${template.defaultTargetTFLOPS}</strong></span>
                            <input id="chip-target-tflops" type="range" min="${template.minTargetTFLOPS}" max="${template.maxTargetTFLOPS}" value="${template.defaultTargetTFLOPS}" oninput="document.getElementById('chip-target-tflops-value').textContent=this.value">
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px">
                            <span>${t('chip.target_vram', '목표 VRAM')} <strong id="chip-target-vram-value">${template.defaultTargetVRAM}GB</strong></span>
                            <input id="chip-target-vram" type="range" min="${template.minTargetVRAM}" max="${template.maxTargetVRAM}" value="${template.defaultTargetVRAM}" oninput="document.getElementById('chip-target-vram-value').textContent=this.value + 'GB'">
                        </label>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
                        <label style="display:flex;flex-direction:column;gap:6px">
                            <span>${t('chip.power_efficiency', '전력 효율')}</span>
                            <select id="chip-power-efficiency">
                                <option value="balanced">Balanced</option>
                                <option value="performance">Performance</option>
                                <option value="efficient">Efficient</option>
                            </select>
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px">
                            <span>${t('chip.foundry_external', '외부 파운드리')}</span>
                            <select id="chip-foundry-mode">
                                ${foundryOptions.map(option => `<option value="${option.id}">${this._chipFoundryLabel(option.id)}</option>`).join('')}
                            </select>
                        </label>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;padding:12px;background:var(--bg-surface);border-radius:var(--r-md)">
                        <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('chip.estimated_duration', '예상 기간')}</div><div style="font-weight:700">${preview?.estimatedDurationMonths || 0}${t('world.months', '개월')}</div></div>
                        <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('chip.estimated_cost', '예상 비용')}</div><div style="font-weight:700">$${Math.round(preview?.estimatedCost || 0).toLocaleString()}</div></div>
                        <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('chip.failure_chance', '실패 확률')}</div><div style="font-weight:700">${Math.round(((preview?.riskProfile?.delay || 0) + (preview?.riskProfile?.underperform || 0) + (preview?.riskProfile?.respin || 0)) * 100)}%</div></div>
                    </div>
                    <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:10px">${this._chipBenefitSummary(preview?.expectedBenefits || {})}</div>
                    ${unlock.ok ? '' : `<div style="margin-top:10px;color:var(--danger);font-size:0.8rem">${unlock.blockers.map(blocker => this._chipUnlockBlockerLabel(blocker, unlock)).join(' · ')}</div>`}
                </div>
                <div class="popup-buttons" style="margin-top:12px">
                    <button class="btn btn-primary" ${unlock.ok ? `onclick="game._startChipProgramFromDialog('${template.id}')"` : 'disabled'}>${t('chip.start_program', '프로그램 시작')}</button>
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.close', '닫기')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _startChipProgramFromDialog(templateId) {
        const targetTFLOPS = Number(document.getElementById('chip-target-tflops')?.value || 0);
        const targetVRAM = Number(document.getElementById('chip-target-vram')?.value || 0);
        const powerEfficiency = document.getElementById('chip-power-efficiency')?.value || 'balanced';
        const foundryMode = document.getElementById('chip-foundry-mode')?.value || 'external';
        const result = startChipProgram(this.state, { templateId, targetTFLOPS, targetVRAM, powerEfficiency, foundryMode });
        if (!result.ok) {
            this.state.addNews(t('chip.start_failed', '칩 프로그램을 시작할 수 없습니다.'), 'warning');
            return;
        }
        this.state.addNews(t('chip.news.started', '{program} 프로그램을 시작했습니다.', {
            program: this._chipProgramDisplayName(result.program)
        }), 'info');
        document.getElementById('popup').classList.remove('show');
        this.renderAll();
    }

    _showComputeDialog(view = 'market') {
        const popup = document.getElementById('popup');
        const {
            eco,
            completedChipPrograms,
            fleetStats,
            colocationCapacity,
            datacenterCapacity,
            operationalDatacenters,
            availableOwned,
            availableCloud,
            providerInfo
        } = this._getComputeDashboardContext();
        popup.dataset.computeView = view;

        const nav = `
            <div class="compute-dialog-nav">
                <button class="btn btn-small ${view === 'market' ? 'btn-primary' : ''}" onclick="game._showComputeDialog('market')">${t('compute.dashboard.open_market', 'GPU 구매')}</button>
                <button class="btn btn-small ${view === 'cloud' ? 'btn-primary' : ''}" onclick="game._showComputeDialog('cloud')">${t('compute.dashboard.cloud_manage', '클라우드 관리')}</button>
                <button class="btn btn-small ${view === 'datacenter' ? 'btn-primary' : ''}" onclick="game._showComputeDialog('datacenter')">${t('compute.dashboard.datacenter_build', '데이터센터 건설')}</button>
            </div>
        `;

        let title = t('compute.dashboard.open_market', 'GPU 구매');
        let bodyHtml = '';

        switch (view) {
            case 'cloud':
                popup.dataset.panel = 'gpu-cloud';
                title = t('compute.dashboard.cloud_manage', '클라우드 관리');
                bodyHtml = `
                    ${nav}
                    <div class="cloud-provider-grid">
                        ${Object.entries(providerInfo).map(([provider, info]) => `
                            <section class="cloud-provider-card">
                                <div class="cloud-provider-card__head">
                                    <strong>${info.label}</strong>
                                    <span>${t('compute.cloud_contract_hint', '즉시 사용 가능하지만 월 비용이 큽니다.')}</span>
                                </div>
                                <div class="cloud-provider-card__body">
                                    ${availableCloud.map(gpu => {
                                        const activeCount = (eco.gpuFleet || [])
                                            .filter(slot => slot.source === 'cloud' && slot.gpuId === gpu.id && (slot.provider || 'aws') === provider)
                                            .reduce((sum, slot) => sum + slot.count, 0);
                                        return `
                                            <div class="compute-market-card">
                                                <div>
                                                    <div class="compute-market-card__title">${this._termLabel(`gpu_${gpu.id}`, gpu.name)}</div>
                                                    <div class="compute-market-card__meta">${gpu.tflops} TFLOPS · ${gpu.vram}GB VRAM · ${t('compute.active_contract_count', '현재 {count}대', { count: activeCount })}</div>
                                                </div>
                                                <div class="compute-market-card__actions">
                                                    <button class="btn btn-small" onclick="game._adjustCloudGpu('${gpu.id}','${provider}',${info.termMonths},1)">+1</button>
                                                    <button class="btn btn-small" onclick="game._adjustCloudGpu('${gpu.id}','${provider}',${info.termMonths},5)">+5</button>
                                                    <button class="btn btn-small" onclick="game._adjustCloudGpu('${gpu.id}','${provider}',${info.termMonths},-1)" ${activeCount < 1 ? 'disabled' : ''}>-1</button>
                                                    <button class="btn btn-small" onclick="game._adjustCloudGpu('${gpu.id}','${provider}',${info.termMonths},-5)" ${activeCount < 5 ? 'disabled' : ''}>-5</button>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </section>
                        `).join('')}
                    </div>
                `;
                break;
            case 'datacenter': {
                popup.dataset.panel = 'gpu-datacenter';
                title = t('compute.dashboard.datacenter_build', '데이터센터 건설');
                const buildState = this._getDatacenterBuildState();
                const tiers = this._getDatacenterTierCatalog();
                const tierRank = { small: 1, medium: 2, ai_farm: 3 };
                const selectedTier = tiers.find(entry => entry.id === buildState.tierId) || tiers[1] || tiers[0];
                const candidateLocations = this._getDatacenterLocationOptions(selectedTier.id);
                const selectedLocation = candidateLocations.find(entry => entry.id === buildState.locationId) || candidateLocations[0] || DATACENTER_LOCATIONS.domestic;
                const selectedPreview = this._getDatacenterBuildPreview(selectedTier.id, selectedLocation.id);
                const tierCards = tiers.map(tier => {
                    const isSelected = tier.id === selectedTier.id;
                    const canAfford = this.state.resources.funds >= this._getDatacenterBuildPreview(tier.id, selectedLocation.id).buildCost;
                    const locked = tier.requires && !this.state.technologies[tier.requires]?.completed;
                    return `
                        <button class="dc-build-card ${isSelected ? 'dc-build-card--selected' : ''}" onclick="game._setDatacenterBuildTier('${tier.id}')">
                            <div class="dc-build-card__badge">${_localizedDatacenterName(tier.id)}</div>
                            <div class="dc-build-card__stat">${t('compute.rack_capacity', '랙 용량: GPU {count}대', { count: tier.gpus })}</div>
                            <div class="dc-build-card__meta">$${Math.round(tier.buildCost).toLocaleString()} · ${tier.buildMonths}${t('world.months', '개월')}</div>
                            <div class="dc-build-card__foot">
                                ${locked ? `<span class="hint">${t('compute.require_tech', '"{tech}" 기술 필요', { tech: _localizedTechName(tier.requires) })}</span>` : `<span class="${canAfford ? 'positive' : 'warning'}">${canAfford ? t('compute.build_start', '건설 시작') : t('common.insufficient_funds', '자금 부족')}</span>`}
                            </div>
                        </button>
                    `;
                }).join('');
                const locationCards = Object.values(DATACENTER_LOCATIONS).map(location => {
                    const locationTierRank = location.minTier ? tierRank[location.minTier] || 1 : 1;
                    const isTierLocked = tierRank[selectedTier.id] < locationTierRank;
                    const techLocked = location.unlockTech && !this.state.technologies[location.unlockTech]?.completed;
                    const spaceComputingLocked = location.id === 'space_orbital' && !this.state.technologies.space_computing?.completed;
                    const isLocked = isTierLocked || techLocked || spaceComputingLocked;
                    const isSelected = location.id === selectedLocation.id;
                    const bonusBits = [];
                    if (location.powerCostMult < 1) bonusBits.push(`<span class="positive">${t('dc.power_cost_mult', '전력비')}: ×${location.powerCostMult.toFixed(2)}</span>`);
                    if (location.costMult !== 1) bonusBits.push(`<span>${t('dc.build_cost_mult', '비용')}: ×${location.costMult.toFixed(2)}</span>`);
                    if (location.buildTimeMult !== 1) bonusBits.push(`<span>${t('dc.build_time_mult', '시간')}: ×${location.buildTimeMult.toFixed(2)}</span>`);
                    if (location.regulationRisk > 0) bonusBits.push(`<span class="warning">${t('dc.regulation_risk', '규제 위험')} ${Math.round(location.regulationRisk * 100)}%</span>`);
                    if (location.disasterRisk > 0) bonusBits.push(`<span class="warning">${t('dc.disaster_risk', '재해 위험')} ${Math.round(location.disasterRisk * 100)}%</span>`);
                    const lockedHint = techLocked
                        ? t('dc.location.requires_tech', '기술 연구 필요: {tech}', { tech: _localizedTechName(location.unlockTech) })
                        : (isTierLocked ? t('dc.location.requires_tier', '더 큰 티어 필요') : '');
                    return `
                        <article class="dc-location-card ${isSelected ? 'dc-location-card--selected' : ''} ${isLocked ? 'dc-location-card--locked' : ''}">
                            <button class="dc-location-card__button" onclick="game._setDatacenterBuildLocation('${location.id}')" ${isLocked ? 'disabled' : ''}>
                                <div class="dc-location-card__icon">${location.icon || '📍'}</div>
                                <div class="dc-location-card__name">${_localizedDatacenterLocationName(location.id)}</div>
                                <div class="dc-location-card__desc">${_localizedDatacenterLocationDescription(location.id)}</div>
                                <div class="dc-location-stats">
                                    <span>${t('dc.build_cost_mult', '비용')} ×${location.costMult.toFixed(2)}</span>
                                    <span>${t('dc.build_time_mult', '시간')} ×${location.buildTimeMult.toFixed(2)}</span>
                                    <span>${t('dc.power_cost_mult', '전력비')} ×${location.powerCostMult.toFixed(2)}</span>
                                    ${bonusBits.map(bit => bit).join('')}
                                </div>
                                ${lockedHint ? `<div class="dc-location-lock">${lockedHint}</div>` : ''}
                                <div class="dc-location-card__cta">${isSelected ? t('common.selected', '선택됨') : t('common.select', '선택')}</div>
                            </button>
                        </article>
                    `;
                }).join('');
                bodyHtml = `
                    ${nav}
                    <div class="compute-datacenter-layout">
                        <section class="panel">
                            <h3>${icon('company', 14)} ${t('compute.datacenter_section', '데이터센터')}</h3>
                            <div class="stat-row"><span>${this._termLabel('colocation', t('compute.colocation_usage', '코로케이션 GPU'))}</span><span>${fleetStats.colocationCount}${t('topbar.gpu_unit', '대')} / ${colocationCapacity}${t('topbar.gpu_unit', '대')}</span></div>
                            <div class="stat-row"><span>${this._termLabel('datacenter', t('compute.datacenter_capacity', '데이터센터 GPU'))}</span><span>${fleetStats.datacenterCount}${t('topbar.gpu_unit', '대')} / ${datacenterCapacity}${t('topbar.gpu_unit', '대')}</span></div>
                            <div class="dashboard-action-row" style="margin-top:12px">
                                <button class="btn btn-small" onclick="game._leaseColocationRack(1)">${t('compute.lease_rack', '랙 임대')}</button>
                            </div>
                            ${operationalDatacenters.length > 0 ? operationalDatacenters.map(datacenter => `
                                ${(() => {
                                    const constructionEvents = Array.isArray(datacenter.constructionEvents) ? datacenter.constructionEvents.length : 0;
                                    const operationalEvents = Array.isArray(datacenter.operationalEvents) ? datacenter.operationalEvents.length : 0;
                                    return `
                                <div class="company-list-item">
                                    <div>
                                        <div class="company-list-item__title">${datacenter.name || _localizedDatacenterName(datacenter.tierId, datacenter.name)}</div>
                                        <div class="company-list-item__meta">${t('compute.rack_capacity', '랙 용량: GPU {count}대', { count: datacenter.gpus || 0 })} · ${t('dc.history.construction', '건설 이벤트')} ${constructionEvents} · ${t('dc.history.operational', '운영 이벤트')} ${operationalEvents}</div>
                                    </div>
                                    <div class="company-list-item__value">$${Math.round(datacenter.monthlyCost || 0).toLocaleString()}/m</div>
                                </div>
                                    `;
                                })()}
                            `).join('') : `<p class="company-empty-state">${t('compute.dashboard.no_datacenter', '운영 중인 데이터센터가 없습니다.')}</p>`}
                        </section>
                        <section class="panel">
                            <h3>${icon('hammer', 14)} ${t('compute.build_title', '데이터센터 건설')}</h3>
                            <div class="dc-build-steps">
                                <div class="dc-build-step dc-build-step--active">${t('dc.step.tier', '1단계: 티어 선택')}</div>
                                <div class="dc-build-step ${selectedTier ? 'dc-build-step--active' : ''}">${t('dc.step.location', '2단계: 지역 선택')}</div>
                                <div class="dc-build-step ${selectedPreview ? 'dc-build-step--active' : ''}">${t('dc.step.review', '3단계: 비용 확인')}</div>
                            </div>
                            <div class="dc-tier-grid">
                                ${tierCards}
                            </div>
                            <div class="dc-location-grid">
                                ${locationCards}
                            </div>
                            <div class="dc-build-review">
                                <div class="dc-build-review__head">
                                    <h4>${selectedLocation.icon || '📍'} ${_localizedDatacenterLocationName(selectedLocation.id)}</h4>
                                    <span>${_localizedDatacenterLocationDescription(selectedLocation.id)}</span>
                                </div>
                                <div class="dc-build-review__stats">
                                    <div><span>${t('dc.cost_breakdown', '비용')}</span><strong>$${selectedPreview.buildCost.toLocaleString()}</strong></div>
                                    <div><span>${t('dc.build_time', '건설 기간')}</span><strong>${selectedPreview.buildMonths}${t('world.months', '개월')}</strong></div>
                                    <div><span>${t('dc.monthly_power_cost', '월 전력비')}</span><strong>$${selectedPreview.monthlyCost.toLocaleString()}</strong></div>
                                    <div><span>${t('dc.risk_total', '리스크')}</span><strong>${Math.round((Number(selectedLocation.regulationRisk || 0) + Number(selectedLocation.disasterRisk || 0)) * 100)}%</strong></div>
                                </div>
                                <div class="dc-build-review__notes">
                                    <span>${t('dc.bonuses', '보너스')}: ${selectedLocation.bonuses?.greenEnergy ? t('dc.bonus.green_energy', '친환경 에너지') : t('dc.bonus.none', '없음')}</span>
                                    <span>${selectedLocation.unlockTech ? t('dc.unlock_tech', '필요 기술: {tech}', { tech: _localizedTechName(selectedLocation.unlockTech) }) : t('dc.unlock_none', '잠금 없음')}</span>
                                </div>
                                <div class="popup-buttons" style="margin-top:12px;justify-content:flex-start">
                                    <button class="btn btn-primary" onclick="game._confirmBuildDatacenter('${selectedTier.id}','${selectedLocation.id}')" ${this.state.resources.funds >= selectedPreview.buildCost && (!selectedTier.requires || this.state.technologies[selectedTier.requires]?.completed) && (!selectedLocation.unlockTech || this.state.technologies[selectedLocation.unlockTech]?.completed) ? '' : 'disabled'}>${t('compute.build_start', '건설 시작')}</button>
                                </div>
                            </div>
                        </section>
                        ${(() => {
                            const warehouseSlots = (eco.gpuFleet || []).filter(slot =>
                                slot.source === 'owned' && (slot.location || 'warehouse') === 'warehouse' && slot.count > 0
                            );
                            return `
                                <section class="panel">
                                    <h3>${icon('gpu', 14)} ${t('compute.install_title', 'GPU 설치')}</h3>
                                    <p class="hint" style="margin-bottom:8px">${t('compute.install_hint', '창고에 보관 중인 GPU를 코로케이션 또는 데이터센터에 설치합니다.')}</p>
                                    <div class="compute-market-list">
                                        ${warehouseSlots.length > 0 ? warehouseSlots.map(slot => {
                                            const gpu = getGpuById(slot.gpuId, { completedChipPrograms });
                                            if (!gpu) return '';
                                            return `
                                                <div class="compute-market-card">
                                                    <div>
                                                        <div class="compute-market-card__title">${gpu.name} × ${slot.count}</div>
                                                        <div class="compute-market-card__meta">${t('compute.location.warehouse', '창고')} · ${gpu.tflops} TFLOPS · ${gpu.vram}GB VRAM</div>
                                                    </div>
                                                    <div class="compute-market-card__actions">
                                                        ${colocationCapacity > fleetStats.colocationCount
                                                            ? `<button class="btn btn-small" onclick="game._moveGpuLocation('${slot.gpuId}',1,'warehouse','colocation');game._showComputeDialog('datacenter')">${t('compute.install_colocation', '코로케이션 설치')}</button>` : ''}
                                                        ${datacenterCapacity > fleetStats.datacenterCount
                                                            ? `<button class="btn btn-small btn-primary" onclick="game._moveGpuLocation('${slot.gpuId}',1,'warehouse','datacenter');game._showComputeDialog('datacenter')">${t('compute.install_datacenter', 'DC 설치')}</button>` : ''}
                                                        ${colocationCapacity <= fleetStats.colocationCount && datacenterCapacity <= fleetStats.datacenterCount
                                                            ? `<span class="hint">${t('compute.no_capacity', '설치 가능한 공간이 없습니다.')}</span>` : ''}
                                                    </div>
                                                </div>
                                            `;
                                        }).join('') : `<p class="company-empty-state">${t('compute.no_warehouse_gpus', '창고에 GPU가 없습니다.')}</p>`}
                                    </div>
                                </section>
                            `;
                        })()}
                    </div>
                `;
                break;
            }
            case 'market':
            default:
                popup.dataset.panel = 'gpu-market';
                bodyHtml = `
                    ${nav}
                    <div class="compute-market-list">
                        ${availableOwned.map(gpu => `
                            <div class="compute-market-card">
                                <div>
                                    <div class="compute-market-card__title">${this._termLabel(`gpu_${gpu.id}`, gpu.name)}</div>
                                    <div class="compute-market-card__meta">${this._termValue('tflops', `${gpu.tflops} TFLOPS`)} · ${this._termValue('vram', `${gpu.vram}GB`)} · $${Math.round(gpu.price || 0).toLocaleString()}</div>
                                </div>
                                <div class="compute-market-card__actions">
                                    <button class="btn btn-small btn-primary" onclick="game._orderGpu('${gpu.id}',1,'owned','warehouse')">${t('compute.order_to_warehouse', '창고 주문')}</button>
                                    ${colocationCapacity > fleetStats.colocationCount ? `<button class="btn btn-small" onclick="game._orderGpu('${gpu.id}',1,'owned','colocation')">${t('compute.install_colocation', '코로케이션에 설치')}</button>` : ''}
                                    ${datacenterCapacity > fleetStats.datacenterCount ? `<button class="btn btn-small" onclick="game._orderGpu('${gpu.id}',1,'owned','datacenter')">${t('compute.install_datacenter', '데이터센터에 설치')}</button>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                break;
        }

        popup.innerHTML = `
            <div class="popup-content compute-dialog-shell" style="max-width:980px">
                <h3>${icon('gpu', 16)} ${title}</h3>
                ${bodyHtml}
                <div class="popup-buttons" style="margin-top:12px">
                    <button class="btn" onclick="game._showDataMarketDialog()">${t('game.data', '데이터')}</button>
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.close', '닫기')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _showCloudGpuDialog() {
        this._showComputeDialog('cloud');
    }

    _showDataMarketDialog(methodId = this._dataMethodId || 'purchase') {
        const popup = document.getElementById('popup');
        const dataState = this._ensureDataState();
        const method = this._getDataMethod(methodId || this._dataMethodId || 'purchase');
        const availability = this._getDataMethodAvailability(method);
        const selectedType = DATA_TYPES[this._dataTypeId] ? this._dataTypeId : 'web_text';
        this._dataMethodId = method.id;
        this._dataTypeId = selectedType;
        const preview = this._getDataMethodPreview(method.id, selectedType, this._dataAmountTB);
        const amountMax = method.id === 'purchase' || method.id === 'scraping' || method.id === 'partnership' || method.id === 'synthetic'
            ? Math.max(0.5, Number(preview.availableTB || 1))
            : 0;
        const actionLabel = method.id === 'purchase'
            ? t('data.action.purchase', '즉시 구매')
            : method.id === 'userLogs'
                ? t('data.action.activate', '자동 수집 연동')
                : t('data.action.acquire', '획득 시작');
        const dataTypeOptions = Object.entries(DATA_TYPES).map(([typeId, typeDef]) => `
            <option value="${typeId}" ${typeId === selectedType ? 'selected' : ''}>
                ${typeDef.icon || ''} ${_localizedDataTypeName(typeDef)}
                (${Math.max(0, Number(typeDef.availableTB || 0))}TB)
            </option>
        `).join('');
        const methodCardsHtml = DATA_ACQUISITION_METHODS.map(entry => {
            const entryAvailability = this._getDataMethodAvailability(entry);
            return `
                <button class="data-method-card ${entry.id === method.id ? 'selected' : ''} ${entryAvailability.available ? '' : 'locked'}"
                    onclick="game._showDataMarketDialog('${entry.id}')">
                    <div class="data-method-card__top">
                        <span class="data-method-card__icon">${entry.icon}</span>
                        <span class="data-method-card__speed">${_localizedDataMethodSpeed(entry)}</span>
                    </div>
                    <div class="data-method-card__title">${_localizedDataMethodName(entry)}</div>
                    <div class="data-method-card__desc">${_localizedDataMethodDescription(entry)}</div>
                </button>
            `;
        }).join('');
        popup.dataset.panel = 'data';
        popup.innerHTML = `
            <div class="popup-content data-dialog" style="max-width:980px">
                <div class="data-dialog__layout">
                    <aside class="data-dialog__methods">
                        <h3>${icon('zap', 16)} ${t('data.dialog.methods', '획득 방법')}</h3>
                        <div class="data-method-grid data-method-grid--compact">
                            ${methodCardsHtml}
                        </div>
                    </aside>
                    <div class="data-dialog__main">
                        <div id="popup-panel-body"></div>
                    </div>
                </div>
                <div class="popup-buttons" style="margin-top:12px">
                    <button class="btn" onclick="game._showComputeDialog('market')">${t('game.gpu', 'GPU')}</button>
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.close', '닫기')}</button>
                </div>
            </div>
        `;
        popup.querySelector('#popup-panel-body').innerHTML = `
            <div class="data-dialog__detail">
                <h3>${method.icon} ${_localizedDataMethodName(method)}</h3>
                <p>${_localizedDataMethodDescription(method)}</p>
                <div class="data-dialog__stats">
                    <div class="data-dialog__stat"><span>${t('data.preview.cost', '예상 비용')}</span><strong>${preview.totalCost > 0 ? `$${preview.totalCost.toLocaleString()}` : t('data.cost.free', '무료')}</strong></div>
                    <div class="data-dialog__stat"><span>${t('data.preview.duration', '획득 기간')}</span><strong>${preview.durationMonths > 0 ? `${preview.durationMonths}${t('world.months', '개월')}` : t('data.speed.instant', '즉시')}</strong></div>
                    <div class="data-dialog__stat"><span>${t('data.preview.quality', '예상 품질')}</span><strong>${preview.quality}%</strong></div>
                    <div class="data-dialog__stat"><span>${t('data.preview.freshness', '예상 신선도')}</span><strong>${preview.freshness}%</strong></div>
                    <div class="data-dialog__stat"><span>${t('data.preview.bias', '편향 위험')}</span><strong>${preview.bias}%</strong></div>
                    <div class="data-dialog__stat"><span>${t('data.preview.legal', '법적 민감도')}</span><strong>${preview.legal}%</strong></div>
                </div>

                <div class="data-dialog__form">
                    <label>
                        <span>${t('data.dialog.type', '데이터 타입')}</span>
                        <select ${method.id === 'userLogs' ? 'disabled' : ''} onchange="game._dataTypeId=this.value;game._showDataMarketDialog('${method.id}')">
                            ${dataTypeOptions}
                        </select>
                    </label>
                    <label>
                        <span>${t('data.dialog.amount', '수량')}</span>
                        <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            max="${amountMax || 100}"
                            value="${this._dataAmountTB || 1}"
                            ${method.id === 'userLogs' ? 'disabled' : ''}
                            oninput="game._dataAmountTB = Number(this.value || 0); game._showDataMarketDialog('${method.id}')">
                    </label>
                </div>

                ${method.id === 'userLogs' ? `
                    <div class="data-passive-note">
                        ${icon('trendUp', 12)} ${t('data.passive.note', '활성 서비스가 있으면 매월 자동으로 텍스트·코드·이미지 로그가 축적됩니다.')}
                        <div>${t('data.passive.current', '현재 자동 수집량')}: <strong>${(dataState.monthlyPassiveGain || 0).toFixed(dataState.monthlyPassiveGain % 1 ? 1 : 0)} TB</strong></div>
                    </div>
                ` : ''}

                <div class="popup-buttons" style="margin-top:16px">
                    <button class="btn btn-primary" onclick="game._startDataAcquisition('${method.id}', '${selectedType}', ${method.id === 'userLogs' ? 1 : (this._dataAmountTB || 1)})" ${availability.available ? '' : 'disabled'}>
                        ${actionLabel}
                    </button>
                    <button class="btn" onclick="game._showDataMarketDialog('purchase')">${t('data.dialog.reset', '구매로 전환')}</button>
                </div>
                ${!availability.available ? `<div style="color:var(--danger);font-size:0.8rem;margin-top:6px">${availability.label}</div>` : ''}
            </div>
        `;
        popup.classList.add('show');
    }

    _orderGpu(gpuId, count, source = 'owned', location = null) {
        this.economy.orderGPUs(gpuId, count, { source, location });
        this._refreshComputePanels();
    }

    _rentCloudGpu(gpuId, provider, termMonths, count) {
        this.economy.rentCloudGPUs({ gpuId, provider, termMonths, count });
        this._refreshComputePanels();
    }

    _leaseColocationRack(count = 1) {
        this.economy.leaseColocationRacks(count);
        this._refreshComputePanels();
    }

    _getDatacenterTierCatalog() {
        const infrastructureMult = this._countryBonusMultiplier(this._getCountryModifiers().infrastructure, 0.85);
        return [
            { id: 'small', gpus: 100, buildCost: 2_000_000, monthlyCost: 50_000, buildMonths: 3, minTier: 'small' },
            { id: 'medium', gpus: 500, buildCost: 15_000_000, monthlyCost: 200_000, buildMonths: 6, minTier: 'medium' },
            { id: 'ai_farm', gpus: 2000, buildCost: 80_000_000, monthlyCost: 800_000, buildMonths: 12, minTier: 'ai_farm', requires: 'ai_farm' }
        ].map(tier => ({
            ...tier,
            buildMonths: Math.max(1, Math.round(tier.buildMonths / infrastructureMult))
        }));
    }

    _getDatacenterBuildState() {
        if (!this._datacenterBuildState || typeof this._datacenterBuildState !== 'object') {
            this._datacenterBuildState = {
                tierId: 'medium',
                locationId: 'domestic'
            };
        }
        return this._datacenterBuildState;
    }

    _setDatacenterBuildTier(tierId) {
        const state = this._getDatacenterBuildState();
        state.tierId = tierId;
        const options = this._getDatacenterLocationOptions(tierId);
        if (!options.some(option => option.id === state.locationId)) {
            state.locationId = options[0]?.id || 'domestic';
        }
        this._showComputeDialog('datacenter');
    }

    _setDatacenterBuildLocation(locationId) {
        const state = this._getDatacenterBuildState();
        state.locationId = locationId;
        this._showComputeDialog('datacenter');
    }

    _getDatacenterLocationOptions(tierId) {
        const tierRank = { small: 1, medium: 2, ai_farm: 3 }[tierId] || 1;
        const completedSpaceTech = Boolean(this.state.technologies?.space_computing?.completed);
        return Object.values(DATACENTER_LOCATIONS).filter(location => {
            if (!location) return false;
            if (location.unlockTech && !this.state.technologies?.[location.unlockTech]?.completed) return false;
            if (location.minTier) {
                const minRank = { small: 1, medium: 2, ai_farm: 3 }[location.minTier] || 1;
                if (tierRank < minRank) return false;
            }
            if (location.id === 'space_orbital' && !completedSpaceTech) return false;
            return true;
        });
    }

    _getDatacenterBuildPreview(tierId, locationId) {
        const tier = this._getDatacenterTierCatalog().find(entry => entry.id === tierId) || this._getDatacenterTierCatalog()[0];
        const location = DATACENTER_LOCATIONS[locationId] || DATACENTER_LOCATIONS.domestic;
        const buildCost = Math.round(Number(tier?.buildCost || 0) * Number(location?.costMult || 1));
        const buildMonths = Math.max(1, Math.round(Number(tier?.buildMonths || 1) * Number(location?.buildTimeMult || 1)));
        const monthlyCost = Math.round(Number(tier?.monthlyCost || 0) * Number(location?.powerCostMult || 1));
        return {
            tier,
            location,
            buildCost,
            buildMonths,
            monthlyCost
        };
    }

    _confirmBuildDatacenter(tier, locationId = null) {
        const tierObj = typeof tier === 'string'
            ? this._getDatacenterTierCatalog().find(entry => entry.id === tier)
            : tier;
        if (!tierObj) return false;
        const state = this._getDatacenterBuildState();
        const resolvedLocationId = locationId || state.locationId || 'domestic';
        return this._startBuildDatacenter(tierObj, resolvedLocationId);
    }

    _startBuildDatacenter(tier, locationId = 'domestic') {
        const tierObj = typeof tier === 'string'
            ? this._getDatacenterTierCatalog().find(entry => entry.id === tier)
            : tier;
        if (!tierObj) return false;

        const location = DATACENTER_LOCATIONS[locationId] || DATACENTER_LOCATIONS.domestic;
        if (tierObj.requires && !this.state.technologies?.[tierObj.requires]?.completed) return false;
        if (location.unlockTech && !this.state.technologies?.[location.unlockTech]?.completed) return false;
        const preview = this._getDatacenterBuildPreview(tierObj.id, location.id);
        if (this.state.resources.funds < preview.buildCost) return false;

        this.state.resources.funds -= preview.buildCost;
        const currentDate = this.time.currentDate || {};
        const datacenter = {
            id: `dc-${tierObj.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
            tierId: tierObj.id,
            locationId: location.id,
            name: `${_localizedDatacenterLocationName(location.id)} ${_localizedDatacenterName(tierObj.id)}`,
            gpus: tierObj.gpus,
            monthlyCost: preview.monthlyCost,
            powerCostMult: Number(location.powerCostMult || 1),
            buildMonthsTotal: preview.buildMonths,
            buildMonthsLeft: preview.buildMonths,
            operational: false,
            constructionEvents: [],
            operationalEvents: [],
            activeOperationalEffects: [],
            bonuses: { ...(location.bonuses || {}) },
            risks: {
                regulationRisk: Number(location.regulationRisk || 0),
                disasterRisk: Number(location.disasterRisk || 0)
            },
            buildStartedAt: { year: currentDate.year || null, month: currentDate.month || null, day: currentDate.day || null }
        };
        const eco = this.state.economy;
        eco.datacenters = Array.isArray(eco.datacenters) ? eco.datacenters : [];
        eco.datacenters.push(datacenter);
        syncStateEconomyCompatibility(this.state, this.time.currentDate.year);
        this.state.addNews(t('compute.build_started_location', '{name} 건설을 시작했습니다! ({location}) · {months}개월 소요', {
            name: datacenter.name,
            location: _localizedDatacenterLocationName(location.id),
            months: preview.buildMonths
        }), 'info');
        this._datacenterBuildState = { tierId: tierObj.id, locationId: location.id };
        this._showComputeDialog('datacenter');
        this.renderAll();
        return true;
    }

    _processDatacenterConstructionEvents() {
        const datacenters = this.state.economy.datacenters || [];
        let queued = 0;
        for (const dc of datacenters) {
            if (!dc || dc.operational || Number(dc.buildMonthsLeft || 0) <= 0) continue;
            const event = checkDatacenterConstructionEvent(dc, this.state, { rng: Math.random });
            if (event && this.events?.enqueueExternalEvent?.(event)) {
                queued++;
                if (queued >= 2) break;
            }
        }
    }

    _advanceDatacenterOperationalEffects() {
        const datacenters = this.state.economy.datacenters || [];
        for (const dc of datacenters) {
            if (!dc || !Array.isArray(dc.activeOperationalEffects)) continue;
            dc.activeOperationalEffects = dc.activeOperationalEffects
                .map(effect => ({
                    ...effect,
                    remainingMonths: Math.max(0, Number(effect.remainingMonths || 0) - 1)
                }))
                .filter(effect => effect.remainingMonths > 0);
        }
    }

    _processDatacenterOperationalEvents() {
        const datacenters = this.state.economy.datacenters || [];
        let queued = 0;
        const currentMonth = (Number(this.time.currentDate.year || 2017) * 12) + Number(this.time.currentDate.month || 1);
        for (const dc of datacenters) {
            if (!dc?.operational) continue;
            const event = checkDatacenterOperationalEvent(dc, this.state, { rng: Math.random, currentMonth });
            if (event && this.events?.enqueueExternalEvent?.(event)) {
                queued++;
                if (queued >= 2) break;
            }
        }
    }

    _buyDataType(typeId, amountTB) {
        return this._startDataAcquisition('purchase', typeId, amountTB);
    }

    _startDataAcquisition(methodId, typeId, amountTB) {
        const method = this._getDataMethod(methodId);
        const availability = this._getDataMethodAvailability(method);
        if (!availability.available) {
            this.state.addNews(availability.label || t('data.locked', '획득 불가'), 'warning');
            return false;
        }

        const preview = this._getDataMethodPreview(method.id, typeId, amountTB);
        const amount = method.id === 'userLogs'
            ? 1
            : Math.max(0.5, Math.min(Number(amountTB || 1), Math.max(0.5, preview.availableTB || Number(amountTB || 1))));
        const result = startDataAcquisitionAction(this.state, {
            method: method.id,
            type: typeId,
            tb: amount,
            currentMonth: (Number(this.time.currentDate.year || 2017) * 12) + Number(this.time.currentDate.month || 1),
            quality: preview.quality,
            freshness: preview.freshness,
            bias: preview.bias,
            legal: preview.legal
        });

        if (!result?.ok) {
            if (result.reason === 'insufficient_funds') {
                this.state.addNews(t('data.insufficient_funds', '자금이 부족합니다.'), 'warning');
            } else if (result.reason === 'missing_tech') {
                this.state.addNews(t('data.require.tech_short', '필요 기술이 부족합니다.'), 'warning');
            } else if (result.reason === 'missing_active_services') {
                this.state.addNews(t('data.require.service', '활성 서비스 필요'), 'warning');
            } else if (result.reason === 'missing_deployed_models') {
                this.state.addNews(t('data.require.model_short', '배포된 모델이 필요합니다.'), 'warning');
            } else if (result.reason === 'min_reputation') {
                this.state.addNews(t('data.require.reputation_short', '평판이 부족합니다.'), 'warning');
            } else {
                this.state.addNews(t('data.acquisition_failed', '데이터 확보에 실패했습니다.'), 'warning');
            }
            return false;
        }

        if (result.immediate) {
            this.state.addNews(t('data.purchase.quick', '{type} {amount}TB를 즉시 구매했습니다.', {
                type: _localizedDataTypeName(DATA_TYPES[typeId] || typeId),
                amount: Math.round(amount * 10) / 10
            }), 'success');
        } else if (result.passive) {
            this.state.addNews(t('data.passive.enabled', '사용자 로그 자동 수집을 연동했습니다.'), 'info');
        } else {
            this.state.addNews(t('data.acquisition_started', '{method}으로 {type} {amount}TB 획득을 시작했습니다.', {
                method: _localizedDataMethodName(method),
                type: _localizedDataTypeName(DATA_TYPES[typeId] || typeId),
                amount: Math.round(amount * 10) / 10
            }), 'info');
        }

        this._ensureDataState();
        this._showDataMarketDialog(method.id);
        this._refreshDataPanels();
        return true;
    }

    _buildDatacenterDialog() {
        this._showComputeDialog('datacenter');
    }

    _renderResearch(el) {
        const researching = this.techTree.getResearchingTechs();
        const totalTechs = Object.keys(TECH_TREE).length;
        const completedTechs = Object.values(this.state.technologies).filter(entry => entry.completed).length;
        const activeGroup = RESEARCH_GROUPS.find(group => group.id === this._researchGroup) || RESEARCH_GROUPS[0];
        this._researchGroup = activeGroup.id;

        const allTechs = Object.entries(TECH_TREE).map(([id, tech]) => {
            const state = this.state.technologies[id];
            return {
                id,
                tech,
                state,
                canRes: this.techTree.canResearch(id),
                groupId: _getResearchGroupIdForCategory(tech.category)
            };
        });

        const counts = Object.fromEntries(RESEARCH_GROUPS.map(group => [group.id, { total: 0, done: 0 }]));
        for (const entry of allTechs) {
            if (!counts[entry.groupId]) continue;
            counts[entry.groupId].total++;
            if (entry.state?.completed) counts[entry.groupId].done++;
        }

        const groupTechs = allTechs.filter(entry => entry.groupId === activeGroup.id);
        const layout = computeSubsetTechTreeLayout(groupTechs.map(entry => entry.id));
        const techMap = new Map(groupTechs.map(entry => [entry.id, entry]));

        const activeItemsHtml = researching.length > 0
            ? researching.map(entry => `
                <div class="ra-item" data-tech-id="${entry.id}">
                    <span class="ra-name">${this._termLabel(`tech_${entry.id}`, _localizedTechName(entry.id))}</span>
                    <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${entry.state?.progress || entry.progress}%"></div></div>
                    <span class="ra-pct">${Math.floor(entry.state?.progress || entry.progress)}%</span>
                    <button class="btn btn-danger btn-small" onclick="game.techTree.cancelResearch('${entry.id}'); game.renderAll()">${t('common.cancel', '취소')}</button>
                </div>
            `).join('')
            : `<div class="research-summary-empty">${t('right.no_research', '연구 없음')}</div>`;

        const groupTabsHtml = RESEARCH_GROUPS.map(group => {
            const countInfo = counts[group.id] || { done: 0, total: 0 };
            return `
                <button class="rgroup-tab ${group.id === activeGroup.id ? 'rgroup-tab--active' : ''}"
                        data-group="${group.id}"
                        style="--group-color:${group.color}"
                        onclick="game._researchGroup='${group.id}';game._renderResearch(document.getElementById('content-panel'))">
                    ${icon(group.icon, 14)} ${t(group.name, group.nameKo)}
                    <span class="rgroup-count">${countInfo.done}/${countInfo.total}</span>
                </button>
            `;
        }).join('');

        const categoriesHtml = activeGroup.categories
            .map(categoryId => `<span class="research-group-chip">${this._termLabel(`researchCategory_${categoryId}`, _localizedTechCategoryName(categoryId))}</span>`)
            .join('');
        const researchSpeedTooltip = this._researchSpeedTooltipData();

        const legendHtml = `
            <div class="tech-tree-legend research-tree-legend">
                <span class="legend-item"><span class="legend-dot" style="background:var(--success)"></span>${t('research.completed', '완료')}</span>
                <span class="legend-item"><span class="legend-dot" style="background:var(--warning)"></span>${t('research.active', '연구 중')}</span>
                <span class="legend-item"><span class="legend-dot" style="background:var(--accent)"></span>${t('research.available', '연구 가능')}</span>
                <span class="legend-item"><span class="legend-dot" style="background:rgba(148,163,184,0.65)"></span>${t('research.locked', '잠김')}</span>
                <span class="legend-item"><span class="legend-line" style="background:${activeGroup.color}"></span>${t('research.same_group_dependency', '계열 내부 의존')}</span>
            </div>`;

        const treeNodesHtml = groupTechs.map(({ id, tech, state, canRes }) => {
            const node = layout.nodes[id];
            if (!node) return '';

            const statusClass = state?.completed ? 'tc-completed' : state?.researching ? 'tc-researching' : canRes ? 'tc-available' : 'tc-locked';
            const routeColor = RESEARCH_ROUTE_COLORS[tech.route] || RESEARCH_ROUTE_COLORS.common;
            const internalReqNames = (tech.requires || []).filter(reqId => layout.nodes[reqId]).map(reqId => _localizedTechName(reqId)).join(', ');
            const anyReqNames = (tech.requiresAny || []).filter(reqId => layout.nodes[reqId]).map(reqId => _localizedTechName(reqId)).join(t('research.or', ' 또는 '));
            const requirementsHtml = [];
            if (internalReqNames && !state?.completed) {
                requirementsHtml.push(`<div class="tc-req">${t('research.required', '필요')}: ${internalReqNames}</div>`);
            }
            if (anyReqNames && !state?.completed) {
                requirementsHtml.push(`<div class="tc-req">${t('research.required_any', '다음 중 하나 필요')}: ${anyReqNames}</div>`);
            }

            const externalDepsHtml = (layout.externalDeps[id] || []).map(dep => {
                const depTech = TECH_TREE[dep.id];
                const depGroupId = depTech ? _getResearchGroupIdForCategory(depTech.category) : '';
                return `<div class="tc-ext-dep">${icon('globe', 10)} ${t('research.external_dep', '외부 의존: [{group}] {name}', {
                    group: _localizedResearchGroupName(depGroupId),
                    name: _localizedTechName(dep.id)
                })}</div>`;
            }).join('');

            let statusHtml = '';
            if (state?.completed) statusHtml = `<span class="tc-badge tc-badge--done">${icon('check', 10)} ${t('research.completed', '완료')}</span>`;
            else if (state?.researching) statusHtml = `<div class="tc-progress"><div class="tc-progress-fill" style="width:${state.progress}%"></div><span>${Math.floor(state.progress)}%</span></div>`;
            else if (canRes) statusHtml = `<span class="tc-badge tc-badge--available">${icon('zap', 10)} ${t('research.available', '연구 가능')}</span>`;
            else statusHtml = `<span class="tc-badge tc-badge--locked">${icon('lock', 10)} ${t('research.locked', '잠김')}</span>`;

            const clickable = canRes || state?.researching;
            const clickAction = state?.researching ? `game._manageTalentDialog('${id}')` : `game._startResearchDialog('${id}')`;
            const titleAttr = tech.historicalContext ? ` title="${_escapeHtmlAttr(tech.historicalContext)}"` : '';

            return `
                <article class="research-tree-node tech-card ${statusClass}"
                         data-tech-id="${id}"
                         style="left:${node.x}px;top:${node.y}px;--group-color:${activeGroup.color}"
                         ${clickable ? `onclick="${clickAction}" role="button" tabindex="0"` : ''}${titleAttr}>
                    <div class="tc-top">
                        <span class="tc-route" style="color:${routeColor}">${_localizedRouteName(tech.route)}</span>
                        <span class="tc-tier">T${tech.tier}</span>
                    </div>
                    <div class="tc-name">${this._termLabel(`tech_${id}`, _localizedTechName(id))}</div>
                    <div class="tc-desc">${_localizedTechDescription(id)}</div>
                    ${tech.historicalContext ? `<div class="tc-history">${icon('clock', 10)} ${tech.historicalContext}</div>` : ''}
                    <div class="tc-meta">
                        <span class="tc-cost">${tech.cost} RP</span>
                        ${statusHtml}
                    </div>
                    ${requirementsHtml.join('')}
                    ${externalDepsHtml}
                </article>`;
        }).join('');

        el.innerHTML = `
            <div class="research-fullscreen">
                <div class="research-topbar research-topbar--graph">
                    <div class="section-header">
                        <h3>${icon('research')} ${t('game.research', '기술 연구')}</h3>
                        <span class="section-badge">${completedTechs} / ${totalTechs} ${t('research.completed', '완료')}</span>
                    </div>
                    <div class="research-summary-bar">
                        <div class="research-summary-main">
                            <div class="research-summary-copy">
                                <div class="research-summary-title">${icon(activeGroup.icon, 14)} ${t(activeGroup.name, activeGroup.nameKo)} ${t('game.research', '기술 연구')}</div>
                                <div class="research-summary-sub">${t('right.active_research', '활성 연구')} ${researching.length} · ${counts[activeGroup.id]?.done || 0}/${counts[activeGroup.id]?.total || 0}</div>
                                <div style="margin-top:6px">
                                    <span class="pill term-link" tabindex="0" data-term-tooltip="${researchSpeedTooltip}">${t('research.speed', '연구 속도')} ×${Number(this.state.player?.modifiers?.researchSpeed || 1).toFixed(2)}</span>
                                    <span class="pill" style="margin-left:6px">${this._termLabel(`researchGroup_${activeGroup.id}`, _localizedResearchGroupName(activeGroup.id))}</span>
                                </div>
                            </div>
                            <div class="research-group-chips">${categoriesHtml}</div>
                        </div>
                        <div class="research-active-bar">${activeItemsHtml}</div>
                    </div>
                </div>
                <div class="research-group-tabs">${groupTabsHtml}</div>
                ${legendHtml}
                <div class="research-tree">
                    <div class="research-tree__canvas" style="width:${layout.canvasWidth}px;height:${layout.canvasHeight}px">
                        <svg class="research-tree__arrows" width="${layout.canvasWidth}" height="${layout.canvasHeight}" viewBox="0 0 ${layout.canvasWidth} ${layout.canvasHeight}"></svg>
                        <div class="research-tree__nodes">${treeNodesHtml}</div>
                    </div>
                </div>
            </div>
        `;

        const treeCanvas = el.querySelector('.research-tree__canvas');
        const arrows = el.querySelector('.research-tree__arrows');
        if (treeCanvas && arrows) {
            requestAnimationFrame(() => {
                const canvasRect = treeCanvas.getBoundingClientRect();
                const nodeEls = new Map(Array.from(treeCanvas.querySelectorAll('.research-tree-node')).map(nodeEl => [nodeEl.dataset.techId, nodeEl]));
                const pathHtml = layout.edges.map(edge => {
                    const fromEl = nodeEls.get(edge.from);
                    const toEl = nodeEls.get(edge.to);
                    if (!fromEl || !toEl) return '';
                    const fromRect = fromEl.getBoundingClientRect();
                    const toRect = toEl.getBoundingClientRect();
                    const x1 = fromRect.right - canvasRect.left;
                    const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
                    const x2 = toRect.left - canvasRect.left;
                    const y2 = toRect.top + toRect.height / 2 - canvasRect.top;
                    const cx = (x1 + x2) / 2;
                    const targetEntry = techMap.get(edge.to);
                    const targetState = targetEntry?.state;
                    let cls = 'arrow-locked';
                    if (targetState?.completed) cls = 'arrow-done';
                    else if (targetState?.researching) cls = 'arrow-active';
                    else if (targetEntry?.canRes) cls = 'arrow-available';
                    if (edge.type === 'requiresAny') cls += ' arrow-optional';
                    return `<path class="${cls}" d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}" />`;
                }).join('');
                arrows.innerHTML = pathHtml;
            });
        }
    }

    _startResearchDialog(techId) {
        const tech = TECH_TREE[techId];
        if (!tech) return;
        const techState = this.state.technologies[techId];
        if (techState?.completed) return; // Already completed — ignore click
        if (techState?.researching) return; // Already researching

        const freeTalents = this.state.talents.filter(t => !t.assignment);

        if (freeTalents.length === 0) {
            this.state.addNews(t('research.no_available_talent', '배치 가능한 인재가 없습니다.'), 'warning');
            return;
        }

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content">
                <h3>"${_localizedTechName(techId)}" ${t('research.start_title', '연구 시작')}</h3>
                <p>${_localizedTechDescription(techId)}</p>
                <p>${t('research.cost', '연구 비용')}: ${tech.cost} RP</p>
                <h4>${t('research.assign_talents', '인재 배치 (복수 선택)')}</h4>
                <div class="talent-select">
                    ${freeTalents.map(talent => `
                        <label class="talent-option">
                            <input type="checkbox" value="${talent.id}" class="research-talent-cb">
                            <span>${talent.name} (${t('talent.research_short', '연구력')}:${talent.stats.research} ${t('talent.specialty_short', '전문')}:${_localizedSpecialtyList(talent.specialty)})</span>
                        </label>
                    `).join('')}
                </div>
                <div class="popup-buttons">
                    <button class="btn btn-primary" onclick="game._confirmResearch('${techId}')">${t('research.start_action', '연구 시작')}</button>
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.cancel', '취소')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _confirmResearch(techId) {
        const checked = document.querySelectorAll('.research-talent-cb:checked');
        const talentIds = Array.from(checked).map(cb => cb.value);

        if (talentIds.length === 0) {
            alert(t('research.need_one_talent', '최소 1명의 인재를 배치해야 합니다.'));
            return;
        }

        this.techTree.startResearch(techId, talentIds);
        document.getElementById('popup').classList.remove('show');
        this.renderAll();
    }

    _manageTalentDialog(techId) {
        const techState = this.state.technologies[techId];
        if (!techState?.researching) return;

        const assigned = techState.assignedTalents
            .map(tid => this.state.talents.find(t => t.id === tid))
            .filter(Boolean);
        const free = this.state.talents.filter(t => !t.assignment);

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content">
                <h3>"${_localizedTechName(techId)}" ${t('research.manage_talent_title', '인재 관리')}</h3>
                <p>${t('research.progress_label', '진행도')}: ${Math.floor(techState.progress)}% | ${t('research.assigned_count', '배치 인원')}: ${assigned.length}${t('creation.stat.people', '명')}</p>

                <h4 style="margin-top:12px">${t('research.assigned_talents', '배치된 인재')}</h4>
                <div class="talent-select">
                    ${assigned.length > 0 ? assigned.map(talent => `
                        <div class="talent-option" style="display:flex;justify-content:space-between;align-items:center">
                            <span>${talent.name} (${t('talent.research_short', '연구력')}:${talent.stats.research})</span>
                            <button class="btn btn-danger btn-small" onclick="game.techTree.removeTalentFromResearch('${techId}','${talent.id}');game._manageTalentDialog('${techId}');game.renderAll()">${t('research.remove_talent', '빼기')}</button>
                        </div>
                    `).join('') : `<p style="color:var(--text-tertiary);font-size:0.8rem">${t('research.no_assigned_talents', '배치된 인재 없음 (연구 일시정지)')}</p>`}
                </div>

                ${free.length > 0 ? `
                    <h4 style="margin-top:12px">${t('research.add_idle_talents', '대기 인재 추가')}</h4>
                    <div class="talent-select">
                        ${free.map(talent => `
                            <div class="talent-option" style="display:flex;justify-content:space-between;align-items:center">
                                <span>${talent.name} (${t('talent.research_short', '연구력')}:${talent.stats.research} ${t('talent.specialty_short', '전문')}:${_localizedSpecialtyList(talent.specialty)})</span>
                                <button class="btn btn-primary btn-small" onclick="game.techTree.addTalentToResearch('${techId}','${talent.id}');game._manageTalentDialog('${techId}');game.renderAll()">${t('research.assign', '배치')}</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="popup-buttons" style="margin-top:16px">
                    <button class="btn btn-danger" onclick="game.techTree.cancelResearch('${techId}');document.getElementById('popup').classList.remove('show');game.renderAll()">${t('research.cancel_research', '연구 취소')}</button>
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.close', '닫기')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _renderTalentCard(talent, specs, traits, isMarket = false) {
        const moraleColor = talent.morale >= 70 ? 'var(--success)' : talent.morale >= 40 ? 'var(--warning)' : 'var(--danger)';
        const statBar = (label, value, color) => `
            <div class="talent-stat-row">
                <span class="stat-name">${label}</span>
                <div class="stat-track"><div class="stat-fill" style="width:${value * 10}%;background:${color}"></div></div>
                <span class="stat-val">${value.toFixed(1)}</span>
            </div>`;

        return `
            <div class="talent-card ${isMarket ? 'market' : ''} ${!isMarket && talent.morale < 30 ? 'low-morale' : ''}">
                <div class="talent-header">
                    <div class="talent-name">${talent.name}</div>
                    <div class="talent-salary">${icon('wallet', 12)} ${this._termValue('salary', `$${talent.salary.toLocaleString()}${t('topbar.per_month', '/월')}`, {
                        breakdown: [
                            { label: t('talent.stat.research', '연구'), value: talent.stats.research.toFixed(1) },
                            { label: t('talent.stat.creativity', '창의'), value: talent.stats.creativity.toFixed(1) },
                            { label: t('talent.stat.collaboration', '협업'), value: talent.stats.collaboration.toFixed(1) }
                        ]
                    })}</div>
                </div>
                <div class="talent-specs">${talent.specialty.map(s => `<span class="spec-tag" style="background:${specs[s]?.color || '#666'}">${this._termLabel(`spec_${s}`, _localizedSpecialtyName(s))}</span>`).join('')}</div>
                <div class="talent-personality">
                    ${talent.personality ? `<span class="spec-tag">${this._termLabel(`personality_${talent.personality.id || talent.personality}`, _localizedPersonality(talent.personality))}</span>` : ''}
                    <span class="spec-tag talent-ideology-tag">${this._termLabel(`ideology_${talent.ideologyProfile?.id || talent.ideology}`, _localizedIdeologyProfile(talent.ideologyProfile, talent.ideology))}</span>
                </div>
                <div class="talent-stat-bars">
                    ${statBar(t('talent.stat.research', '연구'), talent.stats.research, 'var(--accent)')}
                    ${statBar(t('talent.stat.creativity', '창의'), talent.stats.creativity, '#ce93d8')}
                    ${statBar(t('talent.stat.collaboration', '협업'), talent.stats.collaboration, '#4db6ac')}
                </div>
                ${!isMarket ? (() => {
                    const loyaltyVal = talent.loyalty ?? 70;
                    const loyaltyColor = loyaltyVal >= 60 ? 'var(--accent)' : loyaltyVal >= 30 ? 'var(--warning)' : 'var(--danger)';
                    return `
                    <div class="talent-morale">
                        ${icon('heart', 12)}
                        <span class="morale-label">${this._termLabel('morale', t('talent.morale', '사기'), { value: `${Math.round(talent.morale)}%` })}</span>
                        <div class="morale-track"><div class="morale-fill" style="width:${talent.morale}%;background:${moraleColor}"></div></div>
                        <span class="morale-val" style="color:${moraleColor}">${Math.round(talent.morale)}%</span>
                    </div>
                    <div class="talent-morale">
                        ${icon('shield', 12)}
                        <span class="morale-label">${this._termLabel('loyalty', t('talent.loyalty', '충성'), { value: `${Math.round(loyaltyVal)}%` })}</span>
                        <div class="morale-track"><div class="morale-fill" style="width:${loyaltyVal}%;background:${loyaltyColor}"></div></div>
                        <span class="morale-val" style="color:${loyaltyColor}">${Math.round(loyaltyVal)}%</span>
                    </div>`;
                })() : `
                    <div class="talent-info">
                        <span style="color:var(--accent)">${icon('funds', 12)} ${t('talent.hiring_cost', '채용비')}: $${(talent.salary * 3).toLocaleString()}</span>
                    </div>
                `}
                <div class="talent-trait">${icon('lightbulb', 11)} ${this._termLabel(`trait_${talent.trait}`, _localizedTraitName(talent.trait), {
                    extraLines: _localizedTraitEffect(talent.trait) ? [_localizedTraitEffect(talent.trait)] : []
                })}${!isMarket && _localizedTraitEffect(talent.trait) ? ': ' + _localizedTraitEffect(talent.trait) : ''}</div>
                <div class="talent-footer">
                    ${!isMarket ? `
                        <div class="talent-status ${talent.assignment ? 'assigned' : 'idle'}">
                            ${talent.assignment ? icon('briefcase', 13) + ' ' + t('talent.assigned', '배치됨') : icon('coffee', 13) + ' ' + t('talent.idle', '대기 중')}
                        </div>
                        <button class="btn-small btn-danger" onclick="game.fireTalent('${talent.id}')">${t('talent.fire', '해고')}</button>
                    ` : `
                        <div></div>
                        <button class="btn-small btn-primary" onclick="game.hireTalent('${talent.id}')">${t('talent.hire', '채용')}</button>
                    `}
                </div>
            </div>`;
    }

    _renderTalent(el) {
        const traits = PERSONALITY_TRAITS.reduce((m, t) => { m[t.id] = t; return m; }, {});
        const specs = SPECIALTIES.reduce((m, s) => { m[s.id] = s; return m; }, {});

        el.innerHTML = `
            <div class="talent-section">
                <h3>${icon('talent')} ${t('talent.team', '소속 인재')} (${this.state.talents.length}${t('creation.stat.people', '명')}) | ${t('talent.monthly_salary', '월 인건비')}: $${this.state.talents.reduce((s,t)=>s+t.salary,0).toLocaleString()}</h3>
                <div class="talent-grid stagger-in">
                    ${this.state.talents.map(t => this._renderTalentCard(t, specs, traits, false)).join('')}
                </div>
            </div>
            <div class="talent-section">
                <h3>${icon('talent')} ${t('talent.market', '인재 시장')}</h3>
                <button class="btn" onclick="game._refreshTalentMarket(); game.renderAll()" style="margin-bottom:8px">${icon('zap', 14)} ${t('common.refresh', '새로고침')} ($50,000)</button>
                <div class="talent-grid stagger-in">
                    ${this.talentMarket.map(t => this._renderTalentCard(t, specs, traits, true)).join('')}
                </div>
            </div>
        `;
    }

    _renderModels(el) {
        const completedTechs = this.techTree.getCompletedTechs();
        const canCreate = completedTechs.includes('deep_learning_basics');
        const activeTab = this._modelsTab || 'development';

        // Unlocked architectures based on completed techs
        const unlockedArchs = Object.values(MODEL_ARCHITECTURES).filter(arch =>
            arch.requiredTech.every(t => completedTechs.includes(t))
        );
        const availableArchs = unlockedArchs;
        const modelsTabs = `
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 16px">
                ${MODELS_TABS.map(tab => `
                    <button class="btn btn-small ${activeTab === tab.id ? 'btn-primary' : ''}"
                        onclick="game._modelsTab='${tab.id}';game.renderContent()">
                        ${icon(tab.icon, 13)} ${t(tab.labelKey, tab.fallback)}
                    </button>
                `).join('')}
            </div>
        `;

        let body = '';
        if (activeTab === 'services') {
            body = this._renderServicesView();
        } else if (activeTab === 'internal_ai') {
            body = this._renderInternalAIView();
        } else {
            body = this._renderModelDevelopmentView(canCreate, unlockedArchs, availableArchs);
        }

        el.innerHTML = `
            <div class="models-section">
                <h3>${icon('model')} ${t('models.title', 'AI 모델 개발')}</h3>
                ${modelsTabs}
                ${body}
            </div>
        `;

        // Initialize scale dropdown
        if (activeTab === 'development' && canCreate && availableArchs.length > 0) {
            setTimeout(() => this._onArchChange(), 0);
        }
    }

    _renderModelCard(m) {
        this._normalizeModelServiceState(m);
        const arch = MODEL_ARCHITECTURES[m.architecture] || { id: m.architecture, icon: '🤖', name: m.architecture || '?', nameKr: '' };
        const scale = PARAMETER_SCALES[m.scale] || { ...PARAMETER_SCALES.medium, id: m.scale || 'medium' };
        const phase = m.phase ? TRAINING_PHASES.find(p => p.id === m.phase) : null;
        const currentYear = this.time.currentDate.year || 2017;
        const benchmarkResults = getModelBenchmarks(m, currentYear);
        const relativePerformance = getRelativePerformance(m, currentYear);
        const relativeTier = getRelativePerformanceTier(relativePerformance);
        const benchmarkRows = benchmarkResults.map(bench => {
            const ratio = bench.expected > 0 ? bench.score / bench.expected : 0;
            const label = _benchmarkTierLabel(ratio);
            const displayName = _localizedBenchmarkName(bench);
            return `
                <div class="benchmark-row" style="display:flex;justify-content:space-between;gap:8px;font-size:0.72rem;color:var(--text-secondary)">
                    <span title="${bench.description || ''}">${this._termLabel(`bench_${bench.id}`, displayName, { description: bench.description || displayName, value: `${bench.score}` })}</span>
                    <span>${bench.score}${bench.expected > 0 ? ` · ${t('benchmark.expected_short', '기대 {value}', { value: bench.expected })}` : ''} · ${Math.round((ratio || 0) * 100)}% · ${label}</span>
                </div>
            `;
        }).join('');

        let stateClass = m.deployed ? 'deployed' : m.trained ? 'trained' : m.training ? 'training' : '';
        let statusHTML = '';

        if (m.training && phase) {
            // Training — show multi-phase pipeline
            statusHTML = `
                <div class="model-phase">${phase.icon} ${_localizedTrainingPhaseName(phase)} (${Math.floor(m.phaseProgress)}%)</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${m.overallProgress}%"></div></div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin:2px 0">${t('models.overall_progress', '전체')}: ${Math.floor(m.overallProgress)}%</div>
                <div class="training-phase-dots">
                    ${TRAINING_PHASES.map((p, i) => {
                        let cls = i < m.phaseIndex ? 'done' : i === m.phaseIndex ? 'active' : 'pending';
                        if (m.skippedPhases?.includes(p.id)) cls = 'skipped';
                        const connector = i < TRAINING_PHASES.length - 1 ?
                            `<span class="phase-connector ${i < m.phaseIndex ? 'done' : ''}"></span>` : '';
                        return `<span class="phase-dot ${cls}" title="${_localizedTrainingPhaseName(p)}">${p.icon}</span>${connector}`;
                    }).join('')}
                </div>
            `;
        } else if (m.trained && !m.deployed) {
            // Trained — show capability bars
            statusHTML = `
                <div class="capability-mini">
                    ${Object.entries(CAPABILITY_BENCHMARKS).map(([id, cap]) => `
                        <div class="cap-bar-mini">
                            <span title="${_localizedCapabilityName(id)}">${cap.icon}</span>
                            <div class="bar"><div class="bar-fill" style="width:${m.capabilities[id]}%;background:${cap.color}"></div></div>
                            <span>${m.capabilities[id]}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="model-benchmarks" style="display:grid;gap:4px;margin-top:6px">
                    ${benchmarkRows}
                </div>
                <div class="model-composite">${t('benchmark.market_relative', '시장 대비 {percent}%', { percent: getRelativePerformancePercent(relativePerformance) })} · <b>${t(relativeTier.key, relativeTier.fallback)}</b></div>
                <button class="btn-small btn-primary" onclick="event.stopPropagation();game._deployDialog('${m.id}')">${t('models.select_deploy_strategy', '배포 전략 선택')}</button>
            `;
        } else if (m.deployed) {
            const strategy = DEPLOYMENT_STRATEGIES[m.deploymentStrategy] || {};
            const activeChannels = Array.isArray(m.serviceChannels) ? m.serviceChannels.filter(channel => channel.active) : [];
            statusHTML = `
                <div class="model-deploy-badge">${strategy.icon || ''} ${this._termLabel(`deployment_${strategy.id}`, _localizedDeploymentStrategyName(strategy), { description: _localizedDeploymentStrategyDescription(strategy) })}</div>
                <div class="capability-mini compact">
                    ${Object.entries(CAPABILITY_BENCHMARKS).map(([id, cap]) => `
                        <div class="cap-bar-mini">
                            <span title="${_localizedCapabilityName(id)}">${cap.icon}</span>
                            <div class="bar"><div class="bar-fill" style="width:${m.capabilities[id]}%;background:${cap.color}"></div></div>
                            <span>${m.capabilities[id]}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="model-benchmarks" style="display:grid;gap:4px;margin-top:6px">
                    ${benchmarkRows}
                </div>
                <div class="model-composite">${t('benchmark.market_relative', '시장 대비 {percent}%', { percent: getRelativePerformancePercent(relativePerformance) })} · <b>${t(relativeTier.key, relativeTier.fallback)}</b></div>
                <div class="model-revenue">${icon('funds', 13)} $${m.monthlyRevenue.toLocaleString()}${t('topbar.per_month', '/월')}</div>
                <div style="font-size:0.76rem;color:var(--text-secondary);margin-top:6px">${t('models.service.active_channels', '활성 채널')}: ${activeChannels.length > 0 ? activeChannels.map(channel => this._termLabel(`service_${channel.type}`, t(SERVICE_CHANNEL_META[channel.type]?.nameKey || '', SERVICE_CHANNEL_META[channel.type]?.fallback || channel.type))).join(', ') : t('models.service.no_channels', '활성 서비스 채널이 없습니다.')}</div>
                <button class="btn-small" style="margin-top:8px" onclick="event.stopPropagation();game._openServiceDialog('${m.id}')">${t('models.service.manage', '서비스 조정')}</button>
                <div class="deployed-status">${icon('circlePlay', 13)} ${t('models.live', '운영 중')}</div>
            `;
        } else {
            // Designed but not started
            statusHTML = `
                <div style="font-size:0.8rem;color:var(--text-secondary);margin:6px 0">${t('models.waiting_training', '훈련 대기 중')}</div>
                <button class="btn-small btn-primary" onclick="event.stopPropagation();game._trainModelDialog('${m.id}')">${t('models.start_training', '훈련 시작')}</button>
            `;
        }

        return `
            <div class="model-card ${stateClass}" data-model-id="${m.id}">
                <div class="model-header">
                    <span class="model-name">${arch.icon} ${m.name}</span>
                    <span class="model-gen">v${m.generation || 1}</span>
                </div>
                <div class="model-meta">${this._termLabel(`architecture_${arch.id}`, _localizedArchitectureName(arch), { description: _localizedArchitectureDescription(arch) })} · ${this._termLabel(`parameterScale_${scale.id}`, _localizedParameterScaleName(scale), { value: scale.params })} (${scale.params})</div>
                ${statusHTML}
            </div>
        `;
    }

    _renderModelDevelopmentView(canCreate, unlockedArchs, availableArchs) {
        return `
            ${canCreate ? `
                <div class="model-create-panel">
                    <div class="model-create-row" style="display:flex;flex-direction:column;gap:10px;max-width:500px">
                        <input type="text" id="model-name-input" placeholder="${t('models.name_placeholder', '모델 이름')}" class="input" style="width:100%">
                        <select id="model-arch-select" class="input" style="width:100%;font-size:0.9rem"
                                onchange="game._onArchChange()">
                            ${unlockedArchs.map(a => `
                                <option value="${a.id}">
                                    ${a.icon} ${_localizedArchitectureName(a)}
                                </option>
                            `).join('')}
                        </select>
                        <select id="model-scale-select" class="input" style="width:100%;font-size:0.85rem">
                        </select>
                        <button class="btn btn-primary" style="align-self:flex-start;padding:10px 28px" onclick="game._createModelFromUI()">${t('models.design', '설계')}</button>
                    </div>
                    <div id="arch-info" class="arch-info-box"></div>
                </div>
            ` : `<p class="hint">${t('models.unlock_hint', '딥러닝 기초 연구를 완료하면 모델을 만들 수 있습니다.')}</p>`}

            <div class="model-grid stagger-in">
                ${this.state.models.map(m => this._renderModelCard(m)).join('')}
            </div>
        `;
    }

    _renderServicesView() {
        const deployedModels = this.state.models.filter(model => model.deployed);
        const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const computeBudget = getComputeBudget({ fleetStats, models: this.state.models });
        const serviceOverview = this._getServiceOverview();

        return `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px">
                <div class="stats-card"><span>${t('models.service.total_revenue', '총 서비스 수익')}</span><strong>$${Math.round(serviceOverview.revenue).toLocaleString()}${t('topbar.per_month', '/월')}</strong></div>
                <div class="stats-card"><span>${this._termLabel('serviceUsers', t('models.service.total_users', '총 사용자'), { value: Math.round(serviceOverview.users).toLocaleString() })}</span><strong>${this._termValue('serviceUsers', Math.round(serviceOverview.users).toLocaleString())}</strong></div>
                <div class="stats-card"><span>${this._termLabel('computeAllocation', t('models.service.compute_allocated', '서비스 할당'), { value: `${Math.round(serviceOverview.allocatedTFLOPS).toLocaleString()} TF` })}</span><strong>${this._termValue('tflops', `${Math.round(serviceOverview.allocatedTFLOPS).toLocaleString()} TF`)}</strong></div>
                <div class="stats-card"><span>${this._termLabel('tflops', t('models.service.compute_available', '훈련 여유'), { value: `${Math.round(computeBudget.availableTFLOPS).toLocaleString()} TF` })}</span><strong>${this._termValue('tflops', `${Math.round(computeBudget.availableTFLOPS).toLocaleString()} TF`)}</strong></div>
            </div>
            ${deployedModels.length === 0 ? `
                <p class="hint">${t('models.service.no_deployed_models', '배포 중인 모델이 없습니다. 먼저 모델을 훈련하고 배포하세요.')}</p>
            ` : `
                <div class="stagger-in" style="display:grid;gap:12px">
                    ${deployedModels.map(model => {
                        this._normalizeModelServiceState(model);
                        const activeChannels = model.serviceChannels.filter(channel => channel.active);
                        return `
                            <div class="card">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
                                    <div>
                                        <div style="font-size:1rem;font-weight:700">${model.name}</div>
                                        <div style="font-size:0.8rem;color:var(--text-secondary)">${(() => {
                                            const relative = getRelativePerformance(model, this.time?.currentDate?.year || 2017);
                                            const tier = getRelativePerformanceTier(relative);
                                            return t('models.service.market_position', '시장 대비 {percent}% · {label}', {
                                                percent: getRelativePerformancePercent(relative),
                                                label: t(tier.key, tier.fallback)
                                            });
                                        })()}</div>
                                    </div>
                                    <div style="display:flex;gap:8px;align-items:center">
                                        <span class="pill">${Math.round(model.totalAllocatedTFLOPS || 0)} TF</span>
                                        <span class="pill success">$${Math.round(model.totalMonthlyRevenue || model.monthlyRevenue || 0).toLocaleString()}${t('topbar.per_month', '/월')}</span>
                                        <button class="btn btn-small" onclick="game._openServiceDialog('${model.id}')">${t('models.service.manage', '서비스 조정')}</button>
                                    </div>
                                </div>
                                <div style="display:grid;gap:8px;margin-top:12px">
                                    ${activeChannels.length > 0 ? activeChannels.map(channel => {
                                        const meta = SERVICE_CHANNEL_META[channel.type] || SERVICE_CHANNEL_META.api;
                                        const quality = channel.requiredTFLOPS > 0 ? Math.min(1, channel.allocatedTFLOPS / channel.requiredTFLOPS) : 1;
                                        const priceLabel = this._formatServiceChannelPrice(channel.type, channel.priceMult);
                                        const priceBandLabel = this._getServiceChannelPriceBandLabel(channel.type, channel.priceMult);
                                        return `
                                            <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-md);background:rgba(255,255,255,0.02)">
                                                <div>
                                                    <div style="display:flex;align-items:center;gap:6px;font-weight:600">${icon(meta.icon, 13)} ${this._termLabel(`service_${channel.type}`, t(meta.nameKey, meta.fallback), { description: t(meta.descriptionKey, meta.descriptionFallback) })}</div>
                                                    <div style="font-size:0.76rem;color:var(--text-secondary)">${t(meta.descriptionKey, meta.descriptionFallback)}</div>
                                                </div>
                                                <div style="font-size:0.78rem;color:var(--text-secondary)">${Math.round(channel.allocatedTFLOPS).toLocaleString()} / ${Math.round(channel.requiredTFLOPS || channel.allocatedTFLOPS).toLocaleString()} TF</div>
                                                <div style="text-align:right">
                                                    <div style="font-weight:700">${channel.type === 'internal' ? t('models.service.internal_bonus', '내부 활용') : `$${Math.round(channel.monthlyRevenue || 0).toLocaleString()}${t('topbar.per_month', '/월')}`}</div>
                                                    <div style="font-size:0.76rem;color:${quality >= 0.8 ? 'var(--success)' : quality >= 0.5 ? 'var(--warning)' : 'var(--danger)'}">${t('models.service.quality', '품질')} ${(quality * 100).toFixed(0)}%</div>
                                                    <div style="font-size:0.72rem;color:var(--text-tertiary)">${t('service.price_strategy', '가격 전략')} · ${priceLabel} · ${priceBandLabel}</div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('') : `<div class="hint">${t('models.service.no_channels', '활성 서비스 채널이 없습니다.')}</div>`}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        `;
    }

    _renderInternalAIView() {
        const totalCost = this.state.internalAI?.totalMonthlyCost || 0;
        const slotsHtml = INTERNAL_AI_SLOTS.map(slot => {
            const meta = INTERNAL_AI_SLOT_META[slot.id] || {};
            const slotState = this.state.internalAI?.slots?.[slot.id] || {};
            const filled = Boolean(slotState.modelName);
            return `
                <div class="card" style="padding:14px">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
                        <div>
                            <div style="display:flex;align-items:center;gap:6px;font-weight:700">${icon(meta.icon || 'brain', 14)} ${t(meta.nameKey, meta.fallback || slot.id)}</div>
                            <div style="font-size:0.78rem;color:var(--text-secondary)">${t(meta.effectKey, meta.effectFallback || '')}</div>
                        </div>
                        <span class="pill">${t('internal_ai.bonus', '보너스')} +${Math.round((slotState.bonus || 0) * 100)}%</span>
                    </div>
                    <div style="margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:var(--r-md);background:rgba(255,255,255,0.02)">
                        ${filled ? `
                            <div style="font-weight:600">${slotState.source === 'competitor' ? t('internal_ai.source.competitor', '경쟁사') : slotState.source === 'opensource' ? t('internal_ai.source.opensource', '오픈소스') : t('internal_ai.source.own', '자사')} · ${slotState.modelName}</div>
                            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px">${t('internal_ai.slot_cost', '월 비용')}: $${Math.round(slotState.monthlyCost || 0).toLocaleString()}${t('topbar.per_month', '/월')}</div>
                            <div style="display:flex;gap:8px;margin-top:10px">
                                <button class="btn btn-small" onclick="game._showInternalAISlotDialog('${slot.id}')">${t('internal_ai.replace', '교체')}</button>
                                <button class="btn btn-small" onclick="game._clearInternalAISlot('${slot.id}')">${t('internal_ai.clear', '해제')}</button>
                            </div>
                        ` : `
                            <div class="hint">${t('internal_ai.empty', '비어 있음')}</div>
                            <div style="display:flex;gap:8px;margin-top:10px">
                                <button class="btn btn-small btn-primary" onclick="game._showInternalAISlotDialog('${slot.id}')">${t('internal_ai.assign', '모델 배치')}</button>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px">
                <div class="stats-card"><span>${t('internal_ai.total_cost', '월 비용')}</span><strong>$${Math.round(totalCost).toLocaleString()}${t('topbar.per_month', '/월')}</strong></div>
                <div class="stats-card"><span>${t('internal_ai.filled_slots', '배치 슬롯')}</span><strong>${Object.values(this.state.internalAI?.slots || {}).filter(slot => slot?.modelName).length}/${INTERNAL_AI_SLOTS.length}</strong></div>
            </div>
            <div style="display:grid;gap:12px">${slotsHtml}</div>
        `;
    }

    _onArchChange() {
        const archSelect = document.getElementById('model-arch-select');
        const archId = archSelect?.value;
        const arch = MODEL_ARCHITECTURES[archId];
        if (!arch) return;
        const completedTechs = this.techTree.getCompletedTechs();
        const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const computeBudget = getComputeBudget({ fleetStats, models: this.state.models });

        const maxIdx = SCALE_ORDER.indexOf(arch.maxScale);
        const availableScales = SCALE_ORDER.slice(0, maxIdx + 1).map(k => PARAMETER_SCALES[k]);

        const scaleSelect = document.getElementById('model-scale-select');
        if (scaleSelect) {
            scaleSelect.innerHTML = availableScales.map(s => {
                const req = getParameterScaleRequirements(s);
                const lockedTechs = req.requiresTech.filter(techId => !completedTechs.includes(techId));
                const locked = lockedTechs.length > 0;
                const label = locked
                    ? `🔒 ${_localizedParameterScaleName(s)} (${s.params}) — ${t('models.require_tech', '기술 필요: {tech}', { tech: lockedTechs.map(techId => _localizedTechName(techId)).join(', ') })}`
                    : `${s.icon} ${_localizedParameterScaleName(s)} (${s.params}) — ${req.minTFLOPS.toLocaleString()} TFLOPS · ${req.minVRAM || 0}GB · ${(req.requiredPFLOPS || 0).toLocaleString()} PF`;
                return `<option value="${s.id}" ${locked ? 'disabled' : ''}>${label}</option>`;
            }).join('');
            const firstEnabled = [...scaleSelect.options].find(option => !option.disabled);
            if (scaleSelect.selectedOptions[0]?.disabled && firstEnabled) scaleSelect.value = firstEnabled.value;
        }

        // Update info box
        const infoBox = document.getElementById('arch-info');
        if (infoBox) {
            const strengths = Object.entries(arch.strengths)
                .map(([k, v]) => `${CAPABILITY_BENCHMARKS[k]?.icon || ''} ${_localizedCapabilityName(k)} x${v}`)
                .join(', ');
            const weaknesses = Object.entries(arch.weaknesses)
                .map(([k, v]) => `${CAPABILITY_BENCHMARKS[k]?.icon || ''} ${_localizedCapabilityName(k)} x${v}`)
                .join(', ');
            infoBox.innerHTML = `
                <div style="font-size:0.8rem;color:var(--text-secondary);padding:6px 0">
                    ${_localizedArchitectureDescription(arch)}<br>
                    ${strengths ? `<span style="color:var(--success)">${t('models.arch_strengths', '강점')}: ${strengths}</span>` : ''}
                    ${weaknesses ? ` · <span style="color:var(--danger)">${t('models.arch_weaknesses', '약점')}: ${weaknesses}</span>` : ''}
                    · ${t('models.arch_data', '데이터')}: ${arch.dataTypes.map(dt => `${DATA_TYPES[dt]?.icon || ''} ${_localizedDataTypeName(dt)}`.trim()).join(', ')}
                    <br>${t('models.estimated_training', '예상 훈련 기간: {days}일', {
                        days: Math.max(1, Math.ceil(estimateTrainingDays({
                            scale: PARAMETER_SCALES[scaleSelect?.value] || availableScales[0],
                            architecture: arch,
                            fleetStats,
                            customSiliconBonuses: this.state.economy.customSiliconBonuses,
                            availableTFLOPS: Math.max(1, computeBudget.availableTFLOPS || fleetStats.totalTFLOPS || 1),
                            computeBudget
                        })))
                    })}
                </div>
            `;
        }
    }

    _createModelFromUI() {
        const name = document.getElementById('model-name-input')?.value?.trim();
        const arch = document.getElementById('model-arch-select')?.value;
        const scale = document.getElementById('model-scale-select')?.value;
        if (!name) { alert(t('models.name_required', '모델 이름을 입력하세요.')); return; }
        if (!arch || !scale) { alert(t('models.arch_scale_required', '아키텍처와 규모를 선택하세요.')); return; }
        this.createModel(name, arch, scale);
    }

    _trainModelDialog(modelId) {
        const model = this.state.models.find(m => m.id === modelId);
        if (!model) return;
        const arch = MODEL_ARCHITECTURES[model.architecture] || { id: model.architecture, dataTypes: ['web_text'], name: '?', icon: '' };
        const scale = PARAMETER_SCALES[model.scale] || { ...PARAMETER_SCALES.medium, id: model.scale || 'medium' };
        const freeTalents = this.state.talents.filter(t => !t.assignment);
        const totalDataOwned = getTotalDataTB(this.state.economy.dataAssets);
        const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const computeBudget = getComputeBudget({ fleetStats, models: this.state.models });
        const scaleReq = getParameterScaleRequirements(scale);
        const minTrainingTFLOPS = Math.max(1, Math.round(scaleReq.minTFLOPS || 1));
        const maxTrainingTFLOPS = Math.max(0, Math.floor(computeBudget.availableTFLOPS || 0));
        const initialTrainingTFLOPS = maxTrainingTFLOPS >= minTrainingTFLOPS
            ? Math.max(minTrainingTFLOPS, Math.floor((minTrainingTFLOPS + maxTrainingTFLOPS) / 2))
            : Math.max(0, maxTrainingTFLOPS);
        const estimatedTrainingDays = Math.max(1, Math.ceil(estimateTrainingDays({
            scale,
            architecture: arch,
            fleetStats,
            customSiliconBonuses: this.state.economy.customSiliconBonuses,
            availableTFLOPS: Math.max(1, initialTrainingTFLOPS || maxTrainingTFLOPS || fleetStats.totalTFLOPS || 1),
            computeBudget
        })));
        const computeQualityBonus = getModelComputeQualityBonus({ scale, fleetStats });
        const canStartTraining = maxTrainingTFLOPS >= minTrainingTFLOPS;

        if (freeTalents.length === 0) {
            this.state.addNews(t('models.no_available_talent', '배치 가능한 인재가 없습니다.'), 'warning');
            return;
        }

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content" style="max-width:600px">
                <h3>${arch.icon} "${model.name}" ${t('models.train_setup', '훈련 설정')}</h3>
                <p style="color:var(--text-secondary);font-size:0.85rem">
                    ${_localizedArchitectureName(arch)} · ${_localizedParameterScaleName(scale)} (${scale.params}) · ${t('models.training_compute_target', '목표 연산량')}: ${(scale.requiredPFLOPS || 0).toLocaleString()} PFLOPS-day · ${t('compute.max_vram', '최대 VRAM')}: ${scale.minVRAM || 0}GB
                </p>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0;padding:10px;background:var(--bg-surface);border-radius:var(--r-md)">
                    <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('chip.target_tflops', '목표 TFLOPS')}</div><div style="font-weight:700">${Math.round(scaleReq.minTFLOPS).toLocaleString()}</div></div>
                    <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('models.estimated_training', '예상 훈련 기간: {days}일', { days: estimatedTrainingDays })}</div><div id="training-days-estimate" style="font-weight:700">${estimatedTrainingDays}${t('world.days', '일')}</div></div>
                    <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('models.compute_quality_bonus', '초과 투입 보너스: 성능 +{percent}%', { percent: Math.max(0, Math.round((computeQualityBonus - 1) * 100)) })}</div><div style="font-weight:700">+${Math.max(0, Math.round((computeQualityBonus - 1) * 100))}%</div></div>
                    <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('models.service.compute_available', '훈련 여유')}</div><div id="training-service-remaining" style="font-weight:700">${Math.max(0, Math.round(maxTrainingTFLOPS - initialTrainingTFLOPS)).toLocaleString()} TF</div></div>
                </div>

                <h4 style="margin-top:12px;display:flex;align-items:center;gap:4px">${icon('gpu', 14)} ${t('models.training_allocation', '연산력 할당')}</h4>
                <div class="compute-section" style="padding:12px">
                    ${canStartTraining ? `
                        <div style="display:grid;gap:10px">
                            <input
                                type="range"
                                id="training-tflops-range"
                                min="${minTrainingTFLOPS}"
                                max="${maxTrainingTFLOPS}"
                                value="${initialTrainingTFLOPS}"
                                oninput="game._updateTrainingAllocationPreview('${modelId}', this.value)">
                            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
                                <strong id="training-allocation-value">${initialTrainingTFLOPS.toLocaleString()} / ${maxTrainingTFLOPS.toLocaleString()} TFLOPS</strong>
                                <span style="font-size:0.75rem;color:var(--text-secondary)">${t('models.training_allocation_hint', '할당 ↑ = 훈련 기간 ↓')}</span>
                            </div>
                        </div>
                    ` : `
                        <div style="font-size:0.82rem;color:var(--danger)">
                            ${t('models.training_allocation_locked', '현재 서비스 중인 모델 때문에 훈련용 최소 연산력 {required} TFLOPS를 확보할 수 없습니다.', {
                                required: minTrainingTFLOPS.toLocaleString()
                            })}
                        </div>
                    `}
                </div>

                <h4 style="margin-top:12px;display:flex;align-items:center;gap:4px">${icon('data', 14)} ${t('models.data_allocation', '데이터 배분')} (${t('models.data_owned', '보유')}: ${totalDataOwned}TB)</h4>
                <div class="data-mix-grid">
                    ${arch.dataTypes.map(dt => {
                        const dataType = DATA_TYPES[dt];
                        if (!dataType) return '';
                        const ownedTB = Math.floor(this.state.economy.dataAssets?.[dt] || 0);
                        const maxTB = Math.min(ownedTB, dataType.availableTB);
                        const defaultVal = Math.min(Math.floor(scale.dataReqTB / arch.dataTypes.length), maxTB);
                        return `
                            <div class="data-mix-row">
                                <label>${dataType.icon} ${_localizedDataTypeName(dataType)} <span style="color:var(--text-tertiary)">(${ownedTB}TB)</span></label>
                                <input type="range" min="0" max="${maxTB}" value="${defaultVal}"
                                       class="data-slider" data-type="${dt}"
                                       oninput="this.nextElementSibling.textContent=this.value+'TB'">
                                <span>${defaultVal}TB</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <p class="hint" style="font-size:0.75rem">${t('models.recommended_min', '권장 최소')}: ${scale.dataReqTB}TB · ${t('models.more_data_better', '데이터가 많을수록 성능 향상')}</p>
                <p class="hint" style="font-size:0.75rem">${t('models.arch_optimal_mix', '권장 믹스')}: ${Object.entries(arch.optimalDataMix || {}).map(([type, weight]) => `${_localizedDataTypeName(type)} ${Math.round(weight * 100)}%`).join(', ') || t('models.auto_mix_balanced', '균형 배분')}</p>

                <h4 style="margin-top:12px;display:flex;align-items:center;gap:4px">${icon('talent', 14)} ${t('models.assign_training_talents', '인재 배치')}</h4>
                <div class="talent-select">
                    ${freeTalents.map(talent => `
                        <label class="talent-option">
                            <input type="checkbox" value="${talent.id}" class="train-talent-cb" checked>
                            <span>${talent.name} (${_localizedSpecialtyList(talent.specialty) || t('models.general_specialty', '일반')}, ${t('talent.research_short', '연구')}:${talent.stats.research.toFixed(1)})</span>
                        </label>
                    `).join('')}
                </div>

                <div class="popup-buttons" style="margin-top:12px">
                    <button class="btn btn-primary" onclick="game._confirmTraining('${modelId}')" ${canStartTraining ? '' : 'disabled'}>${t('models.start_training', '훈련 시작')}</button>
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.cancel', '취소')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
        if (canStartTraining) {
            this._updateTrainingAllocationPreview(modelId, initialTrainingTFLOPS);
        }
    }

    _updateTrainingAllocationPreview(modelId, value) {
        const model = this.state.models.find(entry => entry.id === modelId);
        if (!model) return;
        const arch = MODEL_ARCHITECTURES[model.architecture] || MODEL_ARCHITECTURES.transformer;
        const scale = PARAMETER_SCALES[model.scale] || PARAMETER_SCALES.medium;
        const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const computeBudget = getComputeBudget({ fleetStats, models: this.state.models });
        const allocatedTFLOPS = Math.max(1, Number(value || 0));
        const estimatedDays = Math.max(1, Math.ceil(estimateTrainingDays({
            scale,
            architecture: arch,
            fleetStats,
            customSiliconBonuses: this.state.economy.customSiliconBonuses,
            availableTFLOPS: allocatedTFLOPS,
            computeBudget
        })));
        const maxTrainingTFLOPS = Math.max(0, Math.floor(computeBudget.availableTFLOPS || 0));
        const allocationEl = document.getElementById('training-allocation-value');
        const daysEl = document.getElementById('training-days-estimate');
        const remainingEl = document.getElementById('training-service-remaining');
        if (allocationEl) allocationEl.textContent = `${Math.round(allocatedTFLOPS).toLocaleString()} / ${Math.round(maxTrainingTFLOPS).toLocaleString()} TFLOPS`;
        if (daysEl) daysEl.textContent = `${estimatedDays}${t('world.days', '일')}`;
        if (remainingEl) remainingEl.textContent = `${Math.max(0, Math.round(maxTrainingTFLOPS - allocatedTFLOPS)).toLocaleString()} TF`;
    }

    _confirmTraining(modelId) {
        const checked = document.querySelectorAll('.train-talent-cb:checked');
        const talentIds = Array.from(checked).map(cb => cb.value);
        if (talentIds.length === 0) { alert(t('models.need_one_training_talent', '최소 1명 배치 필요')); return; }

        // Collect data mix
        const dataMix = {};
        document.querySelectorAll('.data-slider').forEach(slider => {
            const type = slider.dataset.type;
            const val = parseInt(slider.value) || 0;
            if (val > 0) dataMix[type] = val;
        });

        const trainingTFLOPS = Math.max(0, Number(document.getElementById('training-tflops-range')?.value || 0));
        this.startTraining(modelId, talentIds, dataMix, trainingTFLOPS);
        document.getElementById('popup').classList.remove('show');
    }

    _deployDialog(modelId) {
        const model = this.state.models.find(m => m.id === modelId);
        if (!model) return;
        const completedTechs = this.techTree.getCompletedTechs();
        const scale = PARAMETER_SCALES[model.scale] || PARAMETER_SCALES.medium;

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content" style="max-width:600px">
                <h3>"${model.name}" ${t('models.deploy_title', '배포 전략 선택')}</h3>
                <p style="color:var(--text-secondary);font-size:0.85rem">${t('models.capability_score', '종합 {composite}점 · 안전 {safety}점', {
                    composite: model.compositeScore,
                    safety: model.capabilities.safety
                })}</p>
                <div class="deploy-strategies">
                    ${Object.values(DEPLOYMENT_STRATEGIES).map(s => {
                        // Check requirements
                        let available = true;
                        let reason = '';
                        if (s.requirements.techCompleted) {
                            for (const techId of s.requirements.techCompleted) {
                                if (!completedTechs.includes(techId)) {
                                    available = false;
                                    reason = t('models.require_tech', '기술 필요: {tech}', { tech: _localizedTechName(techId) });
                                }
                            }
                        }
                        if (s.requirements.minCapability) {
                            for (const [cap, min] of Object.entries(s.requirements.minCapability)) {
                                if ((model.capabilities[cap] || 0) < min) {
                                    available = false;
                                    const capName = _localizedCapabilityName(cap);
                                    reason = t('models.require_capability', '{capability} {min}+ 필요 (현재: {current})', {
                                        capability: capName,
                                        min,
                                        current: model.capabilities[cap]
                                    });
                                }
                            }
                        }
                        // Estimate revenue
                        let estRevenue = 0;
                        if (available) {
                            let capScore = 0;
                            for (const [cap, w] of Object.entries(s.capWeights)) {
                                capScore += (model.capabilities[cap] || 0) * w;
                            }
                            const currentYear = this.time.currentDate.year || 2017;
                            const relativePerformance = getRelativePerformance(model, currentYear);
                            estRevenue = Math.round(
                                capScore * 500 * scale.trainingCostMult * s.revenueMult * _relativePerformanceRevenueMultiplier(relativePerformance)
                            );
                        }
                        return `
                            <button class="btn btn-choice deploy-option ${available ? '' : 'disabled'}"
                                    ${available ? `onclick="game.deployModel('${modelId}','${s.id}');document.getElementById('popup').classList.remove('show')"` : 'disabled'}
                                    style="${!available ? 'opacity:0.5;cursor:not-allowed' : ''}">
                                <span class="choice-text">${s.icon} ${_localizedDeploymentStrategyName(s)}</span>
                                <span class="choice-hint">${_localizedDeploymentStrategyDescription(s)}</span>
                                ${available ?
                                    `<span class="choice-hint" style="color:var(--success)">${t('models.expected_monthly_revenue', '예상 월수익')}: $${estRevenue.toLocaleString()} · ${t('models.reputation', '평판')} ${s.reputationGain > 0 ? '+' : ''}${s.reputationGain}</span>` :
                                    `<span class="choice-hint" style="color:var(--danger)">${reason}</span>`}
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="popup-buttons">
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.cancel', '취소')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _openServiceDialog(modelId) {
        const model = this.state.models.find(entry => entry.id === modelId);
        if (!model) return;
        this._normalizeModelServiceState(model);
        const fleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const budget = getComputeBudget({ fleetStats, models: this.state.models });
        const availableNow = Math.max(0, budget.availableTFLOPS + (model.totalAllocatedTFLOPS || 0));
        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content" style="max-width:720px">
                <h3>${icon('rocket', 14)} ${t('models.service.dialog_title', '서비스 채널 관리')} · ${model.name}</h3>
                <p style="color:var(--text-secondary);font-size:0.82rem">${t('models.service.dialog_hint', '서비스 채널을 활성화하고 채널별 TFLOPS를 조정할 수 있습니다.')}</p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0;padding:10px;background:var(--bg-surface);border-radius:var(--r-md)">
                    <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('models.service.total_compute', '가용 서비스 TFLOPS')}</div><div style="font-weight:700">${Math.round(availableNow).toLocaleString()} TF</div></div>
                    <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('models.service.current_revenue', '현재 월 수익')}</div><div style="font-weight:700">$${Math.round(model.totalMonthlyRevenue || model.monthlyRevenue || 0).toLocaleString()}</div></div>
                    <div><div style="font-size:0.72rem;color:var(--text-tertiary)">${t('models.service.current_users', '현재 사용자')}</div><div style="font-weight:700">${Math.round(model.serviceChannels.reduce((sum, channel) => sum + Number(channel.estimatedUsers || 0), 0)).toLocaleString()}</div></div>
                </div>
                <div style="display:grid;gap:10px">
                    ${Object.entries(SERVICE_CHANNEL_META).map(([type, meta]) => {
                        const channel = model.serviceChannels.find(entry => entry.type === type) || this._createServiceChannel(type, model, { active: false });
                        const missingTechs = this._getServiceChannelMissingTechs(type);
                        const locked = missingTechs.length > 0;
                        const priceLocked = locked || isFreeServiceChannel(type);
                        const priceMult = clampServicePriceMult(channel.priceMult, type);
                        return `
                            <div style="padding:12px;border:1px solid var(--border);border-radius:var(--r-md)">
                                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
                                    <label style="display:flex;align-items:center;gap:8px;font-weight:600">
                                        <input type="checkbox" class="svc-enabled" data-type="${type}" ${channel.active ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                                        ${icon(meta.icon, 13)} ${t(meta.nameKey, meta.fallback)}
                                    </label>
                                    <span style="font-size:0.76rem;color:${locked ? 'var(--warning)' : 'var(--text-secondary)'}">${locked ? this._getServiceChannelRequirementText(type) : t(meta.descriptionKey, meta.descriptionFallback)}</span>
                                </div>
                                <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin-top:10px">
                                    <input type="range" class="svc-range" data-type="${type}" min="0" max="${Math.max(1, Math.round(availableNow))}" value="${Math.round(Math.min(channel.allocatedTFLOPS || 0, availableNow))}" oninput="this.nextElementSibling.textContent=this.value+' TF'" ${locked ? 'disabled' : ''}>
                                    <span>${Math.round(channel.allocatedTFLOPS || 0)} TF</span>
                                </div>
                                <div style="margin-top:8px">
                                    <label style="font-size:0.76rem;color:var(--text-secondary)">
                                        ${t('service.price_strategy', '가격 전략')}
                                    </label>
                                    <div class="service-price-controls" style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;margin-top:6px">
                                        <input type="range" class="svc-price" data-type="${type}"
                                            min="${isFreeServiceChannel(type) ? 0 : 30}"
                                            max="${isFreeServiceChannel(type) ? 0 : 300}"
                                            value="${Math.round(priceMult * 100)}"
                                            oninput="const nextPrice=Number(this.value)/100;const valueLabel=this.parentElement.querySelector('[data-price-value]');const bandLabel=this.parentElement.querySelector('[data-price-band]');if(valueLabel){valueLabel.textContent=game._formatServiceChannelPrice('${type}', nextPrice);}if(bandLabel){bandLabel.textContent=game._getServiceChannelPriceBandLabel('${type}', nextPrice);}"
                                            ${priceLocked ? 'disabled' : ''}>
                                        <span data-price-value>${this._formatServiceChannelPrice(type, priceMult)}</span>
                                        <span class="pill" data-price-band>${this._getServiceChannelPriceBandLabel(type, priceMult)}</span>
                                    </div>
                                    <div style="font-size:0.7rem;color:var(--text-tertiary);margin-top:2px">
                                        ${isFreeServiceChannel(type)
                                            ? t('service.price_fixed_free', '무료 채널은 가격을 조절할 수 없습니다.')
                                            : t('service.price_hint', '낮은 가격 → 사용자 증가, 높은 가격 → 인당 수익 증가')}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="popup-buttons" style="margin-top:14px">
                    <button class="btn btn-primary" onclick="game._saveServiceDialog('${modelId}')">${t('common.save', '저장')}</button>
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.cancel', '취소')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _saveServiceDialog(modelId) {
        const model = this.state.models.find(entry => entry.id === modelId);
        if (!model) return;
        const saveFleetStats = getFleetStats(this.state.economy.gpuFleet, {
            countryBonuses: this.state.player.countryBonuses || {},
            colocation: this.state.economy.colocation,
            completedChipPrograms: this.state.economy.completedChipPrograms,
            customSiliconBonuses: this.state.economy.customSiliconBonuses
        });
        const maxTF = Math.max(0, Number(saveFleetStats.totalTFLOPS || 0));
        const nextChannels = [];
        document.querySelectorAll('.svc-enabled').forEach(checkbox => {
            const type = checkbox.dataset.type;
            const slider = document.querySelector(`.svc-range[data-type="${type}"]`);
            const priceSlider = document.querySelector(`.svc-price[data-type="${type}"]`);
            const active = checkbox.checked;
            const allocatedTFLOPS = Math.min(Math.max(0, Number(slider?.value || 0)), maxTF);
            const priceMult = priceSlider
                ? clampServicePriceMult(Number(priceSlider.value || 0) / 100, type)
                : clampServicePriceMult(undefined, type);
            const missingTechs = this._getServiceChannelMissingTechs(type);
            if (active && missingTechs.length > 0) return;
            if (active || allocatedTFLOPS > 0) {
                nextChannels.push(this._createServiceChannel(type, model, {
                    active,
                    allocatedTFLOPS,
                    requiredTFLOPS: Math.max(1, allocatedTFLOPS || this._getDefaultChannelAllocation(type, model, saveFleetStats)),
                    priceMult
                }));
            }
        });
        model.serviceChannels = nextChannels;
        model.totalAllocatedTFLOPS = nextChannels.filter(channel => channel.active).reduce((sum, channel) => sum + channel.allocatedTFLOPS, 0);
        if (model.deploymentStrategy === 'open_source' && !nextChannels.some(channel => channel.type === 'open_source' && channel.active)) {
            model.serviceChannels = this._upsertModelServiceChannel(model, 'open_source', { active: true, allocatedTFLOPS: 0, requiredTFLOPS: 1, priceMult: 0 });
        }
        this._syncOpenSourceModels();
        this._refreshServiceEconomySnapshot();
        document.getElementById('popup').classList.remove('show');
        this.renderAll();
    }

    _showInternalAISlotDialog(slotId) {
        const slotMeta = INTERNAL_AI_SLOT_META[slotId] || {};
        const groups = [
            ...this._getOwnInternalAICandidates(),
            ...this._getCompetitorInternalAICandidates(),
            ...this._getOpenSourceInternalAICandidates()
        ];
        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content" style="max-width:720px">
                <h3>${icon(slotMeta.icon || 'brain', 14)} ${t('internal_ai.select_title', '내부 AI 모델 선택')} · ${t(slotMeta.nameKey, slotMeta.fallback || slotId)}</h3>
                <div style="display:grid;gap:12px;margin-top:12px">
                    ${['own', 'competitor', 'opensource'].map(groupId => {
                        const entries = groups.filter(entry => entry.group === groupId);
                        if (entries.length === 0) return '';
                        return `
                            <div>
                                <div style="font-weight:700;margin-bottom:8px">${entries[0].label}</div>
                                <div style="display:grid;gap:8px">
                                    ${entries.map(entry => `
                                        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-md)">
                                            <div>
                                                <div style="font-weight:600">${entry.model.name}</div>
                                                <div style="font-size:0.76rem;color:var(--text-secondary)">
                                                    ${t('models.capability_score', '종합 {composite}점 · 안전 {safety}점', {
                                                        composite: entry.model.performance || 0,
                                                        safety: entry.model.capabilities?.safety || 0
                                                    })} · ${entry.meta}
                                                </div>
                                            </div>
                                            <button class="btn btn-small btn-primary" onclick="game._assignInternalAISlotFromDialog('${slotId}', '${groupId}', '${entry.model.id}')">${t('internal_ai.assign', '모델 배치')}</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }).join('') || `<p class="hint">${t('internal_ai.no_candidates', '배치 가능한 모델이 없습니다.')}</p>`}
                </div>
                <div class="popup-buttons" style="margin-top:14px">
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.cancel', '취소')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _assignInternalAISlotFromDialog(slotId, groupId, modelId) {
        let candidate = null;
        if (groupId === 'own') {
            candidate = this._getOwnInternalAICandidates().find(entry => entry.model.id === modelId)?.model;
        } else if (groupId === 'competitor') {
            candidate = this._getCompetitorInternalAICandidates().find(entry => entry.model.id === modelId)?.model;
        } else {
            candidate = this._getOpenSourceInternalAICandidates().find(entry => entry.model.id === modelId)?.model;
        }
        if (!candidate) return;
        assignInternalAISlot(this.state.internalAI, slotId, candidate, {
            relation: candidate.relation || this.state.competitors.find(comp => comp.id === candidate.competitorId)?.relation || 0,
            competitorId: candidate.competitorId || null
        });
        recalculateInternalAITotalMonthlyCost(this.state.internalAI);
        this._refreshServiceEconomySnapshot();
        document.getElementById('popup').classList.remove('show');
        this.renderAll();
    }

    _clearInternalAISlot(slotId) {
        clearInternalAISlot(this.state.internalAI, slotId);
        recalculateInternalAITotalMonthlyCost(this.state.internalAI);
        this._refreshServiceEconomySnapshot();
        this.renderAll();
    }

    _renderWorld(el) {
        const regionFilter = this._worldRegionFilter || 'all';
        const regionMarket = this.state.geopolitics?.regionalMarket || {};
        const regionsData = getRegionsData()?.REGIONS || {};
        const homePolicy = this.state._countryPolicy || getCountryPolicy(this.state.player.country);
        const geopoliticalTension = Math.round(Number(this.state.global.geopoliticalTension || 0));

        const regionTabs = `
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">
                <button class="btn btn-small ${regionFilter === 'all' ? 'btn-primary' : ''}"
                    onclick="game._worldRegionFilter='all';game.renderContent()">${t('world.region.all', '전체')}</button>
                <button class="btn btn-small ${regionFilter === 'major' ? 'btn-primary' : ''}"
                    onclick="game._worldRegionFilter='major';game.renderContent()">${t('world.region.major', '주요국')}</button>
                ${Object.entries(REGIONS).map(([rid, r]) => `
                    <button class="btn btn-small ${regionFilter === rid ? 'btn-primary' : ''}"
                        onclick="game._worldRegionFilter='${rid}';game.renderContent()"
                        style="border-color:${r.color}40">${_localizedRegionName(rid)}</button>
                `).join('')}
            </div>`;

        let filteredCountries;
        if (regionFilter === 'all') {
            filteredCountries = Object.values(COUNTRIES);
        } else if (regionFilter === 'major') {
            filteredCountries = Object.values(COUNTRIES).filter(c => c.tier <= 2);
        } else {
            filteredCountries = (COUNTRIES_BY_REGION[regionFilter] || []);
        }

        // Sort: tier ascending, then by investment descending
        filteredCountries.sort((a, b) => a.tier - b.tier || b.stats.investment - a.stats.investment);

        el.innerHTML = `
            <div class="panel" style="margin-bottom:16px">
                <h3>${icon('globe')} ${t('world.policy_overview', '정책 · 지역 시장')}</h3>
                <div class="stat-row"><span>${t('world.home_policy', '본국 정책')}</span><span>${homePolicy.type} · ${this._termLabel('regulation', t('world.regulation', '규제'))} ${homePolicy.regulationLevel}/10</span></div>
                <div class="stat-row"><span>${this._termLabel('gpuAccess', t('world.gpu_access', 'GPU 접근성'), { value: `${homePolicy.gpuAccess}/10` })}</span><span>${homePolicy.gpuAccess}/10</span></div>
                <div class="stat-row"><span>${this._termLabel('aiTalentPool', t('world.talent_pool', '인재 풀'), { value: `${homePolicy.aiTalentPool}/10` })}</span><span>${homePolicy.aiTalentPool}/10</span></div>
                <div class="stat-row"><span>${this._termLabel('exportControl', t('world.export_control', '수출 통제'), { value: `${homePolicy.exportControl || 0}/10` })}</span><span>${homePolicy.exportControl || 0}/10</span></div>
                <div class="stat-row"><span>${this._termLabel('geopoliticalTension', t('world.global_tension', '지정학 긴장도'), { value: `${geopoliticalTension}%` })}</span><span><span class="term-link" tabindex="0" data-term-tooltip="${this._geopoliticalTensionTooltipData()}">${geopoliticalTension}%</span></span></div>
                <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">
                    ${Object.entries(regionMarket).map(([regionId, entry]) => `
                        <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.03)">
                            <div style="font-weight:600;color:${regionsData[regionId]?.color || 'var(--accent)'}">${regionsData[regionId]?.name?.[getLocale?.() || 'ko'] || _localizedRegionName(regionId)}</div>
                            <div style="font-size:0.76rem;color:var(--text-secondary)">${this._termLabel('marketShare', t('world.market_share', '점유'))}: ${entry.share.toFixed(1)}%</div>
                            <div style="font-size:0.76rem;color:var(--text-secondary)">${t('world.region_market_size', '시장 규모')}: ${entry.size}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div style="margin-bottom:16px">
                <h3 style="margin-bottom:8px">${icon('globe')} ${t('world.countries_title', '국가별 AI 현황')} (${Object.keys(COUNTRIES).length}${t('world.country_count_unit', '개국')})</h3>
                ${regionTabs}
                <div class="country-grid stagger-in">
                    ${filteredCountries.map(c => {
                        const id = c.id;
                        const isHome = id === this.state.player.country;
                        const fav = this.state.global.countryFavorability?.[id] ?? c.aiFavorability;
                        const tierBadge = c.tier === 1 ? icon('star', 12) : c.tier === 2 ? icon('diamond', 12) : '';
                        return `
                            <div class="country-card ${isHome ? 'home' : ''}" onclick="game.showCountryInfo('${id}')" style="cursor:pointer">
                                <div class="country-header" style="display:flex;align-items:center;gap:6px">${this._flag(c.flag)} ${_localizedCountryName(c)} ${tierBadge} ${isHome ? `<span style="color:var(--accent);font-size:0.8em">(${t('world.home_hq', '본사')})</span>` : ''}</div>
                                <div style="font-size:0.7rem;color:#64748b;display:flex;gap:6px;margin:2px 0">
                                    <span>${c.population >= 1000 ? (c.population/1000).toFixed(1)+'B' : c.population >= 1 ? Math.round(c.population)+'M' : Math.round(c.population*1000)+'K'}</span>
                                    <span>${t('country.gdp', 'GDP')} ${c.gdp >= 1000 ? '$'+(c.gdp/1000).toFixed(1)+'T' : '$'+c.gdp+'B'}</span>
                                    ${c.aiRank ? `<span style="color:#fbbf24">AI #${c.aiRank}</span>` : ''}
                                    ${c.isEU ? '<span style="color:#22c55e">EU</span>' : ''}
                                </div>
                                <div class="country-stats">
                                    <div class="stat-bar"><span>${t('creation.stat.investment', '투자')}</span><div class="bar"><div class="bar-fill" style="width:${c.stats.investment*10}%"></div></div></div>
                                    <div class="stat-bar"><span>${this._termLabel('regulation', t('world.regulation', '규제'))}</span><div class="bar"><div class="bar-fill warning" style="width:${c.stats.regulation*10}%"></div></div></div>
                                    <div class="stat-bar"><span>${this._termLabel('aiTalentPool', t('creation.stat.talent', '인재'))}</span><div class="bar"><div class="bar-fill" style="width:${c.stats.talentPool*10}%"></div></div></div>
                                    <div class="stat-bar"><span>${t('creation.stat.infrastructure', '인프라')}</span><div class="bar"><div class="bar-fill" style="width:${c.stats.infrastructure*10}%"></div></div></div>
                                    <div class="stat-bar"><span>${t('bonus.semiconductor', '반도체')}</span><div class="bar"><div class="bar-fill chip" style="width:${c.stats.semiconductor*10}%"></div></div></div>
                                </div>
                                <div style="font-size:0.75rem;color:${fav > 50 ? '#22c55e' : fav > 30 ? '#eab308' : '#ef4444'};margin-top:2px">${t('world.favorability', '호감도')} ${Math.round(fav)}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div style="margin-top:16px">
                <h3 style="margin-bottom:8px">${icon('target')} ${t('world.competitors_title', '경쟁사 & 파트너십')}</h3>
                ${this.state.competitors.map(c => {
                    const rel = c.relation || 0;
                    const relColor = rel > 30 ? 'var(--success)' : rel > -10 ? 'var(--text-secondary)' : rel > -40 ? 'var(--warning)' : 'var(--danger)';
                    const relLabel = _relationLabel(rel);
                    const doctrineLabel = c.doctrine?.label?.[getLocale?.() || 'ko'] || c.doctrine?.label?.ko || c.doctrine?.label?.en || '';
                    return `
                    <div class="competitor-row" style="cursor:pointer">
                        <div style="display:flex;justify-content:space-between;align-items:center" onclick="game._showDiplomacyDialog('${c.id}')">
                            <div>
                                <div class="comp-name" style="color:${c.color}">${c.name}</div>
                                <div class="comp-info">
                                    <span>${this._flag(COUNTRIES[c.country]?.flag || '')} ${_localizedCountryName(COUNTRIES[c.country]) || ''}</span>
                                    <span>${t('game.models', '모델')}: ${c.currentModel.name} (${c.currentModel.performance}${t('world.points', '점')})</span>
                                    <span>${this._termLabel('marketShare', t('world.market_share', '점유'))}: ${c.marketShare.toFixed(1)}%</span>
                                    ${doctrineLabel ? `<span>${t('company.doctrine', '교리')}: ${this._termLabel(`doctrine_${c.doctrine?.type}`, doctrineLabel)}</span>` : ''}
                                </div>
                            </div>
                            <div style="text-align:right">
                                <div style="font-size:0.8rem;color:${relColor};font-weight:600">${this._termLabel('relation', relLabel, { value: `${rel > 0 ? '+' : ''}${Math.round(rel)}` })} (${rel > 0 ? '+' : ''}${Math.round(rel)})</div>
                                ${c.cooperating ? `<div style="font-size:0.7rem;color:var(--accent)">${t('world.coop_researching', '협력 연구 중')} (${c.cooperationMonths}${t('world.months', '개월')})</div>` : ''}
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }

    _showDiplomacyDialog(compId) {
        const comp = this.companies.getCompetitor(compId);
        if (!comp) return;
        const rel = comp.relation || 0;
        const relColor = rel > 30 ? 'var(--success)' : rel > -10 ? 'var(--text-secondary)' : rel > -40 ? 'var(--warning)' : 'var(--danger)';
        const acquisitionPrice = this.companies._estimateAcquisitionPrice(comp);

        // Available research techs for cooperation
        const availTechs = Object.entries(TECH_TREE)
            .filter(([id, t]) => {
                const st = this.state.technologies[id];
                return st && st.researching && !st.completed;
            })
            .map(([id, t]) => ({ id, name: t.name }));

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content" style="max-width:500px">
                <h3 style="color:${comp.color}">${comp.name}</h3>
                <p style="font-size:0.82rem;color:var(--text-secondary)">${_localizedCompetitorDescription(comp)}</p>
                ${comp.doctrine ? `<p style="font-size:0.78rem;color:var(--text-secondary);margin-top:-4px"><strong style="color:${comp.color}">${t('company.doctrine', '교리')}:</strong> ${this._termLabel(`doctrine_${comp.doctrine.type}`, comp.doctrine.label?.[getLocale?.() || 'ko'] || comp.doctrine.label?.ko || comp.doctrine.label?.en || '')} · ${comp.doctrine.description?.[getLocale?.() || 'ko'] || comp.doctrine.description?.ko || comp.doctrine.description?.en || ''}</p>` : ''}

                <div style="display:flex;gap:16px;margin:12px 0;padding:12px;background:var(--bg-surface);border-radius:var(--r-md)">
                    <div style="flex:1;text-align:center">
                        <div style="font-size:1.2rem;font-weight:700;color:${relColor}">${Math.round(rel)}</div>
                        <div style="font-size:0.7rem;color:var(--text-tertiary)">${t('diplomacy.relation_score', '관계도')}</div>
                    </div>
                    <div style="flex:1;text-align:center">
                        <div style="font-size:1rem;font-weight:600">${comp.currentModel.performance}</div>
                        <div style="font-size:0.7rem;color:var(--text-tertiary)">${t('diplomacy.model_performance', '모델 성능')}</div>
                    </div>
                    <div style="flex:1;text-align:center">
                        <div style="font-size:1rem;font-weight:600">${comp.marketShare.toFixed(1)}%</div>
                        <div style="font-size:0.7rem;color:var(--text-tertiary)">${t('world.market_share', '점유')}</div>
                    </div>
                </div>

                <h4 style="margin-top:12px">${t('diplomacy.actions', '비즈니스 액션')}</h4>
                <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
                    <button class="btn btn-small" onclick="game._doDiplomacy('improve','${compId}')">
                        ${icon('handshake', 13)} ${t('diplomacy.improve', '관계 개선')} ($50K) — ${t('diplomacy.improve_hint', '호의 증가')}
                    </button>

                    <button class="btn btn-small" onclick="game._doDiplomacy('acquire','${compId}')" ${rel < 50 ? 'disabled style="opacity:0.4"' : ''}>
                        ${icon('company', 13)} ${t('diplomacy.acquire', 'M&A 인수')} ($${acquisitionPrice.toLocaleString()}) ${rel < 50 ? '— ' + t('diplomacy.acquire_req', '관계 +50 필요') : ''}
                    </button>

                    <button class="btn btn-small" onclick="game._showLicenseTechSelect('${compId}')" ${rel < 0 ? 'disabled style="opacity:0.4"' : ''}>
                        ${icon('research', 13)} ${t('diplomacy.license', '기술 라이선싱')} ${rel < 0 ? '— ' + t('diplomacy.license_req', '관계 0 이상 필요') : ''}
                    </button>

                    ${!comp.cooperating && availTechs.length > 0 ? `
                        <button class="btn btn-small" onclick="game._showCoopTechSelect('${compId}')" ${rel < -20 ? 'disabled style="opacity:0.4"' : ''}>
                            ${icon('research', 13)} ${t('diplomacy.cooperate', '공동 연구 제안')} ${rel < -20 ? '(' + t('diplomacy.cooperate_req', '관계 -20 이상 필요') + ')' : ''}
                        </button>
                    ` : comp.cooperating ? `
                        <span style="font-size:0.8rem;color:var(--accent)">${icon('check', 12)} ${t('diplomacy.coop_in_progress', '공동 연구 진행 중')} (${comp.cooperationMonths}${t('world.months', '개월')} ${t('diplomacy.remaining', '남음')})</span>
                    ` : `
                        <span style="font-size:0.8rem;color:var(--text-tertiary)">${t('diplomacy.no_active_research', '공동 연구: 진행 중인 연구가 없습니다')}</span>
                    `}

                    <button class="btn btn-small" onclick="game._doDiplomacy('scout','${compId}')">
                        ${icon('talent', 13)} ${t('diplomacy.scout', '인재 스카우트')} ($${(50000 + comp.stats.researchPower * 10000).toLocaleString()}) — ${t('diplomacy.scout_hint', '관계 악화')}
                    </button>

                    <button class="btn btn-small btn-danger" onclick="game._doDiplomacy('provoke','${compId}')">
                        ${icon('flame', 13)} ${t('diplomacy.provoke', '공격적 마케팅')} — ${t('diplomacy.provoke_hint', '점유율 빼앗기, 이미지 하락')}
                    </button>

                    <button class="btn btn-small btn-danger" onclick="game._doDiplomacy('lawsuit','${compId}')">
                        ${icon('alert', 13)} ${t('diplomacy.lawsuit', '특허 소송')} ($300K) — ${t('diplomacy.lawsuit_hint', '고위험 견제')}
                    </button>
                </div>

                <div class="popup-buttons" style="margin-top:16px">
                    <button class="btn" onclick="document.getElementById('popup').classList.remove('show')">${t('common.close', '닫기')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _showLicenseTechSelect(compId) {
        const techs = Object.entries(TECH_TREE)
            .filter(([id]) => {
                const st = this.state.technologies[id];
                return st && !st.completed;
            })
            .slice(0, 24);

        if (techs.length === 0) return;

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content">
                <h3>${t('diplomacy.select_license_tech', '라이선싱할 기술 선택')}</h3>
                <p style="font-size:0.82rem;color:var(--text-secondary)">${t('diplomacy.license_desc', '비용을 지불하고 해당 기술 연구를 즉시 50% 진척시킵니다.')}</p>
                <div class="talent-select" style="margin-top:12px">
                    ${techs.map(([id, tech]) => {
                        const st = this.state.technologies[id];
                        return `
                        <button class="btn btn-small" style="width:100%;text-align:left;margin-bottom:4px"
                            onclick="game._doDiplomacy('license','${compId}','${id}')">
                            ${_localizedTechName(id)} (${t('common.current', '현재')}: ${Math.floor(st.progress || 0)}%)
                        </button>`;
                    }).join('')}
                </div>
                <div class="popup-buttons" style="margin-top:12px">
                    <button class="btn" onclick="game._showDiplomacyDialog('${compId}')">${t('common.back', '뒤로')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _showCoopTechSelect(compId) {
        const techs = Object.entries(TECH_TREE)
            .filter(([id]) => {
                const st = this.state.technologies[id];
                return st && st.researching && !st.completed;
            });

        if (techs.length === 0) return;

        const popup = document.getElementById('popup');
        popup.innerHTML = `
            <div class="popup-content">
                <h3>${t('diplomacy.select_coop_tech', '공동 연구 기술 선택')}</h3>
                <p style="font-size:0.82rem;color:var(--text-secondary)">${t('diplomacy.coop_desc', '6개월간 해당 기술 연구속도 +30%')}</p>
                <div class="talent-select" style="margin-top:12px">
                    ${techs.map(([id, tech]) => `
                        <button class="btn btn-small" style="width:100%;text-align:left;margin-bottom:4px"
                            onclick="game._doDiplomacy('cooperate','${compId}','${id}')">
                            ${_localizedTechName(id)} (${t('diplomacy.progress', '진행')}: ${Math.floor(this.state.technologies[id].progress)}%)
                        </button>
                    `).join('')}
                </div>
                <div class="popup-buttons" style="margin-top:12px">
                    <button class="btn" onclick="game._showDiplomacyDialog('${compId}')">${t('common.back', '뒤로')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    _doDiplomacy(action, compId, extra) {
        let result;
        switch (action) {
            case 'improve':
                result = this.companies.improveRelation(compId);
                break;
            case 'cooperate':
                result = this.companies.proposeCooperation(compId, extra);
                break;
            case 'scout':
                result = this.companies.scoutTalent(compId);
                if (result.ok && result.talent) {
                    this.state.talents.push(result.talent);
                }
                break;
            case 'provoke':
                result = this.companies.provoke(compId);
                break;
            case 'acquire':
                if (!confirm(t('diplomacy.confirm_acquire', '이 경쟁사를 인수하시겠습니까?'))) return;
                result = this.companies.acquireCompetitor(compId);
                break;
            case 'license':
                result = this.companies.licenseTech(compId, extra);
                break;
            case 'lawsuit':
                if (!confirm(t('diplomacy.confirm_lawsuit', '특허 소송을 진행하시겠습니까? 비용과 평판 리스크가 있습니다.'))) return;
                result = this.companies.fileLawsuit(compId);
                break;
        }
        if (result?.msg) {
            this.state.addNews(result.msg, result.ok ? 'info' : 'warning');
        }
        this.renderAll();
        this._showDiplomacyDialog(compId);
    }

    _renderNews(el) {
        const filter = this._newsFilter || 'all';
        const filtered = filter === 'all' ? this.state.newsLog :
            this.state.newsLog.filter(n => n.type === filter);

        const filterBtn = (type, label) => `<button class="btn btn-small ${filter === type ? 'btn-primary' : ''}" onclick="game._newsFilter='${type}';game.renderContent()">${label}</button>`;

        el.innerHTML = `
            <div class="panel wide">
                <div class="section-header">
                    <h3>${icon('news')} ${t('news.title', '뉴스 & 이벤트 로그')}</h3>
                    <span class="section-badge">${this.state.newsLog.length}${t('news.count_unit', '건')}</span>
                </div>
                <div class="d-flex gap-xs flex-wrap mb-md">
                    ${filterBtn('all', t('news.filter.all', '전체'))}
                    ${filterBtn('success', t('news.filter.success', '성공'))}
                    ${filterBtn('info', t('news.filter.info', '정보'))}
                    ${filterBtn('warning', t('news.filter.warning', '경고'))}
                    ${filterBtn('danger', t('news.filter.danger', '위험'))}
                    ${filterBtn('event', t('news.filter.event', '이벤트'))}
                </div>
                <div class="news-list">
                    ${filtered.map(n => `
                        <div class="news-item ${n.type}">
                            <span class="news-date">${n.date?.year || ''}/${n.date?.month || ''}/${n.date?.day || ''}</span>
                            <span class="news-msg">${n.message}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _showEventPopup() {
        showEventPopup(this);
    }

    _dismissCurrentEvent() {
        this.events.dismissEvent();
        if (this.events.hasPendingEvent()) {
            this._showEventPopup();
        } else {
            document.getElementById('popup').classList.remove('show');
            this._restorePreEventPauseState();
            this.renderAll();
        }
    }

    _resolveCurrentEvent(choiceIndex) {
        this.events.resolveEvent(choiceIndex);
        if (this.events.hasPendingEvent()) {
            this._showEventPopup();
        } else {
            document.getElementById('popup').classList.remove('show');
            this._restorePreEventPauseState();
            this.renderAll();
        }
    }

    _restorePreEventPauseState() {
        // Don't restore if another modal/popup is still open
        const paradoxOpen = document.getElementById('paradox-event-modal')?.classList.contains('show');
        const popupOpen = document.getElementById('popup')?.classList.contains('show');
        if (paradoxOpen || popupOpen) return;

        restoreEventPauseState(this.time, this._preEventPauseState);
        this._preEventPauseState = null;
    }

    _formatEventEffects(effects) {
        if (!effects) return '';
        const lines = [];
        const fx = (cls, ic, txt) => `<span class="${cls}" style="display:inline-flex;align-items:center;gap:3px">${icon(ic, 13)} ${txt}</span>`;
        if (effects.funds > 0) lines.push(fx('fx-positive', 'funds', t('event.effect.funds_up', '자금 +{value}', { value: '$' + this._shortNum(effects.funds) })));
        if (effects.funds < 0) lines.push(fx('fx-negative', 'funds', t('event.effect.funds_down', '자금 -{value}', { value: '$' + this._shortNum(Math.abs(effects.funds)) })));
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

    _showGameOver() {
        showGameOver(this);
    }

    _recordLegacyRun(score, grade) {
        if (!this.state?.legacy?.previousRuns || !this.state.gameResult) return;
        const bestModel = Math.max(...this.state.models.map(m => m.compositeScore || m.performance || 0), 0);
        const summary = {
            companyName: this.state.player.companyName || 'Unknown',
            result: this.state.gameResult,
            score,
            grade,
            techRoute: this.state.player.techRoute || 'llm',
            year: this.time.currentDate.year || 2017,
            bestModel,
            legacy: this._deriveLegacyType()
        };
        const key = `${summary.companyName}:${summary.result}:${summary.year}`;
        if (this.state.legacy.previousRuns.some(run => `${run.companyName}:${run.result}:${run.year}` === key)) {
            return;
        }
        this.state.legacy.previousRuns.unshift(summary);
        this.state.legacy.previousRuns = this.state.legacy.previousRuns.slice(0, 10);
    }

    _deriveLegacyType() {
        if (this.state.models.some(model => model.deployed && model.deploymentStrategy === 'open_source')) {
            return 'open_source_pioneer';
        }
        if ((this.state.reputation.publicImage || 0) >= 50) {
            return 'public_trust';
        }
        if ((this.state.reputation.marketShare || 0) > 25) {
            return 'scale_builder';
        }
        return 'balanced_builder';
    }

    _continueAfterVictory() {
        this.state.gameOver = false;
        this.state.gameResult = null;
        document.getElementById('popup')?.classList.remove('show');
    }

    rerenderGameUi() {
        dismissAllToasts();
        this.state.refreshNewsLocale?.();
        showGameScreen();
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-tab="${this.currentTab}"]`)?.classList.add('active');
        this.renderAll();
        if (this.tutorial?.isActive()) {
            this.tutorial._showStep();
        }
        const paradoxModalOpen = document.getElementById('paradox-event-modal')?.classList.contains('show');
        if (paradoxModalOpen && this._paradoxModalState?.entry) {
            this._paradoxModalState.entry.message = this.state.localizeNewsEntry(this._paradoxModalState.entry);
            this._renderParadoxEventModal(this._paradoxModalState.entry, this._paradoxModalState.type);
        }
    }

    async saveGame() {
        await this._showSaveLoadModal('save');
    }

    async saveToSlot(slotIndex, slotName) {
        if (await this.saveManager.save(slotIndex, this, slotName)) {
            toast(t('save.saved', '게임이 저장되었습니다.'), 'success');
            logger.info('save', `Saved to slot ${slotIndex}`, { name: slotName, date: this.time.getShortDate() });
            this.time.markDirty();
        }
    }

    _renderParadoxEventModal(message, type) {
        renderParadoxEventModal(this, message, type);
    }

    async loadGame() {
        await initCampaign();
        await initGeopolitics();
        // Try slot 0 first, then autosave, then legacy
        const data = await this.saveManager.load(0) || await this.saveManager.loadAutosave();
        if (!data) return false;
        if (this.saveManager.applyToGame(data, this)) {
            initBoard(this.state);
            this._ensureDataState();
            void this._refreshSteamProfile();
            this._updateSteamRichPresence(this.currentTab);
            this.saveManager.startAutosave(this);
            this.state.monthlyReport ||= buildMonthlyReportData({ state: this.state, time: this.time }, null);
            this._monthSnapshot = createMonthSnapshot(this.state);
            this.renderAll();
            return true;
        }
        return false;
    }

    async loadFromSlot(slotIndex) {
        const data = await this.saveManager.load(slotIndex);
        if (!data) return false;
        if (this.saveManager.applyToGame(data, this)) {
            initBoard(this.state);
            this._ensureDataState();
            void this._refreshSteamProfile();
            this._updateSteamRichPresence(this.currentTab);
            this.saveManager.startAutosave(this);
            this.renderAll();
            toast(t('save.loaded', '게임을 불러왔습니다.'), 'success');
            return true;
        }
        return false;
    }

    async loadFromAutosave() {
        const data = await this.saveManager.loadAutosave();
        if (!data) return false;
        if (this.saveManager.applyToGame(data, this)) {
            initBoard(this.state);
            this._ensureDataState();
            void this._refreshSteamProfile();
            this._updateSteamRichPresence(this.currentTab);
            this.saveManager.startAutosave(this);
            this.renderAll();
            toast(t('save.autosave_loaded', '자동 저장을 불러왔습니다.'), 'success');
            return true;
        }
        return false;
    }

    _showInGameSettings() {
        // 메인메뉴의 설정 모달을 재활용
        window.menuShowSettings();
    }

    async _showSaveLoadModal(mode = 'save') {
        this._saveLoadMode = mode;
        let modal = document.getElementById('saveload-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'saveload-modal';
            modal.className = 'popup-overlay';
            document.body.appendChild(modal);
        }

        const slots = await this.saveManager.listSlots();
        const autosave = await this.saveManager.getAutosaveInfo();
        const isSave = mode === 'save';
        const title = isSave ? t('save.title_save', '게임 저장') : t('save.title_load', '게임 불러오기');

        const fmtTime = (ts) => {
            if (!ts) return '';
            const d = new Date(ts);
            return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        };

        const slotRows = slots.map((s, i) => {
            const isEmpty = !s.timestamp;
            const displayName = s.name || t('save.slot_name', '슬롯 {index}', { index: i + 1 });
            return `
                <div class="save-slot ${isEmpty ? 'save-slot--empty' : ''}" data-slot="${i}">
                    <div class="save-slot__info">
                        <span class="save-slot__name">${isEmpty ? t('save.empty', '빈 슬롯') : displayName}</span>
                        ${!isEmpty ? `<span class="save-slot__meta">${s.gameDate || ''} | ${fmtTime(s.timestamp)}</span>` : ''}
                    </div>
                    <div class="save-slot__actions">
                        ${isSave ? `<button class="btn btn-primary btn-small" onclick="game._doSaveSlot(${i})">${t('save.save', '저장')}</button>` : ''}
                        ${!isEmpty ? `<button class="btn btn-small" onclick="game._doLoadSlot(${i})">${t('save.load', '불러오기')}</button>` : ''}
                        ${!isEmpty ? `<button class="btn btn-danger btn-small" onclick="game._doDeleteSlot(${i})">${t('save.delete', '삭제')}</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        const autosaveRow = autosave ? `
            <div class="save-slot save-slot--auto">
                <div class="save-slot__info">
                    <span class="save-slot__name">${icon('clock', 14)} ${t('save.autosave', '자동 저장')}</span>
                    <span class="save-slot__meta">${autosave.gameDate || ''} | ${fmtTime(autosave.timestamp)}</span>
                </div>
                <div class="save-slot__actions">
                    <button class="btn btn-small" onclick="game._doLoadAutosave()">${t('save.load', '불러오기')}</button>
                </div>
            </div>
        ` : '';

        modal.innerHTML = `
            <div class="popup-content" style="max-width:520px">
                <h3>${icon('save', 18)} ${title}</h3>
                <div class="save-slots">
                    ${slotRows}
                    ${autosaveRow}
                </div>
                <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
                    <h4 style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:8px">${t('settings.language', '언어')}</h4>
                    ${_localeSwitcherHtml()}
                </div>
                <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
                    <h4 style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:8px">${t('settings.sound', '사운드')}</h4>
                    ${this.sound.getVolumeControlHTML(icon)}
                </div>
                <div class="popup-buttons" style="margin-top:16px">
                    ${this.tutorial ? `<button class="btn btn-small" onclick="game.tutorial.restart();document.getElementById('saveload-modal').classList.remove('show')">${t('settings.replay_tutorial', '튜토리얼 다시보기')}</button>` : ''}
                    <button class="btn" onclick="document.getElementById('saveload-modal').classList.remove('show')">${t('save.close', '닫기')}</button>
                </div>
            </div>
        `;

        setTimeout(() => modal.classList.add('show'), 10);
    }

    async _doSaveSlot(i) {
        const slots = await this.saveManager.listSlots();
        const existingName = slots[i].name;
        const name = prompt(t('save.prompt_name', '세이브 이름:'), existingName || t('save.slot_name', '슬롯 {index}', { index: i + 1 }));
        if (name === null) return;
        await this.saveToSlot(i, name || t('save.slot_name', '슬롯 {index}', { index: i + 1 }));
        await this._showSaveLoadModal('save'); // refresh
    }

    async _doLoadSlot(i) {
        document.getElementById('saveload-modal')?.classList.remove('show');
        await this.loadFromSlot(i);
    }

    async _doDeleteSlot(i) {
        if (!confirm(t('save.confirm_delete', '이 세이브를 삭제하시겠습니까?'))) return;
        await this.saveManager.deleteSave(i);
        await this._showSaveLoadModal(this.state.gameStarted ? 'save' : 'load'); // refresh
        toast(t('save.deleted', '세이브가 삭제되었습니다.'), 'info');
    }

    async _doLoadAutosave() {
        document.getElementById('saveload-modal')?.classList.remove('show');
        await this.loadFromAutosave();
    }
}

// ===== INITIALIZATION =====

let selectedCountry = 'kr';
let selectedRoute = 'llm';

let _bgGlobe = null;

function _ensureBgGlobe() {
    // 배경 지구본 컨테이너가 없으면 만들기
    let container = document.getElementById('bg-globe');
    if (!container) {
        container = document.createElement('div');
        container.id = 'bg-globe';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;opacity:0.35;';
        document.body.prepend(container);
    }

    if (!_bgGlobe) {
        try {
            _bgGlobe = new GlobeMap(container, { background: true });
            // 상호작용 비활성화
            _bgGlobe.onHover = null;
            _bgGlobe.onHoverEnd = null;
            _bgGlobe.onClick = null;
            if (_bgGlobe.renderer?.domElement) {
                _bgGlobe.renderer.domElement.style.pointerEvents = 'none';
            }
        } catch (e) {
            console.warn('[BgGlobe] Failed:', e);
        }
    }

    const settings = _getCurrentSettings();
    _bgGlobe?.applyControlSettings?.({
        edgePan: false,
        zoomSpeed: settings.controls.zoomSpeed,
        panSpeed: settings.controls.panSpeed,
        reducedMotion: settings.display.reducedMotion
    });

    container.style.display = 'block';
}

function _hideBgGlobe() {
    const container = document.getElementById('bg-globe');
    if (container) container.style.display = 'none';
}

function _destroyBgGlobe() {
    _bgGlobe?.dispose?.();
    _bgGlobe = null;
    const container = document.getElementById('bg-globe');
    if (container) container.remove();
}

async function showMainMenu() {
    window.game?.destroyWorldMap?.();
    _ensureBgGlobe();

    // 메뉴 BGM 시작 (브라우저 autoplay 정책: 유저 인터랙션 후 시작)
    try {
        const menuSound = _getMenuSoundSystem();
        if (menuSound && !menuSound._musicStarted) {
            menuSound.startMusic();
            menuSound._musicStarted = true;
        }
    } catch {}

    const app = document.getElementById('app');
    const sm = new SaveManager();
    const slots = await sm.listSlots();
    const autosave = await sm.getAutosaveInfo();
    const hasSave = slots.some(s => s.timestamp) || autosave;
    window.__agiMenuScreen = 'main';

    app.innerHTML = `
        <div class="main-menu">
            <div class="main-menu__bg"></div>
            <div class="main-menu__content">
                ${_localeSwitcherHtml()}
                <h1 class="main-menu__title">AGI Manager</h1>
                <div class="main-menu__version">${DEMO ? DEMO.version : `v${VERSION}`}</div>
                <nav class="main-menu__nav">
                    <button class="menu-item" onclick="showNewGameScreen()">
                        <span class="menu-item__icon">${icon('rocket', 18)}</span>
                        <span class="menu-item__label">${t('menu.new_game', '새 게임')}</span>
                    </button>
                    <button class="menu-item ${hasSave ? '' : 'menu-item--disabled'}" onclick="${hasSave ? 'menuLoadGame()' : ''}" ${hasSave ? '' : 'disabled'}>
                        <span class="menu-item__icon">${icon('save', 18)}</span>
                        <span class="menu-item__label">${t('menu.continue', '이어하기')}</span>
                    </button>
                    <button class="menu-item" onclick="menuShowSettings()">
                        <span class="menu-item__icon">${icon('settings', 18)}</span>
                        <span class="menu-item__label">${t('menu.settings', '설정')}</span>
                    </button>
                    <button class="menu-item" onclick="menuShowHelp()">
                        <span class="menu-item__icon">${icon('lightbulb', 18)}</span>
                        <span class="menu-item__label">${t('menu.help', '도움말')}</span>
                    </button>
                    <button class="menu-item" onclick="menuShowCredits()">
                        <span class="menu-item__icon">${icon('heart', 18)}</span>
                        <span class="menu-item__label">${t('menu.credits', '크레딧')}</span>
                    </button>
                    <button class="menu-item menu-item--secondary" onclick="menuShowAchievements()">
                        <span class="menu-item__icon">${icon('trophy', 18)}</span>
                        <span class="menu-item__label">${t('menu.achievements', '업적')}</span>
                    </button>
                    <button class="menu-item menu-item--secondary" onclick="menuShowStats()">
                        <span class="menu-item__icon">${icon('barChart', 18)}</span>
                        <span class="menu-item__label">${t('menu.stats', '통계')}</span>
                    </button>
                    <button class="menu-item menu-item--secondary" style="margin-top:8px;opacity:0.7" onclick="if(confirm('${t('settings.quit_game_confirm', '게임을 종료하시겠습니까?')}')) { window.electronAPI?.app?.quit?.() || window.close?.(); }">
                        <span class="menu-item__icon">${icon('x', 18)}</span>
                        <span class="menu-item__label">${t('menu.quit', '게임 종료')}</span>
                    </button>
                </nav>
            </div>
        </div>
    `;
}

// ─── Mount & Blade Style Character Creation ───

const CREATION_STEPS = {
    major: {
        titleKey: 'creation.major.title',
        subtitleKey: 'creation.major.subtitle',
        options: [
            { id: 'cs', labelKey: 'creation.option.major.cs.label', icon: 'brain', descKey: 'creation.option.major.cs.desc', effects: { talentQuality: 1, modifiers: { researchSpeed: 1.05 } }, effectTextKey: 'creation.option.major.cs.effect' },
            { id: 'math', labelKey: 'creation.option.major.math.label', icon: 'target', descKey: 'creation.option.major.math.desc', effects: { data: 3, modifiers: { modelQuality: 1.1 } }, effectTextKey: 'creation.option.major.math.effect' },
            { id: 'physics', labelKey: 'creation.option.major.physics.label', icon: 'zap', descKey: 'creation.option.major.physics.desc', effects: { modifiers: { worldModelResearch: 1.15 } }, effectTextKey: 'creation.option.major.physics.effect' },
            { id: 'business', labelKey: 'creation.option.major.business.label', icon: 'trendUp', descKey: 'creation.option.major.business.desc', effects: { investorTrust: 15, modifiers: { overheadReduction: 0.9 } }, effectTextKey: 'creation.option.major.business.effect' },
            { id: 'philosophy', labelKey: 'creation.option.major.philosophy.label', icon: 'shield', descKey: 'creation.option.major.philosophy.desc', effects: { publicImage: 10, modifiers: { safetyResearch: 1.2 } }, effectTextKey: 'creation.option.major.philosophy.effect' },
            { id: 'dropout', labelKey: 'creation.option.major.dropout.label', icon: 'flame', descKey: 'creation.option.major.dropout.desc', effects: { funds: -200000, modifiers: { moralDecayReduction: 0.5 } }, effectTextKey: 'creation.option.major.dropout.effect' }
        ]
    },
    career: {
        titleKey: 'creation.career.title',
        subtitleKey: 'creation.career.subtitle',
        options: [
            { id: 'bigtech', labelKey: 'creation.option.career.bigtech.label', icon: 'company', descKey: 'creation.option.career.bigtech.desc', effects: { funds: 500000, talents: 1, gpu: 5, modifiers: { cloudCostReduction: 0.85 } }, effectTextKey: 'creation.option.career.bigtech.effect' },
            { id: 'academia', labelKey: 'creation.option.career.academia.label', icon: 'research', descKey: 'creation.option.career.academia.desc', effects: { data: 5, modifiers: { researchSpeed: 1.1 } }, effectTextKey: 'creation.option.career.academia.effect' },
            { id: 'finance', labelKey: 'creation.option.career.finance.label', icon: 'funds', descKey: 'creation.option.career.finance.desc', effects: { funds: 1000000, investorTrust: 20 }, effectTextKey: 'creation.option.career.finance.effect' },
            { id: 'serial', labelKey: 'creation.option.career.serial.label', icon: 'rocket', descKey: 'creation.option.career.serial.desc', effects: { funds: 300000, modifiers: { fundraisingSpeed: 1.25 } }, effectTextKey: 'creation.option.career.serial.effect' },
            { id: 'gov', labelKey: 'creation.option.career.gov.label', icon: 'lock', descKey: 'creation.option.career.gov.desc', effects: { modifiers: { govContractRevenue: 1.3 } }, effectTextKey: 'creation.option.career.gov.effect' },
            { id: 'none', labelKey: 'creation.option.career.none.label', icon: 'flame', descKey: 'creation.option.career.none.desc', effects: { ownershipPct: 5 }, effectTextKey: 'creation.option.career.none.effect' }
        ]
    },
    philosophy: {
        titleKey: 'creation.philosophy.title',
        subtitleKey: 'creation.philosophy.subtitle',
        options: [
            { id: 'growth', labelKey: 'creation.option.philosophy.growth.label', icon: 'rocket', descKey: 'creation.option.philosophy.growth.desc', effects: { modifiers: { researchSpeed: 1.15, deployRevenue: 0.85 } }, effectTextKey: 'creation.option.philosophy.growth.effect' },
            { id: 'profit', labelKey: 'creation.option.philosophy.profit.label', icon: 'funds', descKey: 'creation.option.philosophy.profit.desc', effects: { publicImage: -10, modifiers: { deployRevenue: 1.25, overheadReduction: 0.85 } }, effectTextKey: 'creation.option.philosophy.profit.effect' },
            { id: 'safety', labelKey: 'creation.option.philosophy.safety.label', icon: 'shield', descKey: 'creation.option.philosophy.safety.desc', effects: { publicImage: 15, modifiers: { safetyResearch: 1.2, researchSpeed: 0.9 } }, effectTextKey: 'creation.option.philosophy.safety.effect' },
            { id: 'open', labelKey: 'creation.option.philosophy.open.label', icon: 'unlock', descKey: 'creation.option.philosophy.open.desc', effects: { modifiers: { openSourceRevenue: 3.0, deployRevenue: 0.8 } }, effectTextKey: 'creation.option.philosophy.open.effect' }
        ]
    },
    funding: {
        titleKey: 'creation.funding.title',
        subtitleKey: 'creation.funding.subtitle',
        options: [
            { id: 'savings', labelKey: 'creation.option.funding.savings.label', icon: 'wallet', descKey: 'creation.option.funding.savings.desc', effects: {}, effectTextKey: 'creation.option.funding.savings.effect' },
            { id: 'angel', labelKey: 'creation.option.funding.angel.label', icon: 'heart', descKey: 'creation.option.funding.angel.desc', effects: { funds: 200000, ownershipPct: -10 }, effectTextKey: 'creation.option.funding.angel.effect' },
            { id: 'grant', labelKey: 'creation.option.funding.grant.label', icon: 'research', descKey: 'creation.option.funding.grant.desc', effects: { funds: 100000, data: 10 }, effectTextKey: 'creation.option.funding.grant.effect' },
            { id: 'gov_grant', labelKey: 'creation.option.funding.gov_grant.label', icon: 'globe', descKey: 'creation.option.funding.gov_grant.desc', effects: { funds: 300000 }, effectTextKey: 'creation.option.funding.gov_grant.effect' },
            { id: 'family', labelKey: 'creation.option.funding.family.label', icon: 'handshake', descKey: 'creation.option.funding.family.desc', effects: { funds: 100000 }, effectTextKey: 'creation.option.funding.family.effect' }
        ]
    },
    techRoute: {
        titleKey: 'creation.techRoute.title',
        subtitleKey: 'creation.techRoute.subtitle',
        options: [
            { id: 'llm', labelKey: 'creation.option.techRoute.llm.label', icon: 'brain', color: '#3b82f6', descKey: 'creation.option.techRoute.llm.desc', effects: {}, effectTextKey: 'creation.option.techRoute.llm.effect' },
            { id: 'world', labelKey: 'creation.option.techRoute.world.label', icon: 'globe', color: '#f59e0b', descKey: 'creation.option.techRoute.world.desc', effects: {}, effectTextKey: 'creation.option.techRoute.world.effect' },
            { id: 'generative', labelKey: 'creation.option.techRoute.generative.label', icon: 'diamond', color: '#a855f7', descKey: 'creation.option.techRoute.generative.desc', effects: {}, effectTextKey: 'creation.option.techRoute.generative.effect' },
            { id: 'safety', labelKey: 'creation.option.techRoute.safety.label', icon: 'shield', color: '#14b8a6', descKey: 'creation.option.techRoute.safety.desc', effects: {}, effectTextKey: 'creation.option.techRoute.safety.effect' },
            { id: 'balanced', labelKey: 'creation.option.techRoute.balanced.label', icon: 'target', color: '#94a3b8', descKey: 'creation.option.techRoute.balanced.desc', effects: {}, effectTextKey: 'creation.option.techRoute.balanced.effect' }
        ]
    }
};

const BONUS_NAME_FALLBACK = {
    researchSpeed: '연구속도', talentQuality: '인재 수준', vcFunding: 'VC 투자',
    competition: '경쟁 강도', talentCost: '인건비', academicResearch: '학술 연구',
    industrialAI: '산업 AI', stableFunding: '안정 투자', regulationPenalty: '규제',
    marketSize: '시장 규모', energy: '에너지', energyEfficiency: '에너지 효율',
    governmentFunding: '정부 지원', chipResearch: '반도체 연구', lithography: '리소그래피',
    taxBenefit: '세금 혜택', aiEducation: 'AI 교육', innovation: '혁신',
    digitalGov: '디지털 정부', dataAccess: '데이터 접근', internationalRisk: '국제 리스크',
    govContractRevenue: '정부 계약', semiconductor: '반도체', foundryAccess: '파운드리 접근',
    robotics: '로봇공학', semiconductorMaterials: '반도체 소재', startupCulture: '스타트업 문화',
    internetSpeed: '인터넷 속도', costOfLiving: '생활비', talentPool: '인재풀',
    infrastructure: '인프라', investment: '투자 환경',
    // 국가 보너스/페널티 전체
    academicResearch: '학술 연구', africanMarket: '아프리카 시장', aiEducation: 'AI 교육',
    bpoExpertise: 'BPO 전문성', chipAssembly: '칩 조립', competition: '경쟁 강도',
    cybersecurity: '사이버보안', dataCollection: '데이터 수집', defense: '방위산업',
    energy: '에너지', energyEfficiency: '에너지 효율', hardwareIntegration: 'HW 통합',
    industrialAI: '산업 AI', innovation: '혁신', internationalRisk: '국제 리스크',
    lithography: '리소그래피', manufacturingAI: '제조 AI', marketSize: '시장 규모',
    mobileInnovation: '모바일 혁신', regulationFreedom: '규제 자유', regulationPenalty: '규제 부담',
    researchSpeed: '연구속도', stableFunding: '안정 투자', startupSpeed: '창업 속도',
    talentCost: '인건비', talentQuality: '인재 수준', talentQuantity: '인재 수',
    talentShortage: '인재 부족', taxBenefit: '세금 혜택', vcFunding: 'VC 투자',
    governmentFunding: '정부 지원', digitalGov: '디지털 정부', dataAccess: '데이터 접근'
};
function _bonusLabel(key) { return t(`bonus.${key}`, BONUS_NAME_FALLBACK[key] || key); }
const BONUS_EFFECT_FALLBACK = {
    academicResearch: { ko: '기초 및 데이터 계열 연구 속도를 높입니다.', en: 'Speeds up foundation and data research.' },
    aiEducation: { ko: '고레벨 인재가 더 자주 등장합니다.', en: 'Makes higher-level talent appear more often.' },
    innovation: { ko: '프론티어 및 통합 연구를 가속합니다.', en: 'Accelerates frontier and integration research.' },
    talentCost: { ko: '현지 인재 급여와 채용비가 더 비쌉니다.', en: 'Raises local salary and hiring costs.' },
    talentQuantity: { ko: '인재 시장 규모를 키웁니다.', en: 'Expands the talent market.' },
    talentShortage: { ko: '인재 시장 규모를 줄입니다.', en: 'Shrinks the talent market.' },
    bpoExpertise: { ko: '운영 오버헤드를 줄입니다.', en: 'Reduces operating overhead.' },
    vcFunding: { ko: '투자 유치 진행 속도를 높입니다.', en: 'Speeds up fundraising progress.' },
    governmentFunding: { ko: '초기 라운드 자금 조달에 보너스를 줍니다.', en: 'Boosts early-stage fundraising.' },
    stableFunding: { ko: '배포 수익의 하방을 완화합니다.', en: 'Softens downside swings in deployment revenue.' },
    taxBenefit: { ko: '세금성 오버헤드를 줄입니다.', en: 'Reduces tax-related overhead.' },
    startupSpeed: { ko: '게임 시작 시 추가 초기 자금을 줍니다.', en: 'Adds extra starting funds.' },
    marketSize: { ko: '전반적인 배포 수익을 높입니다.', en: 'Boosts overall deployment revenue.' },
    industrialAI: { ko: '기업/정부 계약 수익을 높입니다.', en: 'Boosts enterprise and government revenue.' },
    manufacturingAI: { ko: '기업 솔루션 수익을 추가로 높입니다.', en: 'Further boosts enterprise revenue.' },
    mobileInnovation: { ko: '소비자 챗 서비스 수익을 높입니다.', en: 'Boosts consumer chat revenue.' },
    africanMarket: { ko: '시장 점유율 유지에 도움을 줍니다.', en: 'Helps retain market share.' },
    chipResearch: { ko: '칩 계열 연구 속도를 높입니다.', en: 'Speeds up chip research.' },
    chipAssembly: { ko: '칩 파일럿/전환 단계를 단축합니다.', en: 'Shortens chip pilot and rollout stages.' },
    lithography: { ko: '칩 프로그램 성능 결과를 향상합니다.', en: 'Improves chip program outcomes.' },
    foundryAccess: { ko: '칩 개발 기간을 줄입니다.', en: 'Shortens chip development time.' },
    hardwareIntegration: { ko: 'GPU 실효 연산력을 높입니다.', en: 'Improves effective GPU throughput.' },
    energyEfficiency: { ko: '보유 GPU 전력 비용을 줄입니다.', en: 'Reduces owned GPU power costs.' },
    regulationPenalty: { ko: '배포 수익에 규제 페널티를 줍니다.', en: 'Applies a regulatory penalty to revenue.' },
    regulationFreedom: { ko: '배포 수익에 출시 자유 보너스를 줍니다.', en: 'Adds a fast-launch bonus to revenue.' },
    internationalRisk: { ko: '부정적 국제 이벤트 리스크를 키웁니다.', en: 'Raises negative international event risk.' },
    cybersecurity: { ko: '정부 계약과 안전 역량에 강점을 줍니다.', en: 'Strengthens government contracts and safety work.' },
    competition: { ko: '시장 점유율 방어가 더 어려워집니다.', en: 'Makes market share harder to defend.' },
    digitalGov: { ko: '정부 계약 수익을 높입니다.', en: 'Boosts government contract revenue.' },
    robotics: { ko: '로봇/체화지능 연구에 도움을 줍니다.', en: 'Helps robotics and embodied-AI research.' },
    dataCollection: { ko: '데이터 구매 비용을 줄입니다.', en: 'Reduces data purchase costs.' },
    defense: { ko: '정부/방위 계약 수익을 높입니다.', en: 'Boosts government and defense-style contracts.' },
    semiconductor: { ko: '칩 프로그램 품질과 안정성을 높입니다.', en: 'Improves chip program quality and stability.' },
    infrastructure: { ko: '데이터센터 건설 일정을 앞당깁니다.', en: 'Shortens datacenter construction time.' }
};
function _bonusEffectLabel(key) {
    const fallback = BONUS_EFFECT_FALLBACK[key];
    const fallbackText = fallback ? (getLocale() === 'ko' ? fallback.ko : fallback.en) : key;
    return t(`bonus_effect.${key}`, fallbackText);
}

const INDUSTRY_NAME_FALLBACK = {
    office: '사무직',
    transport: '운송',
    manufacturing: '제조',
    design: '디자인',
    development: '개발'
};

const DATACENTER_NAME_FALLBACK = {
    small: '소형 데이터센터',
    medium: '중형 데이터센터',
    ai_farm: '대형 AI팜'
};

const ARCHITECTURE_NAME_FALLBACK = {
    cnn: { ko: '합성곱 신경망', en: 'CNN' },
    rnn_lstm: { ko: 'RNN/LSTM', en: 'RNN/LSTM' },
    transformer: { ko: '트랜스포머', en: 'Transformer' },
    gpt: { ko: 'GPT 아키텍처', en: 'GPT' },
    diffusion: { ko: '디퓨전 모델', en: 'Diffusion' },
    moe: { ko: '전문가 혼합', en: 'Mixture of Experts' },
    multimodal_arch: { ko: '멀티모달', en: 'Multimodal' },
    agent_arch: { ko: '에이전트', en: 'Agent Architecture' }
};

const ARCHITECTURE_DESCRIPTION_FALLBACK = {
    cnn: {
        ko: '이미지 인식 및 분류에 특화된 아키텍처',
        en: 'An architecture specialized for image recognition and classification.'
    },
    rnn_lstm: {
        ko: '순차 데이터 처리에 적합한 순환 신경망',
        en: 'A recurrent neural network suited to sequential data processing.'
    },
    transformer: {
        ko: 'Attention 메커니즘 기반의 범용 아키텍처. 2017년 "Attention Is All You Need".',
        en: 'A general-purpose architecture built on attention mechanisms. Popularized by "Attention Is All You Need" in 2017.'
    },
    gpt: {
        ko: '자기회귀 언어 모델. 텍스트 생성의 혁명.',
        en: 'An autoregressive language model that reshaped text generation.'
    },
    diffusion: {
        ko: '노이즈 제거 기반 생성 모델. 이미지/영상 생성의 혁명.',
        en: 'A denoising-based generative model that transformed image and video generation.'
    },
    moe: {
        ko: '조건부 연산으로 효율적 스케일링. 추론 비용 대비 높은 성능.',
        en: 'Conditionally activates expert submodels for efficient scaling and strong performance per inference cost.'
    },
    multimodal_arch: {
        ko: '텍스트, 이미지, 오디오, 비디오를 모두 처리하는 통합 아키텍처.',
        en: 'An integrated architecture that handles text, images, audio, and video together.'
    },
    agent_arch: {
        ko: '도구 사용, 계획, 자율 실행이 가능한 에이전트 아키텍처.',
        en: 'An agentic architecture capable of tool use, planning, and autonomous execution.'
    }
};

const PARAMETER_SCALE_NAME_FALLBACK = {
    tiny: { ko: '초소형', en: 'Tiny' },
    small: { ko: '소형', en: 'Small' },
    medium: { ko: '중형', en: 'Medium' },
    large: { ko: '대형', en: 'Large' },
    xlarge: { ko: '초대형', en: 'Extra Large' },
    frontier: { ko: '프론티어', en: 'Frontier' },
    massive: { ko: '거대', en: 'Massive' }
};

const TRAINING_PHASE_NAME_FALLBACK = {
    data_curation: { ko: '데이터 큐레이션', en: 'Data Curation' },
    pretraining: { ko: '사전 학습', en: 'Pretraining' },
    finetuning: { ko: '파인튜닝', en: 'Fine-tuning' },
    alignment: { ko: '정렬/RLHF', en: 'Alignment / RLHF' },
    evaluation: { ko: '평가/레드팀', en: 'Evaluation / Red Teaming' }
};

const DATA_TYPE_NAME_FALLBACK = {
    web_text: { ko: '웹 텍스트', en: 'Web Text' },
    books: { ko: '도서', en: 'Books' },
    code: { ko: '코드', en: 'Code' },
    scientific: { ko: '과학 논문', en: 'Scientific Papers' },
    images: { ko: '이미지', en: 'Images' },
    audio: { ko: '오디오', en: 'Audio' },
    video: { ko: '비디오', en: 'Video' }
};

const DEPLOYMENT_NAME_FALLBACK = {
    api: { ko: 'API 서비스', en: 'API Service' },
    consumer_chat: { ko: '소비자 챗 앱', en: 'Consumer Chat App' },
    enterprise: { ko: '기업 솔루션', en: 'Enterprise Solution' },
    open_source: { ko: '오픈소스', en: 'Open Source' },
    government: { ko: '정부 계약', en: 'Government Contract' }
};

const DEPLOYMENT_DESCRIPTION_FALLBACK = {
    api: {
        ko: '개발자를 위한 API. B2B 중심의 안정적 수익.',
        en: 'Developer-facing API with stable B2B-oriented revenue.'
    },
    consumer_chat: {
        ko: '소비자용 대화형 AI. 대규모 사용자 기반.',
        en: 'Conversational AI for consumers with a large potential user base.'
    },
    enterprise: {
        ko: '기업 맞춤형 솔루션. 고객당 높은 수익.',
        en: 'Customized enterprise solutions with high revenue per customer.'
    },
    open_source: {
        ko: '무료 공개. 직접 수익 적지만 평판 대폭 상승.',
        en: 'Freely released with limited direct revenue but a major reputation boost.'
    },
    government: {
        ko: '정부/군 계약. 매우 높은 수익, 논란 가능성.',
        en: 'Government or defense contracts with very high revenue and controversy risk.'
    }
};

const SPECIALTY_NAME_FALLBACK = {
    ml: { ko: '머신러닝', en: 'Machine Learning' },
    nlp: { ko: 'NLP', en: 'NLP' },
    vision: { ko: '컴퓨터비전', en: 'Computer Vision' },
    rl: { ko: '강화학습', en: 'Reinforcement Learning' },
    safety: { ko: 'AI 안전', en: 'AI Safety' },
    infra: { ko: '인프라', en: 'Infrastructure' },
    hw: { ko: '하드웨어', en: 'Hardware' },
    data: { ko: '데이터', en: 'Data' }
};

const TRAIT_NAME_FALLBACK = {
    perfectionist: { ko: '완벽주의자', en: 'Perfectionist' },
    speedrunner: { ko: '스피드러너', en: 'Speedrunner' },
    team_player: { ko: '팀플레이어', en: 'Team Player' },
    lone_wolf: { ko: '독불장군', en: 'Lone Wolf' },
    innovator: { ko: '혁신가', en: 'Innovator' },
    mentor: { ko: '멘토', en: 'Mentor' },
    workaholic: { ko: '워커홀릭', en: 'Workaholic' },
    balanced: { ko: '균형잡힌', en: 'Balanced' }
};

const TRAIT_EFFECT_FALLBACK = {
    perfectionist: { ko: '연구 품질↑ 속도↓', en: 'Higher research quality, lower speed' },
    speedrunner: { ko: '속도↑ 품질↓', en: 'Higher speed, lower quality' },
    team_player: { ko: '협업 시너지↑', en: 'Better collaboration synergy' },
    lone_wolf: { ko: '단독 연구↑ 협업↓', en: 'Stronger solo work, weaker collaboration' },
    innovator: { ko: '돌파구 확률↑', en: 'Higher breakthrough chance' },
    mentor: { ko: '주변 인재 성장↑', en: 'Improves nearby talent growth' },
    workaholic: { ko: '생산성↑ 번아웃 위험↑', en: 'Higher productivity, higher burnout risk' },
    balanced: { ko: '안정적 성과', en: 'Steady performance' }
};

const CAPABILITY_NAME_FALLBACK = {
    language: { ko: '언어', en: 'Language' },
    reasoning: { ko: '추론', en: 'Reasoning' },
    coding: { ko: '코딩', en: 'Coding' },
    math: { ko: '수학', en: 'Math' },
    multimodal: { ko: '멀티모달', en: 'Multimodal' },
    safety: { ko: '안전', en: 'Safety' },
    speed: { ko: '속도', en: 'Speed' }
};

const COMPETITOR_DESCRIPTION_FALLBACK = {
    openmind: {
        ko: '공격적 AI 개발을 추구하는 미국 스타트업',
        en: 'A U.S. startup pursuing aggressive AI development.'
    },
    titanbrain: {
        ko: '막대한 자원과 학술적 연구력을 겸비한 거대 기업',
        en: 'A giant company combining massive resources with strong academic research.'
    },
    cloudpillar: {
        ko: '안전과 정렬을 최우선으로 하는 AI 연구기업',
        en: 'An AI research company that prioritizes safety and alignment.'
    },
    nexaai: {
        ko: '오픈소스 전략으로 AI 생태계를 주도하는 소셜 기업',
        en: 'A mission-driven company leading the AI ecosystem through open source.'
    },
    skydragon: {
        ko: '중국 정부의 전폭적 지원을 받는 AI 기업',
        en: 'An AI company backed heavily by the Chinese government.'
    },
    omnisoft: {
        ko: '투자와 플랫폼으로 AI 시장을 지배하려는 거대 소프트웨어 기업',
        en: 'A software giant aiming to dominate the AI market through capital and platform power.'
    }
};

function _localeFallbackText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;

    const locale = getLocale();
    return value[locale] ?? value.ko ?? value.en ?? Object.values(value)[0] ?? '';
}

function _resolveCatalogEntry(entryOrId, catalog) {
    if (!entryOrId) return null;
    if (typeof entryOrId === 'string') {
        return Array.isArray(catalog)
            ? catalog.find(entry => entry.id === entryOrId) || null
            : catalog[entryOrId] || null;
    }
    return entryOrId;
}

function _localizedCountryName(country) {
    if (!country) return '';

    const translated = t(`country.${country.id}.name`, country.name);
    if (translated !== country.name) return translated;

    if (getLocale() === 'en' && typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
        try {
            const dn = new Intl.DisplayNames(['en'], { type: 'region' });
            const code = country.id?.toUpperCase();
            if (code && /^[A-Z]{2}$/.test(code)) {
                return dn.of(code) || country.name;
            }
        } catch {
            return country.name;
        }
    }

    return country.name;
}

function _localizedCountryDescription(country) {
    return country ? t(`country.${country.id}.description`, country.description || '') : '';
}

function _localizedRegionName(regionId) {
    return t(`world.region.${regionId}`, REGIONS[regionId]?.name || regionId);
}

function _localizedTechName(techId) {
    return t(`tech.${techId}.name`, TECH_TREE[techId]?.name || techId);
}

function _localizedTechDescription(techId) {
    return t(`tech.${techId}.description`, TECH_TREE[techId]?.description || '');
}

function _localizedTechCategoryName(categoryId) {
    return t(`research.category.${categoryId}`, TECH_CATEGORIES[categoryId]?.name || categoryId);
}

function _localizedRouteName(routeId) {
    return t(`route.${routeId}`, ROUTE_INFO[routeId]?.name || routeId);
}

function _getResearchGroupIdForCategory(categoryId) {
    return RESEARCH_GROUP_BY_CATEGORY[categoryId] || 'research';
}

function _getResearchGroupDefinition(groupId) {
    return RESEARCH_GROUPS.find(group => group.id === groupId) || RESEARCH_GROUPS[0];
}

function _localizedResearchGroupName(groupId) {
    const group = _getResearchGroupDefinition(groupId);
    return group ? t(group.name, group.nameKo || group.id) : groupId;
}

function _escapeHtmlAttr(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function _localizedIndustryName(industryId) {
    return t(`industry.${industryId}`, INDUSTRY_NAME_FALLBACK[industryId] || industryId);
}

function _localizedDatacenterName(tierId, fallbackName = '') {
    return t(`compute.datacenter.${tierId}`, fallbackName || DATACENTER_NAME_FALLBACK[tierId] || tierId);
}

function _localizedDatacenterLocationName(locationId, fallbackName = '') {
    const location = DATACENTER_LOCATIONS[locationId];
    return t(location?.nameKey || `dc.location.${locationId}`, fallbackName || location?.fallback || locationId);
}

function _localizedDatacenterLocationDescription(locationId, fallbackText = '') {
    const location = DATACENTER_LOCATIONS[locationId];
    return t(location?.description || `dc.location.${locationId}.desc`, fallbackText || location?.descFallback || '');
}

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

function _localizedEventChoiceLockedHint(eventId, index, choice) {
    if (!choice?.lockedHint) return '';
    return t(`event.${eventId}.choice_${index}_locked`, choice.lockedHint);
}

function _localizedCapabilityName(capabilityId) {
    return t(`capability.${capabilityId}`, _localeFallbackText(CAPABILITY_NAME_FALLBACK[capabilityId]) || CAPABILITY_BENCHMARKS[capabilityId]?.name || capabilityId);
}

function _localizedBenchmarkName(benchmark) {
    const bench = _resolveCatalogEntry(benchmark, BENCHMARKS);
    if (!bench) return typeof benchmark === 'string' ? benchmark : '';
    const fallback = getLocale() === 'ko'
        ? (bench.nameKo || bench.name || bench.id)
        : (bench.name || bench.nameKo || bench.id);
    return t(`benchmark.${bench.id}.name`, fallback);
}

function _localizedCompetitorName(competitor) {
    if (!competitor) return '';
    return t(`competitor.${competitor.id}.name`, competitor.name || competitor.id || '');
}

function _localizedCompetitorDescription(competitor) {
    if (!competitor) return '';
    return t(
        `company.competitor.${competitor.id}.description`,
        _localeFallbackText(COMPETITOR_DESCRIPTION_FALLBACK[competitor.id]) || competitor.description || ''
    );
}

function _localizedArchitectureName(architecture) {
    const arch = _resolveCatalogEntry(architecture, MODEL_ARCHITECTURES);
    if (!arch) return typeof architecture === 'string' ? architecture : '';
    const fallback = _localeFallbackText(ARCHITECTURE_NAME_FALLBACK[arch.id])
        || (getLocale() === 'ko' ? (arch.nameKr || arch.name) : (arch.name || arch.nameKr))
        || arch.id;
    return t(`architecture.${arch.id}.name`, fallback);
}

function _localizedArchitectureDescription(architecture) {
    const arch = _resolveCatalogEntry(architecture, MODEL_ARCHITECTURES);
    if (!arch) return '';
    const fallback = _localeFallbackText(ARCHITECTURE_DESCRIPTION_FALLBACK[arch.id]) || arch.description || '';
    return t(`architecture.${arch.id}.description`, fallback);
}

function _localizedParameterScaleName(scale) {
    const scaleDef = _resolveCatalogEntry(scale, PARAMETER_SCALES);
    if (!scaleDef) return typeof scale === 'string' ? scale : '';
    const fallback = _localeFallbackText(PARAMETER_SCALE_NAME_FALLBACK[scaleDef.id]) || scaleDef.name || scaleDef.id;
    return t(`parameter_scale.${scaleDef.id}.name`, fallback);
}

function _localizedTrainingPhaseName(phase) {
    const phaseDef = _resolveCatalogEntry(phase, TRAINING_PHASES);
    if (!phaseDef) return typeof phase === 'string' ? phase : '';
    const fallback = _localeFallbackText(TRAINING_PHASE_NAME_FALLBACK[phaseDef.id]) || phaseDef.name || phaseDef.id;
    return t(`training_phase.${phaseDef.id}.name`, fallback);
}

function _localizedDataTypeName(dataType) {
    const dataTypeDef = _resolveCatalogEntry(dataType, DATA_TYPES);
    if (!dataTypeDef) return typeof dataType === 'string' ? dataType : '';
    const fallback = _localeFallbackText(DATA_TYPE_NAME_FALLBACK[dataTypeDef.id]) || dataTypeDef.name || dataTypeDef.id;
    return t(`data_type.${dataTypeDef.id}.name`, fallback);
}

function _localizedDeploymentStrategyName(strategy) {
    const strategyDef = _resolveCatalogEntry(strategy, DEPLOYMENT_STRATEGIES);
    if (!strategyDef) return typeof strategy === 'string' ? strategy : '';
    const fallback = _localeFallbackText(DEPLOYMENT_NAME_FALLBACK[strategyDef.id]) || strategyDef.name || strategyDef.id;
    return t(`deployment.${strategyDef.id}.name`, fallback);
}

function _localizedDeploymentStrategyDescription(strategy) {
    const strategyDef = _resolveCatalogEntry(strategy, DEPLOYMENT_STRATEGIES);
    if (!strategyDef) return '';
    const fallback = _localeFallbackText(DEPLOYMENT_DESCRIPTION_FALLBACK[strategyDef.id]) || strategyDef.description || '';
    return t(`deployment.${strategyDef.id}.description`, fallback);
}

function _localizedSpecialtyName(specialtyId) {
    const specialty = _resolveCatalogEntry(specialtyId, SPECIALTIES);
    if (!specialty) return specialtyId || '';
    const fallback = _localeFallbackText(SPECIALTY_NAME_FALLBACK[specialty.id]) || specialty.name || specialty.id;
    return t(`specialty.${specialty.id}.name`, fallback);
}

function _localizedSpecialtyList(specialtyIds = []) {
    return specialtyIds.map(_localizedSpecialtyName).join(', ');
}

function _localizedTraitName(traitId) {
    const trait = _resolveCatalogEntry(traitId, PERSONALITY_TRAITS);
    if (!trait) return traitId || '';
    const fallback = _localeFallbackText(TRAIT_NAME_FALLBACK[trait.id]) || trait.name || trait.id;
    return t(`trait.${trait.id}.name`, fallback);
}

function _localizedTraitEffect(traitId) {
    const trait = _resolveCatalogEntry(traitId, PERSONALITY_TRAITS);
    if (!trait) return '';
    const fallback = _localeFallbackText(TRAIT_EFFECT_FALLBACK[trait.id]) || trait.effect || '';
    return t(`trait.${trait.id}.effect`, fallback);
}

function _localizedPersonality(personality) {
    if (!personality) return '';
    if (typeof personality === 'string') return personality;
    const locale = getLocale?.() || 'ko';
    return personality.label?.[locale] || personality.label?.ko || personality.label?.en || personality.id || '';
}

function _localizedIdeologyProfile(profile, fallbackId = '') {
    if (profile && typeof profile === 'object') {
        const locale = getLocale?.() || 'ko';
        return profile.label?.[locale] || profile.label?.ko || profile.label?.en || profile.id || fallbackId;
    }
    const fallbackMap = {
        safety: t('talent.ideology.safety', '안전 우선주의'),
        accel: t('talent.ideology.accel', '빠른 성장주의'),
        neutral: t('talent.ideology.neutral', '실용주의')
    };
    return fallbackMap[fallbackId] || fallbackId;
}

function _relationLabel(rel) {
    if (rel > 50) return t('diplomacy.relation.friendly', '우호적');
    if (rel > 20) return t('diplomacy.relation.positive', '호의적');
    if (rel > -10) return t('diplomacy.relation.neutral', '중립');
    if (rel > -40) return t('diplomacy.relation.wary', '경계');
    return t('diplomacy.relation.hostile', '적대적');
}

function _resolveCreationStep(stepId) {
    const step = CREATION_STEPS[stepId];
    if (!step) return null;
    return {
        ...step,
        title: t(step.titleKey, step.titleKey),
        subtitle: t(step.subtitleKey, step.subtitleKey),
        options: step.options.map(option => ({
            ...option,
            label: t(option.labelKey, option.labelKey),
            desc: t(option.descKey, option.descKey),
            effectText: t(option.effectTextKey, option.effectTextKey)
        }))
    };
}

function _localeSwitcherHtml() {
    const current = _getCurrentSettings().gameplay.locale || getLocale();
    const button = (lang) => `
        <button class="btn btn-small ${current === lang ? 'btn-primary' : ''}" onclick="setLanguage('${lang}')">
            ${t(`locale.${lang}`, lang.toUpperCase())}
        </button>
    `;
    return `
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px">
            <span style="font-size:0.78rem;color:var(--text-secondary)">${t('settings.language', 'Language')}</span>
            ${button('ko')}
            ${button('en')}
        </div>
    `;
}

const STEP_ORDER = ['major', 'career', 'philosophy', 'funding', 'techRoute'];
const CEO_AVATARS = ['👨‍💼', '👩‍💼', '🧑‍💻', '👨‍🔬', '👩‍🔬', '🧑‍🏫', '👨‍💻', '👩‍💻', '🧔', '👩', '🧑', '👨', '🤓', '😎', '🤖'];
const BASE_BUILD = {
    funds: BALANCE.START.FUNDS,
    gpu: BALANCE.START.COMPUTING,
    talents: 2,
    talentQuality: 3,
    investorTrust: BALANCE.START.INVESTOR_TRUST,
    publicImage: 0,
    ownershipPct: 100,
    data: BALANCE.START.DATA,
    modifiers: {}
};

let _creationStep = 0;
let _creationChoices = {};
let _companyName = 'DeepCore AI';
let _ceoLastName = 'Kim';
let _ceoFirstName = 'Min-su';
let _ceoName = 'Kim Min-su';
let _ceoNationality = 'kr';
let _ceoAvatar = '👨‍💼';
let _avatarConfig = { hair: 'shortHairShortFlat', skinColor: 'edb98a', eyes: 'default', mouth: 'smile', accessories: '', clothing: 'blazerAndShirt' };

const CEO_NATIONALITIES = [
    { id: 'kr', flag: '🇰🇷', name: '한국' },
    { id: 'us', flag: '🇺🇸', name: '미국' },
    { id: 'cn', flag: '🇨🇳', name: '중국' },
    { id: 'jp', flag: '🇯🇵', name: '일본' },
    { id: 'gb', flag: '🇬🇧', name: '영국' },
    { id: 'de', flag: '🇩🇪', name: '독일' },
    { id: 'fr', flag: '🇫🇷', name: '프랑스' },
    { id: 'in', flag: '🇮🇳', name: '인도' },
    { id: 'ca', flag: '🇨🇦', name: '캐나다' },
    { id: 'il', flag: '🇮🇱', name: '이스라엘' },
    { id: 'sg', flag: '🇸🇬', name: '싱가포르' },
    { id: 'br', flag: '🇧🇷', name: '브라질' },
    { id: 'ae', flag: '🇦🇪', name: 'UAE' },
    { id: 'se', flag: '🇸🇪', name: '스웨덴' },
    { id: 'au', flag: '🇦🇺', name: '호주' },
];

function _calcBuild() {
    const b = JSON.parse(JSON.stringify(BASE_BUILD));
    for (const stepId of STEP_ORDER) {
        const choiceId = _creationChoices[stepId];
        if (!choiceId) continue;
        const step = CREATION_STEPS[stepId];
        const opt = step.options.find(o => o.id === choiceId);
        if (!opt) continue;
        const e = opt.effects;
        if (e.funds) b.funds += e.funds;
        if (e.gpu) b.gpu += e.gpu;
        if (e.talents) b.talents += e.talents;
        if (e.talentQuality) b.talentQuality += e.talentQuality;
        if (e.investorTrust) b.investorTrust += e.investorTrust;
        if (e.publicImage) b.publicImage += e.publicImage;
        if (e.ownershipPct) b.ownershipPct += e.ownershipPct;
        if (e.data) b.data += e.data;
        if (e.modifiers) {
            for (const [k, v] of Object.entries(e.modifiers)) {
                b.modifiers[k] = (b.modifiers[k] || 1) * v;
            }
        }
    }
    b.techRoute = _creationChoices.techRoute || 'llm';
    return b;
}

function _fmtMoney(v) {
    return v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`;
}

function showNewGameScreen() {
    if (_creationStep === 0 && Object.keys(_creationChoices).length === 0) {
        // Show name input first
        _showNameStep();
    } else {
        _showCreationStep();
    }
}

function _showNameStep() {
    const app = document.getElementById('app');
    window.__agiMenuScreen = 'name';
    app.innerHTML = `
        <div class="setup-screen">
            <div class="creation-card" style="max-width:680px">
                <div class="creation-step-indicator">${t('common.preparing', '준비')}</div>
                <h2 class="creation-question">${t('creation.ceo_setup', 'CEO 프로필을 준비하세요')}</h2>
                <p class="creation-subtitle">${t('creation.ceo_setup_sub', '"회사를 이끌 얼굴과 이름을 정하세요"')}</p>

                <!-- 국적 + 성 + 이름 한 줄 -->
                <div style="display:flex;gap:10px;max-width:520px;margin:24px auto 0;align-items:flex-end">
                    <div class="form-group" style="flex:0 0 auto">
                        <label style="display:block;text-align:left;margin-bottom:6px;color:var(--text-secondary);font-size:0.78rem">${t('creation.nationality', '국적')}</label>
                        <select id="ceo-nationality" class="input" style="font-size:1rem;padding:8px 12px;min-width:120px;text-align:center;appearance:auto;">
                            ${CEO_NATIONALITIES.map(n => `<option value="${n.id}" ${n.id === _ceoNationality ? 'selected' : ''}>${n.flag} ${n.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label style="display:block;text-align:left;margin-bottom:6px;color:var(--text-secondary);font-size:0.78rem">${t('creation.last_name', '성')}</label>
                        <input type="text" id="ceo-last-name" class="input" placeholder="Kim" value="${_ceoLastName}" style="text-align:center;font-size:1rem">
                    </div>
                    <div class="form-group" style="flex:1.5">
                        <label style="display:block;text-align:left;margin-bottom:6px;color:var(--text-secondary);font-size:0.78rem">${t('creation.first_name', '이름')}</label>
                        <input type="text" id="ceo-first-name" class="input" placeholder="Min-su" value="${_ceoFirstName}" style="text-align:center;font-size:1rem">
                    </div>
                </div>

                <!-- 아바타 커스터마이저 -->
                <div class="form-group" style="max-width:580px;margin:18px auto 0">
                    <label style="display:block;text-align:left;margin-bottom:8px;color:var(--text-secondary);font-size:0.78rem">${t('creation.ceo_avatar', 'CEO 초상화')}</label>
                    <div id="avatar-customizer-container"></div>
                </div>

                <!-- 회사 이름 -->
                <div class="form-group" style="max-width:420px;margin:18px auto 0">
                    <label style="display:block;text-align:left;margin-bottom:6px;color:var(--text-secondary);font-size:0.78rem">${t('creation.company_name', '회사 이름')}</label>
                    <input type="text" id="company-name" class="input" placeholder="${t('creation.company_name_placeholder', '회사 이름')}" value="${_companyName}" style="text-align:center;font-size:1.1rem">
                </div>

                <div class="creation-nav">
                    <button class="btn" onclick="showMainMenu()">${t('common.back', '뒤로')}</button>
                    <button class="btn btn-primary" onclick="_nameConfirmed()">${t('common.next', '다음 →')}</button>
                </div>
            </div>
        </div>
    `;

    // DiceBear 아바타 커스터마이저 마운트
    const avatarContainer = document.getElementById('avatar-customizer-container');
    if (avatarContainer) {
        _mountAvatarCustomizer(avatarContainer);
    }
}

function _mountAvatarCustomizer(container) {
    import('./ui/avatarGenerator.js').then(({ renderAvatarCustomizer, AVATAR_CSS, generateAvatarUrl }) => {
        if (!document.getElementById('avatar-css')) {
            const style = document.createElement('style');
            style.id = 'avatar-css';
            style.textContent = AVATAR_CSS;
            document.head.appendChild(style);
        }
        renderAvatarCustomizer(container, _avatarConfig, (newConfig) => {
            _avatarConfig = newConfig;
            const cached = generateAvatarUrl(newConfig);
            if (cached) _ceoAvatar = cached;
        });
    }).catch((e) => {
        console.warn('Avatar customizer failed:', e);
        container.innerHTML = `<div class="creation-avatar-grid">${CEO_AVATARS.map(a => `<button type="button" class="creation-avatar-option ${a === _ceoAvatar ? 'creation-avatar-option--active' : ''}" onclick="selectCeoAvatar('${a}')">${a}</button>`).join('')}</div>`;
    });
}

function _showCreationStep() {
    const stepId = STEP_ORDER[_creationStep];
    const step = _resolveCreationStep(stepId);
    if (!step) { _showSummary(); return; }
    window.__agiMenuScreen = 'creation';

    const isCountryStep = false; // Country is shown after name, integrated into flow
    const currentChoice = _creationChoices[stepId];
    const build = _calcBuild();

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="setup-screen">
            <div class="creation-card">
                <div class="creation-progress">
                    ${STEP_ORDER.map((s, i) => `<div class="creation-dot ${i < _creationStep ? 'done' : ''} ${i === _creationStep ? 'active' : ''}"></div>`).join('')}
                </div>
                <div class="creation-step-indicator">${_creationStep + 1} / ${STEP_ORDER.length}</div>
                <h2 class="creation-question">${step.title}</h2>
                <p class="creation-subtitle">${step.subtitle}</p>
                <div class="creation-options">
                    ${step.options.map(o => {
                        const demoLocked = DEMO && stepId === 'techRoute' && !DEMO.allowedRoutes.includes(o.id);
                        return `
                        <button class="creation-option ${currentChoice === o.id ? 'selected' : ''} ${demoLocked ? 'creation-option--locked' : ''}" data-id="${o.id}" ${demoLocked ? 'disabled' : `onclick="creationSelect('${stepId}','${o.id}')"`}>
                            <div class="creation-option__head">
                                <span style="${o.color ? 'color:'+o.color : ''}">${icon(o.icon, 20)}</span>
                                <span class="creation-option__label">${o.label}</span>
                                ${demoLocked ? `<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:auto">${t('common.full_version', '정식 버전')}</span>` : ''}
                            </div>
                            <div class="creation-option__desc">${o.desc}</div>
                            <div class="creation-option__effect">${icon('zap', 11)} ${o.effectText}</div>
                        </button>`;
                    }).join('')}
                </div>
                <div class="creation-stats-bar">
                    <span>${icon('funds', 13)} ${_fmtMoney(build.funds)}</span>
                    <span>${icon('gpu', 13)} ${build.gpu}</span>
                    <span>${icon('talent', 13)} ${build.talents}${t('creation.stat.people', '명')}</span>
                    <span>${icon('data', 13)} ${build.data}TB</span>
                    <span>${t('creation.stat.trust', '신뢰')} ${build.investorTrust}</span>
                    <span>${t('creation.stat.ownership', '지분')} ${build.ownershipPct}%</span>
                </div>
                <div class="creation-nav">
                    <button class="btn" onclick="creationBack()">${t('common.previous', '← 이전')}</button>
                    <button class="btn btn-primary ${currentChoice ? '' : 'menu-item--disabled'}" onclick="creationNext()" ${currentChoice ? '' : 'disabled'}>
                        ${_creationStep < STEP_ORDER.length - 1 ? t('common.next', '다음 →') : t('common.confirm', '확인')}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function _renderAvatar(size = 28) {
    if (_ceoAvatar?.startsWith('data:') || _ceoAvatar?.startsWith('http')) {
        return `<img src="${_ceoAvatar}" style="width:${size}px;height:${size}px;border-radius:50%;border:1px solid rgba(0,229,255,0.3);background:#1a2332;vertical-align:middle;">`;
    }
    return `<span style="font-size:${size * 0.7}px">${_ceoAvatar || '👨‍💼'}</span>`;
}

function _showSummary() {
    const build = _calcBuild();
    const country = COUNTRIES[selectedCountry];
    const cFlag = country?.flag || '';
    const cName = _localizedCountryName(country) || selectedCountry;
    const bonusTexts = [];
    if (country?.bonuses) {
        for (const [k, v] of Object.entries(country.bonuses)) {
            const pct = Math.round((v - 1) * 100);
            if (pct > 0) bonusTexts.push(`${_bonusLabel(k)} +${pct}%`);
        }
    }

    const stepLabels = STEP_ORDER.map(s => {
        const opt = CREATION_STEPS[s].options.find(o => o.id === _creationChoices[s]);
        return opt ? t(opt.labelKey, '—') : '—';
    });

    const app = document.getElementById('app');
    window.__agiMenuScreen = 'summary';
    app.innerHTML = `
        <div class="setup-screen">
            <div class="creation-card summary-card">
                <h2 class="creation-question" style="display:flex;align-items:center;justify-content:center;gap:10px">${_renderAvatar(40)} <span>${_companyName}</span></h2>
                <p class="creation-subtitle">${t('news.ceo_prefix', 'CEO {name}', { name: _ceoName })} · ${cFlag} ${cName}</p>

                <div class="summary-grid">
                    <div class="summary-row"><span class="summary-label">${t('company.ceo', 'CEO')}</span><span style="display:flex;align-items:center;gap:6px">${_renderAvatar(24)} ${_ceoName}</span></div>
                    <div class="summary-row"><span class="summary-label">${t('creation.summary.major', '전공')}</span><span>${stepLabels[0]}</span></div>
                    <div class="summary-row"><span class="summary-label">${t('creation.summary.career', '경력')}</span><span>${stepLabels[1]}</span></div>
                    <div class="summary-row"><span class="summary-label">${t('creation.summary.philosophy', '철학')}</span><span>${stepLabels[2]}</span></div>
                    <div class="summary-row"><span class="summary-label">${t('creation.summary.funding', '초기 자금원')}</span><span>${stepLabels[3]}</span></div>
                    <div class="summary-row"><span class="summary-label">${t('creation.summary.techRoute', '기술 노선')}</span><span>${stepLabels[4]}</span></div>
                </div>

                <div class="summary-stats">
                    <div class="summary-stat"><div class="summary-stat__val">${_fmtMoney(build.funds)}</div><div class="summary-stat__label">${t('creation.summary.funds', '자금')}</div></div>
                    <div class="summary-stat"><div class="summary-stat__val">${build.gpu}</div><div class="summary-stat__label">${t('creation.summary.gpu', 'GPU')}</div></div>
                    <div class="summary-stat"><div class="summary-stat__val">${build.talents}${t('creation.stat.people', '명')}</div><div class="summary-stat__label">${t('creation.summary.talents', '인재')}</div></div>
                    <div class="summary-stat"><div class="summary-stat__val">${build.data}TB</div><div class="summary-stat__label">${t('creation.summary.data', '데이터')}</div></div>
                    <div class="summary-stat"><div class="summary-stat__val">${build.investorTrust}</div><div class="summary-stat__label">${t('creation.summary.investor_trust', '투자자신뢰')}</div></div>
                    <div class="summary-stat"><div class="summary-stat__val">${build.ownershipPct}%</div><div class="summary-stat__label">${t('creation.summary.ownership', '지분율')}</div></div>
                </div>

                ${bonusTexts.length ? `<div class="summary-country-bonus">${cFlag} ${t('creation.summary.country_bonus', '국가 보너스')}: ${bonusTexts.join(', ')}</div>` : ''}

                <div class="creation-nav">
                    <button class="btn" onclick="creationBack()">${t('common.edit', '← 수정')}</button>
                    <button class="btn btn-primary btn-large" onclick="creationStart()">${t('common.start_game', '게임 시작')}</button>
                </div>
            </div>
        </div>
    `;
}

// ─── Expose creation functions ───
window.showMainMenu = showMainMenu;
window.showNewGameScreen = showNewGameScreen;
window.showGameScreen = showGameScreen;

async function _rerenderMenuScreen() {
    switch (window.__agiMenuScreen) {
        case 'name':
            _showNameStep();
            break;
        case 'country':
            _showCountryStep();
            break;
        case 'creation':
            _showCreationStep();
            break;
        case 'summary':
            _showSummary();
            break;
        case 'main':
        default:
            await showMainMenu();
            break;
    }
}

window.setLanguage = async function(lang) {
    const reopenSettingsTab = document.querySelector('#menu-modal .settings-modal')
        ? (window.__settingsModalTab || 'gameplay')
        : null;
    const current = _getCurrentSettings();
    const next = normalizeGameSettings({
        ...current,
        gameplay: {
            ...current.gameplay,
            locale: lang
        }
    });

    await setLocale(lang);
    document.documentElement.lang = getLocale();
    await _syncRuntimeSettings(next, { rerender: Boolean(window.game?.state?.gameStarted) });
    document.getElementById('menu-modal')?.remove();

    if (window.game?.state?.gameStarted) {
        const hadSaveModalOpen = document.getElementById('saveload-modal')?.classList.contains('show');
        const saveLoadMode = window.game._saveLoadMode || 'save';
        window.game.rerenderGameUi();
        if (hadSaveModalOpen) {
            await window.game._showSaveLoadModal(saveLoadMode);
        }
        if (reopenSettingsTab) {
            await window.menuShowSettings(reopenSettingsTab);
        }
        return;
    }

    await _rerenderMenuScreen();
    if (reopenSettingsTab) {
        await window.menuShowSettings(reopenSettingsTab);
    }
};

window._nameConfirmed = function() {
    const lastName = document.getElementById('ceo-last-name')?.value?.trim();
    const firstName = document.getElementById('ceo-first-name')?.value?.trim();
    const nationality = document.getElementById('ceo-nationality')?.value || 'kr';
    const name = document.getElementById('company-name')?.value?.trim();
    if (!lastName || !firstName) { alert(t('creation.ceo_name_required', 'CEO 성과 이름을 입력하세요.')); return; }
    if (!name) { alert(t('creation.company_name_required', '회사 이름을 입력하세요.')); return; }
    _ceoLastName = lastName;
    _ceoFirstName = firstName;
    _ceoName = `${lastName} ${firstName}`;
    _ceoNationality = nationality;
    _companyName = name;
    _creationStep = 0;
    _showCountryStep();
};

function _showCountryStep() {
    const miniBar = (val) => `<div style="flex:1;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden"><div style="width:${val*10}%;height:100%;background:var(--accent,#4fc3f7);border-radius:2px"></div></div>`;
    const app = document.getElementById('app');
    window.__agiMenuScreen = 'country';
    app.innerHTML = `
        <div class="setup-screen">
            <div class="creation-card" style="max-width:1000px">
                <div class="creation-step-indicator">${t('creation.country_step', '본사 선택')}</div>
                <h2 class="creation-question">${t('creation.country', '본사를 어디에 세울까요?')}</h2>
                <p class="creation-subtitle">${t('creation.country_sub', '"2017년, AI의 시대가 열리고 있습니다. 어디서 시작하시겠습니까?"')}</p>
                <div class="country-select country-select-wide">
                    ${PLAYABLE_COUNTRIES.map(c => {
                        const st = c.stats || {};
                        const bonuses = c.bonuses ? Object.entries(c.bonuses).map(([k,v]) => `${_bonusLabel(k)}+${Math.round((v-1)*100)}%`).join(', ') : '';
                        return `
                        <button class="country-option ${c.id === selectedCountry ? 'selected' : ''}" data-country="${c.id}" onclick="selectCountry('${c.id}')">
                            <span class="country-flag">${c.flag}</span>
                            <span class="country-name">${_localizedCountryName(c)}</span>
                            <div style="width:100%;display:flex;flex-direction:column;gap:2px;margin-top:4px">
                                <div style="display:flex;align-items:center;gap:4px;font-size:0.6rem;color:var(--text-secondary)"><span style="width:24px">${t('creation.stat.investment', '투자')}</span>${miniBar(st.investment||0)}</div>
                                <div style="display:flex;align-items:center;gap:4px;font-size:0.6rem;color:var(--text-secondary)"><span style="width:24px">${t('creation.stat.talent', '인재')}</span>${miniBar(st.talentPool||0)}</div>
                                <div style="display:flex;align-items:center;gap:4px;font-size:0.6rem;color:var(--text-secondary)"><span style="width:24px">${t('creation.stat.infrastructure', '인프라')}</span>${miniBar(st.infrastructure||0)}</div>
                            </div>
                            ${bonuses ? `<div style="font-size:0.55rem;color:var(--accent);margin-top:4px">${bonuses}</div>` : ''}
                        </button>`;
                    }).join('')}
                </div>
                <div class="creation-nav">
                    <button class="btn" onclick="_creationStep=0;_showNameStep()">${t('common.previous', '← 이전')}</button>
                    <button class="btn btn-primary" onclick="_showCreationStep()">${t('common.next', '다음 →')}</button>
                </div>
            </div>
        </div>
    `;
}
window._showCountryStep = _showCountryStep;
window._showCreationStep = _showCreationStep;
window._showNameStep = _showNameStep;
window.selectCeoAvatar = function(avatar) {
    _ceoName = document.getElementById('ceo-name')?.value?.trim() || _ceoName;
    _companyName = document.getElementById('company-name')?.value?.trim() || _companyName;
    _ceoAvatar = avatar;
    _showNameStep();
};

window.selectCountry = function(id) {
    selectedCountry = id;
    document.querySelectorAll('.country-option').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.country-option[data-country="${id}"]`)?.classList.add('selected');
};

window.creationSelect = function(stepId, optionId) {
    _creationChoices[stepId] = optionId;
    _showCreationStep(); // re-render to update selection + stats
};

window.creationNext = function() {
    _creationStep++;
    if (_creationStep >= STEP_ORDER.length) {
        _showSummary();
    } else {
        _showCreationStep();
    }
};

window.creationBack = function() {
    if (_creationStep > 0) {
        _creationStep--;
        _showCreationStep();
    } else {
        _showCountryStep();
    }
};

window.creationStart = async function() {
    const build = _calcBuild();
    const statsTracker = new StatsTracker();
    await statsTracker.ready;
    const allRuns = statsTracker.getStats()?.legacyRuns || [];
    // Only victories (non-loss endings) unlock legacy bonuses
    const LOSS_RESULTS = ['bankrupt', 'competitor_agi', 'unknown'];
    const previousRuns = allRuns.filter(run => !LOSS_RESULTS.includes(run.result));
    const beginGame = (legacyBonus = null) => {
        const finalBuild = {
            ...build,
            modifiers: { ...(build.modifiers || {}) },
            ceoName: _ceoName,
            ceoAvatar: _ceoAvatar,
            ceoNationality: _ceoNationality
        };

        if (legacyBonus) {
            finalBuild.legacyBonus = { ...legacyBonus };
            if (legacyBonus.id === 'open_source_pioneer') {
                finalBuild.legacyBonus.unlockTech = _pickLegacyUnlockTech(finalBuild.techRoute || 'llm');
            }
        }

        const game = new Game();
        showGameScreen();
        game.start(_companyName, selectedCountry, finalBuild);

        // Reset creation state
        _creationStep = 0;
        _creationChoices = {};
    };

    if (previousRuns.length > 0) {
        const choices = _getLegacyBonusChoices();
        _showLegacyBonusModal(previousRuns, (bonusId) => {
            const legacyBonus = choices.find(choice => choice.id === bonusId) || null;
            beginGame(legacyBonus);
        });
        return;
    }

    beginGame(null);
};

window.menuLoadGame = async function() {
    const sm = new SaveManager();
    const slots = await sm.listSlots();
    const autosave = await sm.getAutosaveInfo();
    const hasAnySave = slots.some(s => s.timestamp) || autosave;
    if (!hasAnySave) { alert(t('menu.no_save', '저장된 게임이 없습니다.')); return; }
    const game = new Game();
    showGameScreen();
    await game._showSaveLoadModal('load');
};

// ─── Menu Modals ───
function _showMenuModal(title, content, { maxWidth = 560, modalClass = '' } = {}) {
    // Remove any existing modal
    document.getElementById('menu-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'menu-modal';
    overlay.className = 'popup-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="popup-content ${modalClass}" style="max-width:${maxWidth}px">
            <h3>${title}</h3>
            ${content}
            <div class="popup-buttons" style="margin-top:16px">
                <button class="btn" onclick="document.getElementById('menu-modal')?.remove()">${t('common.close', '닫기')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 10);
}

function _installGlobalModalEscapeHandler() {
    if (window.__agiGlobalEscapeInstalled) return;
    window.__agiGlobalEscapeInstalled = true;

    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Escape') return;
        if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.tagName === 'SELECT') return;

        const popup = document.getElementById('popup');
        if (popup?.classList.contains('show')) {
            e.preventDefault();
            popup.classList.remove('show');
            return;
        }

        const menuModal = document.getElementById('menu-modal');
        if (menuModal) {
            e.preventDefault();
            menuModal.remove();
            return;
        }

        const legacyBonusModal = document.getElementById('legacy-bonus-modal');
        if (legacyBonusModal?.classList.contains('show')) {
            e.preventDefault();
            legacyBonusModal.remove();
            return;
        }

        if (!window.game?.state?.gameStarted) {
            const saveModal = document.getElementById('saveload-modal');
            if (saveModal?.classList.contains('show')) {
                e.preventDefault();
                saveModal.classList.remove('show');
            }
        }
    });
}

function _showLegacyBonusModal(previousRuns, onPick) {
    document.getElementById('legacy-bonus-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'legacy-bonus-modal';
    overlay.className = 'popup-overlay';
    overlay.onclick = (e) => {
        if (e.target === overlay) _completeLegacyBonusPick(null, onPick);
    };

    const recentRuns = (previousRuns || []).slice(0, 3).map(run => `
        <div class="legacy-run-card">
            <div class="legacy-run-card__title">${run.companyName || 'Unknown'} · ${run.grade || 'F'}</div>
            <div class="legacy-run-card__meta">${run.result || 'unknown'} · ${run.year || ''} · ${run.legacy || 'balanced_builder'}</div>
        </div>
    `).join('');

    const bonusChoices = _getLegacyBonusChoices();
    overlay.innerHTML = `
        <div class="popup-content" style="max-width:680px">
            <h3>${t('legacy.modal.title', '뉴게임+ 유산 선택')}</h3>
            <p style="color:var(--text-secondary);margin-bottom:14px">${t('legacy.modal.subtitle', '이전 회차의 성과가 다음 도전을 돕습니다. 하나를 골라 시작하세요.')}</p>
            ${recentRuns ? `<div class="legacy-runs">${recentRuns}</div>` : ''}
            <div class="legacy-bonus-grid">
                ${bonusChoices.map(choice => `
                    <button class="legacy-bonus-card" onclick="window.__pickLegacyBonus('${choice.id}')">
                        <div class="legacy-bonus-card__title">${choice.title}</div>
                        <div class="legacy-bonus-card__desc">${choice.desc}</div>
                    </button>
                `).join('')}
            </div>
            <div class="popup-buttons" style="margin-top:18px">
                <button class="btn" onclick="window.__pickLegacyBonus(null)">${t('legacy.modal.skip', '이번엔 건너뛰기')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    window.__pickLegacyBonus = (bonusId) => _completeLegacyBonusPick(bonusId, onPick);
    setTimeout(() => overlay.classList.add('show'), 10);
}

function _completeLegacyBonusPick(bonusId, onPick) {
    document.getElementById('legacy-bonus-modal')?.remove();
    delete window.__pickLegacyBonus;
    onPick?.(bonusId || null);
}

function _getSettingsShortcutRows() {
    return [
        ['Space', t('help.shortcut.pause', '일시정지 / 재개')],
        ['1-5', t('help.shortcut.speed', '게임 속도 조절')],
        ['+ / -', t('help.shortcut.adjust', '속도 올리기 / 내리기')],
        ['F1-F10', t('settings.shortcut_tabs', '주요 탭 전환')],
        ['F11', t('settings.shortcut_save', '저장 화면')],
        ['F12', t('settings.shortcut_load', '불러오기 화면')],
        ['Esc', t('settings.shortcut_escape', '패널 닫기 / 설정 열기')]
    ];
}

async function _getDisplaySettingsContext(settings) {
    const electronDisplay = window.electronAPI?.display;
    const fallbackResolution = {
        width: window.innerWidth || 1600,
        height: window.innerHeight || 900
    };

    if (!electronDisplay) {
        const width = window.screen?.availWidth || fallbackResolution.width;
        const height = window.screen?.availHeight || fallbackResolution.height;
        const baseResolutions = [
            { width: fallbackResolution.width, height: fallbackResolution.height },
            { width: 1280, height: 720 },
            { width: 1600, height: 900 },
            { width: 1920, height: 1080 },
            { width: 2560, height: 1440 }
        ].filter((entry) => entry.width <= width && entry.height <= height);
        const unique = new Map(baseResolutions.map((entry) => [`${entry.width}x${entry.height}`, entry]));
        return {
            isElectron: false,
            displayState: {
                mode: settings.display.mode,
                resolution: fallbackResolution
            },
            availableResolutions: [...unique.values()].map((entry) => ({
                value: `${entry.width}x${entry.height}`,
                label: `${entry.width} × ${entry.height}`
            }))
        };
    }

    const [displayState, availableResolutions] = await Promise.all([
        electronDisplay.getState?.(),
        electronDisplay.getResolutions?.()
    ]);

    return {
        isElectron: true,
        displayState: displayState || { mode: settings.display.mode, resolution: fallbackResolution },
        availableResolutions: Array.isArray(availableResolutions) ? availableResolutions : []
    };
}

async function _applyDisplayPreferencesToElectron(displaySettings) {
    const electronDisplay = window.electronAPI?.display;
    if (!electronDisplay) return null;

    const resolution = parseResolutionValue(displaySettings.resolution);
    if (resolution) {
        await electronDisplay.setResolution?.(resolution.width, resolution.height);
    }
    await electronDisplay.setMode?.(displaySettings.mode);
    return electronDisplay.getState?.();
}

window.menuShowSettings = async function(tab = window.__settingsModalTab || 'display') {
    const settings = _getCurrentSettings();
    window.__settingsModalTab = tab;
    const { isElectron, displayState, availableResolutions } = await _getDisplaySettingsContext(settings);
    const content = renderSettingsModalContent({
        activeTab: tab,
        settings,
        displayState,
        availableResolutions,
        localeSwitcherHtml: _localeSwitcherHtml(),
        shortcutRows: _getSettingsShortcutRows(),
        isElectron,
        showInGameActions: Boolean(window.game?.state?.gameStarted)
    });

    _showMenuModal(`${icon('settings', 18)} ${t('menu.settings', '설정')}`, content, {
        maxWidth: 860,
        modalClass: 'settings-modal-shell'
    });
};

window.switchSettingsTab = function(tab) {
    window.__settingsModalTab = tab || 'display';
    void window.menuShowSettings(window.__settingsModalTab);
};

window.updateUiScaleFromIndex = function(index) {
    const resolvedIndex = Math.max(0, Math.min(UI_SCALE_OPTIONS.length - 1, Number(index) || 0));
    const scale = UI_SCALE_OPTIONS[resolvedIndex];
    return window.updateGameSetting('display', 'uiScale', scale, 'number');
};

window.updateGameSetting = async function(section, key, rawValue, valueType = 'string') {
    const current = _getCurrentSettings();
    const next = normalizeGameSettings(current);
    let value = rawValue;
    if (valueType === 'number') value = Number(rawValue);
    if (valueType === 'boolean') value = rawValue === true || rawValue === 'true' || rawValue === '1';

    next[section] ||= {};
    next[section][key] = value;

    const modeChanged = section === 'display' && key === 'mode';
    const resolutionChanged = section === 'display' && key === 'resolution';
    const mapRendererChanged = section === 'display' && key === 'mapRenderer';

    const normalized = await _syncRuntimeSettings(next, { rerender: !mapRendererChanged });

    if (modeChanged || resolutionChanged) {
        await _applyDisplayPreferencesToElectron(normalized.display);
    }

    if (mapRendererChanged) {
        if (window.game?.setMapMode) {
            await window.game.setMapMode(normalized.display.mapRenderer);
        } else {
            _syncLegacySettingMirrors(normalized);
        }
    }

    await window.menuShowSettings(window.__settingsModalTab || section);
};

window.resetTutorialDone = async function() {
    await storageRemoveItem('agimanager_tutorial_done');
    if (window.game?.tutorial) window.game.tutorial._done = false;
    alert(t('settings.tutorial_reset_done', '튜토리얼이 초기화되었습니다.'));
};

window.menuShowHelp = function() {
    _showMenuModal(`${icon('lightbulb', 18)} ${t('menu.help', '도움말')}`, `
        <div style="margin-top:12px">
            <h4 style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">${t('help.shortcuts', '키보드 단축키')}</h4>
            <table class="help-table">
                <tr><td><kbd>Space</kbd></td><td>${t('help.shortcut.pause', '일시정지 / 재개')}</td></tr>
                <tr><td><kbd>1</kbd>~<kbd>5</kbd></td><td>${t('help.shortcut.speed', '게임 속도 조절')}</td></tr>
                <tr><td><kbd>+</kbd> / <kbd>-</kbd></td><td>${t('help.shortcut.adjust', '속도 올리기 / 내리기')}</td></tr>
            </table>
            <h4 style="font-size:0.85rem;color:var(--text-secondary);margin:12px 0 8px">${t('help.mechanics', '게임 메커니즘')}</h4>
            <ul style="font-size:0.82rem;color:var(--text-primary);line-height:1.7;padding-left:16px">
                <li><b>${t('game.research', '기술 연구')}</b> — ${t('help.mechanic.research', '인재를 기술에 배치하여 연구를 진행합니다')}</li>
                <li><b>${t('game.models', '모델')}</b> — ${t('help.mechanic.models', '아키텍처 선택 → 데이터 → 훈련 → 배포')}</li>
                <li><b>${t('help.economy_title', '경제')}</b> — ${t('help.mechanic.economy', '투자 유치, 모델 수익, GPU 시장 관리')}</li>
                <li><b>${t('help.competition_title', '경쟁')}</b> — ${t('help.mechanic.competition', '6개 경쟁사와 AGI 개발 경쟁')}</li>
                <li><b>${t('help.events_title', '이벤트')}</b> — ${t('help.mechanic.events', '역사적 사건에 대응하여 결정을 내립니다')}</li>
            </ul>
        </div>
    `);
};

window.menuShowCredits = function() {
    const year = new Date().getFullYear();
    _showMenuModal(`${icon('heart', 18)} ${t('menu.credits', '크레딧')}`, `
        <div style="text-align:center;margin-top:16px">
            <h2 style="font-family:var(--font-display);font-size:1.5rem;margin-bottom:4px">AGI Manager</h2>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:20px">${t('credits.subtitle', 'AI 스타트업 경영 시뮬레이션')}</p>

            <div style="color:var(--text-tertiary);font-size:0.8rem;line-height:1.8;margin-bottom:20px">
                <p style="font-size:0.9rem;color:var(--text-primary);font-weight:600;margin-bottom:8px">${t('credits.made_by', '— 제작 —')}</p>
                <p>${t('credits.planning', '기획 / 개발')} — <span style="color:var(--text-primary)">Mimir(미미르)</span></p>
                <p>${t('credits.ai_assistant', 'AI 어시스턴트')} — <span style="color:var(--text-primary)">Claude (Anthropic)</span></p>
            </div>

            <div style="color:var(--text-tertiary);font-size:0.75rem;line-height:1.8;margin-bottom:20px;padding-top:12px;border-top:1px solid var(--border)">
                <p style="font-size:0.82rem;color:var(--text-secondary);font-weight:600;margin-bottom:6px">${t('credits.tech_stack', '— 사용 기술 —')}</p>
                <p>${t('credits.engine', '엔진')} — Vanilla JavaScript (ES6 Modules)</p>
                <p>${t('credits.desktop', '데스크탑')} — <span style="color:var(--text-primary)">Electron</span> (Chromium + Node.js)</p>
                <p>${t('credits.sound', '사운드')} — Web Audio API (${t('credits.procedural_audio', '절차적 합성')})</p>
                <p>${t('credits.rendering', '렌더링')} — HTML5 / CSS3 / SVG</p>
            </div>

            <div style="color:var(--text-tertiary);font-size:0.75rem;line-height:1.8;margin-bottom:20px;padding-top:12px;border-top:1px solid var(--border)">
                <p style="font-size:0.82rem;color:var(--text-secondary);font-weight:600;margin-bottom:6px">${t('credits.licenses', '— 오픈소스 라이선스 —')}</p>
                <p>${t('credits.icons', '아이콘')} — <span style="color:var(--text-primary)">Lucide Icons</span> (ISC License)</p>
                <p>${t('credits.fonts', '폰트')} — <span style="color:var(--text-primary)">Exo 2, Inter, JetBrains Mono</span> (OFL)</p>
                <p>${t('credits.korean_fonts', '한국어 폰트')} — <span style="color:var(--text-primary)">Noto Sans KR</span> (OFL, Google)</p>
                <p>${t('credits.map_data', '지도 데이터')} — <span style="color:var(--text-primary)">Natural Earth</span> (Public Domain)</p>
                <p>TopoJSON — <span style="color:var(--text-primary)">world-atlas</span> (Mike Bostock, ISC)</p>
            </div>

            <div style="padding-top:12px;border-top:1px solid var(--border);font-size:0.7rem;color:var(--text-tertiary);line-height:1.6">
                <p>&copy; ${year} Mimir. All rights reserved.</p>
                <p>${t('credits.disclaimer', '이 게임에 등장하는 회사명 및 기술명은 실제와 다르며, 교육/오락 목적으로 사용되었습니다.')}</p>
                <p style="margin-top:8px;font-family:var(--font-mono);font-size:0.65rem;color:var(--text-tertiary)">v${VERSION} | Built with ❤️ and AI</p>
            </div>
        </div>
    `);
};

window.menuShowAchievements = async function() {
    const achievements = window.game?.achievements || new AchievementSystem();
    await achievements.ready;
    const summary = achievements.getSummary();
    const rows = achievements.getAll().map(a => `
        <div class="achievement-row ${a.unlocked ? 'achievement-row--unlocked' : ''}">
            <div class="achievement-row__icon">${icon(a.unlocked ? 'trophy' : 'lock', 16)}</div>
            <div class="achievement-row__body">
                <div class="achievement-row__name">${a.unlocked ? a.name : '???'}</div>
                <div class="achievement-row__desc">${a.desc}</div>
            </div>
            <div class="achievement-row__status">${a.unlocked ? (a.gameDate || t('achievements.unlocked', '달성')) : t('achievements.locked', '미달성')}</div>
        </div>
    `).join('');

    _showMenuModal(`${icon('trophy', 18)} ${t('menu.achievements', '업적')}`, `
        <div class="achievement-summary">
            <div class="achievement-summary__score">${summary.unlocked} / ${summary.total}</div>
            <div class="achievement-summary__label">${t('achievements.summary', '달성한 업적')}</div>
        </div>
        <div class="achievement-list">
            ${rows}
        </div>
    `);
};

window.menuShowStats = async function() {
    const tracker = window.game?.stats || new StatsTracker();
    await tracker.ready;
    if (window.game?.state?.gameStarted) await tracker.updateSnapshot(window.game.state);
    const stats = tracker.getStats();
    const routeLabel = ROUTE_INFO[stats.favoriteRoute]?.name || stats.favoriteRoute || '-';
    const countryLabel = _localizedCountryName(COUNTRIES[stats.favoriteCountry]) || stats.favoriteCountry || '-';
    const fmtMoney = (v) => v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`;
    const totalWins = Object.values(stats.victories || {}).reduce((a, b) => a + b, 0);
    const totalLosses = Object.values(stats.defeats || {}).reduce((a, b) => a + b, 0);

    _showMenuModal(`${icon('barChart', 18)} ${t('menu.stats', '통계')}`, `
        <div class="stats-grid">
            <div class="stats-card"><span>${t('stats.games_played', '플레이한 게임')}</span><strong>${stats.gamesPlayed}</strong></div>
            <div class="stats-card"><span>${t('stats.play_time', '총 플레이 시간')}</span><strong>${stats.totalPlayTimeMinutes}${t('stats.minutes', '분')}</strong></div>
            <div class="stats-card"><span>${t('stats.highest_score', '최고 점수')}</span><strong>${stats.highestScore}</strong></div>
            <div class="stats-card"><span>${t('stats.best_grade', '최고 등급')}</span><strong>${stats.bestGrade}</strong></div>
            <div class="stats-card"><span>${t('stats.highest_valuation', '최고 기업가치')}</span><strong>${fmtMoney(stats.highestValuation)}</strong></div>
            <div class="stats-card"><span>${t('stats.techs_researched', '완료 기술')}</span><strong>${stats.techsResearched}</strong></div>
            <div class="stats-card"><span>${t('stats.models_deployed', '배포 모델')}</span><strong>${stats.modelsDeployed}</strong></div>
            <div class="stats-card"><span>${t('stats.best_round', '최고 투자 단계')}</span><strong>${stats.fundingRoundsCompleted}</strong></div>
            <div class="stats-card"><span>${t('stats.wins_losses', '승리 / 패배')}</span><strong>${totalWins} / ${totalLosses}</strong></div>
            <div class="stats-card"><span>${t('stats.favorite_route', '선호 노선')}</span><strong>${routeLabel}</strong></div>
            <div class="stats-card"><span>${t('stats.favorite_country', '선호 국가')}</span><strong>${countryLabel}</strong></div>
        </div>
    `);
};

function showGameScreen() {
    _destroyBgGlobe(); // 배경 지구본 제거 — 인게임 지구본으로 교체됨
    _syncDocumentSettings(_getCurrentSettings());
    const app = document.getElementById('app');
    app.innerHTML = `
            <div class="game-container game-container--legacy">
                <div id="world-map-bg" class="world-map-bg"></div>
                <div class="crt-overlay"></div>
                <div id="top-bar" class="top-bar"></div>
                <div class="game-body">
                    <nav class="sidebar">
                        <button class="nav-btn active" data-tab="map" data-tooltip="${t('game.map', '지도')}" onclick="game.switchTab('map')">
                            ${icon('map', 20)}<span class="nav-label">${t('game.map', '지도')}</span>
                        </button>
                        <button class="nav-btn" data-tab="company" data-tooltip="${t('game.company', '회사')}" onclick="game.switchTab('company')">
                            ${icon('company', 20)}<span class="nav-label">${t('game.company', '회사')}</span>
                        </button>
                        <button class="nav-btn" data-tab="research" data-tooltip="${t('game.research', '기술 연구')}" onclick="game.switchTab('research')">
                            ${icon('research', 20)}<span class="nav-label">${t('game.research', '기술 연구')}</span>
                        </button>
                        <button class="nav-btn" data-tab="talent" data-tooltip="${t('game.talent', '인재')}" onclick="game.switchTab('talent')">
                            ${icon('talent', 20)}<span class="nav-label">${t('game.talent', '인재')}</span><span class="nav-badge" id="badge-talent"></span>
                        </button>
                        <button class="nav-btn" data-tab="models" data-tooltip="${t('game.models', '모델')}" onclick="game.switchTab('models')">
                            ${icon('model', 20)}<span class="nav-label">${t('game.models', '모델')}</span><span class="nav-badge" id="badge-models"></span>
                        </button>
                        <button class="nav-btn" data-tab="gpu" data-tooltip="${t('game.gpu', 'GPU')}" onclick="game.switchTab('gpu')">
                            ${icon('gpu', 20)}<span class="nav-label">${t('game.gpu', 'GPU')}</span>
                        </button>
                        <button class="nav-btn" data-tab="data" data-tooltip="${t('game.data', '데이터')}" onclick="game.switchTab('data')">
                            ${icon('data', 20)}<span class="nav-label">${t('game.data', '데이터')}</span>
                        </button>
                        <button class="nav-btn" data-tab="leaderboard" data-tooltip="${t('game.leaderboard', '리더보드')}" onclick="game.switchTab('leaderboard')">
                            ${icon('trophy', 20)}<span class="nav-label">${t('game.leaderboard', '리더보드')}</span>
                        </button>
                        <button class="nav-btn" data-tab="world" data-tooltip="${t('game.world', '세계')}" onclick="game.switchTab('world')">
                            ${icon('globe', 20)}<span class="nav-label">${t('game.world', '세계')}</span>
                        </button>
                        <button class="nav-btn" data-tab="news" data-tooltip="${t('game.news', '뉴스')}" onclick="game.switchTab('news')">
                            ${icon('news', 20)}<span class="nav-label">${t('game.news', '뉴스')}</span><span class="nav-badge" id="badge-news"></span>
                        </button>
                        <div class="sidebar-spacer"></div>
                        <button class="nav-btn save-btn" data-tooltip="${t('menu.settings', '설정')}" onclick="game._showInGameSettings()">${icon('settings', 20)}</button>
                    </nav>
                    <div id="content-panel" class="content-panel hidden"></div>
                    <div id="right-panel" class="right-panel"></div>
                </div>
                <div id="bottom-log" class="bottom-log"></div>
                <div id="pause-overlay" class="pause-overlay show">
                    <div class="pause-badge">${icon('pause', 14)} ${t('game.paused', 'PAUSED')}</div>
                </div>
                <div id="popup" class="popup-overlay"></div>
            </div>
        `;
    // initStickyInfoBar(document.body); // 하단 패널 → TopBar에 통합됨
}

// Start — handle both cases: module loaded before or after DOMContentLoaded
if (typeof document !== 'undefined') {
    _syncDocumentSettings(loadGameSettingsSync(), document);
}

async function showSplashThenMenu() {
    const app = document.getElementById('app');

    // 스플래시 CSS 주입
    if (!document.getElementById('splash-css')) {
        const style = document.createElement('style');
        style.id = 'splash-css';
        style.textContent = `
            .splash { position:fixed; inset:0; background:#020408; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; }
            .splash-logo { opacity:0; transition: opacity 0.8s ease; }
            .splash-logo.show { opacity:1; }
            .splash-logo.hide { opacity:0; transition: opacity 0.6s ease; }
            .splash-title { font-family: var(--font-display, 'Orbitron', sans-serif); font-size: 2.2rem; font-weight: 800; letter-spacing: 6px; color: #00e5ff; margin-top: 16px; opacity:0; transition: opacity 0.8s ease 0.3s; }
            .splash-title.show { opacity:1; }
            .splash-title.hide { opacity:0; transition: opacity 0.6s ease; }
            .splash-sub { font-size: 0.75rem; color: rgba(148,163,184,0.6); margin-top: 8px; letter-spacing: 2px; opacity:0; transition: opacity 0.8s ease 0.6s; }
            .splash-sub.show { opacity:1; }
            .splash-sub.hide { opacity:0; transition: opacity 0.5s ease; }
        `;
        document.head.appendChild(style);
    }

    // 스플래시 HTML
    const splash = document.createElement('div');
    splash.className = 'splash';
    splash.innerHTML = `
        <div class="splash-logo" id="splash-logo">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="36" stroke="#00e5ff" stroke-width="2" fill="none" opacity="0.3"/>
                <circle cx="40" cy="40" r="24" stroke="#00e5ff" stroke-width="1.5" fill="none" opacity="0.5"/>
                <circle cx="40" cy="40" r="12" fill="#00e5ff" opacity="0.8"/>
                <circle cx="40" cy="40" r="5" fill="#020408"/>
            </svg>
        </div>
        <div class="splash-title" id="splash-title">MIMIR</div>
        <div class="splash-sub" id="splash-sub">미미르 스튜디오</div>
    `;
    document.body.appendChild(splash);

    // 페이드인
    await new Promise(r => setTimeout(r, 100));
    document.getElementById('splash-logo')?.classList.add('show');
    document.getElementById('splash-title')?.classList.add('show');
    document.getElementById('splash-sub')?.classList.add('show');

    // 2초 표시
    await new Promise(r => setTimeout(r, 2500));

    // 페이드아웃
    document.getElementById('splash-logo')?.classList.add('hide');
    document.getElementById('splash-title')?.classList.add('hide');
    document.getElementById('splash-sub')?.classList.add('hide');
    await new Promise(r => setTimeout(r, 800));
    splash.remove();

    // ── 면책 조항 / 알파 경고 화면 ──
    const disclaimer = document.createElement('div');
    disclaimer.className = 'splash';
    disclaimer.style.cssText += 'cursor:pointer;';
    disclaimer.innerHTML = `
        <div style="max-width:620px;text-align:center;padding:0 24px;">
            <div style="font-family:var(--font-display,'Orbitron',sans-serif);font-size:1.1rem;font-weight:700;color:#00e5ff;letter-spacing:3px;margin-bottom:24px;opacity:0;transition:opacity 0.8s ease;" id="disc-badge">ALPHA BUILD</div>

            <p style="color:#e2e8f0;font-size:0.85rem;line-height:1.8;margin-bottom:18px;opacity:0;transition:opacity 0.8s ease 0.2s;" id="disc-1">
                본 게임은 현재 개발 중인 <span style="color:#00e5ff;font-weight:600;">알파(Alpha)</span> 버전입니다.<br>
                예기치 않은 버그, 크래시, 성능 저하가 발생할 수 있으며,<br>
                향후 업데이트 시 세이브 파일이 호환되지 않을 수 있습니다.
            </p>

            <p style="color:#94a3b8;font-size:0.78rem;line-height:1.7;margin-bottom:18px;opacity:0;transition:opacity 0.8s ease 0.4s;" id="disc-2">
                본 게임에 등장하는 인물, 기업, 단체, 사건 및 AGI 기술은 모두<br>
                <span style="color:#e2e8f0;">개발자의 상상에 기반한 허구(Fiction)</span>입니다.<br>
                실존하는 명칭, 인물, 사건과 어떠한 관련도 없으며,<br>
                유사성이 있다면 이는 우연의 일치입니다.
            </p>

            <p style="color:#94a3b8;font-size:0.72rem;line-height:1.7;margin-bottom:24px;opacity:0;transition:opacity 0.8s ease 0.6s;" id="disc-3">
                💾 게임은 5분마다 자동 저장됩니다.<br>
                저장 중에는 게임을 종료하지 마십시오.
            </p>

            <p style="color:#475569;font-size:0.65rem;margin-bottom:28px;opacity:0;transition:opacity 0.8s ease 0.8s;" id="disc-copy">
                Copyright © 2026 Mimir Studio. All rights reserved.
            </p>

            <div style="color:#475569;font-size:0.7rem;opacity:0;transition:opacity 0.8s ease 1.0s;animation:pulse 2s ease-in-out infinite;" id="disc-continue">
                아무 곳이나 클릭하여 계속
            </div>
        </div>
    `;
    document.body.appendChild(disclaimer);

    // 순차 페이드인
    await new Promise(r => setTimeout(r, 100));
    ['disc-badge','disc-1','disc-2','disc-3','disc-copy','disc-continue'].forEach(id => {
        document.getElementById(id)?.style.setProperty('opacity', '1');
    });

    // 클릭 또는 키 입력으로 닫기
    await new Promise(resolve => {
        const handler = () => { resolve(); disclaimer.removeEventListener('click', handler); document.removeEventListener('keydown', handler); };
        disclaimer.addEventListener('click', handler);
        document.addEventListener('keydown', handler);
    });

    // 페이드아웃
    disclaimer.style.transition = 'opacity 0.5s ease';
    disclaimer.style.opacity = '0';
    await new Promise(r => setTimeout(r, 500));
    disclaimer.remove();

    await showMainMenu();
}

if (document.readyState === 'loading') {
    _installGlobalModalEscapeHandler();
    document.addEventListener('DOMContentLoaded', showSplashThenMenu);
} else {
    _installGlobalModalEscapeHandler();
    showSplashThenMenu();
}
