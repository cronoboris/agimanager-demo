/**
 * GlobeMap - 3D globe map with country fills, hover tooltips, and game-state overlays.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COUNTRIES } from '../data/countries.js';
import { getCountryColor, getCountryVisualPolicy } from './countryVisualPolicy.js';
import {
    buildCountryLookupTables,
    buildIsoCountryMap,
    decodeTopoJSON,
    findCountryAt,
    latLonToVec3,
    normalizeCountryId,
    normalizeTopoCountryId,
    ringArea,
    vec3ToLatLon
} from './globeMapUtils.js';

const GLOBE_RADIUS = 100;
const BORDER_OFFSET = 0.3;
const ATMOSPHERE_SCALE = 1.12;
const STAR_COUNT = 1500;
const AUTO_ROTATE_SPEED = 0.08;
const EDGE_PAN_MARGIN = 64;
const EDGE_PAN_MAX_STEP = 0.0032;
const HOVER_COLOR = 0x4fc3f7;
// IT 허브 위치 (수도가 아닌 실제 기술 중심지)
// 같은 국가에 여러 허브 → 회사마다 다른 위치에 배치
const IT_HUBS = Object.freeze({
    us: [
        { lat: 37.39, lon: -122.08, name: 'Silicon Valley' },
        { lat: 47.61, lon: -122.33, name: 'Seattle' },
        { lat: 40.71, lon: -74.01, name: 'New York' },
        { lat: 30.27, lon: -97.74, name: 'Austin' },
    ],
    cn: [
        { lat: 39.90, lon: 116.40, name: 'Beijing' },
        { lat: 22.54, lon: 114.06, name: 'Shenzhen' },
        { lat: 31.23, lon: 121.47, name: 'Shanghai' },
        { lat: 30.57, lon: 104.07, name: 'Chengdu' },
    ],
    kr: [
        { lat: 37.50, lon: 127.04, name: 'Gangnam/Seoul' },
        { lat: 35.17, lon: 129.08, name: 'Busan' },
        { lat: 36.35, lon: 127.38, name: 'Daejeon' },
    ],
    gb: [
        { lat: 51.51, lon: -0.13, name: 'London' },
        { lat: 52.21, lon: 0.09, name: 'Cambridge' },
    ],
    jp: [
        { lat: 35.68, lon: 139.65, name: 'Tokyo' },
        { lat: 34.69, lon: 135.50, name: 'Osaka' },
    ],
    de: [
        { lat: 52.52, lon: 13.41, name: 'Berlin' },
        { lat: 48.14, lon: 11.58, name: 'Munich' },
    ],
    ca: [
        { lat: 43.65, lon: -79.38, name: 'Toronto' },
        { lat: 49.28, lon: -123.12, name: 'Vancouver' },
        { lat: 45.50, lon: -73.57, name: 'Montreal' },
    ],
    fr: [{ lat: 48.86, lon: 2.35, name: 'Paris' }],
    il: [{ lat: 32.07, lon: 34.77, name: 'Tel Aviv' }],
    sg: [{ lat: 1.29, lon: 103.85, name: 'Singapore' }],
    in: [
        { lat: 12.97, lon: 77.59, name: 'Bangalore' },
        { lat: 19.08, lon: 72.88, name: 'Mumbai' },
    ],
    au: [{ lat: -33.87, lon: 151.21, name: 'Sydney' }],
    ae: [{ lat: 25.20, lon: 55.27, name: 'Dubai' }],
    br: [{ lat: -23.55, lon: -46.63, name: 'São Paulo' }],
    se: [{ lat: 59.33, lon: 18.07, name: 'Stockholm' }],
});

// fallback: IT_HUBS에 없는 국가는 이 좌표 사용
const COUNTRY_MARKER_COORDINATES = Object.freeze({
    us: { lat: 37.39, lon: -122.08 },
    gb: { lat: 51.51, lon: -0.13 },
    dk: { lat: 55.68, lon: 12.57 },
    fr: { lat: 48.86, lon: 2.35 },
    nl: { lat: 52.37, lon: 4.90 },
    no: { lat: 59.91, lon: 10.75 },
    cn: { lat: 39.90, lon: 116.40 },
    kr: { lat: 37.50, lon: 127.04 },
    jp: { lat: 35.68, lon: 139.65 },
    de: { lat: 52.52, lon: 13.41 },
    ca: { lat: 43.65, lon: -79.38 },
    au: { lat: -33.87, lon: 151.21 },
    il: { lat: 32.07, lon: 34.77 },
    sg: { lat: 1.29, lon: 103.85 },
    in: { lat: 12.97, lon: 77.59 },
    ru: { lat: 55.76, lon: 37.62 },
});

function createFillShape(ring) {
    const shape = new THREE.Shape();
    if (!ring.length) return shape;
    shape.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) {
        shape.lineTo(ring[i][0], ring[i][1]);
    }
    shape.closePath();
    return shape;
}

/**
 * 큰 삼각형을 분할하여 구면 투사 시 빈틈 방지.
 * ShapeGeometry는 2D 삼각분할만 하므로 내부 정점이 부족하다.
 * maxEdgeDeg: 한 변이 이 각도(도) 이상이면 4개로 분할.
 */
function subdivideForSphere(geometry, maxEdgeDeg = 5) {
    const maxPasses = 4;
    for (let pass = 0; pass < maxPasses; pass++) {
        const pos = geometry.attributes.position;
        const index = geometry.index ? Array.from(geometry.index.array) : null;
        const triCount = index ? index.length / 3 : pos.count / 3;

        const newPositions = [];
        // 기존 정점 복사
        for (let i = 0; i < pos.count; i++) {
            newPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        }

        const newIndices = [];
        let needsMore = false;

        for (let t = 0; t < triCount; t++) {
            const i0 = index ? index[t * 3] : t * 3;
            const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
            const i2 = index ? index[t * 3 + 2] : t * 3 + 2;

            const x0 = newPositions[i0 * 3], y0 = newPositions[i0 * 3 + 1];
            const x1 = newPositions[i1 * 3], y1 = newPositions[i1 * 3 + 1];
            const x2 = newPositions[i2 * 3], y2 = newPositions[i2 * 3 + 1];

            const d01 = Math.hypot(x1 - x0, y1 - y0);
            const d12 = Math.hypot(x2 - x1, y2 - y1);
            const d20 = Math.hypot(x0 - x2, y0 - y2);
            const maxEdge = Math.max(d01, d12, d20);

            if (maxEdge > maxEdgeDeg) {
                // 각 변의 중점을 추가하고 4개 삼각형으로 분할
                const baseIdx = newPositions.length / 3;

                // mid01
                newPositions.push((x0 + x1) / 2, (y0 + y1) / 2, 0);
                // mid12
                newPositions.push((x1 + x2) / 2, (y1 + y2) / 2, 0);
                // mid20
                newPositions.push((x2 + x0) / 2, (y2 + y0) / 2, 0);

                const m01 = baseIdx;
                const m12 = baseIdx + 1;
                const m20 = baseIdx + 2;

                newIndices.push(i0, m01, m20);
                newIndices.push(m01, i1, m12);
                newIndices.push(m20, m12, i2);
                newIndices.push(m01, m12, m20);

                needsMore = true;
            } else {
                newIndices.push(i0, i1, i2);
            }
        }

        if (!needsMore) break;

        // 새 geometry 구성
        const newPosArray = new Float32Array(newPositions);
        geometry.setAttribute('position', new THREE.BufferAttribute(newPosArray, 3));
        geometry.setIndex(newIndices);
        geometry.index.needsUpdate = true;
    }
}

