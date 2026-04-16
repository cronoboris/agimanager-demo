#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

export async function runContentLint({ rootDir = REPO_ROOT } = {}) {
    const warnings = [];
    const errors = [];
    const filesChecked = [];

    const localeKeys = new Set(flattenKeys(readJson(join(rootDir, 'locales/ko.json'))));
    const jsFiles = collectJsFiles(join(rootDir, 'js'));
    filesChecked.push(...jsFiles);

    const i18nFindings = collectMissingI18nKeys(jsFiles, localeKeys, rootDir);
    for (const finding of i18nFindings.slice(0, 20)) {
        warnings.push(`[i18n] Missing key: "${finding.key}" (${finding.file}:${finding.line})`);
    }

    const eventsModule = await import(pathToFileURL(join(rootDir, 'js/data/historical_events.js')).href);
    const events = [
        ...(eventsModule.HISTORICAL_EVENTS || []),
        ...(eventsModule.RANDOM_EVENTS || []),
        ...(eventsModule.TECH_MILESTONE_EVENTS || [])
    ];

    for (const finding of checkEventChainIntegrity(events)) {
        errors.push(`[event] ${finding}`);
    }

    for (const finding of checkTechPrereqs(readJson(join(rootDir, 'data/json/technologies.json')))) {
        errors.push(`[tech] ${finding}`);
    }

    for (const finding of checkModelPrereqs(readJson(join(rootDir, 'data/json/models.json')))) {
        warnings.push(`[model] ${finding}`);
    }

    const countries = readJson(join(rootDir, 'data/json/countries.json'));
    const regionsPath = join(rootDir, 'data/json/regions.json');
    if (existsSync(regionsPath)) {
        for (const finding of checkCountryRegionRefs(countries, readJson(regionsPath))) {
            warnings.push(`[country] ${finding}`);
        }
    }

    const campaignPath = join(rootDir, 'data/json/campaign.json');
    if (existsSync(campaignPath)) {
        for (const finding of checkCampaignOrder(readJson(campaignPath))) {
            warnings.push(`[campaign] ${finding}`);
        }
    }

    return {
        filesChecked: filesChecked.length,
        warnings,
        errors
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await runContentLint();
    for (const warning of result.warnings) {
        console.warn(warning);
    }
    for (const error of result.errors) {
        console.error(error);
    }

    console.log('');
    console.log('=== Content Lint Summary ===');
    console.log(`Files checked: ${result.filesChecked}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Errors: ${result.errors.length}`);

    process.exit(result.errors.length > 0 ? 1 : 0);
}

function collectMissingI18nKeys(files, localeKeys, rootDir) {
    const findings = [];
    const seen = new Set();
    const pattern = /\bt\(\s*(['"])([^'"]+)\1/g;

    for (const file of files) {
        const content = readFileSync(file, 'utf8');
        let match;
        while ((match = pattern.exec(content))) {
            const key = match[2];
            if (key.startsWith('event.')) continue;
            if (localeKeys.has(key)) continue;
            const line = lineNumberForOffset(content, match.index);
            const signature = `${key}@${file}:${line}`;
            if (seen.has(signature)) continue;
            seen.add(signature);
            findings.push({
                key,
                file: file.replace(`${rootDir}/`, ''),
                line
            });
        }
    }

    return findings;
}

function checkEventChainIntegrity(events) {
    const findings = [];
    const chains = new Map();

    for (const event of events) {
        if (!event || typeof event !== 'object' || !event.chainId) continue;
        const chainId = String(event.chainId);
        const step = Number(event.chainStep || 1);
        if (!chains.has(chainId)) chains.set(chainId, []);
        chains.get(chainId).push({ id: event.id || '(unknown)', step, event });

        if (event.chainAdvance) {
            const { chainId: advanceChainId, step: advanceStep } = event.chainAdvance;
            if (advanceChainId && advanceChainId !== chainId) {
                findings.push(`Event "${event.id}" advances chain "${advanceChainId}" but belongs to "${chainId}"`);
            }
            if (Number(advanceStep || step) !== step) {
                findings.push(`Event "${event.id}" chainAdvance step ${advanceStep} does not match chainStep ${step}`);
            }
        }
    }

    for (const [chainId, steps] of chains) {
        steps.sort((a, b) => a.step - b.step);
        const uniqueSteps = [...new Set(steps.map(item => item.step))];
        for (let index = 0; index < uniqueSteps.length; index += 1) {
            const expected = index + 1;
            if (uniqueSteps[index] !== expected) {
                findings.push(`Chain "${chainId}" has a gap at step ${expected}`);
                break;
            }
        }
    }

    return findings;
}

function checkTechPrereqs(data) {
    const findings = [];
    const techs = Object.values(data?.TECH_TREE || {});
    const techIds = new Set(techs.map(tech => tech?.id).filter(Boolean));

    for (const tech of techs) {
        for (const req of normalizeList(tech?.requires)) {
            if (!techIds.has(req)) {
                findings.push(`"${tech.id}" requires missing tech "${req}"`);
            }
        }
        for (const req of normalizeList(tech?.requiresAny)) {
            if (!techIds.has(req)) {
                findings.push(`"${tech.id}" requiresAny missing tech "${req}"`);
            }
        }
    }

    const reachable = new Set();
    const queue = techs.filter(tech => normalizeList(tech?.requires).length === 0 && normalizeList(tech?.requiresAny).length === 0)
        .map(tech => tech.id);

    while (queue.length > 0) {
        const current = queue.shift();
        if (reachable.has(current)) continue;
        reachable.add(current);

        for (const tech of techs) {
            const deps = normalizeList(tech?.requires).concat(normalizeList(tech?.requiresAny));
            if (deps.includes(current)) queue.push(tech.id);
        }
    }

    for (const tech of techs) {
        if (tech?.id && !reachable.has(tech.id)) {
            findings.push(`"${tech.id}" is unreachable from any root tech`);
        }
    }

    return findings;
}

function checkModelPrereqs(data) {
    const findings = [];
    const techIds = new Set(Object.values(data?.TECH_TREE || {}).map(tech => tech?.id).filter(Boolean));
    const models = collectObjectsWithKey(data, 'requiresTech');

    for (const model of models) {
        for (const req of normalizeList(model.requiresTech)) {
            if (!techIds.has(req)) {
                findings.push(`model "${model.id || model.name || 'unknown'}" requires missing tech "${req}"`);
            }
        }
    }

    return findings;
}

function checkCountryRegionRefs(countryData, regionData) {
    const findings = [];
    const countries = countryData?.COUNTRIES || {};
    const regions = regionData?.REGIONS || {};
    const countryIds = new Set(Object.keys(countries));

    for (const [countryId, country] of Object.entries(countries)) {
        if (country?.playable && !country?.region) {
            findings.push(`playable country "${countryId}" is missing region`);
        }
        if (country?.region && !regions[country.region]) {
            findings.push(`country "${countryId}" references missing region "${country.region}"`);
        }
    }

    for (const [regionId, region] of Object.entries(regions)) {
        for (const ref of normalizeList(region?.countries)) {
            if (!countryIds.has(ref)) {
                findings.push(`region "${regionId}" references missing country "${ref}"`);
            }
        }
    }

    return findings;
}

function checkCampaignOrder(data) {
    const findings = [];
    const acts = data?.ACTS || {};
    for (const actId of normalizeList(data?.ACT_ORDER)) {
        if (!acts[actId]) {
            findings.push(`ACT_ORDER references missing act "${actId}"`);
        }
    }
    return findings;
}

function collectJsFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectJsFiles(fullPath));
        } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

function collectObjectsWithKey(root, key) {
    const results = [];
    const seen = new Set();

    function visit(value) {
        if (!value || typeof value !== 'object') return;
        if (seen.has(value)) return;
        seen.add(value);

        if (Object.prototype.hasOwnProperty.call(value, key)) {
            results.push(value);
        }

        for (const child of Object.values(value)) {
            visit(child);
        }
    }

    visit(root);
    return results;
}

function normalizeList(value) {
    if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
    if (value == null || value === '') return [];
    return [String(value)];
}

function flattenKeys(value, prefix = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const keys = [];
    for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object' && !Array.isArray(child)) {
            keys.push(...flattenKeys(child, path));
        } else {
            keys.push(path);
        }
    }
    return keys;
}

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

function lineNumberForOffset(text, offset) {
    return text.slice(0, offset).split('\n').length;
}
