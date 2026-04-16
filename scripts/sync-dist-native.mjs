#!/usr/bin/env node

import { cpSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist-native');
const COPY_DIRS = ['js', 'css', 'data', 'locales', 'assets'];
const COPY_FILES = ['index.html'];

function collectFiles(dir, base = dir) {
    const results = [];
    if (!existsSync(dir)) return results;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(full, base));
        } else {
            results.push(relative(base, full));
        }
    }
    return results.sort();
}

console.log('Syncing dist-native/ ...');

for (const dir of COPY_DIRS) {
    const src = join(ROOT, dir);
    const dst = join(DIST, dir);
    if (!existsSync(src)) continue;
    cpSync(src, dst, { recursive: true, force: true });
    console.log(`  ✓ ${dir}/`);
}

for (const file of COPY_FILES) {
    const src = join(ROOT, file);
    const dst = join(DIST, file);
    if (!existsSync(src)) continue;
    cpSync(src, dst, { force: true });
    console.log(`  ✓ ${file}`);
}

const srcJs = new Set(collectFiles(join(ROOT, 'js'), join(ROOT, 'js')));
const distJs = new Set(collectFiles(join(DIST, 'js'), join(DIST, 'js')));

let missing = 0;
for (const file of srcJs) {
    if (!distJs.has(file)) {
        console.error(`  ✗ MISSING in dist-native: js/${file}`);
        missing++;
    }
}

for (const file of distJs) {
    if (!srcJs.has(file)) {
        console.warn(`  ! EXTRA only in dist-native: js/${file}`);
    }
}

if (missing > 0) {
    console.error(`\n${missing} file(s) missing in dist-native/`);
    process.exit(1);
}

console.log(`\n✓ dist-native/ is in sync (${srcJs.size} JS files)`);
