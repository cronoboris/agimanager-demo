/**
 * Sound System — Web Audio API 기반 절차적 사운드
 *
 * 오디오 파일 없이 오실레이터와 엔벨로프로 사운드를 합성합니다.
 * BGM: 절차적 앰비언트 루프
 * SFX: UI 효과음 + 이벤트 사운드
 */

import { t } from '../i18n.js';
import { getAmbientEra } from './feedbackPolicy.js';
import { storageGetItem, storageGetItemSync, storageSetItem } from '../utils/storage.js';

const SETTINGS_KEY = 'agimanager_sound_settings';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function coerceBoolean(value, fallback = false) {
    if (value === true || value === false) return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return fallback;
}

function normalizeVolume(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = num > 1 ? num / 100 : num;
    return clamp(normalized, 0, 1);
}

export class SoundSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;

        this._musicLoop = null;
        this._musicPlaying = false;
        this._windowBlurred = false;

        // Load settings
        this.settings = this._loadSettings();
        this._loadSettingsAsync();

        // Resume AudioContext on first interaction
        this._initOnInteraction = () => {
            this._ensureContext();
            document.removeEventListener('click', this._initOnInteraction);
            document.removeEventListener('keydown', this._initOnInteraction);
        };
        document.addEventListener('click', this._initOnInteraction);
        document.addEventListener('keydown', this._initOnInteraction);

        this._onWindowBlur = () => {
            this._windowBlurred = true;
            this._applySettings();
        };
        this._onWindowFocus = () => {
            this._windowBlurred = false;
            this._applySettings();
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('blur', this._onWindowBlur);
            window.addEventListener('focus', this._onWindowFocus);
            this._removeElectronBlur = window.electronAPI?.display?.onBlur?.(this._onWindowBlur) || null;
            this._removeElectronFocus = window.electronAPI?.display?.onFocus?.(this._onWindowFocus) || null;
        }
    }

    _ensureContext() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);

        this._applySettings();
    }

    // ─── Settings ───

    _loadSettings() {
        try {
            const raw = storageGetItemSync(SETTINGS_KEY);
            if (raw) return JSON.parse(raw);
        } catch {}
        return {
            masterVolume: 0.5,
            musicVolume: 0.3,
            sfxVolume: 0.6,
            enabled: true,
            musicEnabled: true,
            muteOnBlur: false
        };
    }

    async _loadSettingsAsync() {
        try {
            const raw = await storageGetItem(SETTINGS_KEY);
            if (!raw) return;
            this.settings = { ...this.settings, ...JSON.parse(raw) };
            this._applySettings();
        } catch {}
    }

    _saveSettings() {
        storageSetItem(SETTINGS_KEY, JSON.stringify(this.settings));
    }

    _applySettings() {
        if (!this.masterGain) return;
        const s = this.settings;
        const shouldMuteForBlur = Boolean(s.muteOnBlur && this._windowBlurred);
        this.masterGain.gain.value = s.enabled && !shouldMuteForBlur ? s.masterVolume : 0;
        this.musicGain.gain.value = s.enabled && s.musicEnabled && !shouldMuteForBlur ? s.musicVolume : 0;
        this.sfxGain.gain.value = s.sfxVolume;
    }

    _setVolume(key, value) {
        this.settings[key] = normalizeVolume(value, this.settings[key]);
        this._applySettings();
        this._saveSettings();
        return this.settings[key];
    }

    setMasterVolume(v) { return this._setVolume('masterVolume', v); }
    setMusicVolume(v) { return this._setVolume('musicVolume', v); }
    setSFXVolume(v) { return this._setVolume('sfxVolume', v); }

    setEnabled(v) {
        this.settings.enabled = coerceBoolean(v, this.settings.enabled);
        this._applySettings();
        this._saveSettings();
        if (!this.settings.enabled) this.stopMusic();
    }

    setMusicEnabled(v) {
        this.settings.musicEnabled = coerceBoolean(v, this.settings.musicEnabled);
        this._applySettings();
        this._saveSettings();
        if (!this.settings.musicEnabled) this.stopMusic();
        else if (this.settings.enabled) this.startMusic();
    }

    setMuteOnBlur(v) {
        this.settings.muteOnBlur = coerceBoolean(v, this.settings.muteOnBlur);
        this._applySettings();
        this._saveSettings();
    }

    destroy() {
        document.removeEventListener('click', this._initOnInteraction);
        document.removeEventListener('keydown', this._initOnInteraction);
        if (typeof window !== 'undefined') {
            window.removeEventListener('blur', this._onWindowBlur);
            window.removeEventListener('focus', this._onWindowFocus);
        }
        this._removeElectronBlur?.();
        this._removeElectronFocus?.();
    }

    applyGameSettings(audioSettings = {}) {
        this.settings = {
            ...this.settings,
            masterVolume: normalizeVolume(audioSettings.master ?? audioSettings.masterVolume, this.settings.masterVolume),
            musicVolume: normalizeVolume(audioSettings.music ?? audioSettings.musicVolume, this.settings.musicVolume),
            sfxVolume: normalizeVolume(audioSettings.sfx ?? audioSettings.sfxVolume, this.settings.sfxVolume),
            enabled: coerceBoolean(audioSettings.enabled, this.settings.enabled),
            musicEnabled: coerceBoolean(audioSettings.musicEnabled, this.settings.musicEnabled),
            muteOnBlur: coerceBoolean(audioSettings.muteOnBlur, this.settings.muteOnBlur)
        };
        this._applySettings();
        this._saveSettings();
        return this.settings;
    }

    toggleSound() {
        this.setEnabled(!this.settings.enabled);
    }

    // ─── SFX ───

    play(soundId) {
        if (!this.settings.enabled) return;
        this._ensureContext();
        const fn = SOUNDS[soundId];
        if (fn) fn(this.ctx, this.sfxGain);
    }

    // ─── BGM ───

    startMusic() {
        if (this._musicPlaying || !this.settings.enabled || !this.settings.musicEnabled) return;
        this._ensureContext();
        this._musicPlaying = true;
        this._playAmbientLoop();
    }

    stopMusic() {
        this._musicPlaying = false;
        if (this._musicTimeout) {
            clearTimeout(this._musicTimeout);
            this._musicTimeout = null;
        }
    }

    toggleMusic() {
        if (this._musicPlaying) this.stopMusic();
        else this.startMusic();
    }

    _playAmbientLoop() {
        if (!this._musicPlaying) return;

        const ctx = this.ctx;
        const dest = this.musicGain;
        const now = ctx.currentTime;
        const year = window.game?.time?.currentDate?.year || 2017;
        const actId = window.game?.state?.campaign?.currentAct || null;
        const era = getAmbientEra(actId || year);

        const ambientPresets = {
            startup: {
                padType: 'sawtooth',
                padFreqs: [55, 65.41, 73.42],
                padGain: 0.055,
                padDuration: 8.5,
                arpType: 'triangle',
                arpFreqs: [196.00, 261.63, 329.63, 392.00],
                arpGain: 0.028,
                arpCount: 2,
                arpSpacing: 2.4,
                arpSpread: 1.15,
                loopMin: 8500,
                loopMax: 11000,
                filterCutoff: 900,
                shimmer: false
            },
            expansion: {
                padType: 'triangle',
                padFreqs: [82.41, 110.00, 130.81],
                padGain: 0.075,
                padDuration: 8.25,
                arpType: 'sine',
                arpFreqs: [261.63, 329.63, 392.00, 523.25],
                arpGain: 0.033,
                arpCount: 3,
                arpSpacing: 2.1,
                arpSpread: 1.35,
                loopMin: 7500,
                loopMax: 10000,
                filterCutoff: 1200,
                shimmer: false
            },
            political: {
                padType: 'sine',
                padFreqs: [130.81, 164.81, 196.00],
                padGain: 0.09,
                padDuration: 7.5,
                arpType: 'sine',
                arpFreqs: [392.00, 523.25, 659.25, 783.99],
                arpGain: 0.04,
                arpCount: 4,
                arpSpacing: 1.7,
                arpSpread: 1.05,
                loopMin: 6500,
                loopMax: 9000,
                filterCutoff: 1800,
                shimmer: true
            },
            frontier: {
                padType: 'sine',
                padFreqs: [98.0, 123.47, 155.56],
                padGain: 0.11,
                padDuration: 7.2,
                arpType: 'triangle',
                arpFreqs: [311.13, 466.16, 622.25, 830.61],
                arpGain: 0.045,
                arpCount: 5,
                arpSpacing: 1.35,
                arpSpread: 0.9,
                loopMin: 5600,
                loopMax: 7600,
                filterCutoff: 2100,
                shimmer: true
            }
        };

        const preset = ambientPresets[era] || ambientPresets.startup;

        // Pad: era-tinted sustained note
        const padFreq = preset.padFreqs[Math.floor(Math.random() * preset.padFreqs.length)];
        const pad = ctx.createOscillator();
        pad.type = preset.padType;
        pad.frequency.value = padFreq;

        const padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = preset.filterCutoff;
        padFilter.Q.value = 0.9;

        const padGain = ctx.createGain();
        padGain.gain.setValueAtTime(0, now);
        padGain.gain.linearRampToValueAtTime(preset.padGain, now + 2);
        padGain.gain.linearRampToValueAtTime(0, now + preset.padDuration);

        pad.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(dest);
        pad.start(now);
        pad.stop(now + preset.padDuration);

        // Arpeggio notes evolve with the era.
        for (let i = 0; i < preset.arpCount; i++) {
            const t = now + 0.9 + i * preset.arpSpacing + Math.random() * 0.35;
            const freq = preset.arpFreqs[Math.floor(Math.random() * preset.arpFreqs.length)] * (
                era === 'startup' && Math.random() < 0.45 ? 0.5 : 1
            );
            const osc = ctx.createOscillator();
            osc.type = preset.arpType;
            osc.frequency.value = freq;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = preset.filterCutoff + (i * 180);

            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(preset.arpGain, t + 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

            osc.connect(filter);
            filter.connect(g);
            g.connect(dest);
            osc.start(t);
            osc.stop(t + 1.5);
        }

        if (preset.shimmer) {
            const shimmer = ctx.createOscillator();
            shimmer.type = 'sine';
            shimmer.frequency.value = padFreq * 2;

            const shimmerFilter = ctx.createBiquadFilter();
            shimmerFilter.type = 'highpass';
            shimmerFilter.frequency.value = 900;

            const shimmerGain = ctx.createGain();
            shimmerGain.gain.setValueAtTime(0, now + 0.6);
            shimmerGain.gain.linearRampToValueAtTime(0.016, now + 1.4);
            shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);

            shimmer.connect(shimmerFilter);
            shimmerFilter.connect(shimmerGain);
            shimmerGain.connect(dest);
            shimmer.start(now + 0.6);
            shimmer.stop(now + 4.5);
        }

        // Schedule next cycle
        const nextLoop = preset.loopMin + Math.random() * (preset.loopMax - preset.loopMin);
        this._musicTimeout = setTimeout(() => this._playAmbientLoop(), nextLoop);
    }

    // ─── Volume Control UI HTML ───

    getVolumeControlHTML(iconFn) {
        const s = this.settings;
        return `
            <div class="sound-controls">
                <div class="sound-control-row">
                    <span class="sound-label">${t('settings.sound_master', '마스터')}</span>
                    <input type="range" class="sound-slider" min="0" max="100" value="${Math.round(s.masterVolume * 100)}"
                        oninput="(window.game?.sound || window.__menuSoundSystem)?.setMasterVolume(this.value/100)">
                </div>
                <div class="sound-control-row">
                    <span class="sound-label">${t('settings.music', '음악')}</span>
                    <input type="range" class="sound-slider" min="0" max="100" value="${Math.round(s.musicVolume * 100)}"
                        oninput="(window.game?.sound || window.__menuSoundSystem)?.setMusicVolume(this.value/100)">
                </div>
                <div class="sound-control-row">
                    <span class="sound-label">${t('settings.sfx', '효과음')}</span>
                    <input type="range" class="sound-slider" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}"
                        oninput="(window.game?.sound || window.__menuSoundSystem)?.setSFXVolume(this.value/100)">
                </div>
                <div class="sound-control-row">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.78rem;color:var(--text-secondary)">
                        <input type="checkbox" ${s.muteOnBlur ? 'checked' : ''}
                            onchange="(window.game?.sound || window.__menuSoundSystem)?.setMuteOnBlur(this.checked)"> ${t('settings.sound_mute_on_blur', '백그라운드 시 음소거')}
                    </label>
                </div>
                <div class="sound-control-row">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.78rem;color:var(--text-secondary)">
                        <input type="checkbox" ${s.enabled ? 'checked' : ''}
                            onchange="(window.game?.sound || window.__menuSoundSystem)?.setEnabled(this.checked)"> ${t('settings.sound_enabled', '사운드 켜기')}
                    </label>
                </div>
            </div>
        `;
    }
}

