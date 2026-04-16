import { t } from '../i18n.js';
import { AUTOSAVE_INTERVAL_OPTIONS, UI_SCALE_OPTIONS, formatResolutionLabel } from '../game/GameSettings.js';

const SETTINGS_TABS = Object.freeze([
    { id: 'display', icon: '🖥️', labelKey: 'settings.tab.display', fallback: '디스플레이' },
    { id: 'audio', icon: '🎵', labelKey: 'settings.tab.audio', fallback: '오디오' },
    { id: 'gameplay', icon: '⚙️', labelKey: 'settings.tab.gameplay', fallback: '게임플레이' },
    { id: 'controls', icon: '⌨️', labelKey: 'settings.tab.controls', fallback: '조작' }
]);

function isActiveTab(activeTab, tabId) {
    return (activeTab || 'display') === tabId;
}

function uiScaleIndex(value) {
    const index = UI_SCALE_OPTIONS.indexOf(Number(value));
    return index >= 0 ? index : UI_SCALE_OPTIONS.indexOf(100);
}

function renderResolutions(resolutions = [], currentValue = 'auto') {
    const rows = [{ value: 'auto', label: t('settings.resolution_auto', '현재 창 크기') }, ...resolutions];
    return rows.map((option) => {
        const value = option.value || 'auto';
        const label = option.label || formatResolutionLabel(option.width, option.height);
        return `<option value="${value}" ${value === currentValue ? 'selected' : ''}>${label}</option>`;
    }).join('');
}

function renderTabButtons(activeTab) {
    return SETTINGS_TABS.map((tab) => `
        <button
            class="company-subtab ${isActiveTab(activeTab, tab.id) ? 'company-subtab--active' : ''}"
            data-settings-tab="${tab.id}"
            onclick="switchSettingsTab('${tab.id}')"
        >
            <span>${tab.icon}</span>
            <span>${t(tab.labelKey, tab.fallback)}</span>
        </button>
    `).join('');
}

function renderShortcutRows(rows = []) {
    return rows.map(([key, description]) => `
        <tr>
            <td><kbd>${key}</kbd></td>
            <td>${description}</td>
        </tr>
    `).join('');
}

