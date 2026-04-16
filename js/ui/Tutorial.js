/**
 * Interactive Tutorial System
 *
 * - 시작 시 진행 여부 확인
 * - 실제 조작을 안내하며 완료를 기다림 (waitFor 조건)
 * - UI 요소 하이라이트 + 말풍선
 */

import { t } from '../i18n.js';
import { storageGetItem, storageRemoveItem, storageSetItem } from '../utils/storage.js';

const TUTORIAL_KEY = 'agimanager_tutorial_done';

export const TUTORIAL_STEPS = [
    {
        id: 'welcome',
        messageKey: 'tutorial.step.welcome',
        messageFallback: '환영합니다, CEO님!\n이 튜토리얼에서는 실제로 게임을 조작하면서 기본적인 흐름을 배웁니다.',
        position: 'center',
        btnKey: 'tutorial.start_button',
        btnFallback: '시작하기'
    },
    {
        id: 'topbar_explain',
        target: '#top-bar',
        messageKey: 'tutorial.step.topbar_explain',
        messageFallback: '상단 바에서 자금, GPU, 인재, 기업가치를 확인할 수 있습니다.\n자금이 0이 되면 파산합니다!',
        position: 'bottom'
    },
    {
        id: 'go_research',
        target: '.nav-btn[data-tab="research"]',
        messageKey: 'tutorial.step.go_research',
        messageFallback: '먼저 기술 연구를 시작해야 합니다.\n연구 탭을 클릭하세요.',
        position: 'right',
        waitFor: () => window.game?.currentTab === 'research',
        allowClick: '.nav-btn[data-tab="research"]'
    },
    {
        id: 'research_explain',
        messageKey: 'tutorial.step.research_explain',
        messageFallback: '기술 연구 화면입니다.\n계열별 탭으로 기술을 분류하고, "연구 가능" 표시된 기술을 클릭하면 인재를 배치하여 연구를 시작합니다.\n\n지금 연구 가능한 기술 하나를 클릭해서 연구를 시작해보세요.',
        position: 'center',
        waitFor: () => {
            const techs = window.game?.state?.technologies;
            return techs && Object.values(techs).some(t => t.researching);
        }
    },
    {
        id: 'research_started',
        messageKey: 'tutorial.step.research_started',
        messageFallback: '연구가 시작되었습니다!\n인재가 배치되면 매일 자동으로 연구가 진행됩니다.\n연구 중인 기술을 클릭하면 인재를 추가/제거할 수 있습니다.',
        position: 'center'
    },
    {
        id: 'go_talent',
        target: '.nav-btn[data-tab="talent"]',
        messageKey: 'tutorial.step.go_talent',
        messageFallback: '다음은 인재 관리입니다.\n인재 탭을 클릭하세요.',
        position: 'right',
        waitFor: () => window.game?.currentTab === 'talent',
        allowClick: '.nav-btn[data-tab="talent"]'
    },
    {
        id: 'talent_explain',
        messageKey: 'tutorial.step.talent_explain',
        messageFallback: '인재 탭에서 보유 인재와 채용 시장을 확인합니다.\n인재에게는 사기(morale)와 충성도(loyalty)가 있습니다.\n충성도가 낮으면 퇴사할 수 있으니 주의하세요!\n\n다음으로 넘어가겠습니다.',
        position: 'center'
    },
    {
        id: 'go_company',
        target: '.nav-btn[data-tab="company"]',
        messageKey: 'tutorial.step.go_company',
        messageFallback: '회사 탭에서 재무 상황과 투자 유치를 관리합니다.\n회사 탭을 클릭하세요.',
        position: 'right',
        waitFor: () => window.game?.currentTab === 'company',
        allowClick: '.nav-btn[data-tab="company"]'
    },
    {
        id: 'company_explain',
        messageKey: 'tutorial.step.company_explain',
        messageFallback: '회사 탭에서는 재무, 투자 유치, 시장 점유율, 글로벌 현황을 확인합니다.\nGPU와 데이터는 이제 각각 별도의 사이드바 탭으로 분리되었습니다.\n\n먼저 GPU 탭으로 이동해 보세요.',
        position: 'center'
    },
    {
        id: 'go_gpu',
        target: '.nav-btn[data-tab="gpu"]',
        messageKey: 'tutorial.step.go_gpu',
        messageFallback: 'GPU 탭에서는 클라우드 임대, 직접 구매한 GPU, 데이터센터 운영 현황을 확인합니다.\nGPU 탭을 클릭하세요.',
        position: 'right',
        waitFor: () => window.game?.currentTab === 'gpu',
        allowClick: '.nav-btn[data-tab="gpu"]'
    },
    {
        id: 'gpu_explain',
        messageKey: 'tutorial.step.gpu_explain',
        messageFallback: '이곳이 GPU 운영 화면입니다.\n보유 장비의 성능과 월 유지비를 보고, GPU 관리 버튼에서 클라우드 임대, GPU 구입, 데이터센터 건설을 진행합니다.',
        position: 'center',
        tab: 'gpu'
    },
    {
        id: 'go_data',
        target: '.nav-btn[data-tab="data"]',
        messageKey: 'tutorial.step.go_data',
        messageFallback: '이번에는 데이터 탭입니다.\n데이터 탭을 클릭해서 학습 자산 구성을 확인해 보세요.',
        position: 'right',
        waitFor: () => window.game?.currentTab === 'data',
        allowClick: '.nav-btn[data-tab="data"]'
    },
    {
        id: 'data_explain',
        messageKey: 'tutorial.step.data_explain',
        messageFallback: '데이터 탭에서는 총 데이터량과 데이터 유형별 보유량을 확인합니다.\n모델 훈련 때 어떤 데이터를 얼마나 넣을지 여기서 준비한 자산을 기준으로 결정합니다.',
        position: 'center',
        tab: 'data'
    },
    {
        id: 'go_models',
        target: '.nav-btn[data-tab="models"]',
        messageKey: 'tutorial.step.go_models',
        messageFallback: '이제 모델 개발 흐름을 볼 차례입니다.\n모델 탭을 클릭하세요.',
        position: 'right',
        waitFor: () => window.game?.currentTab === 'models',
        allowClick: '.nav-btn[data-tab="models"]'
    },
    {
        id: 'models_explain',
        messageKey: 'tutorial.step.models_explain',
        messageFallback: '모델 탭은 설계, 훈련, 배포까지 이어지는 핵심 작업 공간입니다.\n초반에는 딥러닝 기초 같은 선행 연구가 필요하지만, 흐름 자체는 여기서 모두 관리합니다.',
        position: 'center',
        tab: 'models'
    },
    {
        id: 'models_create_explain',
        messageKey: 'tutorial.step.models_create_explain',
        messageFallback: '모델 생성 단계에서는 이름, 아키텍처, 규모를 정해 설계합니다.\n아키텍처마다 강점과 필요한 데이터 유형이 다르므로, 연구 해금과 보유 GPU 규모를 함께 봐야 합니다.',
        position: 'center',
        tab: 'models'
    },
    {
        id: 'models_train_explain',
        messageKey: 'tutorial.step.models_train_explain',
        messageFallback: '설계가 끝난 모델은 훈련을 시작할 수 있습니다.\n훈련 시에는 인재를 배치하고, 데이터 믹스를 나눠 주며, 충분한 GPU와 VRAM이 있는지 확인해야 합니다.',
        position: 'center',
        tab: 'models'
    },
    {
        id: 'models_deploy_explain',
        messageKey: 'tutorial.step.models_deploy_explain',
        messageFallback: '훈련 완료 후에는 배포 전략을 골라 수익화를 시작합니다.\nAPI, B2B, 정부 계약처럼 전략마다 요구 능력과 기대 매출, 평판 영향이 다릅니다.',
        position: 'center',
        tab: 'models'
    },
    {
        id: 'unpause',
        target: '.speed-controls',
        messageKey: 'tutorial.step.unpause',
        messageFallback: '이제 게임을 시작할 준비가 되었습니다!\nSpace를 누르거나 ▶ 버튼을 클릭하여 시간을 흐르게 하세요.',
        position: 'bottom',
        waitFor: () => window.game?.time?.speed > 0,
        allowClick: '.speed-btn'
    },
    {
        id: 'finish',
        messageKey: 'tutorial.step.finish',
        messageFallback: '게임이 시작되었습니다!\n\n핵심 흐름: 연구 → 모델 개발 → 배포 → 수익 → 재투자\n\n경쟁사보다 먼저 AGI에 도달하세요.\n파산하지 않도록 자금 관리에 주의하세요.\n\n행운을 빕니다!',
        position: 'center',
        btnKey: 'tutorial.finish_button',
        btnFallback: '게임 시작!'
    }
];

