/**
 * Steam bridge for renderer code.
 * Wraps the Electron preload API and degrades gracefully when Steam is absent.
 */
export class SteamBridge {
    constructor() {
        this._api = typeof window !== 'undefined' ? window.electronAPI?.steam || null : null;
        this._available = null;
    }

    async isAvailable() {
        if (this._available !== null) return this._available;
        if (!this._api?.isAvailable) {
            this._available = false;
            return false;
        }
        try {
            this._available = Boolean(await this._api.isAvailable());
        } catch {
            this._available = false;
        }
        return this._available;
    }

    async getPlayerName() {
        if (!await this.isAvailable()) return null;
        try {
            return await this._api.getPlayerName();
        } catch {
            return null;
        }
    }

    async unlockAchievement(id) {
        if (!await this.isAvailable()) return false;
        try {
            return Boolean(await this._api.unlockAchievement(id));
        } catch {
            return false;
        }
    }

    async getAchievements() {
        if (!await this.isAvailable()) return [];
        try {
            return await this._api.getAchievements();
        } catch {
            return [];
        }
    }

    async setRichPresence(status) {
        if (!await this.isAvailable()) return false;
        try {
            return Boolean(await this._api.setRichPresence('steam_display', status));
        } catch {
            return false;
        }
    }

    async cloudSave(key, data) {
        if (!await this.isAvailable()) return false;
        try {
            return Boolean(await this._api.cloudSave(key, data));
        } catch {
            return false;
        }
    }

    async cloudLoad(key) {
        if (!await this.isAvailable()) return null;
        try {
            return await this._api.cloudLoad(key);
        } catch {
            return null;
        }
    }
}

export const steam = new SteamBridge();
