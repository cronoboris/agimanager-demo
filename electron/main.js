const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Steam 초기화 ──────────────────────────────────────────────
let steamworks = null;
let steamClient = null;
let steamOverlayEnabled = false;
let steamOverlayRefreshInterval = null;

function resolveSteamAppId() {
    const envAppId = Number(process.env.STEAM_APP_ID);
    if (Number.isFinite(envAppId) && envAppId > 0) {
        return envAppId;
    }

    for (const basePath of [app.getAppPath(), process.cwd()]) {
        try {
            const appIdPath = path.join(basePath, 'steam_appid.txt');
            if (fs.existsSync(appIdPath)) {
                const fileAppId = Number(fs.readFileSync(appIdPath, 'utf8').trim());
                if (Number.isFinite(fileAppId) && fileAppId > 0) {
                    return fileAppId;
                }
            }
        } catch (err) {
            console.warn('[Steam] Failed to read steam_appid.txt:', err.message);
        }
    }

    return 480;
}

function stopSteamOverlayRefreshLoop() {
    if (steamOverlayRefreshInterval) {
        clearInterval(steamOverlayRefreshInterval);
        steamOverlayRefreshInterval = null;
    }
}

function startSteamOverlayRefreshLoop() {
    if (!steamClient || steamOverlayRefreshInterval || !mainWindow) return;

    steamOverlayRefreshInterval = setInterval(() => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            stopSteamOverlayRefreshLoop();
            return;
        }

        try {
            mainWindow.webContents.invalidate();
        } catch (err) {
            console.warn('[Steam] Overlay refresh failed:', err.message);
        }
    }, 1000 / 30);
}

function initSteam() {
    try {
        steamworks = require('steamworks.js');
        const appId = resolveSteamAppId();
        steamClient = steamworks.init(appId);
        console.log(`[Steam] Initialized successfully with appId ${appId}`);
        return true;
    } catch (err) {
        console.warn('[Steam] Not available:', err.message);
        steamworks = null;
        steamClient = null;
        stopSteamOverlayRefreshLoop();
        return false;
    }
}

// ── 윈도우 생성 ──────────────────────────────────────────────
let mainWindow = null;
const isDev = process.argv.includes('--dev');

const DISPLAY_MODES = new Set(['windowed', 'fullscreen', 'borderless']);

function normalizeDisplayMode(mode) {
    return DISPLAY_MODES.has(mode) ? mode : 'windowed';
}

function formatResolutionLabel(width, height) {
    return `${Math.round(width)} × ${Math.round(height)}`;
}

function getDisplayState() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return null;
    }

    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds) || screen.getPrimaryDisplay();

    return {
        mode: mainWindow.isFullScreen()
            ? 'fullscreen'
            : (mainWindow.isMaximized() ? 'borderless' : 'windowed'),
        resolution: {
            width: bounds.width,
            height: bounds.height
        },
        bounds,
        display: display ? {
            id: display.id,
            bounds: display.bounds,
            workArea: display.workArea,
            scaleFactor: display.scaleFactor
        } : null
    };
}

function getAvailableResolutions() {
    const resolutions = new Map();

    for (const display of screen.getAllDisplays()) {
        for (const size of [display.size, display.workAreaSize]) {
            if (!size) continue;

            const width = Math.round(size.width);
            const height = Math.round(size.height);
            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                continue;
            }

            const value = `${width}x${height}`;
            if (!resolutions.has(value)) {
                resolutions.set(value, {
                    value,
                    width,
                    height,
                    label: formatResolutionLabel(width, height)
                });
            }
        }
    }

    return [...resolutions.values()].sort((a, b) => {
        const areaDiff = (b.width * b.height) - (a.width * a.height);
        if (areaDiff !== 0) return areaDiff;
        if (b.width !== a.width) return b.width - a.width;
        return b.height - a.height;
    });
}

