import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = join(ROOT, 'dist-native');
const WEB_ITEMS = ['index.html', 'css', 'js', 'assets', 'data', 'locales'];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const item of WEB_ITEMS) {
    const src = join(ROOT, item);
    if (!existsSync(src)) {
        throw new Error(`Missing required web asset: ${src}`);
    }
    cpSync(src, join(DIST, item), { recursive: true });
}

console.log(`native dist ready: ${DIST}`);
