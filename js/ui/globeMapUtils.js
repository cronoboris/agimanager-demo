import { COUNTRIES, ISO_TO_ID } from '../data/countries.js';

const COORD_PRECISION = 1e6;
const EPSILON = 1e-9;
const ISO_ALPHA_CODE_RE = /^[a-z]{2}$/i;
const MISSING_ID_FALLBACKS = Object.freeze({
    Kosovo: '-99',
    'N. Cyprus': 'unknown:n-cyprus',
    Somaliland: 'unknown:somaliland'
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundCoordinate(value) {
    return Math.round(value * COORD_PRECISION) / COORD_PRECISION;
}

function isNumericCountryId(value) {
    return /^-?\d+$/.test(String(value).trim());
}

function pointOnSegment(testX, testY, x1, y1, x2, y2) {
    const cross = ((testY - y1) * (x2 - x1)) - ((testX - x1) * (y2 - y1));
    if (Math.abs(cross) > EPSILON) return false;

    const dot = ((testX - x1) * (testX - x2)) + ((testY - y1) * (testY - y2));
    return dot <= EPSILON;
}

export function latLonToVec3(lat, lon, radius) {
    const effectiveRadius = Number.isFinite(Number(radius)) ? Number(radius) : 1;
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lon + 180) * Math.PI) / 180;

    return {
        x: -effectiveRadius * Math.sin(phi) * Math.cos(theta),
        y: effectiveRadius * Math.cos(phi),
        z: effectiveRadius * Math.sin(phi) * Math.sin(theta)
    };
}

export function vec3ToLatLon(point, radius) {
    const x = Number(point?.x) || 0;
    const y = Number(point?.y) || 0;
    const z = Number(point?.z) || 0;
    const fallbackRadius = Math.sqrt((x * x) + (y * y) + (z * z));
    const effectiveRadius = Number.isFinite(Number(radius)) && Number(radius) > 0
        ? Number(radius)
        : (fallbackRadius || 1);

    const lat = 90 - (Math.acos(clamp(y / effectiveRadius, -1, 1)) * 180 / Math.PI);
    const lon = Math.atan2(-z, x) * 180 / Math.PI;

    return {
        lat: roundCoordinate(lat),
        lon: roundCoordinate(lon)
    };
}

export function normalizeTopoCountryId(countryId) {
    if (countryId == null) return null;
    const raw = String(countryId).trim();
    if (!raw) return null;
    if (isNumericCountryId(raw)) {
        return raw.startsWith('-') ? raw : raw.padStart(3, '0');
    }
    return raw.toLowerCase();
}

export function resolveIsoCountryCode(countryId, isoMap = ISO_TO_ID) {
    if (countryId == null) return null;
    const raw = String(countryId).trim();
    if (!raw) return null;
    if (ISO_ALPHA_CODE_RE.test(raw)) return raw.toLowerCase();

    const direct = isoMap?.[raw];
    if (direct) return String(direct).toLowerCase();

    if (!isNumericCountryId(raw)) return null;

    const padded = raw.startsWith('-') ? raw : raw.padStart(3, '0');
    if (isoMap?.[padded]) return String(isoMap[padded]).toLowerCase();

    const stripped = String(Number(raw));
    if (isoMap?.[stripped]) return String(isoMap[stripped]).toLowerCase();

    return null;
}

/**
 * Ray-casting point-in-polygon test with boundary inclusion.
 */
export function pointInPolygon(testX, testY, ring) {
    if (!Array.isArray(ring) || ring.length < 3) return false;

    for (let i = 0; i < ring.length; i++) {
        const next = (i + 1) % ring.length;
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[next];
        if (pointOnSegment(testX, testY, x1, y1, x2, y2)) return true;
    }

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        if (((yi > testY) !== (yj > testY)) &&
            (testX < ((xj - xi) * (testY - yi)) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

export function ringArea(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        area += (x1 * y2) - (x2 * y1);
    }
    return Math.abs(area) / 2;
}

function polygonSignedArea(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        area += (x1 * y2) - (x2 * y1);
    }
    return area / 2;
}

export function polygonCentroid(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return null;

    const signedArea = polygonSignedArea(ring);
    if (Math.abs(signedArea) <= EPSILON) {
        let lon = 0;
        let lat = 0;
        for (const [x, y] of ring) {
            lon += x;
            lat += y;
        }
        return {
            lon: roundCoordinate(lon / ring.length),
            lat: roundCoordinate(lat / ring.length)
        };
    }

    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        const cross = (x1 * y2) - (x2 * y1);
        cx += (x1 + x2) * cross;
        cy += (y1 + y2) * cross;
    }

    return {
        lon: roundCoordinate(cx / (6 * signedArea)),
        lat: roundCoordinate(cy / (6 * signedArea))
    };
}

export function buildIsoCountryMap(overrides = {}) {
    const map = { ...ISO_TO_ID };
    for (const country of Object.values(COUNTRIES)) {
        if (country?.isoNumeric == null) continue;
        map[String(country.isoNumeric).padStart(3, '0')] = country.id;
    }
    return { ...map, ...overrides };
}

