const { contextBridge, ipcRenderer } = require('electron');

/**
 * Electron Preload — 게임에서 사용할 API를 안전하게 노출
 * contextIsolation: true 환경에서 window.electronAPI로 접근 가능
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // ── 디스플레이 ──
    display: {
        setMode: (mode) => ipcRenderer.invoke('display:setMode', mode),
        setResolution: (width, height) => ipcRenderer.invoke('display:setResolution', width, height),
        getState: () => ipcRenderer.invoke('display:getState'),
        getResolutions: () => ipcRenderer.invoke('display:getResolutions'),
        onBlur: (callback) => {
            if (typeof callback !== 'function') return () => {};
            const listener = () => callback();
            ipcRenderer.on('window:blur', listener);
            return () => ipcRenderer.removeListener('window:blur', listener);
        },
        onFocus: (callback) => {
            if (typeof callback !== 'function') return () => {};
            const listener = () => callback();
            ipcRenderer.on('window:focus', listener);
            return () => ipcRenderer.removeListener('window:focus', listener);
        }
    },

    // ── 세이브/로드 (파일 시스템 기반) ──
    save: {
        write: (slot, data) => ipcRenderer.invoke('save:write', slot, data),
        read: (slot) => ipcRenderer.invoke('save:read', slot),
        list: () => ipcRenderer.invoke('save:list'),
        delete: (slot) => ipcRenderer.invoke('save:delete', slot),
    },

    // ── Steam API ──
    steam: {
        isAvailable: () => ipcRenderer.invoke('steam:isAvailable'),
        getPlayerName: () => ipcRenderer.invoke('steam:getPlayerName'),
        unlockAchievement: (id) => ipcRenderer.invoke('steam:unlockAchievement', id),
        setRichPresence: (key, value) => ipcRenderer.invoke('steam:setRichPresence', key, value),
        getAchievements: () => ipcRenderer.invoke('steam:getAchievements'),
        cloudSave: (key, data) => ipcRenderer.invoke('steam:cloudSave', key, data),
        cloudLoad: (key) => ipcRenderer.invoke('steam:cloudLoad', key),
    },

    // ── 앱 정보 ──
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        getSavePath: () => ipcRenderer.invoke('app:getSavePath'),
        getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
        quit: () => ipcRenderer.invoke('app:quit'),
    },

    // ── 아바타 생성 (DiceBear 오프라인) ──
    avatar: {
        generate: (options) => ipcRenderer.invoke('avatar:generate', options),
    },
});
