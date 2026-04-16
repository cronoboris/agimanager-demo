const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveMacBuildOutputDir } = require('./builder-paths.cjs');

function hasOutputOverride(args) {
    return args.some((arg) => arg.startsWith('-c.directories.output=') || arg.startsWith('--config.directories.output='));
}

function collectAppBundles(rootDir, depth = 0) {
    if (!fs.existsSync(rootDir) || depth > 3) return [];

    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const apps = [];

    for (const entry of entries) {
        const entryPath = path.join(rootDir, entry.name);
        if (entry.isDirectory() && entry.name.endsWith('.app')) {
            apps.push(entryPath);
            continue;
        }

        if (entry.isDirectory()) {
            apps.push(...collectAppBundles(entryPath, depth + 1));
        }
    }

    return apps;
}

function verifyMacArtifacts(outputDir) {
    const apps = collectAppBundles(outputDir);
    if (apps.length === 0) {
        console.warn(`[electron-builder] No macOS app bundle found under ${outputDir}`);
        return;
    }

    for (const appPath of apps) {
        console.log(`[electron-builder] Verifying codesign: ${appPath}`);
        const result = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
            stdio: 'inherit'
        });
        if (result.status !== 0) {
            process.exit(result.status || 1);
        }
    }
}

const projectDir = process.cwd();
const args = process.argv.slice(2);
const builderArgs = [...args];
const outputDir = resolveMacBuildOutputDir({ projectDir });

if (process.platform === 'darwin' && !hasOutputOverride(builderArgs)) {
    builderArgs.push(`-c.directories.output=${outputDir}`);
    if (path.resolve(outputDir).startsWith(path.resolve(projectDir))) {
        console.log(`[electron-builder] Using workspace output: ${outputDir}`);
    } else {
        console.log(`[electron-builder] Using macOS-safe output outside the synced workspace: ${outputDir}`);
    }
}

const cliPath = require.resolve('electron-builder/out/cli/cli.js');
const buildResult = spawnSync(process.execPath, [cliPath, ...builderArgs], {
    stdio: 'inherit'
});

if (buildResult.status !== 0) {
    process.exit(buildResult.status || 1);
}

if (process.platform === 'darwin') {
    verifyMacArtifacts(outputDir);
}
