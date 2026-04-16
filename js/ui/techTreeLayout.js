// ============================================================
// Tech Tree Layout Engine — Computes node positions for visual tree
// ============================================================
import { TECH_TREE } from '../data/technologies.js';

const COL_WIDTH = 300;
const ROW_HEIGHT = 196;
const PAD_X = 32;
const PAD_Y = 28;
const NODE_W = 220;
const NODE_H = 164;

// Route sort priority (LLM top, World bottom, Synergy between, Common after)
const ROUTE_ORDER = { llm: 0, synergy: 1, world: 2, common: 3 };
const CAT_ORDER = [
    'foundation','model_arch','advanced_ai','frontier_ai','generative',
    'data','chip','infra','energy','product','safety','quantum','integration'
];

let _cachedLayout = null;
const _subsetLayoutCache = new Map();

function normalizeTechIds(techIds) {
    const seen = new Set();
    const ids = [];

    for (const id of techIds || []) {
        if (typeof id !== 'string' || seen.has(id) || !TECH_TREE[id]) continue;
        seen.add(id);
        ids.push(id);
    }

    ids.sort();
    return ids;
}

/**
 * Compute global depth for each tech (memoized longest-path-to-root).
 */
function computeDepths() {
    const depths = {};
    function getDepth(id) {
        if (depths[id] !== undefined) return depths[id];
        const tech = TECH_TREE[id];
        if (!tech) { depths[id] = 0; return 0; }
        const allDeps = [...(tech.requires || []), ...(tech.requiresAny || [])];
        if (allDeps.length === 0) { depths[id] = 0; return 0; }
        depths[id] = -1; // cycle guard
        let maxDep = 0;
        for (const dep of allDeps) {
            const d = getDepth(dep);
            if (d >= 0) maxDep = Math.max(maxDep, d);
        }
        depths[id] = maxDep + 1;
        return depths[id];
    }
    for (const id of Object.keys(TECH_TREE)) getDepth(id);
    return depths;
}

function computeSubsetDepths(subsetIds) {
    const subsetSet = new Set(subsetIds);
    const depths = {};

    function getDepth(id) {
        if (depths[id] !== undefined) return depths[id];
        const tech = TECH_TREE[id];
        if (!tech || !subsetSet.has(id)) {
            depths[id] = 0;
            return 0;
        }

        const internalDeps = [...(tech.requires || []), ...(tech.requiresAny || [])]
            .filter(dep => subsetSet.has(dep));

        if (internalDeps.length === 0) {
            depths[id] = 0;
            return 0;
        }

        depths[id] = -1; // cycle guard
        let maxDep = 0;
        for (const dep of internalDeps) {
            const d = getDepth(dep);
            if (d >= 0) maxDep = Math.max(maxDep, d);
        }
        depths[id] = maxDep + 1;
        return depths[id];
    }

    for (const id of subsetIds) getDepth(id);
    return depths;
}

/**
 * Assign row positions within each depth column.
 */
function assignRows(depths) {
    // Group by depth
    const columns = {};
    for (const [id, depth] of Object.entries(depths)) {
        if (!columns[depth]) columns[depth] = [];
        columns[depth].push(id);
    }

    const rows = {};
    for (const [depth, ids] of Object.entries(columns)) {
        // Sort by route priority, then category order
        ids.sort((a, b) => {
            const ta = TECH_TREE[a], tb = TECH_TREE[b];
            const ra = ROUTE_ORDER[ta.route] ?? 3, rb = ROUTE_ORDER[tb.route] ?? 3;
            if (ra !== rb) return ra - rb;
            const ca = CAT_ORDER.indexOf(ta.category), cb = CAT_ORDER.indexOf(tb.category);
            if (ca !== cb) return ca - cb;
            return (ta.cost || 0) - (tb.cost || 0);
        });
        ids.forEach((id, i) => { rows[id] = i; });
    }
    return { columns, rows };
}

/**
 * Build list of all dependency edges.
 */
