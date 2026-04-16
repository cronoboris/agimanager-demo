import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT_DIR = join(ROOT, 'output', 'release');
const WEB_DIR = join(OUT_DIR, 'web');
const APP_NAME = 'AGI Manager.app';
const APP_DIR = join(OUT_DIR, APP_NAME);
const APP_CONTENTS = join(APP_DIR, 'Contents');
const APP_MACOS = join(APP_CONTENTS, 'MacOS');
const APP_RESOURCES = join(APP_CONTENTS, 'Resources');
const ZIP_PATH = join(OUT_DIR, 'AGI-Manager-macOS.zip');

const WEB_ITEMS = ['index.html', 'css', 'js', 'assets', 'data', 'locales'];

function resetDir(path) {
    rmSync(path, { recursive: true, force: true });
    mkdirSync(path, { recursive: true });
}

function copyWebAssets(destRoot) {
    mkdirSync(destRoot, { recursive: true });
    for (const item of WEB_ITEMS) {
        cpSync(join(ROOT, item), join(destRoot, item), { recursive: true });
    }
}

console.log('🔨 Building release bundle...');

resetDir(OUT_DIR);
copyWebAssets(WEB_DIR);

mkdirSync(APP_MACOS, { recursive: true });
mkdirSync(APP_RESOURCES, { recursive: true });
copyWebAssets(join(APP_RESOURCES, 'web'));

const plistTemplate = readFileSync(join(ROOT, 'packaging', 'macos', 'Info.plist'), 'utf8');
const launcherTemplate = readFileSync(join(ROOT, 'packaging', 'macos', 'launcher.sh'), 'utf8');
const stopLauncherTemplate = readFileSync(join(ROOT, 'packaging', 'macos', 'stop-launcher.sh'), 'utf8');

writeFileSync(join(APP_CONTENTS, 'Info.plist'), plistTemplate);
writeFileSync(join(APP_MACOS, 'agi-manager-launcher'), launcherTemplate);
chmodSync(join(APP_MACOS, 'agi-manager-launcher'), 0o755);
writeFileSync(join(OUT_DIR, 'Stop AGI Manager.command'), stopLauncherTemplate);
chmodSync(join(OUT_DIR, 'Stop AGI Manager.command'), 0o755);

rmSync(ZIP_PATH, { force: true });
execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', APP_DIR, ZIP_PATH]);

console.log(`✅ Web bundle: ${WEB_DIR}`);
console.log(`✅ macOS app:  ${APP_DIR}`);
console.log(`✅ Zip archive: ${ZIP_PATH}`);
console.log(`✅ Stop script: ${join(OUT_DIR, 'Stop AGI Manager.command')}`);
console.log('');
console.log('Next steps:');
console.log(`1. Open the app: open "${APP_DIR}"`);
console.log(`2. Or run the launcher directly: "${join(APP_MACOS, 'agi-manager-launcher')}"`);
