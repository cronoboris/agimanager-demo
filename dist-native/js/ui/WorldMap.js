import { COUNTRIES, ISO_TO_ID } from '../data/countries.js';
import { t } from '../i18n.js';
import { getCountryColor, getCountryOpacity, getCountryVisualPolicy } from './countryVisualPolicy.js';

// ============================================================
// Cached map data
// ============================================================
export let mapCache = null;      // Array of { id, svgPaths[], centroid }
let mapLoading = false;

const MAP_PULSE_COLORS = {
    info: '#4fc3f7',
    warning: '#eab308',
    danger: '#ef4444',
    success: '#22c55e'
};

// ============================================================
// TopoJSON → SVG Decoder
// ============================================================
function decodeTopoJSON(topology) {
    const { arcs: rawArcs, transform, objects } = topology;

    const decodedArcs = rawArcs.map(arc => {
        let px = 0, py = 0;
        return arc.map(([dx, dy]) => {
            px += dx; py += dy;
            return [px, py];
        });
    });

    function xform([qx, qy]) {
        return transform
            ? [qx * transform.scale[0] + transform.translate[0],
               qy * transform.scale[1] + transform.translate[1]]
            : [qx, qy];
    }

    function resolveRing(arcIndices) {
        const coords = [];
        for (const idx of arcIndices) {
            const arc = idx >= 0 ? decodedArcs[idx] : [...decodedArcs[~idx]].reverse();
            const start = coords.length > 0 ? 1 : 0;
            for (let i = start; i < arc.length; i++) coords.push(xform(arc[i]));
        }
        return coords;
    }

    const result = [];
    for (const geom of objects.countries.geometries) {
        const rings = [];
        if (geom.type === 'Polygon') {
            for (const r of geom.arcs) rings.push(resolveRing(r));
        } else if (geom.type === 'MultiPolygon') {
            for (const poly of geom.arcs)
                for (const r of poly) rings.push(resolveRing(r));
        }

        // Calculate centroid from all ring points (SVG coords)
        let sx = 0, sy = 0, n = 0;
        for (const ring of rings) {
            for (const [lon, lat] of ring) {
                sx += (lon + 180) / 360 * 1000;
                sy += (90 - lat) / 180 * 500;
                n++;
            }
        }
        const centroid = n > 0 ? { x: +(sx / n).toFixed(1), y: +(sy / n).toFixed(1) } : null;

        result.push({
            id: String(geom.id),
            svgPaths: rings.map(ring => ringToSVG(ring)),
            rings: rings,
            centroid
        });
    }
    return result;
}

