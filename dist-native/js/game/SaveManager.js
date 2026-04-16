/**
 * Save Manager — Multi-slot save/load with auto-save
 *
 * Slots: 5 manual + 1 autosave
 * Features: versioning, migration, timestamps, slot naming
 */

import { t } from '../i18n.js';
import { MIN_COMPATIBLE_SAVE, SAVE_VERSION } from '../data/version.js';
import { storageGetItem, storageSetItem, storageRemoveItem } from '../utils/storage.js';
import { normalizeSerializedGamePayload } from './GameStateCompatibility.js';

const SAVE_PREFIX = 'agimanager_slot_';
const AUTOSAVE_KEY = 'agimanager_autosave';
const LEGACY_KEY = 'agimanager_save';
const MAX_SLOTS = 5;
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SaveManager {
    constructor() {
        this._autosaveTimer = null;
        this.ready = this._migrateLegacy();
    }

    // ─── Slot Management ───

    async listSlots() {
        await this.ready;
        const slots = [];
        for (let i = 0; i < MAX_SLOTS; i++) {
            const raw = await storageGetItem(SAVE_PREFIX + i);
            if (raw) {
                try {
                    const data = JSON.parse(raw);
                    slots.push({
                        index: i,
                        name: data.slotName || t('save.slot_name', '슬롯 {index}', { index: i + 1 }),
                        timestamp: data.timestamp,
                        gameDate: data.gameDate || null,
                        version: data.version || 0
                    });
                } catch {
                    slots.push({
                        index: i,
                        name: t('save.corrupted_slot', '슬롯 {index} (손상)', { index: i + 1 }),
                        timestamp: null,
                        gameDate: null,
                        version: 0
                    });
                }
            } else {
                slots.push({ index: i, name: null, timestamp: null, gameDate: null, version: 0 });
            }
        }
        return slots;
    }

    async getAutosaveInfo() {
        await this.ready;
        const raw = await storageGetItem(AUTOSAVE_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            return {
                name: t('save.autosave', '자동 저장'),
                timestamp: data.timestamp,
                gameDate: data.gameDate || null,
                version: data.version || 0
            };
        } catch {
            return null;
        }
    }

    // ─── Save ───

    async save(slotIndex, game, slotName) {
        await this.ready;
        if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return false;
        const payload = this._serialize(game, slotName || t('save.slot_name', '슬롯 {index}', { index: slotIndex + 1 }));
        try {
            return await storageSetItem(SAVE_PREFIX + slotIndex, JSON.stringify(payload));
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    }

    async autoSave(game) {
        await this.ready;
        const payload = this._serialize(game, t('save.autosave', '자동 저장'));
        try {
            return await storageSetItem(AUTOSAVE_KEY, JSON.stringify(payload));
        } catch (e) {
            console.error('Autosave failed:', e);
            return false;
        }
    }

    // ─── Load ───

    async load(slotIndex) {
        await this.ready;
        const raw = await storageGetItem(SAVE_PREFIX + slotIndex);
        if (!raw) return null;
        return this._deserialize(raw);
    }

    async loadAutosave() {
        await this.ready;
        const raw = await storageGetItem(AUTOSAVE_KEY);
        if (!raw) return null;
        return this._deserialize(raw);
    }

    // ─── Delete ───

    async deleteSave(slotIndex) {
        await this.ready;
        await storageRemoveItem(SAVE_PREFIX + slotIndex);
    }

    // ─── Auto-save Timer ───

    startAutosave(game) {
        this.stopAutosave();
        this._autosaveTimer = setInterval(() => {
            if (game.state.gameStarted && !game.state.gameOver) {
                this.autoSave(game);
            }
        }, AUTOSAVE_INTERVAL_MS);
    }

    stopAutosave() {
        if (this._autosaveTimer) {
            clearInterval(this._autosaveTimer);
            this._autosaveTimer = null;
        }
    }

    // ─── Serialization ───

    _serialize(game, slotName) {
        const dateObj = game.time.currentDate;
        return {
            version: SAVE_VERSION,
            slotName,
            timestamp: Date.now(),
            gameDate: `${dateObj.year}.${String(dateObj.month).padStart(2, '0')}.${String(dateObj.day).padStart(2, '0')}`,
            state: game.state.toJSON(),
            time: game.time.toJSON(),
            events: game.events.toJSON(),
            talentMarket: game.talentMarket
        };
    }

    _deserialize(raw) {
        try {
            const data = JSON.parse(raw);
            if ((data.version || 0) < MIN_COMPATIBLE_SAVE) {
                return null;
            }
            // Version migration
            if (data.version < SAVE_VERSION) {
                this._migrate(data);
            }
            this._normalizePayload(data);
            return data;
        } catch (e) {
            console.error('Deserialize failed:', e);
            return null;
        }
    }

    _migrate(data) {
        /**
         * 마이그레이션 테이블:
         * v0 → v1: player 객체 추가, reputation 구조 변경
         * v1 → v2: eventChains, internalAI, chipProgram 추가
         * v2 → v3: campaignAct, techRoute 정규화, version.json 도입
         */
        data.version = SAVE_VERSION;
    }

    _normalizePayload(data) {
        normalizeSerializedGamePayload(data);
    }

    async _migrateLegacy() {
        // Migrate old single-slot save to slot 0
        const legacy = await storageGetItem(LEGACY_KEY);
        if (!legacy) return;

        // Only migrate if slot 0 is empty
        if (await storageGetItem(SAVE_PREFIX + '0')) return;

        try {
            const old = JSON.parse(legacy);
            const migrated = {
                version: SAVE_VERSION,
                slotName: t('save.migrated', '마이그레이션된 세이브'),
                timestamp: Date.now(),
                gameDate: old.time?.currentDate
                    ? `${old.time.currentDate.year}.${String(old.time.currentDate.month).padStart(2, '0')}.${String(old.time.currentDate.day).padStart(2, '0')}`
                    : null,
                state: old.state,
                time: old.time,
                events: old.events,
                talentMarket: old.talentMarket
            };
            this._normalizePayload(migrated);
            await storageSetItem(SAVE_PREFIX + '0', JSON.stringify(migrated));
            await storageRemoveItem(LEGACY_KEY);
        } catch {
            // Ignore corrupt legacy data
        }
    }

    // ─── Apply loaded data to game ───

    applyToGame(data, game) {
        if (!data || !data.state) return false;

        game.state.fromJSON(data.state);

        // Support both old format (plain date) and new format (full time state)
        if (data.time && data.time.currentDate) {
            game.time.fromJSON(data.time);
        } else if (data.time) {
            game.time.currentDate = data.time;
        }

        if (data.events) game.events.fromJSON(data.events);
        game.talentMarket = data.talentMarket || [];
        game.state.gameStarted = true;

        return true;
    }
}

export { MAX_SLOTS };