export function normalizeCountryId(countryId, isoMap = ISO_TO_ID, countries = COUNTRIES) {
    if (countryId == null) return null;
    const raw = String(countryId).trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (countries?.[lower]) return lower;
    const isoId = resolveIsoCountryCode(raw, isoMap);
    if (isoId && countries?.[isoId]) return isoId;

    if (isNumericCountryId(raw)) {
        const padded = raw.startsWith('-') ? raw : raw.padStart(3, '0');
        return padded;
    }

    return lower;
}

export function resolveGameCountryId(countryId, isoMap = ISO_TO_ID, countries = COUNTRIES) {
    const normalized = normalizeCountryId(countryId, isoMap, countries);
    if (!normalized || !countries?.[normalized]) return null;
    return normalized;
}

export function buildCountryLookupTables(countries = [], isoMap = ISO_TO_ID, playableCountries = COUNTRIES) {
    const topoToAlpha = {};
    const alphaToTopo = {};
    const countryByTopo = {};
    const countryByAlpha = {};

    for (const country of countries || []) {
        const topoId = normalizeTopoCountryId(country?.topoId ?? country?.id);
        if (!topoId) continue;

        countryByTopo[topoId] = country;
        const alphaId = resolveIsoCountryCode(country?.isoId ?? country?.gameId ?? country?.id, isoMap);
        const gameId = resolveGameCountryId(country?.gameId ?? alphaId ?? country?.id, isoMap, playableCountries);

        if (alphaId) {
            topoToAlpha[topoId] = alphaId;
            alphaToTopo[alphaId] = topoId;
        }
        if (gameId) {
            countryByAlpha[gameId] = country;
        }
    }

    return {
        topoToAlpha,
        alphaToTopo,
        countryByTopo,
        countryByAlpha
    };
}

export function decodeTopoJSON(topo, isoMap = ISO_TO_ID, playableCountries = COUNTRIES) {
    if (!topo?.objects?.countries?.geometries || !Array.isArray(topo?.arcs)) return [];

    const { scale = [1, 1], translate = [0, 0] } = topo.transform || {};
    const decodedArcs = topo.arcs.map((arc) => {
        let x = 0;
        let y = 0;

        return arc.map(([dx, dy]) => {
            x += dx;
            y += dy;

            const lon = roundCoordinate(clamp((x * scale[0]) + translate[0], -180, 180));
            const lat = roundCoordinate(clamp((y * scale[1]) + translate[1], -90, 90));
            return [lon, lat];
        });
    });

    const countries = [];
    for (const geo of topo.objects.countries.geometries) {
        const fallbackTopoId = geo?.id == null
            ? (MISSING_ID_FALLBACKS[geo?.properties?.name] || `unknown:${String(geo?.properties?.name || 'country').toLowerCase().replace(/\s+/g, '-')}`)
            : geo.id;
        const topoId = normalizeTopoCountryId(fallbackTopoId);
        if (!topoId) continue;

        const isoId = resolveIsoCountryCode(topoId, isoMap);
        const gameId = resolveGameCountryId(isoId || topoId, isoMap, playableCountries);
        const name = playableCountries?.[gameId]?.name || geo.properties?.name || isoId || topoId;
        const rings = [];
        const polygons = geo.type === 'MultiPolygon'
            ? (geo.arcs || [])
            : [geo.arcs || []];

        for (const polygon of polygons) {
            if (!Array.isArray(polygon)) continue;
            for (const arcIndices of polygon) {
                if (!Array.isArray(arcIndices)) continue;

                const ring = [];
                for (const idx of arcIndices) {
                    const arc = idx < 0 ? [...decodedArcs[~idx]].reverse() : decodedArcs[idx];
                    if (arc) ring.push(...arc);
                }
                if (ring.length > 2) rings.push(ring);
            }
        }

        if (rings.length) {
            const mainRing = rings.reduce((best, ring) => (
                ringArea(ring) > ringArea(best) ? ring : best
            ), rings[0]);
            countries.push({
                id: gameId || isoId || topoId,
                topoId,
                isoId,
                gameId,
                name,
                rings,
                centroid: polygonCentroid(mainRing)
            });
        }
    }

    return countries;
}

export function findCountryAt(lat, lon, countries, isoMap = ISO_TO_ID, playableCountries = COUNTRIES) {
    let bestMatch = null;
    let bestArea = 0;

    for (const country of countries || []) {
        const gameId = resolveGameCountryId(country?.gameId ?? country?.id, isoMap, playableCountries);
        const isoId = resolveIsoCountryCode(country?.isoId ?? country?.gameId ?? country?.id, isoMap);
        const fallbackId = normalizeTopoCountryId(country?.topoId ?? country?.id);
        const candidateId = gameId || isoId || fallbackId;
        if (!candidateId) continue;

        for (const ring of country.rings || []) {
            if (!pointInPolygon(lon, lat, ring)) continue;

            const area = ringArea(ring);
            if (area > bestArea) {
                bestArea = area;
                bestMatch = candidateId;
            }
        }
    }

    return bestMatch;
}