function ringToSVG(coords) {
    if (!coords.length) return '';
    return coords.map(([lon, lat], i) => {
        const x = ((lon + 180) / 360 * 1000).toFixed(1);
        const y = ((90 - lat) / 180 * 500).toFixed(1);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ') + 'Z';
}

function resolvePulseColor(type = 'info') {
    return MAP_PULSE_COLORS[type] || MAP_PULSE_COLORS.info;
}

function resolvePulseTarget(countryId, options = {}) {
    const centroid = options.centroid || mapCache?.find(m => ISO_TO_ID[m.id] === countryId)?.centroid;
    if (!centroid) return null;
    return {
        countryId,
        centroid,
        offsetX: Number(options.offsetX || 0),
        offsetY: Number(options.offsetY || 0)
    };
}

function normalizePulseRequest(pulseOrCountryId, type = 'info', options = {}) {
    if (!pulseOrCountryId) return null;
    if (typeof pulseOrCountryId === 'object') {
        const countryId = pulseOrCountryId.countryId || pulseOrCountryId.country || pulseOrCountryId.id;
        if (!countryId) return null;
        return {
            countryId,
            type: pulseOrCountryId.type || type,
            options: { ...pulseOrCountryId }
        };
    }
    return {
        countryId: pulseOrCountryId,
        type,
        options: { ...options }
    };
}

function buildPulseRingSVG(cx, cy, color, options = {}, delayMs = 0) {
    const baseRadius = Number(options.baseRadius ?? 3);
    const maxRadius = Number(options.maxRadius ?? 30);
    const strokeWidth = Number(options.strokeWidth ?? 1.5);
    const opacity = Number(options.opacity ?? 0.9);
    const durationMs = Math.max(600, Number(options.durationMs ?? 2000));
    const begin = delayMs > 0 ? ` begin="${(delayMs / 1000).toFixed(2)}s"` : '';
    return `
        <circle cx="${cx}" cy="${cy}" r="${baseRadius}" fill="none" stroke="${color}"
                stroke-width="${strokeWidth}" opacity="${opacity}" pointer-events="none">
            <animate attributeName="r" values="${baseRadius};${maxRadius}" dur="${(durationMs / 1000).toFixed(2)}s"${begin}
                     repeatCount="1" fill="freeze"/>
            <animate attributeName="opacity" values="${opacity};0" dur="${(durationMs / 1000).toFixed(2)}s"${begin}
                     repeatCount="1" fill="freeze"/>
        </circle>`;
}

export function buildMapEventPulseSVG(pulseOrCountryId, type = 'info', options = {}) {
    const request = normalizePulseRequest(pulseOrCountryId, type, options);
    if (!request) return '';
    const target = resolvePulseTarget(request.countryId, request.options);
    if (!target) return '';

    const color = resolvePulseColor(request.type);
    return `
        <g class="map-event-pulse map-event-pulse--${request.type}" data-country="${request.countryId}" pointer-events="none">
            ${buildPulseRingSVG(
                target.centroid.x + target.offsetX,
                target.centroid.y + target.offsetY,
                color,
                request.options,
                0
            )}
        </g>`;
}

function appendPulseRing(svg, cx, cy, color, options = {}, delayMs = 0) {
    const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const baseRadius = Number(options.baseRadius ?? 3);
    const maxRadius = Number(options.maxRadius ?? 30);
    const strokeWidth = Number(options.strokeWidth ?? 1.5);
    const opacity = Number(options.opacity ?? 0.9);
    const durationMs = Math.max(600, Number(options.durationMs ?? 2000));

    pulse.setAttribute('cx', cx);
    pulse.setAttribute('cy', cy);
    pulse.setAttribute('r', baseRadius);
    pulse.setAttribute('fill', 'none');
    pulse.setAttribute('stroke', color);
    pulse.setAttribute('stroke-width', strokeWidth);
    pulse.setAttribute('opacity', opacity);
    pulse.setAttribute('pointer-events', 'none');

    const animR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animR.setAttribute('attributeName', 'r');
    animR.setAttribute('values', `${baseRadius};${maxRadius}`);
    animR.setAttribute('dur', `${(durationMs / 1000).toFixed(2)}s`);
    animR.setAttribute('repeatCount', '1');
    animR.setAttribute('fill', 'freeze');
    if (delayMs > 0) animR.setAttribute('begin', `${(delayMs / 1000).toFixed(2)}s`);

    const animOpacity = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animOpacity.setAttribute('attributeName', 'opacity');
    animOpacity.setAttribute('values', `${opacity};0`);
    animOpacity.setAttribute('dur', `${(durationMs / 1000).toFixed(2)}s`);
    animOpacity.setAttribute('repeatCount', '1');
    animOpacity.setAttribute('fill', 'freeze');
    if (delayMs > 0) animOpacity.setAttribute('begin', `${(delayMs / 1000).toFixed(2)}s`);

    pulse.appendChild(animR);
    pulse.appendChild(animOpacity);
    svg.appendChild(pulse);
    return pulse;
}

export function showMapEventPulse(countryId, type = 'info', options = {}) {
    if (typeof document === 'undefined') return false;
    const request = normalizePulseRequest(countryId, type, options);
    if (!request) return false;

    const svg = document.querySelector('#world-map-bg svg');
    const zoomGroup = svg?.querySelector('#map-zoom-group');
    if (!svg || !zoomGroup) return false;

    const target = resolvePulseTarget(request.countryId, request.options);
    if (!target) return false;

    const color = resolvePulseColor(request.type);
    const pulseRefs = [appendPulseRing(
        zoomGroup,
        target.centroid.x + target.offsetX,
        target.centroid.y + target.offsetY,
        color,
        request.options,
        0
    )];

    const durationMs = Math.max(600, Number(request.options.durationMs ?? 2000));
    window.setTimeout(() => {
        for (const pulse of pulseRefs) pulse?.remove?.();
    }, durationMs + 200);

    return true;
}

// ============================================================
// Load map data from CDN (Natural Earth 110m)
// ============================================================
export async function initMapData() {
    if (mapCache || mapLoading) return;
    mapLoading = true;
    try {
        // In sandboxed previews, CDN fetch may fail — skip gracefully
        if (window._skipCDN) { mapLoading = false; console.log('Map CDN skipped'); return; }
        const res = await fetch('./assets/countries-110m.json');
        if (!res.ok) throw new Error(res.status);
        const topo = await res.json();
        mapCache = decodeTopoJSON(topo);
        console.log(`Map loaded: ${mapCache.length} countries`);
    } catch (e) {
        console.warn('Map load failed:', e);
        mapCache = null;
    }
    mapLoading = false;
}

// ============================================================
// Render world map SVG
// ============================================================
export function renderWorldMap(gameState, playerCountry, competitors, pulses = []) {
    // Grid lines
    let gridSVG = '';
    for (let x = 0; x <= 1000; x += 50)
        gridSVG += `<line x1="${x}" y1="0" x2="${x}" y2="500" stroke="rgba(80,140,220,0.04)"/>`;
    for (let y = 0; y <= 500; y += 50)
        gridSVG += `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="rgba(80,140,220,0.04)"/>`;
    gridSVG += `<line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(80,180,255,0.06)" stroke-dasharray="4,4"/>`;

    // Country paths
    let landSVG = '';
    let highlightSVG = '';
    let labelsSVG = '';

    if (mapCache) {
        for (const mapCountry of mapCache) {
            const gameId = ISO_TO_ID[mapCountry.id];
            const countryData = gameId ? COUNTRIES[gameId] : null;
            const isPlayer = gameId === playerCountry;
            const visual = countryData ? getCountryVisualPolicy(countryData, gameState, { isPlayer }) : null;
            const color = visual?.color || null;

            for (const pathD of mapCountry.svgPaths) {
                if (!pathD) continue;

                if (countryData && color) {
                    const fillOpacity = visual?.svg?.fillOpacity ?? getCountryOpacity(countryData.tier, isPlayer);
                    const strokeW = visual?.svg?.strokeWidth ?? (isPlayer ? 1.2 : (countryData.tier <= 2 ? 0.6 : 0.3));
                    const filter = isPlayer ? 'filter="url(#playerGlow)"' : '';
                    const hitStroke = visual?.svg?.hitStrokeWidth ?? (countryData.tier <= 2 ? 12 : 8);

                    highlightSVG += `<path d="${pathD}" fill="none" stroke="rgba(0,0,0,0.001)"
                        stroke-width="${hitStroke}" class="map-country-hit" data-country="${gameId}"
                        onclick="game.showCountryInfo('${gameId}')" onmouseenter="game.setMapHoverCountry('${gameId}')" onmouseleave="game.clearMapHoverCountry('${gameId}')"
                        style="cursor:pointer"/>`;
                    highlightSVG += `<path d="${pathD}" fill="${color}" fill-opacity="${fillOpacity}"
                        stroke="${color}" stroke-width="${strokeW}" stroke-opacity="0.6" ${filter}
                        class="map-country" data-country="${gameId}"
                        onclick="game.showCountryInfo('${gameId}')" onmouseenter="game.setMapHoverCountry('${gameId}')" onmouseleave="game.clearMapHoverCountry('${gameId}')"
                        style="cursor:pointer"/>`;
                    highlightSVG += `<path d="${pathD}" fill="url(#hatch)" pointer-events="none" opacity="${isPlayer ? 0.4 : 0.15}" />`;
                    landSVG += `<path d="${pathD}" fill="#151e30" stroke="#1e2d48" stroke-width="0.3"/>`;
                } else {
                    landSVG += `<path d="${pathD}" fill="#151e30" stroke="#1e2d48" stroke-width="0.3"/>`;
                    landSVG += `<path d="${pathD}" fill="url(#hatch)" pointer-events="none" opacity="0.05" />`;
                }
            }

            // Labels for tier 1-2 countries
            if (countryData && mapCountry.centroid && visual?.svg?.showLabel) {
                const pos = mapCountry.centroid;
                const fav = gameState.global.countryFavorability?.[gameId] ?? countryData.aiFavorability;
                const fontSize = visual.svg.fontSize;
                const dotR = visual.svg.dotRadius;

                labelsSVG += `
                    <g class="map-label ${isPlayer ? 'is-always-visible' : ''}" data-country="${gameId}" onclick="game.showCountryInfo('${gameId}')"
                       onmouseenter="game.setMapHoverCountry('${gameId}')" onmouseleave="game.clearMapHoverCountry('${gameId}')" style="cursor:pointer">
                        ${isPlayer ? `
                        <circle cx="${pos.x}" cy="${pos.y}" r="2" fill="none" stroke="${color}" stroke-width="0.5" class="hq-radar">
                            <animate attributeName="r" values="2;30" dur="3s" repeatCount="indefinite"/>
                            <animate attributeName="opacity" values="1;0" dur="3s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="${pos.x}" cy="${pos.y}" r="2" fill="none" stroke="${color}" stroke-width="0.5" class="hq-radar">
                            <animate attributeName="r" values="2;30" dur="3s" begin="1.5s" repeatCount="indefinite"/>
                            <animate attributeName="opacity" values="1;0" dur="3s" begin="1.5s" repeatCount="indefinite"/>
                        </circle>` : ''}
                        <circle cx="${pos.x}" cy="${pos.y}" r="${dotR}" fill="${color}">
                            ${isPlayer ? '<animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite"/>' : ''}
                        </circle>
                        <text x="${pos.x}" y="${pos.y - visual.svg.labelOffsetY}"
                              fill="${color}" font-size="${fontSize}" font-weight="bold"
                              text-anchor="middle"
                              style="text-shadow:0 0 6px #000,0 0 3px #000">${countryData.flag} ${countryData.name}</text>
                        ${isPlayer ? `<text x="${pos.x}" y="${pos.y - 20}" fill="${color}" font-size="7" font-weight="600" text-anchor="middle" opacity="0.9" style="text-shadow:0 0 4px ${color}">${t('world.agi_hq', 'AGI HQ')}</text>` : ''}
                        ${visual.svg.showFavBar ? _favBar(pos, fav) : ''}
                    </g>`;
            }
        }
    } else {
        landSVG = `<text x="500" y="250" fill="#334" font-size="14" text-anchor="middle">${t('world.map_loading', '지도 데이터 로딩 중...')}</text>`;
    }

    // Competitor markers
    let compSVG = '';
    if (competitors && mapCache) {
        const COMP_OFFSETS = [
            { dx: -20, dy: 20 }, { dx: 20, dy: 20 },
            { dx: -20, dy: 32 }, { dx: 20, dy: 32 },
            { dx: 0, dy: 42 }, { dx: 0, dy: 52 }
        ];
        competitors.forEach((comp, i) => {
            const mapEntry = mapCache.find(m => ISO_TO_ID[m.id] === comp.country);
            const pos = mapEntry?.centroid;
            if (!pos) return;
            const off = COMP_OFFSETS[i] || { dx: 0, dy: 40 };
            const cx = pos.x + off.dx, cy = pos.y + off.dy;
            compSVG += `
                <g style="cursor:pointer" onclick="game.showCountryInfo('${comp.country}')">
                    <line x1="${pos.x}" y1="${pos.y}" x2="${cx}" y2="${cy}"
                          stroke="${comp.color}" stroke-width="0.3" opacity="0.3" stroke-dasharray="2,2"/>
                    <circle cx="${cx}" cy="${cy}" r="2" fill="${comp.color}" opacity="0.7"/>
                    <text x="${cx + 5}" y="${cy + 3}" fill="${comp.color}" font-size="5.5" opacity="0.6"
                          style="text-shadow:0 0 3px #000">${comp.name}</text>
                </g>`;
        });
    }

    const pulseSVG = Array.isArray(pulses)
        ? pulses.map(pulse => buildMapEventPulseSVG(pulse)).join('')
        : '';

    // Global AI favorability
    const aiFav = gameState.global.aiFavorability;
    const favColor = aiFav > 60 ? '#22c55e' : aiFav > 35 ? '#eab308' : '#ef4444';

    return `
        <svg viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"
             style="width:100%;height:100%;overflow:visible">
            <defs>
                <filter id="playerGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <radialGradient id="ocean" cx="50%" cy="40%" r="80%">
                    <stop offset="0%" stop-color="#0d1525"/>
                    <stop offset="100%" stop-color="#060a12"/>
                </radialGradient>
                <pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4">
                    <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/>
                </pattern>
            </defs>

            <rect width="1000" height="500" x="0" fill="#060a12"/>
            <g id="map-zoom-group">
                <g>
                    ${gridSVG}${landSVG}${highlightSVG}${compSVG}${pulseSVG}${labelsSVG}
                </g>
            </g>

            <g transform="translate(870,12)" opacity="0.8">
                <text fill="#94a3b8" font-size="7">${t('topbar.global_ai_favorability', '글로벌 AI 호감도')}</text>
                <rect x="0" y="4" width="80" height="3" rx="1.5" fill="rgba(255,255,255,0.08)"/>
                <rect x="0" y="4" width="${80 * aiFav / 100}" height="3" rx="1.5" fill="${favColor}"/>
                <text x="84" y="8" fill="${favColor}" font-size="7">${Math.round(aiFav)}%</text>
            </g>
        </svg>`;
}

// Small favorability bar helper
function _favBar(pos, fav) {
    const barW = 28, barX = pos.x - barW / 2, barY = pos.y + 13;
    const barColor = fav > 50 ? '#22c55e' : fav > 25 ? '#eab308' : '#ef4444';
    return `<rect x="${barX}" y="${barY}" width="${barW}" height="2" rx="1" fill="rgba(255,255,255,0.08)"/>
            <rect x="${barX}" y="${barY}" width="${barW * fav / 100}" height="2" rx="1" fill="${barColor}"/>`;
}