function applyDisplayMode(mode) {
    if (!mainWindow || mainWindow.isDestroyed()) return null;

    const nextMode = normalizeDisplayMode(mode);

    if (nextMode === 'fullscreen') {
        mainWindow.setMenuBarVisibility(false);
        mainWindow.setFullScreen(true);
        return getDisplayState();
    }

    mainWindow.setFullScreen(false);
    if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
    }

    if (nextMode === 'borderless') {
        mainWindow.setMenuBarVisibility(false);
        if (!mainWindow.isMaximized()) {
            mainWindow.maximize();
        }
        return getDisplayState();
    }

    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    }
    mainWindow.setMenuBarVisibility(false);
    return getDisplayState();
}

function applyDisplayResolution(width, height) {
    if (!mainWindow || mainWindow.isDestroyed()) return null;

    const nextWidth = Math.round(Number(width));
    const nextHeight = Math.round(Number(height));
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth <= 0 || nextHeight <= 0) {
        return getDisplayState();
    }

    if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
    }

    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    }

    mainWindow.setSize(nextWidth, nextHeight);
    return getDisplayState();
}

function attachDisplayWindowEvents() {
    mainWindow.on('blur', () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        mainWindow.webContents.send('window:blur');
    });

    mainWindow.on('focus', () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        mainWindow.webContents.send('window:focus');
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        title: 'AGI Manager',
        backgroundColor: '#02040a',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // steamworks.js 호환
        },
    });

    attachDisplayWindowEvents();

    // 메뉴바 숨기기 (게임이니까)
    mainWindow.setMenuBarVisibility(false);

    // index.html 로드
    const indexPath = path.join(__dirname, '..', 'index.html');
    mainWindow.loadFile(indexPath);

    // 준비되면 표시
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (isDev) {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    mainWindow.on('closed', () => {
        stopSteamOverlayRefreshLoop();
        mainWindow = null;
    });

    if (steamOverlayEnabled) {
        startSteamOverlayRefreshLoop();
    }
}

// ── Steam Overlay 활성화 ─────────────────────────────────────
function enableSteamOverlay() {
    try {
        if (steamworks && typeof steamworks.electronEnableSteamOverlay === 'function') {
            steamworks.electronEnableSteamOverlay(true);
            console.log('[Steam] Overlay enabled');
            steamOverlayEnabled = true;
            startSteamOverlayRefreshLoop();
        }
    } catch (err) {
        console.warn('[Steam] Overlay setup failed:', err.message);
    }
}

