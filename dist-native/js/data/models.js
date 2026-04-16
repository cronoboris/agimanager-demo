import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('models.json');

export const CAPABILITY_BENCHMARKS = data.CAPABILITY_BENCHMARKS;
export const BENCHMARK_WEIGHTS = data.BENCHMARK_WEIGHTS;
export const BENCHMARKS = data.BENCHMARKS;
export const MARKET_EXPECTATIONS = data.MARKET_EXPECTATIONS;
export const MODEL_ARCHITECTURES = data.MODEL_ARCHITECTURES;
export const PARAMETER_SCALES = data.PARAMETER_SCALES;
export const SCALE_ORDER = Object.keys(PARAMETER_SCALES);
export const TRAINING_PHASES = data.TRAINING_PHASES;
export const DATA_TYPES = data.DATA_TYPES;
export const CAP_DATA_MAP = data.CAP_DATA_MAP;
export const TECH_CAP_BONUSES = data.TECH_CAP_BONUSES;
export const DEPLOYMENT_STRATEGIES = data.DEPLOYMENT_STRATEGIES;
