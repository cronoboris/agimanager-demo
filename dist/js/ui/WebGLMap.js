import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COUNTRIES, ISO_TO_ID } from '../data/countries.js';
import { getLocale, t } from '../i18n.js';
import { mapCache } from './WorldMap.js';
import { getCountryColor, getCountryVisualPolicy } from './countryVisualPolicy.js';

const COMPETITOR_OFFSETS = [
    { dx: -24, dy: 26 },
    { dx: 24, dy: 26 },
    { dx: -28, dy: 42 },
    { dx: 28, dy: 42 },
    { dx: 0, dy: 52 },
    { dx: 0, dy: 66 }
];

const MAP_PULSE_COLORS = {
    info: '#4fc3f7',
    warning: '#eab308',
    danger: '#ef4444',
    success: '#22c55e'
};

function resolvePulseColor(type = 'info') {
    return MAP_PULSE_COLORS[type] || MAP_PULSE_COLORS.info;
}

export class WebGLMap {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        if (!WebGLMap.isSupported()) {
            throw new Error('WebGL is not supported in this browser');
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#060a12');
        this.scene.fog = new THREE.FogExp2('#060a12', 0.001);

        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 1, 10000);
        this.cameraIntro = {
            start: new THREE.Vector3(0, -100, 1200),
            end: new THREE.Vector3(0, -100, 800),
            startedAt: performance.now(),
            duration: 2200,
            active: true
        };
        this.camera.position.copy(this.cameraIntro.start);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
        this.container.classList.add('world-map-bg--webgl');

        this.overlay = this._createOverlay();
        this.container.appendChild(this.overlay.root);

        // Paradox-style flat map controls: drag=pan, scroll=zoom, no rotation
        this.controls = null; // No OrbitControls
        this._isDragging = false;
        this._lastDrag = { x: 0, y: 0 };
        this._setupFlatMapControls();