export class Tutorial {
    constructor(game) {
        this.game = game;
        this._active = false;
        this._step = 0;
        this._overlay = null;
        this._tooltip = null;
        this._waitInterval = null;
        this._done = false;
        this.ready = this._loadDone();
    }

    isActive() { return this._active; }

    async _loadDone() {
        this._done = Boolean(await storageGetItem(TUTORIAL_KEY));
    }

    async shouldShow() {
        await this.ready;
        return !this._done;
    }

    /** Show confirmation dialog first */
    askToStart() {
        const popup = document.getElementById('popup');
        if (!popup) return;
        popup.innerHTML = `
            <div class="popup-content" style="max-width:400px;text-align:center">
                <h3>${t('tutorial.title', '튜토리얼')}</h3>
                <p style="margin:16px 0;color:var(--text-secondary)">${t('tutorial.prompt_body', '기본적인 게임 진행 방법을 배울 수 있습니다.\n실제로 조작하면서 진행합니다.').replace(/\n/g, '<br>')}</p>
                <div class="popup-buttons" style="justify-content:center">
                    <button class="btn btn-primary" onclick="game.tutorial.start();document.getElementById('popup').classList.remove('show')">${t('tutorial.start_cta', '튜토리얼 시작')}</button>
                    <button class="btn" onclick="game.tutorial.skip();document.getElementById('popup').classList.remove('show')">${t('tutorial.skip_action', '건너뛰기')}</button>
                </div>
            </div>
        `;
        popup.classList.add('show');
    }