// ─── Sound Definitions ───

function _tone(ctx, dest, freq, type, start, dur, vol = 0.15) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur);
}

const SOUNDS = {
    click(ctx, dest) {
        _tone(ctx, dest, 800, 'sine', ctx.currentTime, 0.05, 0.1);
    },

    tab_switch(ctx, dest) {
        const now = ctx.currentTime;
        _tone(ctx, dest, 600, 'sine', now, 0.06, 0.08);
        _tone(ctx, dest, 900, 'sine', now + 0.04, 0.06, 0.08);
    },

    notification(ctx, dest) {
        const now = ctx.currentTime;
        _tone(ctx, dest, 523.25, 'sine', now, 0.12, 0.1);       // C5
        _tone(ctx, dest, 659.25, 'sine', now + 0.08, 0.12, 0.1); // E5
        _tone(ctx, dest, 783.99, 'sine', now + 0.16, 0.15, 0.1); // G5
    },

    research_complete(ctx, dest) {
        const now = ctx.currentTime;
        _tone(ctx, dest, 261.63, 'triangle', now, 0.2, 0.12);        // C4
        _tone(ctx, dest, 329.63, 'triangle', now + 0.1, 0.2, 0.12);  // E4
        _tone(ctx, dest, 392.00, 'triangle', now + 0.2, 0.2, 0.12);  // G4
        _tone(ctx, dest, 523.25, 'triangle', now + 0.3, 0.3, 0.12);  // C5
    },

    model_trained(ctx, dest) {
        const now = ctx.currentTime;
        // Triumphant chord
        _tone(ctx, dest, 261.63, 'triangle', now, 0.5, 0.08); // C4
        _tone(ctx, dest, 329.63, 'triangle', now, 0.5, 0.08);  // E4
        _tone(ctx, dest, 392.00, 'triangle', now, 0.5, 0.08);  // G4
    },

    funding_secured(ctx, dest) {
        const now = ctx.currentTime;
        // Cash register: noise burst + tone
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.15, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(ng);
        ng.connect(dest);
        noise.start(now);
        _tone(ctx, dest, 1200, 'sine', now + 0.03, 0.15, 0.12);
    },

    warning(ctx, dest) {
        const now = ctx.currentTime;
        _tone(ctx, dest, 220, 'sawtooth', now, 0.15, 0.08);      // A3
        _tone(ctx, dest, 174.61, 'sawtooth', now + 0.1, 0.2, 0.08); // F3
    },

    game_over(ctx, dest) {
        const now = ctx.currentTime;
        _tone(ctx, dest, 130.81, 'sawtooth', now, 0.5, 0.1);
        _tone(ctx, dest, 110.00, 'sawtooth', now + 0.3, 0.5, 0.1);
        _tone(ctx, dest, 82.41, 'sawtooth', now + 0.6, 0.8, 0.1);
    },

    victory(ctx, dest) {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
        notes.forEach((f, i) => {
            _tone(ctx, dest, f, 'triangle', now + i * 0.12, 0.3, 0.12);
        });
    }
};
