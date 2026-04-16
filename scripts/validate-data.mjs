#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data/json');

let errorCount = 0;
let warningCount = 0;
let filesChecked = 0;

function report(level, message) {
    const line = `[${level}] ${message}`;
    if (level === 'ERROR') errorCount += 1;
    if (level === 'WARN') warningCount += 1;
    process.stderr.write(`${line}\n`);
}

function readJson(name) {
    filesChecked += 1;
    return JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));
}

function readOptionalJson(name) {
    const filePath = join(DATA_DIR, name);
    if (!existsSync(filePath)) return null;
    filesChecked += 1;
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function validateTechTree(data) {
    const techTree = data?.TECH_TREE || {};
    const techIds = new Set(Object.keys(techTree));

    for (const [id, tech] of Object.entries(techTree)) {
        try {
            assertCondition(tech && typeof tech === 'object', `${id}: tech entry must be an object`);
            assertCondition(typeof tech.id === 'string', `${id}: id must be a string`);
            assertCondition(
                typeof tech.name === 'string' || (tech.name && typeof tech.name === 'object'),
                `${id}: name must be a string or locale object`
            );
            assertCondition(typeof tech.cost === 'number', `${id}: cost must be a number`);
            assertCondition(typeof tech.route === 'string', `${id}: route must be a string`);

            for (const field of ['requires', 'requiresAny']) {
                if (tech[field] == null) continue;
                assertCondition(Array.isArray(tech[field]), `${id}: ${field} must be an array`);
                for (const reqId of tech[field]) {
                    assertCondition(techIds.has(reqId), `${id}.${field}: "${reqId}" not found`);
                }
            }
        } catch (error) {
            report('ERROR', `technologies.json:${error.message}`);
        }
    }
}

function validateCompanies(data, countries) {
    const companies = Array.isArray(data?.COMPETITORS) ? data.COMPETITORS : [];
    const countryIds = new Set(Object.keys(countries || {}));

    for (const company of companies) {
        try {
            assertCondition(company && typeof company === 'object', 'company entry must be an object');
            assertCondition(typeof company.id === 'string', `${company?.id || 'unknown'}: id must be a string`);
            assertCondition(
                typeof company.name === 'string' || (company.name && typeof company.name === 'object'),
                `${company?.id || 'unknown'}: name must be a string or locale object`
            );
            assertCondition(typeof company.country === 'string', `${company.id}: country must be a string`);
            assertCondition(countryIds.has(company.country), `${company.id}: country "${company.country}" not found`);
            assertCondition(company.stats && typeof company.stats === 'object', `${company.id}: stats must be an object`);
            assertCondition(typeof company.stats.researchPower === 'number', `${company.id}: stats.researchPower must be a number`);
            assertCondition(typeof company.stats.aggression === 'number', `${company.id}: stats.aggression must be a number`);
            assertCondition(typeof company.aiLevel === 'number', `${company.id}: aiLevel must be a number`);
            assertCondition(company.currentModel && typeof company.currentModel === 'object', `${company.id}: currentModel must be an object`);
            assertCondition(typeof company.currentModel.name === 'string', `${company.id}: currentModel.name must be a string`);
            assertCondition(typeof company.currentModel.performance === 'number', `${company.id}: currentModel.performance must be a number`);
            assertCondition(
                company.doctrine != null,
                `${company.id}: doctrine must exist`
            );
            if (company.doctrine && typeof company.doctrine === 'object') {
                assertCondition(typeof company.doctrine.type === 'string', `${company.id}: doctrine.type must be a string`);
            }
            if (company.initialFunds == null) {
                report('WARN', `companies.json:${company.id}: initialFunds missing (using runtime defaults)`);
            } else {
                assertCondition(typeof company.initialFunds === 'number', `${company.id}: initialFunds must be a number`);
            }
        } catch (error) {
            report('ERROR', `companies.json:${error.message}`);
        }
    }
}

function validateCountries(data) {
    const countries = data?.COUNTRIES || {};
    const regions = data?.REGIONS || {};
    const countryIds = new Set(Object.keys(countries));

    for (const [id, country] of Object.entries(countries)) {
        try {
            assertCondition(country && typeof country === 'object', `${id}: country entry must be an object`);
            assertCondition(typeof country.id === 'string', `${id}: id must be a string`);
            assertCondition(typeof country.name === 'string', `${id}: name must be a string`);
            assertCondition(typeof country.region === 'string', `${id}: region must be a string`);
            assertCondition(typeof country.playable === 'boolean', `${id}: playable must be a boolean`);
            assertCondition(country.bonuses && typeof country.bonuses === 'object', `${id}: bonuses must be an object`);
            assertCondition(country.penalties && typeof country.penalties === 'object', `${id}: penalties must be an object`);
            if (country.playable) {
                assertCondition(country.region.length > 0, `${id}: playable country missing region`);
                const policy = country.policy || data?.COUNTRY_POLICY_OVERRIDES?.[id];
                assertCondition(policy && typeof policy === 'object', `${id}: playable country missing policy`);
            }
        } catch (error) {
            report('ERROR', `countries.json:${error.message}`);
        }
    }

    for (const [regionId, region] of Object.entries(regions)) {
        try {
            if (!region || typeof region !== 'object') continue;
            if (!Array.isArray(region.countries)) continue;
            for (const countryRef of region.countries) {
                assertCondition(countryIds.has(countryRef), `region ${regionId}: country "${countryRef}" not in countries.json`);
            }
        } catch (error) {
            report('ERROR', `countries.json:${error.message}`);
        }
    }
}

function validateModels(data, techTree) {
    const architectures = data?.MODEL_ARCHITECTURES || {};
    const benchmarkCatalog = Array.isArray(data?.BENCHMARKS) ? data.BENCHMARKS : [];
    const deploymentStrategies = data?.DEPLOYMENT_STRATEGIES || {};
    const dataTypes = data?.DATA_TYPES || {};
    const techIds = new Set(Object.keys(techTree || {}));

    for (const [id, arch] of Object.entries(architectures)) {
        try {
            assertCondition(arch && typeof arch === 'object', `${id}: architecture must be an object`);
            assertCondition(typeof arch.id === 'string', `${id}: id must be a string`);
            assertCondition(
                typeof arch.name === 'string' || (arch.name && typeof arch.name === 'object'),
                `${id}: name must be a string or locale object`
            );
            assertCondition(Array.isArray(arch.requiredTech), `${id}: requiredTech must be an array`);
            for (const reqId of arch.requiredTech) {
                assertCondition(techIds.has(reqId), `${id}.requiredTech: "${reqId}" not found`);
            }
        } catch (error) {
            report('ERROR', `models.json:${error.message}`);
        }
    }

    for (const benchmark of benchmarkCatalog) {
        try {
            assertCondition(benchmark && typeof benchmark === 'object', 'benchmark entry must be an object');
            assertCondition(typeof benchmark.id === 'string', 'benchmark id must be a string');
            assertCondition(benchmark.capWeights && typeof benchmark.capWeights === 'object', `${benchmark.id}: capWeights must be an object`);
        } catch (error) {
            report('ERROR', `models.json:${error.message}`);
        }
    }

    for (const [id, strategy] of Object.entries(deploymentStrategies)) {
        try {
            assertCondition(strategy && typeof strategy === 'object', `${id}: deployment strategy must be an object`);
            assertCondition(typeof strategy.id === 'string', `${id}: id must be a string`);
            assertCondition(typeof strategy.name === 'string', `${id}: name must be a string`);
        } catch (error) {
            report('ERROR', `models.json:${error.message}`);
        }
    }

    for (const [id, dataType] of Object.entries(dataTypes)) {
        try {
            assertCondition(dataType && typeof dataType === 'object', `${id}: data type must be an object`);
            assertCondition(typeof dataType.id === 'string', `${id}: id must be a string`);
            assertCondition(typeof dataType.costPerTB === 'number', `${id}: costPerTB must be a number`);
            assertCondition(typeof dataType.availableTB === 'number', `${id}: availableTB must be a number`);
        } catch (error) {
            report('ERROR', `models.json:${error.message}`);
        }
    }
}

function validateGpus(data) {
    const gpus = Array.isArray(data?.GPU_CATALOG) ? data.GPU_CATALOG : [];

    for (const gpu of gpus) {
        try {
            assertCondition(gpu && typeof gpu === 'object', 'gpu entry must be an object');
            assertCondition(typeof gpu.id === 'string', `${gpu?.id || 'unknown'}: id must be a string`);
            assertCondition(typeof gpu.name === 'string', `${gpu.id}: name must be a string`);
            assertCondition(
                typeof gpu.tflops === 'number' || typeof gpu.flops === 'number',
                `${gpu.id}: tflops/flops must be a number`
            );
            assertCondition(typeof gpu.price === 'number', `${gpu.id}: price must be a number`);
            assertCondition(
                typeof gpu.releaseYear === 'number' || typeof gpu.availableYear === 'number',
                `${gpu.id}: releaseYear/availableYear must be a number`
            );
        } catch (error) {
            report('ERROR', `gpus.json:${error.message}`);
        }
    }
}

function validateBalance(data) {
    const balance = data?.BALANCE || {};
    const requiredSections = ['START', 'RESEARCH', 'COMPETITOR', 'ECONOMY'];

    for (const section of requiredSections) {
        try {
            assertCondition(balance[section] && typeof balance[section] === 'object', `BALANCE.${section} must be an object`);
        } catch (error) {
            report('ERROR', `balance.json:${error.message}`);
        }
    }

    const numericPaths = [
        ['START', 'FUNDS'],
        ['START', 'COMPUTING'],
        ['START', 'POWER'],
        ['START', 'DATA'],
        ['RESEARCH', 'TALENT_RESEARCH_WEIGHT'],
        ['RESEARCH', 'TALENT_CREATIVITY_WEIGHT'],
        ['COMPETITOR', 'AI_GROWTH_RATE'],
        ['COMPETITOR', 'PERFORMANCE_CAP'],
        ['ECONOMY', 'BASE_GPU_PRICE'],
        ['ECONOMY', 'GPU_CLOUD_MONTHLY']
    ];

    for (const [section, key] of numericPaths) {
        try {
            assertCondition(typeof balance?.[section]?.[key] === 'number', `BALANCE.${section}.${key} must be a number`);
        } catch (error) {
            report('ERROR', `balance.json:${error.message}`);
        }
    }
}

function validateDataAcquisition(data, modelDataTypes) {
    const methods = data?.METHODS || {};
    const dataTypes = data?.DATA_TYPES || {};
    const modelTypeIds = new Set(Object.keys(modelDataTypes || {}));

    try {
        assertCondition(Object.keys(methods).length >= 5, 'METHODS must define at least five acquisition methods');
    } catch (error) {
        report('ERROR', `data_acquisition.json:${error.message}`);
    }

    for (const [id, method] of Object.entries(methods)) {
        try {
            assertCondition(method && typeof method === 'object', `${id}: method must be an object`);
            assertCondition(typeof method.id === 'string', `${id}: id must be a string`);
            assertCondition(typeof method.name?.ko === 'string', `${id}: name.ko must be a string`);
            assertCondition(typeof method.name?.en === 'string', `${id}: name.en must be a string`);
            assertCondition(typeof method.description?.ko === 'string', `${id}: description.ko must be a string`);
            assertCondition(typeof method.costPerTB === 'number', `${id}: costPerTB must be a number`);
            assertCondition(typeof method.qualityBase === 'number', `${id}: qualityBase must be a number`);
            assertCondition(typeof method.freshnessBase === 'number', `${id}: freshnessBase must be a number`);
            assertCondition(typeof method.biasRisk === 'number', `${id}: biasRisk must be a number`);
            assertCondition(typeof method.legalSensitivity === 'number', `${id}: legalSensitivity must be a number`);
        } catch (error) {
            report('ERROR', `data_acquisition.json:${error.message}`);
        }
    }

    for (const [id, typeDef] of Object.entries(dataTypes)) {
        try {
            assertCondition(typeDef && typeof typeDef === 'object', `${id}: data type must be an object`);
            assertCondition(modelTypeIds.has(id), `${id}: data type must exist in models.json DATA_TYPES`);
            assertCondition(typeof typeDef.name?.ko === 'string', `${id}: name.ko must be a string`);
            assertCondition(typeof typeDef.name?.en === 'string', `${id}: name.en must be a string`);
            assertCondition(typeof typeDef.baseValue === 'number', `${id}: baseValue must be a number`);
        } catch (error) {
            report('ERROR', `data_acquisition.json:${error.message}`);
        }
    }
}

function validateCampaign(data) {
    if (!data) return;
    const acts = data?.ACTS || {};
    const order = Array.isArray(data?.ACT_ORDER) ? data.ACT_ORDER : [];

    for (const actId of order) {
        try {
            assertCondition(acts[actId], `ACT_ORDER: "${actId}" not found in ACTS`);
        } catch (error) {
            report('ERROR', `campaign.json:${error.message}`);
        }
    }

    for (const [id, act] of Object.entries(acts)) {
        try {
            assertCondition(act && typeof act === 'object', `${id}: act must be an object`);
            assertCondition(act.name && typeof act.name === 'object', `${id}: name must be an object`);
            assertCondition(typeof act.name.ko === 'string', `${id}: name.ko must be a string`);
            assertCondition(typeof act.description?.ko === 'string', `${id}: description.ko must be a string`);
        } catch (error) {
            report('ERROR', `campaign.json:${error.message}`);
        }
    }
}

function main() {
    const techs = readJson('technologies.json');
    const companies = readJson('companies.json');
    const countries = readJson('countries.json');
    const models = readJson('models.json');
    const gpus = readJson('gpus.json');
    const balance = readJson('balance.json');
    const dataAcquisition = readOptionalJson('data_acquisition.json');
    const campaign = readOptionalJson('campaign.json');
    readOptionalJson('regions.json');

    validateTechTree(techs);
    validateCompanies(companies, countries?.COUNTRIES || {});
    validateCountries(countries);
    validateModels(models, techs?.TECH_TREE || {});
    validateGpus(gpus);
    validateBalance(balance);
    validateDataAcquisition(dataAcquisition, models?.DATA_TYPES || {});
    validateCampaign(campaign);

    process.stderr.write(
        [
            '',
            '=== Validation Summary ===',
            `Files checked: ${filesChecked}`,
            `Errors: ${errorCount}`,
            `Warnings: ${warningCount}`
        ].join('\n') + '\n'
    );

    process.exit(errorCount > 0 ? 1 : 0);
}

main();
