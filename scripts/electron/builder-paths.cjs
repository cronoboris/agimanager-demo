const os = require('node:os');
const path = require('node:path');

function normalizePath(value) {
    return path.resolve(value).replace(/\\/g, '/');
}

function isDropboxBackedPath(targetPath) {
    const normalized = normalizePath(targetPath);
    return normalized.includes('/Library/CloudStorage/Dropbox/') || normalized.includes('/Dropbox/');
}

function resolveOutputOverride(projectDir, env = process.env, platform = process.platform) {
    const configured = env.AGI_MANAGER_ELECTRON_OUT_DIR;
    if (configured) {
        return path.isAbsolute(configured) ? configured : path.resolve(projectDir, configured);
    }

    if (platform === 'darwin' && isDropboxBackedPath(projectDir)) {
        return path.join(os.tmpdir(), 'agimanager-electron-dist');
    }

    return path.resolve(projectDir, 'dist-electron');
}

function resolveMacBuildOutputDir(options = {}) {
    const projectDir = options.projectDir || process.cwd();
    const env = options.env || process.env;
    const platform = options.platform || process.platform;
    return resolveOutputOverride(projectDir, env, platform);
}

module.exports = {
    isDropboxBackedPath,
    resolveMacBuildOutputDir
};
