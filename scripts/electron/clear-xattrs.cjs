const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { isDropboxBackedPath } = require('./builder-paths.cjs');

module.exports = async function clearXattrs(context) {
    if (process.platform !== 'darwin') return;

    const productName = context?.appInfo?.productFilename || context?.packager?.appInfo?.productFilename;
    const explicitAppPath = context?.appPath || (productName && context?.appOutDir
        ? path.join(context.appOutDir, `${productName}.app`)
        : null);

    const targets = [
        explicitAppPath,
        context?.appOutDir,
        context?.packager?.appInfo?.appOutDir
    ]
        .filter(Boolean)
        .filter((target, index, list) => list.indexOf(target) === index)
        .filter((target) => fs.existsSync(target));

    for (const target of targets) {
        const result = spawnSync('xattr', ['-cr', target], { stdio: 'inherit' });
        if (result.status !== 0) {
            throw new Error(`xattr cleanup failed for ${target}`);
        }

        const probe = spawnSync('xattr', ['-lr', target], { encoding: 'utf8' });
        if (probe.status === 0 && /com\.apple\.FinderInfo|com\.apple\.fileprovider\./.test(probe.stdout)) {
            const locationHint = isDropboxBackedPath(target)
                ? 'macOS builds inside Dropbox-backed folders can reattach FinderInfo during signing; use AGI_MANAGER_ELECTRON_OUT_DIR or npm run build:mac:dir.'
                : `lingering disallowed xattrs detected under ${target}`;
            throw new Error(locationHint);
        }
    }
};
