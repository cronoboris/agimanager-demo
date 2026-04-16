const MOOD_PRESETS = {
    startup: {
        grammar: 'corporate',
        palette: { accent: '#00e5ff', accentDim: 'rgba(0,229,255,0.08)', bgPrimary: '#02040a' },
        glitchIntensity: 0.05
    },
    expansion: {
        grammar: 'corporate',
        palette: { accent: '#22d3ee', accentDim: 'rgba(34,211,238,0.12)', bgPrimary: '#040810' },
        glitchIntensity: 0.1
    },
    political: {
        grammar: 'government',
        palette: { accent: '#f59e0b', accentDim: 'rgba(245,158,11,0.1)', bgPrimary: '#060808' },
        glitchIntensity: 0.25
    },
    frontier: {
        grammar: 'crisis',
        palette: { accent: '#ef4444', accentDim: 'rgba(239,68,68,0.12)', bgPrimary: '#0a0204' },
        glitchIntensity: 0.55
    }
};

export function getMoodPreset(actId = 'startup') {
    return MOOD_PRESETS[actId] || MOOD_PRESETS.startup;
}

export function applyMoodToDocument(doc, actId = 'startup') {
    const preset = getMoodPreset(actId);
    if (!doc?.body) return preset;
    doc.body.dataset.mood = actId;
    doc.body.style.setProperty('--mood-accent', preset.palette.accent);
    doc.body.style.setProperty('--mood-accent-dim', preset.palette.accentDim);
    doc.body.style.setProperty('--mood-bg-primary', preset.palette.bgPrimary);
    return preset;
}
