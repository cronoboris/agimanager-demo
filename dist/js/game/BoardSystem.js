import { t } from '../i18n.js';

const BOARD_MEMBER_TYPES = {
    founder: { label: { ko: '창업자', en: 'Founder' }, votePower: 2 },
    investor: { label: { ko: '투자자', en: 'Investor' }, votePower: 1 },
    independent: { label: { ko: '독립이사', en: 'Independent Director' }, votePower: 1 }
};

const DEFAULT_CULTURE = {
    speed: 50,
    academic: 50,
    mission: 50,
    secrecy: 50,
    accountability: 50,
    discipline: 50,
    safety: 50
};

function _clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function _ensureBoard(state) {
    if (!state.board || typeof state.board !== 'object') {
        state.board = {
            members: [],
            nextMeetingMonth: 3,
            resolutions: [],
            seats: 1,
            confidence: 55,
            pressure: 0
        };
    }

    state.board.members = Array.isArray(state.board.members) ? state.board.members : [];
    state.board.resolutions = Array.isArray(state.board.resolutions) ? state.board.resolutions : [];
    state.board.seats = Math.max(1, Number(state.board.seats || 1));
    state.board.confidence = _clamp(state.board.confidence ?? 55);
    state.board.pressure = _clamp(state.board.pressure ?? 0);
    state.board.nextMeetingMonth = Number.isFinite(Number(state.board.nextMeetingMonth))
        ? Number(state.board.nextMeetingMonth)
        : 3;

    return state.board;
}

function _ensureCulture(state) {
    state.culture = {
        ...DEFAULT_CULTURE,
        ...(state.culture || {})
    };
    return state.culture;
}

function _getIdeologyId(talent = {}) {
    if (talent.ideologyProfile?.id) return talent.ideologyProfile.id;
    if (talent.ideology?.id) return talent.ideology.id;
    if (typeof talent.ideology === 'string') return talent.ideology;
    return 'pragmatic';
}

function _getIdeologyProfileFromState(state, ideologyId) {
    for (const talent of state.talents || []) {
        const profile = talent.ideologyProfile;
        if (profile?.id === ideologyId) return profile;
        if (talent.ideology?.id === ideologyId) return talent.ideology;
    }
    return null;
}

function _cultureWeightsFromIdeology(ideologyId) {
    switch (ideologyId) {
        case 'move_fast':
        case 'ambitious':
            return { speed: 2, mission: 1, accountability: -1 };
        case 'safety_first':
        case 'methodical':
            return { safety: 2, secrecy: 1, accountability: 1, speed: -1 };
        case 'open_source':
            return { academic: 1, mission: 1, secrecy: -1 };
        case 'profit_driven':
            return { mission: 1, accountability: 1, academic: -1 };
        case 'academic':
            return { academic: 2, mission: 1, speed: -1 };
        case 'pragmatic':
        default:
            return { accountability: 1, mission: 1 };
    }
}

export function initBoard(state) {
    const board = _ensureBoard(state);
    _ensureCulture(state);

    if (board.members.length === 0) {
        board.members.push({
            id: 'ceo',
            name: state.player?.ceoName || 'CEO',
            type: 'founder',
            stance: 'neutral',
            satisfaction: 80,
            priority: 'growth',
            votePower: BOARD_MEMBER_TYPES.founder.votePower
        });
    } else {
        const founder = board.members.find(member => member.type === 'founder');
        if (founder) {
            founder.name = state.player?.ceoName || founder.name || 'CEO';
        } else {
            board.members.unshift({
                id: 'ceo',
                name: state.player?.ceoName || 'CEO',
                type: 'founder',
                stance: 'neutral',
                satisfaction: 80,
                priority: 'growth',
                votePower: BOARD_MEMBER_TYPES.founder.votePower
            });
        }
    }

    return board;
}

export function addBoardMemberOnFunding(state, roundName, options = {}) {
    const board = _ensureBoard(state);
    const priorities = ['growth', 'profit', 'safety', 'ipo', 'market_share'];
    const stances = ['supportive', 'neutral', 'critical'];
    const member = {
        id: `board_${board.members.length}_${Date.now()}`,
        name: _generateInvestorName(),
        type: options.type || 'investor',
        stance: options.stance || stances[Math.floor(Math.random() * stances.length)],
        satisfaction: _clamp(60 + Math.floor(Math.random() * 30)),
        priority: options.priority || priorities[Math.floor(Math.random() * priorities.length)],
        joinedRound: roundName,
        votePower: BOARD_MEMBER_TYPES[options.type || 'investor']?.votePower || 1
    };

    board.members.push(member);
    if (options.boardSeat) {
        board.seats = Math.max(1, Number(board.seats || 1) + 1);
    }
    return member;
}