// ── IPC 핸들러 (Renderer ↔ Main) ────────────────────────────
function setupIPC() {
    // 세이브/로드 (파일 시스템)
    const savePath = path.join(app.getPath('userData'), 'saves');
    if (!fs.existsSync(savePath)) fs.mkdirSync(savePath, { recursive: true });

    ipcMain.handle('save:write', async (_, slot, data) => {
        const filePath = path.join(savePath, `slot_${slot}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return { success: true, path: filePath };
    });

    ipcMain.handle('save:read', async (_, slot) => {
        const filePath = path.join(savePath, `slot_${slot}.json`);
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    ipcMain.handle('save:list', async () => {
        if (!fs.existsSync(savePath)) return [];
        return fs.readdirSync(savePath)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const stat = fs.statSync(path.join(savePath, f));
                return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
            });
    });

    ipcMain.handle('save:delete', async (_, slot) => {
        const filePath = path.join(savePath, `slot_${slot}.json`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return { success: true };
    });

    // Steam API
    ipcMain.handle('steam:isAvailable', () => !!steamClient);

    ipcMain.handle('steam:getPlayerName', () => {
        if (!steamClient) return 'Player';
        try { return steamClient.localplayer.getName() || 'Player'; }
        catch { return 'Player'; }
    });

    ipcMain.handle('steam:unlockAchievement', (_, id) => {
        if (!steamClient) return false;
        try {
            steamClient.achievement.activate(id);
            return true;
        } catch { return false; }
    });

    ipcMain.handle('steam:setRichPresence', (_, key, value) => {
        if (!steamClient) return false;
        try {
            steamClient.localplayer.setRichPresence(key, value ?? undefined);
            return true;
        } catch { return false; }
    });

    ipcMain.handle('steam:getAchievements', () => {
        if (!steamClient) return [];
        const achievementIds = [
            'first_tech', 'ten_techs', 'deep_research', 'first_model', 'trained_model', 'first_deploy',
            'three_deploys', 'model_50', 'model_80', 'seed_round', 'series_a', 'ipo', 'millionaire',
            'unicorn', 'team_10', 'team_50', 'datacenter', 'market_10', 'market_30', 'safety_stack',
            'chip_stack', 'no_cloud', 'good_public', 'investor_trust', 'agi', 'safety_leader',
            'market_dominance', 'talent_exodus', 'survive_bankruptcy', 'rich_revenue'
        ];
        try {
            return achievementIds.map(id => ({
                id,
                unlocked: steamClient.achievement.isActivated(id)
            }));
        } catch {
            return [];
        }
    });

    ipcMain.handle('steam:cloudSave', async (_, key, data) => {
        if (!steamClient) return false;
        try {
            const payload = typeof data === 'string' ? data : JSON.stringify(data);
            return Boolean(steamClient.cloud.writeFile(key, payload));
        } catch {
            return false;
        }
    });

    ipcMain.handle('steam:cloudLoad', async (_, key) => {
        if (!steamClient) return null;
        try {
            if (!steamClient.cloud.fileExists(key)) return null;
            const payload = steamClient.cloud.readFile(key);
            if (!payload) return null;
            try {
                return JSON.parse(payload);
            } catch {
                return payload;
            }
        } catch {
            return null;
        }
    });

    // 앱 정보
    ipcMain.handle('app:getVersion', () => app.getVersion());
    ipcMain.handle('app:getSavePath', () => savePath);
    ipcMain.handle('app:getPlatform', () => process.platform);
    ipcMain.handle('app:quit', () => { app.quit(); });

    // 디스플레이
    ipcMain.handle('display:setMode', (_, mode) => applyDisplayMode(mode));
    ipcMain.handle('display:setResolution', (_, width, height) => applyDisplayResolution(width, height));
    ipcMain.handle('display:getState', () => getDisplayState());
    ipcMain.handle('display:getResolutions', () => getAvailableResolutions());

    // 아바타 생성 (DiceBear — Node.js에서 오프라인 생성)
    let _dicebearCore = null;
    let _dicebearAvataaars = null;

    ipcMain.handle('avatar:generate', async (_, options) => {
        try {
            if (!_dicebearCore) _dicebearCore = await import('@dicebear/core');
            if (!_dicebearAvataaars) _dicebearAvataaars = await import('@dicebear/collection');

            // DiceBear v9는 옵션을 배열로 받음
            const opts = {};
            for (const [key, val] of Object.entries(options || {})) {
                if (val && val !== 'blank' && val !== '') {
                    opts[key] = Array.isArray(val) ? val : [val];
                }
            }
            // blank 처리: 확률 0으로 설정하여 비활성화
            if (!options.facialHair || options.facialHair === 'blank') {
                opts.facialHairProbability = [0];
            }
            if (!options.accessories || options.accessories === 'blank') {
                opts.accessoriesProbability = [0];
            }

            const avatar = _dicebearCore.createAvatar(_dicebearAvataaars.avataaars, {
                ...opts,
                radius: [50],
                backgroundColor: ['1a2332'],
            });
            const svg = avatar.toString();
            return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
        } catch (err) {
            console.warn('[Avatar] Generation failed:', err.message);
            return null;
        }
    });
}

// ── 앱 라이프사이클 ──────────────────────────────────────────
app.whenReady().then(() => {
    const steamOk = initSteam();
    setupIPC();
    createWindow();
    if (steamOk) enableSteamOverlay();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
    stopSteamOverlayRefreshLoop();
});