/**
 * 날짜변경선(-180/180)을 가로지르는 폴리곤을 분할.
 * 경도 차이가 180° 이상인 연속 점 쌍을 찾아 경계에서 폴리곤을 끊고,
 * 각 조각을 닫힌 폴리곤으로 반환한다.
 */
function splitByAntimeridian(ring) {
    if (!ring || ring.length < 3) return [ring];

    // 날짜변경선을 넘는 엣지가 있는지 확인
    let crosses = false;
    for (let i = 0; i < ring.length; i++) {
        const next = ring[(i + 1) % ring.length];
        if (Math.abs(next[0] - ring[i][0]) > 180) { crosses = true; break; }
    }
    if (!crosses) return [ring];

    const parts = [[]];
    let current = parts[0];

    for (let i = 0; i < ring.length; i++) {
        const p1 = ring[i];
        const p2 = ring[(i + 1) % ring.length];
        current.push(p1);

        const deltaLon = p2[0] - p1[0];
        if (Math.abs(deltaLon) > 180) {
            // 날짜변경선 교차! 보간 점 계산
            const sign = deltaLon > 0 ? -1 : 1; // p1 쪽 경계
            const edgeLon = sign > 0 ? 180 : -180;
            const otherEdgeLon = -edgeLon;

            // 위도 보간: 경도가 ±180에서 만나는 점의 위도
            const lonDist = sign > 0
                ? (180 - p1[0]) + (180 + p2[0])
                : (180 + p1[0]) + (180 - p2[0]);
            const t = lonDist > 0
                ? (sign > 0 ? (180 - p1[0]) : (180 + p1[0])) / lonDist
                : 0.5;
            const crossLat = p1[1] + t * (p2[1] - p1[1]);

            // 현재 폴리곤 닫기
            current.push([edgeLon, crossLat]);

            // 새 폴리곤 시작
            current = [[otherEdgeLon, crossLat]];
            parts.push(current);
        }
    }

    return parts.filter(p => p.length >= 3);
}

/**
 * 남극 전용: 폴리곤을 분할한 후 남극점(-90°)까지 확장하여 구멍 방지.
 */
function splitAntarcticaRing(ring) {
    const parts = splitByAntimeridian(ring);
    return parts.map(part => {
        // 각 조각의 밑바닥을 -90°까지 확장
        const lons = part.map(p => p[0]);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        // 하단에 남극점 경계 추가
        part.push([maxLon, -90]);
        part.push([minLon, -90]);
        return part;
    });
}

function toVector3(point) {
    return new THREE.Vector3(point.x, point.y, point.z);
}

export class GlobeMap {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.getElementById(container)
            : container;
        this.options = options;

        this.countries = [];
        this.countryMeshes = {};
        this.countryFillGroup = new THREE.Group();
        this.markerGroup = new THREE.Group();
        this._markerLabels = new Set();
        this._tooltip = null;
        this._state = null;
        this._mapMode = 'default';
        this._gameIdMap = {};
        this._alphaToTopoId = {};
        this._isoToAlpha = {};
        this._countryLookup = buildCountryLookupTables();
        this._disposed = false;
        this._autoRotate = true;
        this.edgePanEnabled = false;
        this._reducedMotion = false;
        this._controlSettings = {
            edgePan: false,
            zoomSpeed: 0.8,
            panSpeed: 1,
            reducedMotion: false
        };
        this._edgePanVector = new THREE.Vector2();
        this.hoveredCountryId = null;
        this._lastFocusedPlayerCountry = null;

        this._onResize = this._onResize.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onClick = this._onClick.bind(this);
        this._onMouseLeave = this._onMouseLeave.bind(this);
        this._animate = this._animate.bind(this);

