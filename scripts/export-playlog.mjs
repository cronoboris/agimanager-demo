#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function csvEscape(value) {
    if (value == null) return '';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function flattenDevLog(payload) {
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.devLog)) return payload.devLog;
    if (Array.isArray(payload.state?.devLog)) return payload.state.devLog;
    if (Array.isArray(payload.payload?.state?.devLog)) return payload.payload.state.devLog;
    return [];
}

function resolveSavePath(inputPath = 'saves/latest.json') {
    const directPath = resolve(inputPath);
    if (existsSync(directPath) && statSync(directPath).isFile()) {
        return directPath;
    }

    const latestPath = resolve('saves/latest.json');
    if (existsSync(latestPath) && statSync(latestPath).isFile()) {
        return latestPath;
    }

    const savesDir = resolve('saves');
    if (existsSync(savesDir) && statSync(savesDir).isDirectory()) {
        const candidates = readdirSync(savesDir)
            .filter(name => name.endsWith('.json'))
            .map(name => ({
                path: join(savesDir, name),
                mtimeMs: statSync(join(savesDir, name)).mtimeMs
            }))
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
        if (candidates.length > 0) {
            return candidates[0].path;
        }
    }

    return directPath;
}

function main() {
    const savePath = resolveSavePath(process.argv[2] || 'saves/latest.json');
    let payload;

    try {
        payload = JSON.parse(readFileSync(savePath, 'utf8'));
    } catch (error) {
        console.error(`Unable to read save file: ${savePath}`);
        console.error(error.message);
        process.exit(1);
    }

    const devLog = flattenDevLog(payload);
    if (!devLog.length) {
        console.error('No devLog found in save file');
        process.exit(1);
    }

    const headers = Object.keys(devLog[0]);
    process.stdout.write(`${headers.join(',')}\n`);
    for (const row of devLog) {
        process.stdout.write(`${headers.map(header => csvEscape(row[header])).join(',')}\n`);
    }
}

main();
