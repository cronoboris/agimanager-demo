import { loadDataJson } from './jsonLoader.js';

const data = await loadDataJson('names.json');

export const TALENT_NAMES = data.TALENT_NAMES;
export const SPECIALTIES = data.SPECIALTIES;
export const PERSONALITY_TRAITS = data.PERSONALITY_TRAITS;

export function generateTalent(country = 'us', level = null) {
    const firsts = TALENT_NAMES.first[country] || TALENT_NAMES.first.us;
    const lasts = TALENT_NAMES.last[country] || TALENT_NAMES.last.us;
    const firstName = firsts[Math.floor(Math.random() * firsts.length)];
    const lastName = lasts[Math.floor(Math.random() * lasts.length)];

    const baseLevel = level || Math.floor(Math.random() * 7) + 2; // 2~8
    const specialtyPool = SPECIALTIES.filter(() => Math.random() > 0.5).slice(0, 2);
    const specialty = specialtyPool.length > 0 ? specialtyPool : [SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)]];
    const trait = PERSONALITY_TRAITS[Math.floor(Math.random() * PERSONALITY_TRAITS.length)];

    return {
        id: `talent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: country === 'kr' ? `${lastName}${firstName}` : `${firstName} ${lastName}`,
        country,
        ideology: Math.random() < 0.3 ? 'safety' : (Math.random() < 0.5 ? 'accel' : 'neutral'),
        specialty: specialty.map(s => s.id),
        stats: {
            research: Math.min(10, Math.max(1, baseLevel + Math.floor(Math.random() * 3) - 1)),
            creativity: Math.min(10, Math.max(1, baseLevel + Math.floor(Math.random() * 3) - 1)),
            collaboration: Math.min(10, Math.max(1, baseLevel + Math.floor(Math.random() * 3) - 1))
        },
        salary: baseLevel >= 7
            ? baseLevel * 4000 + 4000 + Math.floor(Math.random() * 4000)
            : baseLevel * 4000 + Math.floor(Math.random() * 2500),
        morale: 70 + Math.floor(Math.random() * 20),
        loyalty: 60 + Math.floor(Math.random() * 30),
        trait: trait.id,
        assignment: null,
        monthsWorked: 0,
        level: baseLevel,
        ideologyFrustration: 0
    };
}