        this._init();
    }

    async _init() {
        this._initScene();
        this._createStarfield();
        this._createGlobe();
        this._createAtmosphere();
        await this._loadIsoMap();
        await this._loadBorders();
        this._setupInteraction();
        this._animate();
    }

    _initScene() {
        const w = this.container?.clientWidth || window.innerWidth;
        const h = this.container?.clientHeight || window.innerHeight;

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x020408, 1);
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000);
        this.camera.position.set(0, 50, 280);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = GLOBE_RADIUS * 1.3;
        this.controls.maxDistance = GLOBE_RADIUS * 5;
        this.controls.enablePan = false;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 0.8;
        this.controls.panSpeed = 1;
        this.controls.addEventListener('start', () => { this._autoRotate = false; });
        this.applyControlSettings(this._controlSettings);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));
        const sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
        sunLight.position.set(300, 200, 400);
        this.scene.add(sunLight);
        const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.4);
        rimLight.position.set(-200, -100, -300);
        this.scene.add(rimLight);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.scene.add(this.countryFillGroup);
        this.scene.add(this.markerGroup);

        window.addEventListener('resize', this._onResize);
    }

    _createGlobe() {
        const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
        const loader = new THREE.TextureLoader();
        const diffuse = loader.load('assets/textures/earth_dark.jpg');
        diffuse.colorSpace = THREE.SRGBColorSpace;

        this.globeMaterial = new THREE.MeshStandardMaterial({
            map: diffuse,
            roughness: 0.85,
            metalness: 0.1,
            emissive: new THREE.Color(0x0a1628),
            emissiveIntensity: 0.15,
        });

        this.globe = new THREE.Mesh(geometry, this.globeMaterial);
        this.scene.add(this.globe);
    }

    _createAtmosphere() {
        const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * ATMOSPHERE_SCALE, 64, 64);
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vec3 viewDir = normalize(-vPosition);
                    float fresnel = 1.0 - dot(vNormal, viewDir);
                    fresnel = pow(fresnel, 3.0) * 0.65;
                    vec3 color = mix(vec3(0.0, 0.4, 0.8), vec3(0.0, 0.9, 1.0), fresnel);
                    gl_FragColor = vec4(color, fresnel * 0.5);
                }
            `,
            side: THREE.BackSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.atmosphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.atmosphere);
    }

    _createStarfield() {
        const positions = new Float32Array(STAR_COUNT * 3);
        for (let i = 0; i < STAR_COUNT; i++) {
            const r = 1500 + Math.random() * 2000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.7,
        });
        this.stars = new THREE.Points(geometry, material);
        this.scene.add(this.stars);
    }

    async _loadIsoMap() {
        try {
            const res = await fetch('data/json/iso_country_map.json');
            if (!res.ok) throw new Error(String(res.status));
            this._isoToAlpha = { ...buildIsoCountryMap(), ...(await res.json()) };
        } catch (error) {
            console.warn('[GlobeMap] ISO map not found, using built-in map:', error);
            this._isoToAlpha = buildIsoCountryMap();
        }
        this._rebuildCountryIdMaps();
    }

    async _loadBorders() {
        try {
            const res = await fetch('assets/countries-110m.json');
            if (!res.ok) throw new Error(String(res.status));
            const topo = await res.json();
            this.countries = decodeTopoJSON(topo, this._isoToAlpha);
            this._rebuildCountryIdMaps();
            this._renderBorders();
            this._createCountryFills();
            this._syncCountryVisuals();
        } catch (error) {
            console.warn('[GlobeMap] Failed to load borders:', error);
        }
    }

    _rebuildCountryIdMaps() {
        this._countryLookup = buildCountryLookupTables(this.countries, this._isoToAlpha, COUNTRIES);
        this._alphaToTopoId = { ...(this._countryLookup.alphaToTopo || {}) };
        // 1:N 매핑 — 같은 게임 ID를 가진 모든 TopoJSON ID (그린란드→덴마크 등)
        this._alphaToTopoIds = {};

        for (const country of this.countries) {
            const topoId = normalizeTopoCountryId(country.topoId || country.id);
            const alphaId = country.gameId || normalizeCountryId(country.id, this._isoToAlpha);
            if (alphaId && topoId) {
                if (!this._alphaToTopoIds[alphaId]) this._alphaToTopoIds[alphaId] = [];
                if (!this._alphaToTopoIds[alphaId].includes(topoId)) {
                    this._alphaToTopoIds[alphaId].push(topoId);
                }
            }
        }

        for (const [alphaId, topoCountryId] of Object.entries(this._gameIdMap || {})) {
            const resolvedTopoId = normalizeTopoCountryId(topoCountryId);
            if (alphaId && resolvedTopoId) {
                this._alphaToTopoId[alphaId] = resolvedTopoId;
            }
        }
    }

    /**
     * 게임 ID로 연결된 모든 TopoJSON 메시를 반환 (본토+해외영토)
     */
    _getAllMeshesForGameId(gameId) {
        if (!gameId) return [];
        const topoIds = this._alphaToTopoIds?.[gameId] || [];
        const meshes = [];
        for (const tid of topoIds) {
            const m = this.countryMeshes[tid];
            if (m) meshes.push(m);
        }
        // fallback: 단일 매핑
        if (meshes.length === 0) {
            const single = this._getCountryMesh(gameId);
            if (single) meshes.push(single);
        }
        return meshes;
    }

    _resolveTopoCountryId(countryId) {
        if (countryId == null) return null;
        const raw = String(countryId).trim();
        if (!raw) return null;
        if (this.countryMeshes[raw]) return raw;
        const mapped = this._gameIdMap?.[raw];
        const mappedTopo = normalizeTopoCountryId(mapped);
        if (mappedTopo && this.countryMeshes[mappedTopo]) return mappedTopo;
        const alphaId = normalizeCountryId(raw, this._isoToAlpha);
        if (alphaId && this._alphaToTopoId[alphaId]) return this._alphaToTopoId[alphaId];
        return normalizeTopoCountryId(raw);
    }

    _getCountryMesh(countryId) {
        const topo = this._resolveTopoCountryId(countryId);
        return topo ? this.countryMeshes[topo] : null;
    }

    _renderBorders() {
        if (this.borderGroup) {
            this.scene.remove(this.borderGroup);
        }

        const borderGroup = new THREE.Group();
        borderGroup.name = 'borders';

        for (const country of this.countries) {
            const topoCountryId = normalizeTopoCountryId(country.topoId || country.id);
            const alphaId = country.isoId || normalizeCountryId(country.id, this._isoToAlpha) || this._isoToAlpha?.[topoCountryId] || null;
            const gameId = country.gameId || (COUNTRIES[alphaId] ? alphaId : null);
            const name = COUNTRIES[gameId]?.name || country.name || topoCountryId;
            const borders = [];
            let centroidSum = new THREE.Vector3();
            let pointCount = 0;

            for (const ring of country.rings) {
                const points = [];
                for (const [lon, lat] of ring) {
                    const point = latLonToVec3(lat, lon, GLOBE_RADIUS + BORDER_OFFSET);
                    const p = toVector3(point);
                    points.push(p);
                    centroidSum.add(p);
                    pointCount++;
                }
                if (points.length < 3) continue;
                points.push(points[0]);

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: 0x00e5ff,
                    transparent: true,
                    opacity: 0.45,
                    linewidth: 1,
                });
                const line = new THREE.Line(geometry, material);
                line.userData.countryId = topoCountryId;
                borders.push(line);
                borderGroup.add(line);
            }

            const centroid = country.centroid
                ? toVector3(latLonToVec3(country.centroid.lat, country.centroid.lon, GLOBE_RADIUS + BORDER_OFFSET + 1))
                : (pointCount > 0
                    ? centroidSum.divideScalar(pointCount).normalize().multiplyScalar(GLOBE_RADIUS + BORDER_OFFSET + 1)
                    : new THREE.Vector3());

            const data = {
                borders,
                centroid,
                name,
                topoId: topoCountryId,
                alphaId,
                gameId,
                country,
                fillMesh: null
            };
            this.countryMeshes[topoCountryId] = data;
            if (alphaId) this.countryMeshes[alphaId] = data;
        }

        this.borderGroup = borderGroup;
        this.scene.add(borderGroup);
    }

    _createCountryFills() {
        if (this.countryFillGroup) {
            this.scene.remove(this.countryFillGroup);
        }
        this.countryFillGroup = new THREE.Group();
        this.countryFillGroup.name = 'country-fills';

        // 모든 국가를 antimeridian 분할 + 공격적 subdivide로 통합 처리
        const SPECIAL_FILL = new Set();

        for (const country of this.countries) {
            const topoCountryId = normalizeTopoCountryId(country.topoId || country.id);
            const data = this.countryMeshes[topoCountryId];
            if (!data) continue;
            if (SPECIAL_FILL.has(topoCountryId)) {
                const mesh = this._buildSpecialFill(topoCountryId, data);
                // mesh가 배열일 수 있음
                const meshes = Array.isArray(mesh) ? mesh : (mesh ? [mesh] : []);
                for (const m of meshes) {
                    m.userData.countryId = topoCountryId;
                    this.countryFillGroup.add(m);
                    if (!data.fillMesh) data.fillMesh = m;
                    if (!data.fillMeshes) data.fillMeshes = [];
                    data.fillMeshes.push(m);
                }
                continue;
            }

            // 모든 ring을 렌더링 (mainRing만이 아님 → 캐나다 섬, 노르웨이 등 커버)
            for (const ring of country.rings) {
                if (ring.length < 3) continue;

                // 남극만 antimeridian 분할 (극점 확장 필요)
                // 나머지 국가는 _buildFillMesh 내부의 경도 시프트 기법으로 처리
                const isAntarctica = topoCountryId === '010';
                const ringsToRender = isAntarctica
                    ? splitAntarcticaRing(ring)
                    : [ring];

                for (const subRing of ringsToRender) {
                    if (subRing.length < 3) continue;

                    // 큰 폴리곤일수록 subdivide를 공격적으로
                    const subLons = subRing.map(p => p[0]);
                    const subSpan = Math.max(...subLons) - Math.min(...subLons);
                    const subdivThreshold = subSpan > 80 ? 2.0 : subSpan > 40 ? 3.0 : 5.0;

                    const mesh = this._buildFillMesh(subRing, subdivThreshold);
                    if (mesh) {
                        mesh.userData.countryId = topoCountryId;
                        this.countryFillGroup.add(mesh);
                        if (!data.fillMesh) data.fillMesh = mesh;
                        if (!data.fillMeshes) data.fillMeshes = [];
                        data.fillMeshes.push(mesh);
                    }
                } // subRing loop
            } // ring loop
        } // country loop

        this.scene.add(this.countryFillGroup);
    }

    /**
     * 남극/러시아 등 특수 국가 fill 처리
     */
    _buildSpecialFill(topoId, data) {
        const material = new THREE.MeshBasicMaterial({
            color: 0x1a2130,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        if (topoId === '010') {
            // ── 남극: 극점 중심 원형 디스크 ──
            // 위도 -60°~-90° 범위를 구면 캡으로 덮음
            const segments = 64;
            const positions = [];
            const indices = [];

            // 중심점 (남극점)
            const pole = latLonToVec3(-90, 0, GLOBE_RADIUS + 0.15);
            positions.push(pole.x, pole.y, pole.z);

            // 외곽 원 (위도 -60° 선)
            for (let i = 0; i <= segments; i++) {
                const lon = -180 + (360 * i / segments);
                const p = latLonToVec3(-60, lon, GLOBE_RADIUS + 0.15);
                positions.push(p.x, p.y, p.z);
            }

            // 중간 링 추가 (위도 -75°) — 곡면 정확도
            const midStart = segments + 2;
            for (let i = 0; i <= segments; i++) {
                const lon = -180 + (360 * i / segments);
                const p = latLonToVec3(-75, lon, GLOBE_RADIUS + 0.15);
                positions.push(p.x, p.y, p.z);
            }

            // 삼각형: 극점 → 중간링
            for (let i = 0; i < segments; i++) {
                indices.push(0, midStart + i, midStart + i + 1);
            }
            // 삼각형: 중간링 → 외곽링
            for (let i = 0; i < segments; i++) {
                indices.push(midStart + i, 1 + i, 1 + i + 1);
                indices.push(midStart + i, 1 + i + 1, midStart + i + 1);
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setIndex(indices);
            geo.computeVertexNormals();
            return new THREE.Mesh(geo, material);
        }

        if (topoId === '643') {
            // ── 러시아: antimeridian 분할 후 큰 조각을 경도 80° 간격으로 재분할 ──
            const country = this.countries.find(c =>
                normalizeTopoCountryId(c.topoId || c.id) === '643'
            );
            if (!country) return null;

            const meshes = [];
            for (const ring of country.rings) {
                if (ring.length < 3) continue;

                // 1단계: antimeridian 분할
                const antiParts = splitByAntimeridian(ring);

                for (const part of antiParts) {
                    if (part.length < 3) continue;
                    const lons = part.map(p => p[0]);
                    const span = Math.max(...lons) - Math.min(...lons);

                    if (span <= 40) {
                        const m = this._buildFillMesh(part);
                        if (m) meshes.push(m);
                    } else {
                        // 2단계: 80° 간격으로 추가 분할 — 보간점 포함
                        const minLon = Math.min(...lons);
                        const maxLon = Math.max(...lons);
                        const sliceCount = 10;
                        const sliceWidth = (maxLon - minLon) / sliceCount;
                        for (let lo = minLon; lo < maxLon; lo += sliceWidth * 0.85) {
                            const hi = lo + sliceWidth;
                            // 범위 안의 점 + 경계 교차 보간점
                            const slice = [];
                            for (let i = 0; i < part.length; i++) {
                                const [lon, lat] = part[i];
                                const inRange = lon >= lo && lon <= hi;
                                if (inRange) slice.push([lon, lat]);

                                // 다음 점과 경계 교차 시 보간
                                const next = part[(i + 1) % part.length];
                                if (next) {
                                    const nextIn = next[0] >= lo && next[0] <= hi;
                                    if (inRange !== nextIn) {
                                        const boundary = inRange ? (lon < next[0] ? hi : lo) : (lon < next[0] ? lo : hi);
                                        const t = (boundary - lon) / (next[0] - lon);
                                        if (t > 0 && t < 1) {
                                            slice.push([boundary, lat + t * (next[1] - lat)]);
                                        }
                                    }
                                }
                            }
                            if (slice.length >= 3) {
                                const m = this._buildFillMesh(slice);
                                if (m) meshes.push(m);
                            }
                        }
                    }
                }
            }
            return meshes;
        }

        return null;
    }

    _buildFillMesh(ring, subdivThreshold = 5.0) {
        if (!ring || ring.length < 3) return null;
        try {
            // ★ 날짜변경선 교차 감지 → 경도 시프트 기법
            // 음수 경도(-170°)를 양수(190°)로 바꿔서 폴리곤이 끊어지지 않게 함
            const hasNegative = ring.some(p => p[0] < -90);
            const hasPositive = ring.some(p => p[0] > 90);
            const crossesAntimeridian = hasNegative && hasPositive;

            const shiftedRing = crossesAntimeridian
                ? ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat])
                : ring;

            const shape = createFillShape(shiftedRing);
            const geometry = new THREE.ShapeGeometry(shape, 8);
            subdivideForSphere(geometry, subdivThreshold);

            const positions = geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                let lon = positions.getX(i);
                const lat = positions.getY(i);
                // ★ 경도 시프트 복원: 0~360 → -180~180
                if (crossesAntimeridian && lon > 180) lon -= 360;
                const point = latLonToVec3(lat, lon, GLOBE_RADIUS + 0.18);
                positions.setXYZ(i, point.x, point.y, point.z);
            }
            positions.needsUpdate = true;
            geometry.computeVertexNormals();

            const material = new THREE.MeshBasicMaterial({
                color: 0x1a2130,
                transparent: true,
                opacity: 0.18,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            return new THREE.Mesh(geometry, material);
        } catch {
            return null;
        }
    }

    _createTooltip() {
        if (this._tooltip || typeof document === 'undefined') return;
        const tooltip = document.createElement('div');
        tooltip.className = 'globe-tooltip';
        tooltip.style.cssText = [
            'position:fixed',
            'pointer-events:none',
            'padding:6px 10px',
            'background:rgba(6,8,12,0.92)',
            'border:1px solid rgba(0,229,255,0.3)',
            'border-radius:6px',
            'color:#e2e8f0',
            'font-size:12px',
            'font-family:var(--font-mono, monospace)',
            'z-index:100',
            'display:none',
            'white-space:nowrap'
        ].join(';');
        const title = document.createElement('span');
        title.className = 'globe-tooltip__title';
        const meta = document.createElement('span');
        meta.className = 'globe-tooltip__meta';
        tooltip.append(title, meta);
        this._tooltipTitle = title;
        this._tooltipMeta = meta;
        document.body.appendChild(tooltip);
        this._tooltip = tooltip;
    }

    _ensureTooltip() {
        return this._createTooltip();
    }

    _showTooltip(name, countryId, x, y, { interactive = false, topoId = null } = {}) {
        this._ensureTooltip();
        if (!this._tooltip) return;
        if (this._tooltipTitle) {
            this._tooltipTitle.textContent = name || 'Unknown';
        }
        if (this._tooltipMeta) {
            const code = countryId ? String(countryId).toUpperCase() : '';
            if (interactive && code) {
                this._tooltipMeta.textContent = code;
            } else if (code) {
                this._tooltipMeta.textContent = `${code} · 지도 전용`;
            } else if (topoId) {
                this._tooltipMeta.textContent = `TOPO ${String(topoId).toUpperCase()} · 데이터 없음`;
            } else {
                this._tooltipMeta.textContent = '데이터 없음';
            }
        }
        this._tooltip.style.left = `${x + 12}px`;
        this._tooltip.style.top = `${y - 20}px`;
        this._tooltip.style.display = 'block';
    }

    _hideTooltip() {
        if (this._tooltip) this._tooltip.style.display = 'none';
    }

    _setupInteraction() {
        this._createTooltip();
        this.renderer.domElement.addEventListener('mousemove', this._onMouseMove);
        this.renderer.domElement.addEventListener('click', this._onClick);
        this.renderer.domElement.addEventListener('mouseleave', this._onMouseLeave);
    }

    _onMouseLeave() {
        this.mouse.set(-9999, -9999);
        this._edgePanVector.set(0, 0);
        this._setHoveredCountry(null);
    }

    _updateEdgePan(event) {
        if (!this.edgePanEnabled || this._reducedMotion || !event) {
            this._edgePanVector.set(0, 0);
            return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const margin = Math.max(EDGE_PAN_MARGIN, Math.min(rect.width, rect.height) * 0.08);

        let edgeX = 0;
        if (x < margin) {
            edgeX = -(1 - (x / margin));
        } else if (x > rect.width - margin) {
            edgeX = 1 - ((rect.width - x) / margin);
        }

        let edgeY = 0;
        if (y < margin) {
            edgeY = 1 - (y / margin);
        } else if (y > rect.height - margin) {
            edgeY = -(1 - ((rect.height - y) / margin));
        }

        this._edgePanVector.set(edgeX, edgeY);
        if (edgeX !== 0 || edgeY !== 0) {
            this._autoRotate = false;
        }
    }

    _syncRotatingGroups() {
        if (!this.globe) return;
        if (this.borderGroup) this.borderGroup.rotation.copy(this.globe.rotation);
        if (this.countryFillGroup) this.countryFillGroup.rotation.copy(this.globe.rotation);
        if (this.markerGroup) this.markerGroup.rotation.copy(this.globe.rotation);
    }

    applyControlSettings(settings = {}) {
        const normalized = {
            edgePan: Boolean(settings.edgePan ?? settings.edgePanEnabled ?? this._controlSettings.edgePan),
            zoomSpeed: Number.isFinite(Number(settings.zoomSpeed))
                ? Math.max(0.3, Math.min(2, Number(settings.zoomSpeed)))
                : this._controlSettings.zoomSpeed,
            panSpeed: Number.isFinite(Number(settings.panSpeed))
                ? Math.max(0.3, Math.min(2, Number(settings.panSpeed)))
                : this._controlSettings.panSpeed,
            reducedMotion: Boolean(settings.reducedMotion ?? this._controlSettings.reducedMotion)
        };

        this._controlSettings = normalized;
        this._reducedMotion = normalized.reducedMotion;
        this.edgePanEnabled = Boolean(normalized.edgePan && !this._reducedMotion);
        this._edgePanVector.set(0, 0);

        if (this.controls) {
            this.controls.enableDamping = !this._reducedMotion;
            this.controls.rotateSpeed = Math.max(0.1, normalized.panSpeed * 0.5);
            this.controls.zoomSpeed = normalized.zoomSpeed;
            this.controls.panSpeed = normalized.panSpeed;
        }

        if (this._reducedMotion) {
            this._autoRotate = false;
        }

        return this._controlSettings;
    }

    applySettings(settings = {}) {
        return this.applyControlSettings(settings);
    }

    _setHoveredCountry(countryId, event) {
        // 이전 호버 해제 — 같은 게임 ID의 모든 영토 (그린란드+덴마크 등)
        if (this.hoveredCountryId && this.hoveredCountryId !== countryId) {
            const prevMesh = this._getCountryMesh(this.hoveredCountryId);
            const prevGameId = prevMesh?.gameId;
            const prevMeshes = prevGameId ? this._getAllMeshesForGameId(prevGameId) : (prevMesh ? [prevMesh] : []);
            for (const m of prevMeshes) {
                for (const line of m.borders) {
                    line.material.opacity = m._baseOpacity ?? 0.45;
                    line.material.color.setHex(m._baseColor ?? 0x00e5ff);
                }
                for (const fm of (m.fillMeshes || (m.fillMesh ? [m.fillMesh] : []))) {
                    fm.material.opacity = m._baseFillOpacity ?? 0.18;
                    fm.material.color.setHex(m._baseFillColor ?? 0x1a2130);
                }
            }
        }

        this.hoveredCountryId = countryId || null;

        if (!countryId) {
            this.renderer.domElement.style.cursor = 'default';
            this._hideTooltip();
            if (this.onHoverEnd) this.onHoverEnd();
            return;
        }

        const mesh = this._getCountryMesh(countryId);
        if (!mesh) {
            this.hoveredCountryId = null;
            this.renderer.domElement.style.cursor = 'default';
            this._hideTooltip();
            if (this.onHoverEnd) this.onHoverEnd();
            return;
        }

        const gameCountryId = mesh.gameId && COUNTRIES[mesh.gameId] ? mesh.gameId : null;
        const displayCountryId = mesh.alphaId || mesh.topoId || countryId;
        const countryData = gameCountryId ? COUNTRIES[gameCountryId] : null;
        const policy = countryData
            ? getCountryVisualPolicy(countryData, this._state, { isPlayer: gameCountryId === this._state?.player?.country })
            : null;
        const highlightColor = policy?.color ? new THREE.Color(policy.color).getHex() : HOVER_COLOR;

        // 같은 게임 ID의 모든 영토를 하이라이트 (덴마크+그린란드, 영국+포클랜드 등)
        const allMeshes = gameCountryId ? this._getAllMeshesForGameId(gameCountryId) : [mesh];
        for (const m of allMeshes) {
            for (const line of m.borders) {
                line.material.opacity = 1.0;
                line.material.color.setHex(highlightColor);
            }
            for (const fm of (m.fillMeshes || (m.fillMesh ? [m.fillMesh] : []))) {
                fm.material.opacity = Math.min(0.6, (m._baseFillOpacity ?? 0.18) + 0.16);
                fm.material.color.setHex(highlightColor);
            }
        } // allMeshes loop
        this.renderer.domElement.style.cursor = gameCountryId ? 'pointer' : 'default';
        if (event && this.onHover && gameCountryId) {
            this.onHover(gameCountryId, mesh.name, event.clientX, event.clientY);
        }
        this._hideTooltip();
        this._showTooltip(mesh.name, displayCountryId, event?.clientX ?? 0, event?.clientY ?? 0, {
            interactive: Boolean(gameCountryId),
            topoId: mesh.topoId
        });
    }

    _onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._updateEdgePan(event);
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.globe);

        if (intersects.length === 0) {
            this._setHoveredCountry(null);
            return;
        }

        const localPoint = this.globe.worldToLocal(intersects[0].point.clone());
        const { lat, lon } = vec3ToLatLon(localPoint, GLOBE_RADIUS);
        const countryId = this._findCountryAt(lat, lon);
        this._setHoveredCountry(countryId, event);
    }

    _onClick() {
        if (!this.hoveredCountryId || !this.onClick) return;
        const mesh = this._getCountryMesh(this.hoveredCountryId);
        if (!mesh) return;
        if (!mesh.gameId || !COUNTRIES[mesh.gameId]) return;
        this.onClick(mesh.gameId, mesh.name);
    }

    _findCountryAt(lat, lon) {
        return findCountryAt(lat, lon, this.countries, this._isoToAlpha);
    }

    _clearMarkers() {
        for (const child of [...this.markerGroup.children]) {
            if (child.userData?.kind === 'pulse') continue;
            if (child.userData?.labelDiv) {
                child.userData.labelDiv.remove();
                this._markerLabels.delete(child.userData.labelDiv);
            }
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.markerGroup.remove(child);
        }
    }

    _addMarker(position, options = {}) {
        const { color = 0x00e5ff, label, type = 'marker', size = 2, pulse = false } = options;
        const spriteMaterial = new THREE.SpriteMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(size, size, 1);
        sprite.userData.kind = 'state-marker';
        sprite.userData.marker = { type, pulse, age: 0 };

        if (label && typeof document !== 'undefined') {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'globe-marker-label';
            labelDiv.textContent = label;
            const colorStr = new THREE.Color(color).getStyle();
            labelDiv.style.cssText = [
                'position:fixed',
                'pointer-events:none',
                'font-size:9px',
                'font-weight:600',
                'letter-spacing:0.5px',
                `color:${colorStr}`,
                'font-family:var(--font-mono, monospace)',
                'text-shadow:0 0 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
                'background:rgba(2,4,10,0.7)',
                'padding:2px 5px',
                'border-radius:3px',
                `border:1px solid ${colorStr}33`,
                'z-index:50',
                'display:none',
                'white-space:nowrap',
                'text-align:center'
            ].join(';');
            document.body.appendChild(labelDiv);
            sprite.userData.labelDiv = labelDiv;
            this._markerLabels.add(labelDiv);
        }

        this.markerGroup.add(sprite);
        return sprite;
    }

    /**
     * IT 허브 목록에서 순차적으로 위치 배정 — 같은 국가의 회사들이 겹치지 않음
     */
    _resolveMarkerPositionForHub(countryId, hubIndexMap = {}) {
        const normalizedId = normalizeCountryId(countryId, this._isoToAlpha) || countryId;
        const hubs = IT_HUBS[normalizedId];
        if (hubs && hubs.length > 0) {
            const idx = hubIndexMap[normalizedId] || 0;
            hubIndexMap[normalizedId] = idx + 1;
            const hub = hubs[idx % hubs.length];
            return toVector3(latLonToVec3(hub.lat, hub.lon, GLOBE_RADIUS + BORDER_OFFSET + 1));
        }
        // fallback: 기존 좌표 + 약간의 랜덤 오프셋
        const pos = this._resolveMarkerPosition(countryId);
        if (pos) {
            const offset = (hubIndexMap[normalizedId] || 0) * 2;
            hubIndexMap[normalizedId] = (hubIndexMap[normalizedId] || 0) + 1;
            return pos.clone().add(new THREE.Vector3(offset * 0.3, offset * 0.2, 0));
        }
        return null;
    }

    _resolveMarkerPosition(countryId) {
        const normalizedCountryId = normalizeCountryId(countryId, this._isoToAlpha);
        const markerOverride = normalizedCountryId ? COUNTRY_MARKER_COORDINATES[normalizedCountryId] : null;
        if (markerOverride) {
            return toVector3(latLonToVec3(markerOverride.lat, markerOverride.lon, GLOBE_RADIUS + BORDER_OFFSET + 1));
        }

        const meshes = normalizedCountryId ? this._getAllMeshesForGameId(normalizedCountryId) : [];
        if (meshes.length > 0) {
            const primaryMesh = meshes
                .slice()
                .sort((a, b) => {
                    const aArea = Math.max(...((a.country?.rings || []).map((ring) => ringArea(ring))), 0);
                    const bArea = Math.max(...((b.country?.rings || []).map((ring) => ringArea(ring))), 0);
                    return bArea - aArea;
                })[0];
            if (primaryMesh?.centroid) {
                return primaryMesh.centroid;
            }
        }

        const mesh = this._getCountryMesh(countryId);
        return mesh?.centroid || null;
    }

    setMapMode(mode) {
        if (mode === this._mapMode) return;
        this._mapMode = mode || 'default';
        this._syncCountryVisuals();
    }

    getMapMode() { return this._mapMode; }

    _syncCountryVisuals() {
        if (!this._state) return;
        const mapMode = this._mapMode || 'default';

        for (const country of this.countries) {
            const topoCountryId = normalizeTopoCountryId(country.topoId || country.id);
            const mesh = this.countryMeshes[topoCountryId];
            if (!mesh || mesh._syncing) continue;

            const gameCountryId = mesh.gameId || (mesh.alphaId && COUNTRIES[mesh.alphaId] ? mesh.alphaId : null);
            const countryData = gameCountryId ? COUNTRIES[gameCountryId] : null;
            const isPlayer = gameCountryId === this._state?.player?.country;
            const policy = countryData
                ? getCountryVisualPolicy(countryData, this._state, { isPlayer, mapMode })
                : null;

            const baseColor = policy ? policy.color : getCountryColor(countryData, this._state, mapMode);
            const fillOpacity = policy?.webgl?.fillOpacity ?? (isPlayer ? 0.38 : 0.12);
            const borderOpacity = policy?.webgl?.borderOpacity ?? (isPlayer ? 0.88 : 0.45);
            const fillColor = new THREE.Color(baseColor);

            mesh._baseColor = new THREE.Color(baseColor).getHex();
            mesh._baseFillColor = fillColor.getHex();
            mesh._baseOpacity = borderOpacity;
            mesh._baseFillOpacity = fillOpacity;

            for (const line of mesh.borders) {
                line.material.color.setHex(baseColor);
                line.material.opacity = borderOpacity;
            }

            for (const fm of (mesh.fillMeshes || (mesh.fillMesh ? [mesh.fillMesh] : []))) {
                fm.material.color.copy(fillColor);
                fm.material.opacity = fillOpacity;
            }
        }

        if (this.hoveredCountryId) {
            this._setHoveredCountry(this.hoveredCountryId);
        }
    }

    _updateMarkerLabels() {
        const width = this.renderer.domElement.clientWidth || this.container.clientWidth;
        const height = this.renderer.domElement.clientHeight || this.container.clientHeight;
        const rect = this.renderer.domElement.getBoundingClientRect();

        for (const child of this.markerGroup.children) {
            const labelDiv = child.userData?.labelDiv;
            if (!labelDiv) continue;

            const worldPos = child.getWorldPosition(new THREE.Vector3());
            const screenPos = worldPos.clone().project(this.camera);

            // 지구본 뒤에 있으면 숨기기:
            // 마커 위치와 카메라 방향의 내적 — 카메라 반대편이면 음수
            const camDir = this.camera.position.clone().normalize();
            const markerDir = worldPos.clone().normalize();
            const dot = camDir.dot(markerDir);
            if (dot < 0.1 || screenPos.z > 1) {
                labelDiv.style.display = 'none';
                if (child.material) child.material.opacity = 0;
                continue;
            }
            if (child.material) child.material.opacity = 0.9;

            const x = (screenPos.x * 0.5 + 0.5) * width + rect.left;
            const y = (-screenPos.y * 0.5 + 0.5) * height + rect.top;

            labelDiv.style.display = 'block';
            // 마커 바로 아래에 라벨 배치 (중앙 정렬)
            labelDiv.style.left = `${x}px`;
            labelDiv.style.top = `${y + 8}px`;
            labelDiv.style.transform = 'translateX(-50%)';
        }
    }

    applyState(state, gameCountryMap = {}) {
        this._state = state;
        this._gameIdMap = gameCountryMap || {};
        this._rebuildCountryIdMaps();
        this._syncCountryVisuals();
        this._clearMarkers();

        if (!state) return;

        // 같은 국가 내 회사들을 다른 IT 허브에 분산 배치
        const countryHubIndex = {}; // countryId → 다음 허브 인덱스

        const competitors = state.competitors || [];
        for (const competitor of competitors) {
            const country = competitor.country;
            const position = this._resolveMarkerPositionForHub(country, countryHubIndex);
            if (!position) continue;
            this._addMarker(position, {
                color: competitor.color || 0xf472b6,
                label: competitor.name,
                type: 'competitor',
                size: 1.0  // 작은 도트
            });
        }

        const hqCountry = state.player?.country;
        const hqPosition = this._resolveMarkerPositionForHub(hqCountry, countryHubIndex);
        if (hqPosition) {
            this._addMarker(hqPosition, {
                color: 0x00e5ff,
                label: state.company?.companyName || 'HQ',
                type: 'hq',
                size: 1.5,  // HQ만 약간 크게
                pulse: true
            });
        }

        // Datacenter markers on globe
        const dcLocationCoords = {
            domestic: null, // uses player HQ country
            us_virginia: { lat: 38.9, lon: -77.4 },
            iceland: { lat: 64.1, lon: -21.9 },
            singapore: { lat: 1.3, lon: 103.8 },
            uae: { lat: 25.2, lon: 55.3 },
            nordics: { lat: 59.9, lon: 10.7 },
            space_orbital: { lat: 0, lon: 0, orbital: true }
        };
        const datacenters = state.economy?.datacenters || [];
        for (const dc of datacenters) {
            const locId = dc.locationId || 'domestic';
            const coordDef = dcLocationCoords[locId];
            let position;
            if (coordDef?.orbital) {
                // Space DC: place above globe at orbital height
                const orbitRadius = GLOBE_RADIUS + 30;
                const angle = (datacenters.indexOf(dc) * 1.2) + Date.now() * 0.00001;
                position = new THREE.Vector3(
                    Math.cos(angle) * orbitRadius,
                    Math.sin(angle * 0.3) * 15,
                    Math.sin(angle) * orbitRadius
                );
            } else if (coordDef) {
                position = toVector3(latLonToVec3(coordDef.lat, coordDef.lon, GLOBE_RADIUS + BORDER_OFFSET + 2));
            } else {
                // domestic — use player's country hub
                position = this._resolveMarkerPositionForHub(hqCountry, countryHubIndex);
            }
            if (!position) continue;
            const isBuilding = !dc.operational;
            const dcColor = coordDef?.orbital ? 0xac83ff : isBuilding ? 0xeab308 : 0x22c55e;
            const dcLabel = `${dc.name || 'DC'}${isBuilding ? ' ⚙' : ' ●'}`;
            this._addMarker(position, {
                color: dcColor,
                label: dcLabel,
                type: 'datacenter',
                size: coordDef?.orbital ? 2.0 : 1.2,
                pulse: isBuilding
            });
        }

        // Add orbital ring if any space DC exists
        const hasSpaceDC = datacenters.some(dc => (dc.locationId || 'domestic') === 'space_orbital');
        if (hasSpaceDC) {
            const ringGeo = new THREE.RingGeometry(GLOBE_RADIUS + 28, GLOBE_RADIUS + 32, 64);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xac83ff,
                transparent: true,
                opacity: 0.15,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const orbitRing = new THREE.Mesh(ringGeo, ringMat);
            orbitRing.rotation.x = Math.PI * 0.5;
            orbitRing.rotation.z = Math.PI * 0.1;
            orbitRing.userData.kind = 'state-marker';
            this.markerGroup.add(orbitRing);
        }

        const playerCountry = state.player?.country || null;
        if (playerCountry && playerCountry !== this._lastFocusedPlayerCountry) {
            this.focusCountry(playerCountry);
            this._lastFocusedPlayerCountry = playerCountry;
        }
    }

    showPulse(countryId, color = 0x00e5ff) {
        const data = this._getCountryMesh(countryId);
        if (!data) return;

        const geometry = new THREE.RingGeometry(0.5, 1.5, 32);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(data.centroid);
        ring.lookAt(new THREE.Vector3(0, 0, 0));
        ring.userData.kind = 'pulse';
        ring.userData.pulse = { age: 0, maxAge: 90 };
        this.markerGroup.add(ring);
    }

    focusCountry(countryId) {
        const data = this._getCountryMesh(countryId);
        if (!data) return;

        const target = data.centroid.clone().normalize().multiplyScalar(GLOBE_RADIUS * 2.5);
        if (this._reducedMotion) {
            this.camera.position.copy(target);
            this.camera.lookAt(0, 0, 0);
            this._autoRotate = false;
            this._syncRotatingGroups();
            return;
        }
        const startPos = this.camera.position.clone();
        const startTime = performance.now();
        const duration = 1200;

        const animateCamera = () => {
            const t = Math.min(1, (performance.now() - startTime) / duration);
            const ease = 1 - Math.pow(1 - t, 3);
            this.camera.position.lerpVectors(startPos, target, ease);
            this.camera.lookAt(0, 0, 0);
            if (t < 1) requestAnimationFrame(animateCamera);
        };
        animateCamera();
        this._autoRotate = false;
    }

    _animate() {
        if (this._disposed) return;
        requestAnimationFrame(this._animate);

        if (this._autoRotate && this.globe) {
            this.globe.rotation.y += AUTO_ROTATE_SPEED * 0.005;
            this._syncRotatingGroups();
        }

        if (this.edgePanEnabled && !this._reducedMotion && (this._edgePanVector.x !== 0 || this._edgePanVector.y !== 0) && this.globe) {
            const edgeStep = EDGE_PAN_MAX_STEP * this._controlSettings.panSpeed;
            this.globe.rotation.y += this._edgePanVector.x * edgeStep;
            this.globe.rotation.x = Math.max(-1.2, Math.min(1.2, this.globe.rotation.x + this._edgePanVector.y * edgeStep * 0.85));
            this._syncRotatingGroups();
        }

        const toRemove = [];
        for (const child of this.markerGroup.children) {
            if (child.userData.pulse) {
                const pulse = child.userData.pulse;
                pulse.age++;
                const t = pulse.age / pulse.maxAge;
                child.scale.setScalar(1 + t * 5);
                child.material.opacity = 0.8 * (1 - t);
                if (pulse.age >= pulse.maxAge) toRemove.push(child);
            }
        }
        for (const obj of toRemove) {
            obj.geometry.dispose();
            obj.material.dispose();
            this.markerGroup.remove(obj);
        }

        this._updateMarkerLabels();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    _onResize() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    dispose() {
        this._disposed = true;
        window.removeEventListener('resize', this._onResize);
        this.renderer.domElement.removeEventListener('mousemove', this._onMouseMove);
        this.renderer.domElement.removeEventListener('click', this._onClick);
        this.renderer.domElement.removeEventListener('mouseleave', this._onMouseLeave);
        this.controls.dispose();
        this._clearMarkers();
        this._markerLabels.forEach(label => label.remove());
        this._markerLabels.clear();
        this._hideTooltip();
        this._tooltip?.remove?.();

        const uniqueMeshes = new Set(Object.values(this.countryMeshes));
        for (const mesh of uniqueMeshes) {
            if (!mesh) continue;
            for (const line of mesh.borders || []) {
                line.geometry?.dispose?.();
                line.material?.dispose?.();
            }
            mesh.fillMesh?.geometry?.dispose?.();
            mesh.fillMesh?.material?.dispose?.();
        }
        for (const child of [...this.markerGroup.children]) {
            child.geometry?.dispose?.();
            child.material?.dispose?.();
            this.markerGroup.remove(child);
        }
        this.borderGroup?.parent?.remove?.(this.borderGroup);
        this.countryFillGroup?.parent?.remove?.(this.countryFillGroup);
        this.renderer.dispose();
        this.container?.removeChild?.(this.renderer.domElement);
    }
}