    start() {
        this._active = true;
        this._step = 0;
        this._createDOM();
        this._showStep();
    }

    skip() {
        this._complete();
    }

    advance() {
        this._clearWait();
        this._step++;
        if (this._step >= TUTORIAL_STEPS.length) {
            this._complete();
        } else {
            this._showStep();
        }
    }

    restart() {
        this._done = false;
        storageRemoveItem(TUTORIAL_KEY);
        this.start();
    }

    _complete() {
        this._active = false;
        this._clearWait();
        this._done = true;
        storageSetItem(TUTORIAL_KEY, '1');
        this._removeDOM();
    }

    _clearWait() {
        if (this._waitInterval) {
            clearInterval(this._waitInterval);
            this._waitInterval = null;
        }
    }

    _createDOM() {
        this._removeDOM();
        this._overlay = document.createElement('div');
        this._overlay.className = 'tutorial-overlay';
        this._tooltip = document.createElement('div');
        this._tooltip.className = 'tutorial-tooltip';
        document.body.appendChild(this._overlay);
        document.body.appendChild(this._tooltip);
    }

    _removeDOM() {
        this._overlay?.remove();
        this._tooltip?.remove();
        this._overlay = null;
        this._tooltip = null;
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    }

    _showStep() {
        const step = TUTORIAL_STEPS[this._step];
        if (!step) return;

        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

        // Switch tab if needed
        if (step.tab && this.game.switchTab) {
            this.game.switchTab(step.tab);
        }

        requestAnimationFrame(() => this._renderStep(step));
    }

