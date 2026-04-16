/**
 * DiceBear Avataaars CEO 아바타 — Electron IPC로 Node.js에서 오프라인 생성
 * 브라우저 fallback: HTTP API fetch
 */

export const AVATAR_PARTS = {
    top: {
        label: '머리',
        options: [
            { id: 'shortFlat' }, { id: 'shortWaved' }, { id: 'shortCurly' },
            { id: 'shortRound' }, { id: 'theCaesar' }, { id: 'sides' },
            { id: 'shavedSides' }, { id: 'frizzle' },
            { id: 'straight01' }, { id: 'straight02' }, { id: 'bob' },
            { id: 'bun' }, { id: 'curly' }, { id: 'curvy' },
            { id: 'dreads' }, { id: 'dreads01' }, { id: 'fro' },
            { id: 'longButNotTooLong' }, { id: 'shaggy' }, { id: 'bigHair' },
            { id: 'hat' }, { id: 'hijab' }, { id: 'turban' },
        ]
    },
    skinColor: {
        label: '피부',
        options: [
            { id: 'f8d25c' }, { id: 'edb98a' }, { id: 'd08b5b' },
            { id: 'ae5d29' }, { id: '614335' },
        ]
    },
    eyes: {
        label: '눈',
        options: [
            { id: 'default' }, { id: 'happy' }, { id: 'squint' },
            { id: 'surprised' }, { id: 'side' }, { id: 'wink' },
            { id: 'hearts' }, { id: 'closed' },
        ]
    },
    eyebrows: {
        label: '눈썹',
        options: [
            { id: 'defaultNatural' }, { id: 'flatNatural' },
            { id: 'raisedExcitedNatural' }, { id: 'angryNatural' },
            { id: 'upDownNatural' }, { id: 'unibrowNatural' },
        ]
    },
    mouth: {
        label: '표정',
        options: [
            { id: 'smile' }, { id: 'default' }, { id: 'serious' },
            { id: 'twinkle' }, { id: 'grimace' }, { id: 'eating' },
            { id: 'screamOpen' },
        ]
    },
    facialHair: {
        label: '수염',
        options: [
            { id: 'blank' }, { id: 'beardLight' }, { id: 'beardMedium' },
            { id: 'beardMajestic' }, { id: 'moustacheFancy' }, { id: 'moustacheMagnum' },
        ]
    },
    accessories: {
        label: '안경',
        options: [
            { id: 'blank' }, { id: 'prescription01' },
            { id: 'prescription02' }, { id: 'sunglasses' },
            { id: 'round' }, { id: 'wayfarers' },
        ]
    },
    hairColor: {
        label: '머리색',
        options: [
            { id: '2c1b18' }, { id: '4a312c' }, { id: '724133' },
            { id: 'a55728' }, { id: 'b58143' }, { id: 'd6b370' },
            { id: 'e8e1e1' }, { id: 'c93305' }, { id: '6b4423' },
        ]
    },
    clothing: {
        label: '의상',
        options: [
            { id: 'blazerAndShirt' }, { id: 'blazerAndSweater' },
            { id: 'collarAndSweater' }, { id: 'hoodie' },
            { id: 'shirtCrewNeck' }, { id: 'shirtVNeck' },
        ]
    },
};

const PART_KEYS = Object.keys(AVATAR_PARTS);

// ── 아바타 생성 (IPC → fallback HTTP) ──

const _cache = new Map();

async function generateDataUrl(config) {
    const key = JSON.stringify(config);
    if (_cache.has(key)) return _cache.get(key);

    // 1차: Electron IPC (오프라인, 즉시)
    if (window.electronAPI?.avatar?.generate) {
        try {
            const dataUrl = await window.electronAPI.avatar.generate(config);
            if (dataUrl) {
                _cache.set(key, dataUrl);
                return dataUrl;
            }
        } catch {}
    }

    // 2차: HTTP API fallback (브라우저 환경)
    try {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(config)) {
            if (v && v !== 'blank') params.set(k, v);
        }
        params.set('radius', '50');
        params.set('backgroundColor', '0a0e14');
        const res = await fetch(`https://api.dicebear.com/9.x/avataaars/svg?${params}`);
        const svg = await res.text();
        const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
        _cache.set(key, dataUrl);
        return dataUrl;
    } catch {}

    return null;
}