export function processMonthlyBoardCulture(state) {
    const board = _ensureBoard(state);
    const culture = _ensureCulture(state);

    const talents = Array.isArray(state.talents) ? state.talents : [];
    const ideologyCounts = new Map();
    for (const talent of talents) {
        const ideologyId = _getIdeologyId(talent);
        ideologyCounts.set(ideologyId, (ideologyCounts.get(ideologyId) || 0) + 1);
    }

    const totalTalents = Math.max(1, talents.length);
    const ratios = Object.fromEntries(Array.from(ideologyCounts.entries()).map(([id, count]) => [id, count / totalTalents]));

    const nextCulture = { ...culture };
    const speedDelta = ((ratios.move_fast || 0) + (ratios.ambitious || 0)) * 6 + 0.3;
    const academicDelta = ((ratios.academic || 0) + (ratios.methodical || 0)) * 6;
    const missionDelta = ((ratios.pragmatic || 0) + (ratios.profit_driven || 0)) * 4;
    const secrecyDelta = ((ratios.safety_first || 0) * 5) - ((ratios.open_source || 0) * 3);
    const accountabilityDelta = ((ratios.safety_first || 0) * 4) + ((ratios.pragmatic || 0) * 2) - ((ratios.move_fast || 0) * 1.5);
    const disciplineDelta = (academicDelta * 0.3) + (accountabilityDelta * 0.4);
    const safetyDelta = ((ratios.safety_first || 0) * 6) + ((ratios.methodical || 0) * 2);

    nextCulture.speed = _clamp(nextCulture.speed + speedDelta);
    nextCulture.academic = _clamp(nextCulture.academic + academicDelta);
    nextCulture.mission = _clamp(nextCulture.mission + missionDelta);
    nextCulture.secrecy = _clamp(nextCulture.secrecy + secrecyDelta);
    nextCulture.accountability = _clamp(nextCulture.accountability + accountabilityDelta);
    nextCulture.discipline = _clamp(nextCulture.discipline + disciplineDelta);
    nextCulture.safety = _clamp(nextCulture.safety + safetyDelta);

    state.culture = nextCulture;

    const externalMembers = board.members.filter(member => member.type !== 'founder');
    const relevantMembers = externalMembers.length > 0 ? externalMembers : board.members;
    const avgSatisfaction = relevantMembers.length > 0
        ? relevantMembers.reduce((sum, member) => sum + _clamp(member.satisfaction, 0, 100), 0) / relevantMembers.length
        : 80;
    board.confidence = _clamp(70 + ((nextCulture.accountability - 50) * 0.25) + ((avgSatisfaction - 50) * 0.4));
    board.pressure = _clamp(100 - board.confidence);

    return {
        board,
        culture: nextCulture,
        ideologyCounts: Object.fromEntries(ideologyCounts.entries())
    };
}

export function processQuarterlyBoard(state) {
    const board = _ensureBoard(state);
    if (board.members.length === 0) return null;

    const externalMembers = board.members.filter(member => member.type !== 'founder');
    const relevantMembers = externalMembers.length > 0 ? externalMembers : board.members;
    const avgSatisfaction = relevantMembers.length > 0
        ? relevantMembers.reduce((sum, member) => sum + _clamp(member.satisfaction, 0, 100), 0) / relevantMembers.length
        : 80;
    const dissatisfied = relevantMembers
        .filter(member => _clamp(member.satisfaction, 0, 100) < 30)
        .map(member => member.name);

    board.pressure = _clamp(100 - avgSatisfaction);
    board.confidence = _clamp(75 - board.pressure * 0.45);

    if (avgSatisfaction < 50) {
        return {
            type: 'board_pressure',
            title: t('board.pressure', '이사회 압박'),
            avgSatisfaction: Math.round(avgSatisfaction),
            dissatisfied
        };
    }

    return null;
}

function _generateInvestorName() {
    const firsts = ['David', 'Sarah', 'Michael', 'Jennifer', 'James', 'Emily', 'Wei', 'Yuki', 'Hans', 'Marie'];
    const lasts = ['Chen', 'Park', 'Miller', 'Kim', 'Smith', 'Wang', 'Tanaka', 'Schmidt', 'Johnson', 'Lee'];
    return `${firsts[Math.floor(Math.random() * firsts.length)]} ${lasts[Math.floor(Math.random() * lasts.length)]}`;
}