    _renderStep(step) {
        const isCenter = step.position === 'center' || !step.target;
        let targetRect = null;

        if (!isCenter && step.target) {
            const el = document.querySelector(step.target);
            if (el) {
                targetRect = el.getBoundingClientRect();
                el.classList.add('tutorial-highlight');
            }
        }

        // Overlay — allow clicks when waiting for user action
        if (step.waitFor) {
            // Lower z-index so popups/modals appear above, and disable pointer events
            this._overlay.style.clipPath = 'none';
            this._overlay.style.pointerEvents = 'none';
            this._overlay.style.zIndex = '5';
            this._tooltip.style.zIndex = '9999';
        } else if (targetRect) {
            const pad = 6;
            const x1 = targetRect.left - pad, y1 = targetRect.top - pad;
            const x2 = targetRect.right + pad, y2 = targetRect.bottom + pad;
            this._overlay.style.clipPath = `polygon(
                0% 0%, 0% 100%, ${x1}px 100%, ${x1}px ${y1}px,
                ${x2}px ${y1}px, ${x2}px ${y2}px,
                ${x1}px ${y2}px, ${x1}px 100%, 100% 100%, 100% 0%
            )`;
            this._overlay.style.pointerEvents = 'auto';
            this._overlay.style.zIndex = '9998';
        } else {
            this._overlay.style.clipPath = 'none';
            this._overlay.style.pointerEvents = 'auto';
            this._overlay.style.zIndex = '9998';
        }

        const message = t(step.messageKey, step.messageFallback || step.message || '');
        const lines = message.split('\n').map(l => `<p>${l}</p>`).join('');
        const progress = `${this._step + 1} / ${TUTORIAL_STEPS.length}`;
        const hasWait = !!step.waitFor;
        const btnText = step.btnKey
            ? t(step.btnKey, step.btnFallback || step.btnText || '')
            : (hasWait ? t('tutorial.waiting', '대기 중...') : t('tutorial.next', '다음'));

        this._tooltip.innerHTML = `
            <div class="tutorial-tooltip__body">${lines}</div>
            <div class="tutorial-tooltip__footer">
                <span class="tutorial-tooltip__progress">${progress}</span>
                <div class="tutorial-tooltip__btns">
                    <button class="btn btn-small" onclick="game.tutorial.skip()">${t('tutorial.skip_action', '건너뛰기')}</button>
                    ${hasWait ? `<span class="btn btn-small" style="opacity:0.4;cursor:default">${btnText}</span>` :
                    `<button class="btn btn-primary btn-small" onclick="game.tutorial.advance()">${btnText}</button>`}
                </div>
            </div>
        `;

        if (isCenter) {
            this._tooltip.style.left = '50%';
            this._tooltip.style.top = '50%';
            this._tooltip.style.transform = 'translate(-50%, -50%)';
        } else if (targetRect) {
            this._positionTooltip(targetRect, step.position);
        }

        this._tooltip.classList.add('visible');

        // Wait for condition
        if (step.waitFor) {
            this._clearWait();
            this._waitInterval = setInterval(() => {
                if (step.waitFor()) {
                    this.advance();
                }
            }, 300);
        }
    }

    _positionTooltip(rect, position) {
        const tt = this._tooltip;
        tt.style.transform = '';
        const gap = 12;

        switch (position) {
            case 'bottom':
                tt.style.left = `${rect.left + rect.width / 2}px`;
                tt.style.top = `${rect.bottom + gap}px`;
                tt.style.transform = 'translateX(-50%)';
                break;
            case 'top':
                tt.style.left = `${rect.left + rect.width / 2}px`;
                tt.style.top = `${rect.top - gap}px`;
                tt.style.transform = 'translate(-50%, -100%)';
                break;
            case 'right':
                tt.style.left = `${rect.right + gap}px`;
                tt.style.top = `${rect.top + rect.height / 2}px`;
                tt.style.transform = 'translateY(-50%)';
                break;
            case 'left':
                tt.style.left = `${rect.left - gap}px`;
                tt.style.top = `${rect.top + rect.height / 2}px`;
                tt.style.transform = 'translate(-100%, -50%)';
                break;
        }

        requestAnimationFrame(() => {
            const ttRect = tt.getBoundingClientRect();
            if (ttRect.right > window.innerWidth - 10) {
                tt.style.left = `${window.innerWidth - ttRect.width - 10}px`;
                tt.style.transform = 'translateY(-50%)';
            }
            if (ttRect.bottom > window.innerHeight - 10) {
                tt.style.top = `${window.innerHeight - ttRect.height - 10}px`;
            }
        });
    }
}