export function serializeAvatarConfig(config) {
    const result = {};
    for (const key of PART_KEYS) {
        result[key] = config[key] || AVATAR_PARTS[key].options[0].id;
    }
    return result;
}

export function generateAvatarUrl(config) {
    // 동기 fallback: 세이브에 저장할 URL (캐시에서 가져오거나 빈 문자열)
    const key = JSON.stringify(config);
    return _cache.get(key) || '';
}

function randomConfig() {
    const cfg = {};
    for (const [key, part] of Object.entries(AVATAR_PARTS)) {
        cfg[key] = part.options[Math.floor(Math.random() * part.options.length)].id;
    }
    return cfg;
}

// ── UI ──

export function renderAvatarCustomizer(container, initialConfig = {}, onChange = null) {
    const config = serializeAvatarConfig(initialConfig);
    const indices = {};
    for (const [key, part] of Object.entries(AVATAR_PARTS)) {
        indices[key] = Math.max(0, part.options.findIndex(o => o.id === config[key]));
    }

    let imgEl = null;

    async function updatePreview() {
        if (!imgEl) return;
        imgEl.style.opacity = '0.4';
        const dataUrl = await generateDataUrl(config);
        if (dataUrl && imgEl) {
            imgEl.src = dataUrl;
            imgEl.style.opacity = '1';
        }
    }

    function build() {
        container.innerHTML = `
            <div class="avc">
                <div class="avc-preview">
                    <img class="avc-img" alt="" src="">
                </div>
                <div class="avc-controls">
                    ${PART_KEYS.map(key => `
                        <div class="avc-row">
                            <span class="avc-cat">${AVATAR_PARTS[key].label}</span>
                            <button class="avc-arrow" data-key="${key}" data-dir="-1">◀</button>
                            <button class="avc-arrow" data-key="${key}" data-dir="1">▶</button>
                        </div>
                    `).join('')}
                    <button class="avc-random" id="avc-rnd">🎲 랜덤</button>
                </div>
            </div>
        `;

        imgEl = container.querySelector('.avc-img');
        updatePreview();

        // 이벤트 위임 — innerHTML 교체 없이 안정적
        container.addEventListener('click', (e) => {
            const arrow = e.target.closest('.avc-arrow');
            if (arrow) {
                const key = arrow.dataset.key;
                const dir = parseInt(arrow.dataset.dir);
                const opts = AVATAR_PARTS[key].options;
                indices[key] = (indices[key] + dir + opts.length) % opts.length;
                config[key] = opts[indices[key]].id;
                updatePreview();
                if (onChange) onChange({ ...config });
                return;
            }

            if (e.target.closest('#avc-rnd')) {
                Object.assign(config, randomConfig());
                for (const [key, part] of Object.entries(AVATAR_PARTS)) {
                    indices[key] = Math.max(0, part.options.findIndex(o => o.id === config[key]));
                }
                updatePreview();
                if (onChange) onChange({ ...config });
            }
        });
    }

    build();
    return config;
}

export const AVATAR_CSS = `
.avc{display:flex;gap:20px;align-items:center}
.avc-preview{flex-shrink:0}
.avc-img{width:100px;height:100px;border-radius:50%;border:2px solid var(--accent,#00e5ff);background:#1a2332;transition:opacity .2s}
.avc-controls{display:flex;flex-direction:column;gap:4px}
.avc-row{display:flex;align-items:center;gap:6px}
.avc-cat{min-width:45px;font-size:.72rem;font-weight:600;color:var(--text-secondary,#94a3b8)}
.avc-arrow{width:26px;height:26px;border-radius:5px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-elevated,rgba(15,20,28,.85));color:var(--accent,#00e5ff);cursor:pointer;font-size:.65rem;display:flex;align-items:center;justify-content:center;transition:all .12s}
.avc-arrow:hover{background:rgba(0,229,255,.15);border-color:var(--accent,#00e5ff)}
.avc-random{margin-top:6px;padding:5px 14px;border-radius:5px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.08);color:var(--accent,#00e5ff);cursor:pointer;font-size:.72rem;font-weight:600;transition:all .12s;align-self:flex-start}
.avc-random:hover{background:rgba(0,229,255,.2)}
`;