export function renderSettingsModalContent({
    activeTab = 'display',
    settings,
    displayState = {},
    availableResolutions = [],
    localeSwitcherHtml = '',
    shortcutRows = [],
    isElectron = false,
    showInGameActions = false
}) {
    const tab = SETTINGS_TABS.some((entry) => entry.id === activeTab) ? activeTab : 'display';
    const resolutionValue = settings.display.resolution === 'auto'
        ? 'auto'
        : settings.display.resolution;
    const currentResolution = displayState.resolution
        ? `${displayState.resolution.width} × ${displayState.resolution.height}`
        : t('settings.resolution_unknown', '알 수 없음');

    return `
        <div class="settings-modal">
            <div class="company-subtabs settings-tabs">
                ${renderTabButtons(tab)}
            </div>

            <div class="settings-body">
                <section class="settings-panel ${tab === 'display' ? 'settings-panel--active' : ''}" data-settings-panel="display">
                    <div class="settings-group">
                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.display_mode', '디스플레이 모드')}</div>
                                <div class="settings-note">${t('settings.display_mode_desc', '창 모드, 전체화면, 테두리 없는 창을 전환합니다.')}</div>
                            </div>
                            <div class="settings-control display-mode">
                                <button class="btn btn-small ${settings.display.mode === 'windowed' ? 'btn-primary' : ''}" onclick="updateGameSetting('display', 'mode', 'windowed')">${t('settings.mode_windowed', '창 모드')}</button>
                                <button class="btn btn-small ${settings.display.mode === 'fullscreen' ? 'btn-primary' : ''}" onclick="updateGameSetting('display', 'mode', 'fullscreen')">${t('settings.mode_fullscreen', '전체화면')}</button>
                                <button class="btn btn-small ${settings.display.mode === 'borderless' ? 'btn-primary' : ''}" onclick="updateGameSetting('display', 'mode', 'borderless')">${t('settings.mode_borderless', '테두리 없는 창')}</button>
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.resolution', '해상도')}</div>
                                <div class="settings-note">${t('settings.resolution_desc', '사용 가능한 해상도를 적용합니다. 현재 창: {value}', { value: currentResolution })}</div>
                            </div>
                            <div class="settings-control">
                                <select id="resolution-select" class="settings-select" onchange="updateGameSetting('display', 'resolution', this.value)">
                                    ${renderResolutions(availableResolutions, resolutionValue)}
                                </select>
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.ui_scale', 'UI 크기')}</div>
                                <div class="settings-note">${t('settings.ui_scale_desc', '75%부터 150%까지 인터페이스 크기를 조절합니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <div class="settings-slider-meta"><strong>${settings.display.uiScale}%</strong></div>
                                <input id="ui-scale-slider" type="range" min="0" max="${UI_SCALE_OPTIONS.length - 1}" step="1" value="${uiScaleIndex(settings.display.uiScale)}" oninput="updateUiScaleFromIndex(this.value)">
                                <div class="settings-scale-labels">${UI_SCALE_OPTIONS.map((value) => `<span>${value}%</span>`).join('')}</div>
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.map_renderer', '지도 렌더러')}</div>
                                <div class="settings-note">${t('settings.map_mode_desc', '브라우저/기기 상태에 따라 3D가 자동으로 2D로 대체될 수 있습니다.')}</div>
                            </div>
                            <div class="settings-control">
                                <button class="btn btn-small ${settings.display.mapRenderer === 'globe' ? 'btn-primary' : ''}" onclick="updateGameSetting('display', 'mapRenderer', 'globe')">${t('settings.map_mode_globe', 'Globe 3D')}</button>
                                <button class="btn btn-small ${settings.display.mapRenderer === 'webgl' ? 'btn-primary' : ''}" onclick="updateGameSetting('display', 'mapRenderer', 'webgl')">${t('settings.map_mode_webgl', 'Flat 3D')}</button>
                                <button class="btn btn-small ${settings.display.mapRenderer === 'svg' ? 'btn-primary' : ''}" onclick="updateGameSetting('display', 'mapRenderer', 'svg')">${t('settings.map_mode_svg', '2D SVG')}</button>
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.motion_profile', '시각 효과')}</div>
                                <div class="settings-note">${t('settings.motion_profile_desc', '자동 회전, 글리치, 배경 애니메이션을 줄입니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <label class="settings-checkbox">
                                    <input type="checkbox" ${settings.display.reducedMotion ? 'checked' : ''} onchange="updateGameSetting('display', 'reducedMotion', this.checked, 'boolean')">
                                    ${t('settings.reduced_motion', '배경 애니메이션 끄기')}
                                </label>
                                <label class="settings-checkbox">
                                    <input type="checkbox" ${settings.display.highContrast ? 'checked' : ''} onchange="updateGameSetting('display', 'highContrast', this.checked, 'boolean')">
                                    ${t('settings.high_contrast', '고대비 모드')}
                                </label>
                                <label class="settings-checkbox settings-checkbox--disabled">
                                    <input type="checkbox" ${settings.display.vsync ? 'checked' : ''} disabled>
                                    ${t('settings.vsync_enabled', 'V-Sync (기본 활성화)')}
                                </label>
                                ${!isElectron ? `<div class="settings-note settings-note--inline">${t('settings.display_browser_note', '브라우저 실행에서는 창 모드/해상도 적용이 제한됩니다.')}</div>` : ''}
                            </div>
                        </div>
                    </div>
                </section>

                <section class="settings-panel ${tab === 'audio' ? 'settings-panel--active' : ''}" data-settings-panel="audio">
                    <div class="settings-group">
                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.sound_master', '마스터')}</div>
                                <div class="settings-note">${t('settings.sound_master_desc', '전체 오디오 출력의 기준이 됩니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <div class="settings-slider-meta"><strong>${settings.audio.master}</strong></div>
                                <input id="master-volume-slider" type="range" min="0" max="100" step="1" value="${settings.audio.master}" oninput="updateGameSetting('audio', 'master', this.value, 'number')">
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.music', '배경음악')}</div>
                                <div class="settings-note">${t('settings.music_desc', '절차적 앰비언트 음악 레이어 볼륨입니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <div class="settings-slider-meta"><strong>${settings.audio.music}</strong></div>
                                <input id="music-volume-slider" type="range" min="0" max="100" step="1" value="${settings.audio.music}" oninput="updateGameSetting('audio', 'music', this.value, 'number')">
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.sfx', '효과음')}</div>
                                <div class="settings-note">${t('settings.sfx_desc', 'UI, 이벤트, 연구 완료 효과음에 적용됩니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <div class="settings-slider-meta"><strong>${settings.audio.sfx}</strong></div>
                                <input id="sfx-volume-slider" type="range" min="0" max="100" step="1" value="${settings.audio.sfx}" oninput="updateGameSetting('audio', 'sfx', this.value, 'number')">
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.mute_on_blur', '백그라운드 시 음소거')}</div>
                                <div class="settings-note">${t('settings.mute_on_blur_desc', '창이 비활성화되면 오디오를 자동으로 줄입니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <label class="settings-checkbox">
                                    <input type="checkbox" ${settings.audio.muteOnBlur ? 'checked' : ''} onchange="updateGameSetting('audio', 'muteOnBlur', this.checked, 'boolean')">
                                    ${t('settings.mute_on_blur', '백그라운드 시 음소거')}
                                </label>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="settings-panel ${tab === 'gameplay' ? 'settings-panel--active' : ''}" data-settings-panel="gameplay">
                    <div class="settings-group">
                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.language', '언어')}</div>
                                <div class="settings-note">${t('settings.language_desc', 'UI와 이벤트 텍스트에 사용할 언어를 선택합니다.')}</div>
                            </div>
                            <div class="settings-control">
                                ${localeSwitcherHtml}
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.autosave_interval', '자동 저장 간격')}</div>
                                <div class="settings-note">${t('settings.autosave_interval_desc', '캠페인 진행 속도와 선호에 맞게 자동 저장 간격을 설정합니다.')}</div>
                            </div>
                            <div class="settings-control">
                                <select id="autosave-interval-select" class="settings-select" onchange="updateGameSetting('gameplay', 'autosaveInterval', this.value)">
                                    ${AUTOSAVE_INTERVAL_OPTIONS.map((value) => `<option value="${value}" ${settings.gameplay.autosaveInterval === value ? 'selected' : ''}>${t(`settings.autosave.${value}`, value)}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.auto_pause_events', '이벤트 자동 일시정지')}</div>
                                <div class="settings-note">${t('settings.auto_pause_events_desc', '중요 이벤트가 뜰 때 시간을 멈출지 선택합니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <label class="settings-checkbox">
                                    <input type="checkbox" ${settings.gameplay.autoPauseOnEvent ? 'checked' : ''} onchange="updateGameSetting('gameplay', 'autoPauseOnEvent', this.checked, 'boolean')">
                                    ${t('settings.auto_pause_events', '이벤트 자동 일시정지')}
                                </label>
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.tooltip_delay', '툴팁 표시 지연')}</div>
                                <div class="settings-note">${t('settings.tooltip_delay_desc', '단어/수치 툴팁이 나타나기 전 대기 시간을 조절합니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <div class="settings-slider-meta"><strong>${settings.gameplay.tooltipDelay}ms</strong></div>
                                <input id="tooltip-delay-slider" type="range" min="0" max="1000" step="50" value="${settings.gameplay.tooltipDelay}" oninput="updateGameSetting('gameplay', 'tooltipDelay', this.value, 'number')">
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.reset_tutorial', '튜토리얼 초기화')}</div>
                                <div class="settings-note">${t('settings.reset_tutorial_desc', '도입 튜토리얼을 처음부터 다시 볼 수 있습니다.')}</div>
                            </div>
                            <div class="settings-control">
                                <button class="btn btn-small" onclick="resetTutorialDone()">${t('settings.reset_tutorial', '튜토리얼 초기화')}</button>
                            </div>
                        </div>

                        ${showInGameActions ? `
                            <div class="settings-row settings-row--actions">
                                <button class="btn btn-small" onclick="if(confirm('${t('settings.quit_confirm', '메인 메뉴로 돌아갑니다. 저장하지 않은 진행은 사라집니다.')}')) { document.getElementById('menu-modal')?.remove(); showMainMenu(); }">${t('settings.main_menu', '메인 메뉴로')}</button>
                                <button class="btn btn-small" style="border-color:rgba(239,68,68,0.3);color:#ef4444" onclick="if(confirm('${t('settings.quit_game_confirm', '게임을 종료하시겠습니까?')}')) { window.electronAPI?.app?.quit?.() || window.close?.(); }">${t('settings.quit_game', '게임 종료')}</button>
                            </div>
                        ` : ''}
                    </div>
                </section>

                <section class="settings-panel ${tab === 'controls' ? 'settings-panel--active' : ''}" data-settings-panel="controls">
                    <div class="settings-group">
                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.edge_pan', '마우스 가장자리 이동')}</div>
                                <div class="settings-note">${t('settings.edge_pan_desc', '지구본에서 커서를 화면 가장자리로 가져가면 카메라가 이동합니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <label class="settings-checkbox">
                                    <input id="edge-pan-toggle" type="checkbox" ${settings.controls.edgePan ? 'checked' : ''} onchange="updateGameSetting('controls', 'edgePan', this.checked, 'boolean')">
                                    ${t('settings.edge_pan', '마우스 가장자리 이동')}
                                </label>
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.zoom_speed', '줌 속도')}</div>
                                <div class="settings-note">${t('settings.zoom_speed_desc', '휠/핀치 확대 축소 감도를 조절합니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <div class="settings-slider-meta"><strong>${settings.controls.zoomSpeed.toFixed(1)}×</strong></div>
                                <input id="zoom-speed-slider" type="range" min="0.3" max="2.0" step="0.1" value="${settings.controls.zoomSpeed}" oninput="updateGameSetting('controls', 'zoomSpeed', this.value, 'number')">
                            </div>
                        </div>

                        <div class="settings-row">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.pan_speed', '팬 속도')}</div>
                                <div class="settings-note">${t('settings.pan_speed_desc', '드래그 회전과 edge pan 속도를 함께 조절합니다.')}</div>
                            </div>
                            <div class="settings-control settings-control--stacked">
                                <div class="settings-slider-meta"><strong>${settings.controls.panSpeed.toFixed(1)}×</strong></div>
                                <input id="pan-speed-slider" type="range" min="0.3" max="2.0" step="0.1" value="${settings.controls.panSpeed}" oninput="updateGameSetting('controls', 'panSpeed', this.value, 'number')">
                            </div>
                        </div>

                        <div class="settings-row settings-row--table">
                            <div class="settings-copy">
                                <div class="settings-label">${t('settings.shortcuts', '단축키 안내')}</div>
                                <div class="settings-note">${t('settings.shortcuts_desc', '현재 고정된 단축키 요약입니다. 변경 기능은 차후 버전에서 지원합니다.')}</div>
                            </div>
                            <div class="settings-control">
                                <table class="help-table shortcut-table">
                                    ${renderShortcutRows(shortcutRows)}
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    `;
}