function buildEdges() {
    const edges = [];
    for (const [id, tech] of Object.entries(TECH_TREE)) {
        for (const dep of (tech.requires || [])) {
            edges.push({ from: dep, to: id, type: 'requires' });
        }
        for (const dep of (tech.requiresAny || [])) {
            edges.push({ from: dep, to: id, type: 'requiresAny' });
        }
    }
    return edges;
}

function sortDepsForDisplay(deps) {
    return [...deps].sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.id.localeCompare(b.id);
    });
}

function buildSubsetEdgesAndExternalDeps(subsetIds) {
    const subsetSet = new Set(subsetIds);
    const edges = [];
    const externalDeps = {};

    for (const id of subsetIds) {
        const tech = TECH_TREE[id];
        if (!tech) continue;

        const external = [];
        for (const dep of (tech.requires || [])) {
            if (subsetSet.has(dep)) edges.push({ from: dep, to: id, type: 'requires' });
            else external.push({ id: dep, type: 'requires' });
        }
        for (const dep of (tech.requiresAny || [])) {
            if (subsetSet.has(dep)) edges.push({ from: dep, to: id, type: 'requiresAny' });
            else external.push({ id: dep, type: 'requiresAny' });
        }

        if (external.length > 0) {
            externalDeps[id] = sortDepsForDisplay(
                external.filter((dep, index, arr) =>
                    arr.findIndex(other => other.id === dep.id && other.type === dep.type) === index
                )
            );
        }
    }

    edges.sort((a, b) => {
        if (a.from !== b.from) return a.from.localeCompare(b.from);
        if (a.to !== b.to) return a.to.localeCompare(b.to);
        return a.type.localeCompare(b.type);
    });

    return { edges, externalDeps };
}

function buildLayoutFromSubsetIds(subsetIds) {
    const depths = computeSubsetDepths(subsetIds);
    const { columns: columnsByDepth, rows } = assignRows(depths);
    const columns = Object.keys(columnsByDepth)
        .map(depth => Number(depth))
        .sort((a, b) => a - b)
        .map(depth => columnsByDepth[depth]);
    const maxDepth = Math.max(...Object.values(depths), 0);
    const maxRow = Math.max(...Object.values(rows), 0);

    const nodes = {};
    for (const id of subsetIds) {
        const tech = TECH_TREE[id];
        if (!tech) continue;
        const depth = depths[id];
        const row = rows[id];
        nodes[id] = {
            x: PAD_X + depth * COL_WIDTH,
            y: PAD_Y + row * ROW_HEIGHT,
            depth,
            row,
            tech
        };
    }

    const { edges, externalDeps } = buildSubsetEdgesAndExternalDeps(subsetIds);
    const canvasWidth = PAD_X * 2 + (maxDepth + 1) * COL_WIDTH;
    const canvasHeight = PAD_Y * 2 + (maxRow + 1) * ROW_HEIGHT;

    return { nodes, edges, externalDeps, columns, canvasWidth, canvasHeight, nodeW: NODE_W, nodeH: NODE_H };
}

/**
 * Compute a layout for a subset of technologies, including external dependency
 * metadata for requirements that are not part of the visible subset.
 * @param {string[]} techIds
 * @returns {{ nodes: Object, edges: Array, externalDeps: Object, columns: Array, canvasWidth: number, canvasHeight: number, nodeW: number, nodeH: number }}
 */
export function computeSubsetTechTreeLayout(techIds) {
    const subsetIds = normalizeTechIds(techIds);
    const cacheKey = subsetIds.join('|');
    if (_subsetLayoutCache.has(cacheKey)) return _subsetLayoutCache.get(cacheKey);

    const layout = buildLayoutFromSubsetIds(subsetIds);
    _subsetLayoutCache.set(cacheKey, layout);
    return layout;
}

/**
 * Compute full layout. Result is cached (tech data is static).
 * @returns {{ nodes: Object, edges: Array, canvasWidth: number, canvasHeight: number, nodeW: number, nodeH: number }}
 */
export function computeTechTreeLayout() {
    if (_cachedLayout) return _cachedLayout;

    _cachedLayout = buildLayoutFromSubsetIds(Object.keys(TECH_TREE));
    return _cachedLayout;
}
