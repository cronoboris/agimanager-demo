function _getInvoke() {
    if (typeof window === 'undefined') return null;
    if (window.__TAURI__?.core?.invoke) return window.__TAURI__.core.invoke.bind(window.__TAURI__.core);
    if (window.__TAURI__?.invoke) return window.__TAURI__.invoke.bind(window.__TAURI__);
    return null;
}

function _getElectronAPI() {
    if (typeof window === 'undefined') return null;
    return window.electronAPI?.save ?? null;
}

export function isElectronAvailable() {
    return Boolean(_getElectronAPI());
}

function _pathForKey(key) {
    const safe = String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${safe}.json`;
}

export function isTauriStorageAvailable() {
    return Boolean(_getInvoke());
}

export async function storageGetItem(key) {
    if (typeof window === 'undefined') return null;

    // Electron file-based storage
    const electron = _getElectronAPI();
    if (electron) {
        try {
            const data = await electron.read(key);
            if (data !== null && data !== undefined) {
                return typeof data === 'string' ? data : JSON.stringify(data);
            }
        } catch (e) {
            console.warn(`Electron storage read failed for ${key}; falling back.`, e);
        }
    }

    // Tauri invoke
    const invoke = _getInvoke();
    if (invoke) {
        try {
            const value = await invoke('load_file', { path: _pathForKey(key) });
            return value ?? null;
        } catch (e) {
            console.warn(`Tauri storage read failed for ${key}; falling back to localStorage.`, e);
        }
    }

    try {
        if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return null;
        return localStorage.getItem(key);
    } catch (e) {
        console.warn(`localStorage read failed for ${key}.`, e);
        return null;
    }
}

export function storageGetItemSync(key) {
    if (typeof window === 'undefined') return null;
    try {
        if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return null;
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export async function storageSetItem(key, value) {
    if (typeof window === 'undefined') return false;

    // Electron file-based storage
    const electron = _getElectronAPI();
    if (electron) {
        try {
            const data = typeof value === 'string' ? JSON.parse(value) : value;
            await electron.write(key, data);
            return true;
        } catch (e) {
            console.warn(`Electron storage write failed for ${key}; falling back.`, e);
        }
    }

    // Tauri invoke
    const invoke = _getInvoke();
    if (invoke) {
        try {
            await invoke('save_file', { path: _pathForKey(key), data: value });
            return true;
        } catch (e) {
            console.warn(`Tauri storage write failed for ${key}; falling back to localStorage.`, e);
        }
    }

    try {
        if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return false;
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn(`localStorage write failed for ${key}.`, e);
        return false;
    }
}

export async function storageRemoveItem(key) {
    if (typeof window === 'undefined') return false;
    const invoke = _getInvoke();
    if (invoke) {
        try {
            await invoke('delete_file', { path: _pathForKey(key) });
            return true;
        } catch (e) {
            console.warn(`Tauri storage delete failed for ${key}; falling back to localStorage.`, e);
        }
    }

    try {
        if (typeof localStorage === 'undefined' || typeof localStorage.removeItem !== 'function') return false;
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.warn(`localStorage delete failed for ${key}.`, e);
        return false;
    }
}