        this.setupLights();
        this.setupSceneDecor();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-9999, -9999);
        this.intersected = null;
        this.hoveredCountryId = null;

        this.countryMeshes = new Map();
        this.countryAnchors = new Map();
        this.competitorAnchors = [];
        this.mapPulses = new Set();
        this._projectionVec = new THREE.Vector3();
        this.gridHelper = null;
        this._lastMeshKey = null;
        this._lastOverlayKey = null;
        this._time = 0;

        this.onWindowResize = this.onWindowResize.bind(this);
        window.addEventListener('resize', this.onWindowResize);

        this.onMouseMove = this.onMouseMove.bind(this);
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);

        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.renderer.domElement.addEventListener('mouseleave', this.onMouseLeave);

        this.onClick = this.onClick.bind(this);
        this.renderer.domElement.addEventListener('click', this.onClick);

        this.animate = this.animate.bind(this);
        this.animate();
    }

    static isSupported() {
        if (typeof window === 'undefined') return false;
        try {
            const canvas = document.createElement('canvas');
            return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
            return false;
        }
    }

    _createOverlay() {
        const root = document.createElement('div');
        root.className = 'world-map-webgl-overlay';

        const pulses = document.createElement('div');
        pulses.className = 'world-map-webgl-pulses';
        root.appendChild(pulses);

        const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        lines.setAttribute('class', 'world-map-webgl-lines');
        root.appendChild(lines);

        const labels = document.createElement('div');
        labels.className = 'world-map-webgl-labels';
        root.appendChild(labels);

        return { root, pulses, lines, labels };
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambientLight);

        // Cyberpunk rim light - more dramatic
        const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
        rimLight.position.set(500, -500, 1000);
        this.scene.add(rimLight);

        // Warm fill light for depth
        const fillLight = new THREE.DirectionalLight(0xff7a18, 0.45);
        fillLight.position.set(-500, 500, 600);
        this.scene.add(fillLight);

        // Center pulse light
        const pulseLight = new THREE.PointLight(0x4fc3f7, 1.5, 3000, 2);
        pulseLight.position.set(0, 0, 250);
        this.scene.add(pulseLight);
        this.pulseLight = pulseLight;
    }

    setupSceneDecor() {
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(2600, 1600),
            new THREE.MeshBasicMaterial({
                color: 0x081220,
                transparent: true,
                opacity: 0.42
            })
        );
        floor.position.z = -8;
        this.scene.add(floor);

        const starsGeometry = new THREE.BufferGeometry();
        const stars = [];
        for (let i = 0; i < 220; i++) {
            stars.push(
                (Math.random() - 0.5) * 2600,
                (Math.random() - 0.5) * 1600,
                500 + Math.random() * 700
            );
        }
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
        const starsMaterial = new THREE.PointsMaterial({
            color: 0x77d7ff,
            size: 3,
            transparent: true,
            opacity: 0.45,
            sizeAttenuation: true
        });
        this.scene.add(new THREE.Points(starsGeometry, starsMaterial));
    }

    onWindowResize() {
        if (!this.container || !this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onClick() {
        if (this.intersected?.userData?.gameId && window.game) {
            window.game.showCountryInfo(this.intersected.userData.gameId);
        }
    }

    onMouseLeave() {
        this.mouse.set(-9999, -9999);
        this.hoveredCountryId = null;
        if (this.intersected) {
            this.intersected.material.emissive.setHex(this.intersected.userData.baseEmissiveHex);
            this.intersected = null;
        }
        this.container.style.cursor = 'default';
    }

    animate() {
        if (!this.renderer) return;
        requestAnimationFrame(this.animate);

        this._time = performance.now();
        this._animateCameraIntro();
        // Flat map: camera always looks straight down at XY plane
        this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);
        this._animateCountryMeshes();
        this._animateSceneLights();

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        let hitCountry = null;
        for (const hit of intersects) {
            if (hit.object?.userData?.isCountry) {
                hitCountry = hit.object;
                break;
            }
        }

        if (hitCountry) {
            if (this.intersected !== hitCountry) {
                if (this.intersected) {
                    this.intersected.material.emissive.setHex(this.intersected.userData.baseEmissiveHex);
                }
                this.intersected = hitCountry;
                this.intersected.material.emissive.setHex(0x00e5ff);
                this.container.style.cursor = 'pointer';
            }
            this.hoveredCountryId = hitCountry.userData.gameId || null;
        } else if (this.intersected) {
            this.intersected.material.emissive.setHex(this.intersected.userData.baseEmissiveHex);
            this.intersected = null;
            this.container.style.cursor = 'default';
            this.hoveredCountryId = null;
        } else {
            this.hoveredCountryId = null;
        }

        this._updateOverlayLayout();
        this.renderer.render(this.scene, this.camera);
    }

    _animateCameraIntro() {
        if (!this.cameraIntro.active) return;
        const elapsed = this._time - this.cameraIntro.startedAt;
        const progress = Math.min(elapsed / this.cameraIntro.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        this.camera.position.lerpVectors(this.cameraIntro.start, this.cameraIntro.end, eased);
        // flat map: camera target is fixed

        if (progress >= 1) {
            this.cameraIntro.active = false;
            this.camera.position.copy(this.cameraIntro.end);
        }
    }

    _animateSceneLights() {
        if (!this.pulseLight) return;
        this.pulseLight.intensity = 1 + Math.sin(this._time * 0.002) * 0.25;
    }

    _animateCountryMeshes() {
        for (const [countryId, meshes] of this.countryMeshes.entries()) {
            const anchor = this.countryAnchors.get(countryId);
            let latestOffset = 0;

            for (const mesh of meshes) {
                const { baseZ = 0, floatAmplitude = 0, floatPhase = 0, pulseStrength = 0 } = mesh.userData;
                latestOffset = Math.sin(this._time * 0.0012 + floatPhase) * floatAmplitude;
                mesh.position.z = baseZ + latestOffset;
                if (pulseStrength > 0) {
                    mesh.material.emissiveIntensity = mesh.userData.baseEmissiveIntensity + ((Math.sin(this._time * 0.002 + floatPhase) + 1) * 0.5 * pulseStrength);
                }
            }

            if (anchor?.anchorObject) {
                anchor.anchorObject.position.z = anchor.baseZ + latestOffset;
            }
        }
    }

    renderMap(gameState, playerCountry, competitors = []) {
        if (!mapCache || mapCache.length === 0) return;

        const meshKey = `${playerCountry}:${mapCache.length}`;
        if (this._lastMeshKey !== meshKey) {
            this._buildCountryMeshes(playerCountry, gameState);
            this._lastMeshKey = meshKey;
        }

        const overlayKey = `${playerCountry}:${competitors.map(comp => `${comp.id}:${comp.country}`).join('|')}`;
        if (this._lastOverlayKey !== overlayKey) {
            this._buildOverlay(gameState, playerCountry, competitors);
            this._lastOverlayKey = overlayKey;
        }

        this._updateOverlayState(gameState);
        this._updateCountryVisuals(gameState);
    }

    showMapEventPulse(countryId, type = 'info', options = {}) {
        if (!this.overlay?.pulses || !countryId) return false;

        const countryAnchor = this.countryAnchors.get(countryId);
        const mapCountry = mapCache?.find(m => ISO_TO_ID[m.id] === countryId);
        const centroid = countryAnchor?.anchorObject
            ? null
            : mapCountry?.centroid || options.centroid || null;

        if (!countryAnchor?.anchorObject && !centroid) return false;

        const pulse = document.createElement('div');
        pulse.className = `webgl-map-pulse webgl-map-pulse--${type}`;
        pulse.style.position = 'absolute';
        pulse.style.left = '0';
        pulse.style.top = '0';
        pulse.style.width = `${Number(options.baseSize ?? 18)}px`;
        pulse.style.height = `${Number(options.baseSize ?? 18)}px`;
        pulse.style.transform = 'translate(-9999px, -9999px)';
        pulse.style.pointerEvents = 'none';
        pulse.style.opacity = '0';
        pulse.style.setProperty('--pulse-color', resolvePulseColor(type));
        pulse.innerHTML = `
            <span class="webgl-map-pulse__ring webgl-map-pulse__ring--primary"></span>
            <span class="webgl-map-pulse__ring webgl-map-pulse__ring--secondary"></span>
        `;

        for (const ring of pulse.querySelectorAll('.webgl-map-pulse__ring')) {
            ring.style.position = 'absolute';
            ring.style.inset = '0';
            ring.style.borderRadius = '999px';
            ring.style.border = `1.5px solid var(--pulse-color)`;
            ring.style.boxShadow = `0 0 16px color-mix(in srgb, var(--pulse-color) 45%, transparent)`;
            ring.style.opacity = '0';
            ring.style.pointerEvents = 'none';
            ring.style.animation = `webglPulse ${Math.max(1000, Number(options.durationMs ?? 2200))}ms linear infinite`;
        }
        pulse.querySelector('.webgl-map-pulse__ring--secondary').style.animationDelay = `${Math.max(1000, Number(options.durationMs ?? 2200)) / 2}ms`;

        const record = {
            countryId,
            type,
            element: pulse,
            anchorObject: countryAnchor?.anchorObject || null,
            worldPosition: centroid ? this._mapToWorld(centroid, 0) : null,
            baseSize: Number(options.baseSize ?? 18),
            scale: Number(options.scale ?? 1),
            offsetX: Number(options.offsetX ?? 0),
            offsetY: Number(options.offsetY ?? 0),
            startedAt: performance.now(),
            expiresAt: performance.now() + Math.max(1000, Number(options.durationMs ?? 2200))
        };

        this.overlay.pulses.appendChild(pulse);
        this.mapPulses.add(record);
        this._updateOverlayLayout();
        return true;
    }

    _buildCountryMeshes(playerCountry, gameState) {
        this._clearCountryMeshes();
        this._clearAnchorObjects();
        this.countryAnchors.clear();

        if (!this.gridHelper) {
            this.gridHelper = new THREE.GridHelper(2000, 100, 0x00e5ff, 0x00e5ff);
            this.gridHelper.position.z = -2;
            this.gridHelper.rotation.x = Math.PI / 2;
            this.gridHelper.material.opacity = 0.05;
            this.gridHelper.material.transparent = true;
            this.scene.add(this.gridHelper);
        }

        const offsetX = -500;
        const offsetY = 250;

        for (const mapCountry of mapCache) {
            const gameId = ISO_TO_ID[mapCountry.id];
            const countryData = gameId ? COUNTRIES[gameId] : null;
            if (!mapCountry.rings?.length) continue;

            const isPlayer = gameId === playerCountry;
            const visual = countryData ? getCountryVisualPolicy(countryData, gameState, { isPlayer }) : null;
            const colorStr = visual?.color || (countryData ? getCountryColor(countryData, gameState) : '#1e2b40');
            const meshes = [];

            const thickness = visual?.webgl?.thickness ?? 2;

            for (const ring of mapCountry.rings) {
                const projectedRing = this._projectRing(ring, offsetX, offsetY);
                if (!projectedRing) continue;

                const shape = new THREE.Shape();
                for (let i = 0; i < projectedRing.length; i++) {
                    const [x, y] = projectedRing[i];
                    if (i === 0) shape.moveTo(x, y);
                    else shape.lineTo(x, y);
                }

                const geometry = new THREE.ExtrudeGeometry(shape, {
                    depth: thickness,
                    bevelEnabled: true,
                    bevelSegments: 1,
                    steps: 1,
                    bevelSize: 0.5,
                    bevelThickness: 0.5
                });

                const material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(colorStr),
                    roughness: 0.4, // Lower for more "globe" sheen
                    metalness: 0.35, // More metallic/plastic premium feel
                    flatShading: false, // Smooth shading for globe-like feel
                    emissive: new THREE.Color(colorStr),
                    emissiveIntensity: visual?.webgl?.baseEmissiveIntensity ?? (isPlayer ? 0.32 : (countryData?.tier <= 2 ? 0.08 : 0.01))
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.userData = {
                    isCountry: true,
                    gameId,
                    baseZ: 0,
                    floatAmplitude: visual?.webgl?.floatAmplitude ?? (isPlayer ? 1.2 : (countryData?.tier <= 2 ? 0.45 : 0.18)),
                    floatPhase: (meshes.length + 1) * 0.8 + (countryData?.tier || 0),
                    pulseStrength: visual?.webgl?.pulseStrength ?? (isPlayer ? 0.22 : (countryData?.tier === 1 ? 0.08 : 0)),
                    baseEmissiveHex: material.emissive.getHex(),
                    baseEmissiveIntensity: material.emissiveIntensity
                };
                this.scene.add(mesh);
                meshes.push(mesh);
            }

            if (gameId && meshes.length > 0) {
                this.countryMeshes.set(gameId, meshes);
            }

            if (gameId && mapCountry.centroid && countryData) {
                const anchorObject = new THREE.Object3D();
                anchorObject.position.copy(this._mapToWorld(mapCountry.centroid, thickness));
                this.scene.add(anchorObject);
                this.countryAnchors.set(gameId, {
                    countryId: gameId,
                    countryData,
                    color: colorStr,
                    isPlayer,
                    tier: countryData.tier,
                    anchorObject,
                    baseZ: thickness,
                    labelOffsetY: visual?.webgl?.labelOffsetY ?? (isPlayer ? 28 : (countryData.tier === 1 ? 18 : 14)),
                    showOverlayLabel: visual?.webgl?.showOverlayLabel ?? (countryData.tier <= 2),
                    showFavBar: visual?.webgl?.showFavBar ?? (countryData.tier === 1)
                });
            }
        }
    }

    _updateCountryVisuals(gameState) {
        const tension = Number(gameState?.global?.geopoliticalTension || 0);

        for (const anchor of this.countryAnchors.values()) {
            const visual = getCountryVisualPolicy(anchor.countryData, gameState, { isPlayer: anchor.isPlayer });
            const color = visual.color;
            anchor.color = color;
            anchor.labelOffsetY = visual.webgl.labelOffsetY;
            anchor.showOverlayLabel = visual.webgl.showOverlayLabel;
            anchor.showFavBar = visual.webgl.showFavBar;

            if (anchor.element) {
                anchor.element.style.setProperty('--country-color', color);
                anchor.element.classList.toggle('is-tense', tension >= 60);
            }

            if (anchor.barFill) {
                anchor.barFill.style.background = `linear-gradient(90deg, color-mix(in srgb, ${color} 80%, #fff 20%), ${color})`;
            }

            const meshes = this.countryMeshes.get(anchor.countryId) || [];
            for (const mesh of meshes) {
                mesh.material.color.set(color);
                mesh.material.emissive.set(color);
                mesh.material.emissiveIntensity = visual.webgl.emissiveIntensity;
                mesh.userData.baseEmissiveHex = mesh.material.emissive.getHex();
                mesh.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity;
            }
        }
    }

    _buildOverlay(gameState, playerCountry, competitors) {
        this.overlay.labels.innerHTML = '';
        this.overlay.lines.innerHTML = '';
        this.competitorAnchors = [];

        for (const anchor of this.countryAnchors.values()) {
            if (!anchor.showOverlayLabel) continue;

            const label = document.createElement('button');
            label.className = `webgl-country-label ${anchor.isPlayer ? 'is-player' : ''} tier-${anchor.tier}`;
            label.type = 'button';
            label.innerHTML = `
                ${anchor.isPlayer ? '<span class="webgl-country-label__pulse"></span><span class="webgl-country-label__pulse webgl-country-label__pulse--delayed"></span>' : ''}
                <span class="webgl-country-label__badge" style="--country-color:${anchor.color}">
                    <span class="webgl-country-label__name">${anchor.countryData.flag} ${this._localizedCountryName(anchor.countryData)}</span>
                    ${anchor.isPlayer ? `<span class="webgl-country-label__hq">${t('world.agi_hq', 'AGI HQ')}</span>` : ''}
                    <span class="webgl-country-label__detail">${t('country.tier', 'Tier')} ${anchor.countryData.tier} · ${t('country.gdp', 'GDP')} ${anchor.countryData.gdp >= 1000 ? `$${(anchor.countryData.gdp / 1000).toFixed(1)}T` : `$${anchor.countryData.gdp}B`}</span>
                </span>
                ${anchor.showFavBar ? `
                    <span class="webgl-country-label__bar">
                        <span class="webgl-country-label__bar-fill" style="--country-color:${anchor.color}"></span>
                    </span>
                ` : ''}
            `;
            label.style.setProperty('--country-color', anchor.color);
            label.addEventListener('click', () => window.game?.showCountryInfo(anchor.countryId));
            this.overlay.labels.appendChild(label);
            anchor.element = label;
            anchor.barFill = label.querySelector('.webgl-country-label__bar-fill');
        }

        competitors.forEach((comp, index) => {
            const countryAnchor = this.countryAnchors.get(comp.country);
            if (!countryAnchor) return;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'webgl-competitor-line');
            line.setAttribute('stroke', comp.color || '#f472b6');
            this.overlay.lines.appendChild(line);

            const marker = document.createElement('button');
            marker.type = 'button';
            marker.className = 'webgl-competitor-marker';
            marker.style.setProperty('--comp-color', comp.color || '#f472b6');
            marker.innerHTML = `
                <span class="webgl-competitor-marker__dot"></span>
                <span class="webgl-competitor-marker__label">${comp.name}</span>
            `;
            marker.addEventListener('click', () => window.game?.showCountryInfo(comp.country));
            this.overlay.labels.appendChild(marker);

            this.competitorAnchors.push({
                countryId: comp.country,
                offset: COMPETITOR_OFFSETS[index] || { dx: 0, dy: 54 + index * 10 },
                line,
                marker
            });
        });

        this._updateOverlayState(gameState);
    }

    _updateOverlayState(gameState) {
        for (const anchor of this.countryAnchors.values()) {
            if (!anchor.barFill) continue;
            const favorability = gameState.global.countryFavorability?.[anchor.countryId] ?? anchor.countryData.aiFavorability;
            anchor.barFill.style.width = `${Math.max(8, Math.min(100, favorability))}%`;
        }
    }

    _updateOverlayLayout() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const camZ = this.camera.position.z;
        const zoomLevel = camZ > 800 ? 'far' : camZ > 400 ? 'mid' : 'close';

        this.overlay.lines.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.overlay.lines.setAttribute('width', width);
        this.overlay.lines.setAttribute('height', height);

        for (const anchor of this.countryAnchors.values()) {
            if (!anchor.element) continue;
            const screenPos = this._projectToScreen(anchor.anchorObject, width, height);
            const showLabel = anchor.isPlayer || anchor.countryId === this.hoveredCountryId;
            if (!screenPos.visible || !showLabel) {
                anchor.element.style.opacity = '0';
                anchor.element.classList.remove('is-visible');
                continue;
            }
            anchor.element.style.opacity = '1';
            anchor.element.classList.add('is-visible');
            const camD = this.camera?.position?.length() || 1000;
            const oScale = Math.max(0.3, Math.min(1.5, 800 / camD));
            anchor.element.style.transform = `translate(${screenPos.x}px, ${screenPos.y - (anchor.labelOffsetY || 0) * oScale}px) translate(-50%, -100%)`;
            anchor.element.classList.toggle('is-mid', zoomLevel === 'mid');
            anchor.element.classList.toggle('is-close', zoomLevel === 'close');
        }

        // Scale offsets based on camera distance
        const camDist = this.camera?.position?.length() || 1000;
        const offsetScale = Math.max(0.3, Math.min(1.5, 800 / camDist));

        for (const compAnchor of this.competitorAnchors) {
            const countryAnchor = this.countryAnchors.get(compAnchor.countryId);
            if (!countryAnchor) continue;
            const screenPos = this._projectToScreen(countryAnchor.anchorObject, width, height);
            if (!screenPos.visible) {
                compAnchor.marker.style.opacity = '0';
                compAnchor.line.setAttribute('opacity', '0');
                continue;
            }

            const targetX = screenPos.x + compAnchor.offset.dx * offsetScale;
            const targetY = screenPos.y + compAnchor.offset.dy * offsetScale;
            compAnchor.marker.style.opacity = '1';
            compAnchor.marker.style.transform = `translate(${targetX}px, ${targetY}px) translate(-50%, -50%)`;
            compAnchor.line.setAttribute('opacity', '0.6');
            compAnchor.line.setAttribute('x1', screenPos.x);
            compAnchor.line.setAttribute('y1', screenPos.y);
            compAnchor.line.setAttribute('x2', targetX);
            compAnchor.line.setAttribute('y2', targetY);
        }

        const now = this._time || performance.now();
        for (const pulse of [...this.mapPulses]) {
            if (!pulse?.element) {
                this.mapPulses.delete(pulse);
                continue;
            }

            if (now >= pulse.expiresAt) {
                pulse.element.remove();
                this.mapPulses.delete(pulse);
                continue;
            }

            const source = pulse.anchorObject || pulse.worldPosition;
            if (!source) {
                pulse.element.style.opacity = '0';
                continue;
            }

            const screenPos = this._projectToScreen(source, width, height);
            if (!screenPos.visible) {
                pulse.element.style.opacity = '0';
                continue;
            }

            const camD = this.camera?.position?.length() || 1000;
            const oScale = Math.max(0.55, Math.min(1.6, 800 / camD));
            pulse.element.style.opacity = '1';
            pulse.element.style.transform = `translate(${screenPos.x + pulse.offsetX}px, ${screenPos.y + pulse.offsetY}px) translate(-50%, -50%) scale(${pulse.scale * oScale})`;
        }
    }

    _projectRing(ring, offsetX, offsetY) {
        if (!ring || ring.length < 3) return null;

        const projectedRing = [];
        let lonShift = 0;
        
        for (let i = 0; i < ring.length; i++) {
            const point = ring[i];
            if (!Array.isArray(point) || point.length < 2) return null;
            
            let [lon, lat] = point;
            
            // Handle Anti-Meridian wrapping
            if (i > 0) {
                const prevLon = ring[i - 1][0];
                const deltaLong = lon - prevLon;
                if (deltaLong > 180) lonShift -= 360;
                else if (deltaLong < -180) lonShift += 360;
            }
            
            const adjustedLon = lon + lonShift;
            const x = ((adjustedLon + 180) / 360 * 1000) + offsetX;
            const y = -(((90 - lat) / 180 * 500) - offsetY);
            
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

            const prev = projectedRing[projectedRing.length - 1];
            if (!prev || prev[0] !== x || prev[1] !== y) {
                projectedRing.push([x, y]);
            }
        }

        if (projectedRing.length < 3) return null;

        // Validation: If the ring still spans a ridiculous width (usually data corruption), skip it
        const minX = Math.min(...projectedRing.map(p => p[0]));
        const maxX = Math.max(...projectedRing.map(p => p[0]));
        if (maxX - minX > 800) return null;

        const ringArea = Math.abs(projectedRing.reduce((sum, [x1, y1], index) => {
            const [x2, y2] = projectedRing[(index + 1) % projectedRing.length];
            return sum + (x1 * y2 - x2 * y1);
        }, 0)) / 2;

        if (!Number.isFinite(ringArea) || ringArea < 0.5) return null;
        return projectedRing;
    }

    _mapToWorld(centroid, z = 8) {
        return new THREE.Vector3(centroid.x - 500, 250 - centroid.y, z);
    }

    _projectToScreen(worldSource, width, height) {
        const pos = worldSource?.isObject3D
            ? worldSource.getWorldPosition(this._projectionVec).project(this.camera)
            : this._projectionVec.copy(worldSource).project(this.camera);
        const visible = pos.z < 1 && pos.x >= -1.3 && pos.x <= 1.3 && pos.y >= -1.3 && pos.y <= 1.3;
        return {
            visible,
            x: ((pos.x + 1) / 2) * width,
            y: ((-pos.y + 1) / 2) * height
        };
    }

    _setupFlatMapControls() {
        const el = this.renderer.domElement;

        // Drag = pan camera X/Y
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Left click only for pan
            this._isDragging = true;
            this._lastDrag = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('mousemove', (e) => {
            if (!this._isDragging) return;
            const dx = e.clientX - this._lastDrag.x;
            const dy = e.clientY - this._lastDrag.y;
            this._lastDrag = { x: e.clientX, y: e.clientY };

            // Scale pan speed by camera distance
            const zoomFactor = this.camera.position.z / 800;
            this.camera.position.x -= dx * zoomFactor * 1.5;
            this.camera.position.y += dy * zoomFactor * 1.5;

            this.camera.position.x = Math.max(-600, Math.min(600, this.camera.position.x));
            this.camera.position.y = Math.max(-350, Math.min(200, this.camera.position.y));
        });
        window.addEventListener('mouseup', () => { this._isDragging = false; });

        // Scroll = zoom (move camera Z)
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1.08 : 0.92;
            const newZ = Math.max(180, Math.min(1400, this.camera.position.z * delta));
            this.camera.position.z = newZ;
        }, { passive: false });
    }

    _localizedCountryName(country) {
        if (!country) return '';
        if (getLocale() === 'en') {
            try {
                const dn = new Intl.DisplayNames(['en'], { type: 'region' });
                const code = country.id?.toUpperCase();
                if (code && /^[A-Z]{2}$/.test(code)) {
                    return dn.of(code) || country.name;
                }
            } catch {
                return country.name;
            }
        }
        return country.name;
    }

    _clearCountryMeshes() {
        for (const meshes of this.countryMeshes.values()) {
            for (const mesh of meshes) {
                mesh.geometry.dispose();
                mesh.material.dispose();
                this.scene.remove(mesh);
            }
        }
        this.countryMeshes.clear();
    }

    _clearAnchorObjects() {
        for (const anchor of this.countryAnchors.values()) {
            if (anchor.anchorObject) {
                this.scene.remove(anchor.anchorObject);
            }
        }
    }

    _clearMapPulses() {
        for (const pulse of this.mapPulses) {
            pulse?.element?.remove?.();
        }
        this.mapPulses.clear();
    }

    destroy() {
        window.removeEventListener('resize', this.onWindowResize);
        this.renderer?.domElement?.removeEventListener('mousemove', this.onMouseMove);
        this.renderer?.domElement?.removeEventListener('mouseleave', this.onMouseLeave);
        this.renderer?.domElement?.removeEventListener('click', this.onClick);

        this._clearCountryMeshes();
        this._clearAnchorObjects();
        this._clearMapPulses();
        this.countryAnchors.clear();
        this.competitorAnchors = [];

        if (this.overlay?.root && this.container?.contains(this.overlay.root)) {
            this.container.removeChild(this.overlay.root);
        }

        if (this.renderer) {
            if (this.container?.contains(this.renderer.domElement)) {
                this.container.removeChild(this.renderer.domElement);
            }
            this.renderer.dispose();
            this.renderer = null;
        }

        this.container?.classList.remove('world-map-bg--webgl');
    }
}
