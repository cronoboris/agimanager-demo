import { icon } from './icons.js';
import { t } from '../i18n.js';
import {
    getPersistentEffectDurationText,
    getPersistentEffectLabel,
    localizeNarrativeText
} from '../game/PersistentEffectSystem.js';

const CHARACTER_FATE_SUMMARIES = {
    stayed: {
        ko: '핵심 인재들은 끝까지 회사를 지켰다.',
        en: 'Core talent stayed with the company.'
    },
    left: {
        ko: '핵심 인재들은 회사를 떠나 각자의 길을 택했다.',
        en: 'Core talent left the company and chose different paths.'
    },
    founded: {
        ko: '몇몇 인재는 자신의 회사를 세워 다음 장을 열었다.',
        en: 'Some talent founded new companies and opened the next chapter.'
    },
    recruited: {
        ko: '핵심 인재들은 경쟁사나 외부 조직으로 흩어졌다.',
        en: 'Core talent was recruited by rivals or outside organizations.'
    },
    retired: {
        ko: '많은 인재가 조용히 업계를 떠나 은퇴했다.',
        en: 'Many talent quietly left the industry and retired.'
    }
};

function _formatMoney(v) {
    return v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`;
}

function _getPersistentEffects(state) {
    if (Array.isArray(state?.persistentEffects) && state.persistentEffects.length > 0) {
        return state.persistentEffects;
    }
    if (Array.isArray(state?.activeEffects) && state.activeEffects.length > 0) {
        return state.activeEffects;
    }
    return [];
}

function _getTopTalents(state, count) {
    return [...(state.talents || [])]
        .sort((a, b) => (b.stats?.research || 0) - (a.stats?.research || 0))
        .slice(0, count);
}

function _determineTalentFate(talent, result) {
    const loyalty = talent.loyalty || 50;
    const morale = talent.morale || 50;

    if (result === 'bankrupt' || result === 'internal_coup' || result === 'acquisition') {
        if (loyalty > 70) return { id: 'founded', label: { ko: `${talent.name}은(는) 자신의 스타트업을 창업했다.`, en: `${talent.name} founded their own startup.` } };
        return { id: 'recruited', label: { ko: `${talent.name}은(는) 경쟁사에 합류했다.`, en: `${talent.name} joined a competitor.` } };
    }
    if (morale > 70 && loyalty > 60) {
        return { id: 'stayed', label: { ko: `${talent.name}은(는) 끝까지 회사에 남았다.`, en: `${talent.name} stayed with the company.` } };
    }
    if (morale < 30) {
        return { id: 'left', label: { ko: `${talent.name}은(는) 업계를 떠났다.`, en: `${talent.name} left the industry.` } };
    }
    return { id: 'retired', label: { ko: `${talent.name}은(는) 조용히 은퇴했다.`, en: `${talent.name} quietly retired.` } };
}

function _determineCompetitorFate(comp, result) {
    const level = comp.aiLevel || 0;
    const share = comp.marketShare || 0;

    if (result === 'competitor_agi' && level >= 95) {
        return { id: 'agi', label: { ko: `${comp.name}: AGI를 달성하고 세계를 지배했다.`, en: `${comp.name}: Achieved AGI and dominated.` } };
    }
    if (share > 30) {
        return { id: 'dominant', label: { ko: `${comp.name}: 시장의 주요 플레이어로 남았다.`, en: `${comp.name}: Remained a major player.` } };
    }
    if (level < 20) {
        return { id: 'dissolved', label: { ko: `${comp.name}: 경쟁에서 도태되어 사라졌다.`, en: `${comp.name}: Faded into irrelevance.` } };
    }
    return { id: 'survived', label: { ko: `${comp.name}: 틈새 시장에서 살아남았다.`, en: `${comp.name}: Survived in a niche.` } };
}

function _generateLegacySentence(state, result) {
    const companyName = state.player?.companyName || 'AI Corp';
    const LEGACIES = {
        singularity: { ko: `${companyName}은(는) 인류 역사상 가장 중요한 기술적 이정표를 세운 기업으로 기록되었다.`, en: `${companyName} was recorded as the company that set humanity's most important technological milestone.` },
        public_infra: { ko: `${companyName}의 AGI는 전기와 인터넷에 이어 세 번째 보편적 인프라가 되었다.`, en: `${companyName}'s AGI became the third universal infrastructure after electricity and the internet.` },
        military_hegemony: { ko: `${companyName}의 이름은 두려움의 동의어가 되었다. 평화의 대가로 자유를 지불한 셈이다.`, en: `${companyName} became synonymous with fear. Freedom was the price paid for peace.` },
        open_source_liberation: { ko: `${companyName}은(는) 스스로를 해체하고, 인류에게 AGI를 선물했다. 혼돈이 뒤따랐지만, 그것은 자유의 혼돈이었다.`, en: `${companyName} dissolved itself and gifted AGI to humanity. Chaos followed, but it was the chaos of freedom.` },
        ethical_failure: { ko: `${companyName}은(는) AGI에 도달하지 못했지만, 후대의 모든 AI 기업이 따르는 안전 원칙을 남겼다.`, en: `${companyName} never reached AGI, but left safety principles every future AI company follows.` },
        acquisition: { ko: `${companyName}의 로고는 사라졌지만, 그 기술은 인수한 기업의 심장부에서 여전히 작동하고 있다.`, en: `${companyName}'s logo vanished, but its technology still runs at the heart of the acquiring company.` },
        internal_coup: { ko: `${companyName}은(는) 내부 분열로 무너졌다. 창업자의 비전은 이사회의 타협 속에 묻혔다.`, en: `${companyName} collapsed from within. The founder's vision was buried in boardroom compromises.` },
        state_absorption: { ko: `${companyName}은(는) 국가의 일부가 되었다. 혁신은 계획 경제의 틀 안에 갇혔다.`, en: `${companyName} became part of the state. Innovation was caged within planned economy.` },
        bankrupt: { ko: `${companyName}은(는) 자금 부족으로 문을 닫았다. 하지만 그 실패에서 배운 교훈은 다음 세대에게 전해졌다.`, en: `${companyName} shut down due to lack of funding. But lessons from its failure were passed to the next generation.` },
        competitor_agi: { ko: `${companyName}은(는) 경쟁에서 뒤처졌지만, AI 산업의 초기 역사에 이름을 남겼다.`, en: `${companyName} fell behind but left its name in the early history of AI.` },
        ipo_success: { ko: `${companyName}은(는) 성공적인 상장으로 세계적 기업이 되었다. CEO의 초상화가 타임지 표지를 장식했다.`, en: `${companyName} went public and became a global enterprise. The CEO's portrait graced the cover of TIME.` },
        market_dominance: { ko: `${companyName}은(는) AI 시장을 독점하며 새로운 시대의 표준을 만들었다.`, en: `${companyName} monopolized the AI market, setting the standard for a new era.` },
        safety_leader: { ko: `${companyName}은(는) "안전한 AI"의 대명사가 되었다. 신뢰가 가장 강력한 경쟁력이었다.`, en: `${companyName} became synonymous with "safe AI." Trust was the strongest competitive edge.` },
        time_limit: { ko: `${companyName}은(는) 시대의 흐름 속에서 조용히 사라졌다. 하지만 그 여정은 의미 있었다.`, en: `${companyName} quietly faded with the times. But the journey was meaningful.` }
    };
    const legacy = LEGACIES[result] || LEGACIES.time_limit;
    return localizeNarrativeText(legacy, legacy.ko || legacy.en || '');
}

function _renderTimeline(state) {
    const keyEvents = (state.newsLog || [])
        .filter(entry => entry.type === 'event' || entry.type === 'danger' || entry.type === 'success')
        .slice(0, 20)
        .reverse();

    if (keyEvents.length === 0) return `<p style="margin:0;color:var(--text-secondary);font-size:0.78rem">${t('ending.no_events', '기록된 주요 사건이 없습니다.')}</p>`;

    let html = '<div style="display:flex;flex-direction:column;gap:6px">';
    for (const entry of keyEvents) {
        const dateStr = entry.date
            ? `${entry.date.year}.${String(entry.date.month).padStart(2, '0')}`
            : '???';
        html += `<div style="display:flex;gap:8px;font-size:0.74rem;line-height:1.5">`;
        html += `<span style="min-width:56px;color:var(--accent);font-family:var(--font-mono)">${dateStr}</span>`;
        html += `<span style="color:var(--text-primary)">${entry.message || ''}</span>`;
        html += `</div>`;
    }
    html += '</div>';
    return html;
}

function _renderEffectPills(state) {
    const effects = _getPersistentEffects(state).filter(effect => effect && effect.type);
    if (effects.length === 0) {
        return `<p style="margin:0;color:var(--text-secondary);font-size:0.78rem">${t('ending.no_lasting_effects', '남아 있는 지속 효과가 없습니다.')}</p>`;
    }

    return `
        <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${effects.map(effect => `
                <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,0.06);font-size:0.7rem;color:var(--text-primary)">
                    <span>${effect.icon || '🔄'}</span>
                    <span>${getPersistentEffectLabel(effect)}</span>
                    <span style="color:var(--text-tertiary)">· ${getPersistentEffectDurationText(effect)}</span>
                </span>
            `).join('')}
        </div>
    `;
}

export function renderEndingNarrative(game) {
    const s = game?.state || {};
    const result = s.gameResult;
    const victory = game?.victory;
    const def = victory?.getResultDef?.(result) || {};
    const legacyModifier = Number(victory?.getLegacyScoreModifier?.(result) ?? def.legacyScoreModifier ?? 1);
    const topTalents = _getTopTalents(s, 3);
    const fateTemplate = CHARACTER_FATE_SUMMARIES[def.characterFates?.template || 'stayed'] || CHARACTER_FATE_SUMMARIES.stayed;

    let html = `
        <div class="ending-narrative-stack" style="display:grid;gap:12px;margin-top:18px;text-align:left">
            <section style="padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.03)">
                <h3 style="margin:0 0 8px;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent)">${t('ending.world_impact', '세계에 남긴 영향')}</h3>
                <p style="margin:0;font-size:0.84rem;line-height:1.7;color:var(--text-primary)">${localizeNarrativeText(def.worldImpact, def.msg || '')}</p>
                <div style="margin-top:10px">${_renderEffectPills(s)}</div>
            </section>

            <section style="padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.03)">
                <h3 style="margin:0 0 8px;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent)">${t('ending.talent_fates', '주요 인재의 최후')}</h3>
                <p style="margin:0 0 10px;font-size:0.8rem;line-height:1.6;color:var(--text-primary)">${localizeNarrativeText(fateTemplate, fateTemplate.ko || fateTemplate.en || '')}</p>
    `;

    if (topTalents.length > 0) {
        html += `<div style="display:flex;flex-direction:column;gap:6px">`;
        for (const talent of topTalents) {
            const fate = _determineTalentFate(talent, result);
            html += `
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:0.75rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                    <span style="font-weight:700">${talent.name}</span>
                    <span style="color:var(--text-secondary)">${localizeNarrativeText(fate.label, '')}</span>
                </div>
            `;
        }
        html += `</div>`;
    } else {
        html += `<p style="margin:0;color:var(--text-secondary);font-size:0.78rem">${t('ending.no_talents', '마지막까지 함께한 인재가 없습니다.')}</p>`;
    }

    html += `
            </section>

            <section style="padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.03)">
                <h3 style="margin:0 0 8px;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent)">${t('ending.competitor_fates', '경쟁사 운명')}</h3>
    `;

    const competitors = Array.isArray(s.competitors) ? s.competitors : [];
    if (competitors.length > 0) {
        html += `<div style="display:flex;flex-direction:column;gap:6px">`;
        for (const comp of competitors) {
            const compFate = _determineCompetitorFate(comp, result);
            html += `
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:0.75rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                    <span style="font-weight:700">${comp.name}</span>
                    <span style="color:var(--text-secondary)">${localizeNarrativeText(compFate.label, '')}</span>
                </div>
            `;
        }
        html += `</div>`;
    } else {
        html += `<p style="margin:0;color:var(--text-secondary);font-size:0.78rem">${t('ending.no_competitors', '경쟁사가 남아 있지 않습니다.')}</p>`;
    }

    html += `
            </section>

            <section style="padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.03)">
                <h3 style="margin:0 0 8px;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent)">${t('ending.company_legacy', '회사의 유산')}</h3>
                <p style="margin:0;font-size:0.84rem;line-height:1.7;color:var(--text-primary)">${_generateLegacySentence(s, result)}</p>
                <div style="margin-top:8px;font-size:0.72rem;color:var(--text-secondary)">Legacy x${legacyModifier.toFixed(2)}</div>
            </section>

            <section style="padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.03)">
                <h3 style="margin:0 0 8px;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-secondary)">${t('ending.timeline', '연대기')}</h3>
                ${_renderTimeline(s)}
            </section>
        </div>
    `;

    return html;
}

export function showGameOver(game) {
    const popup = document.getElementById('popup');
    const def = game.victory.getResultDef(game.state.gameResult);
    const score = game.victory.calculateScore();
    const grade = game.victory.getGrade(score);
    const gradeColor = game.victory.getGradeColor(grade);
    const isLoss = game.victory.isLoss(game.state.gameResult);
    const legacyScore = Math.round(score * Number(def.legacyScoreModifier || 1));
    game._recordLegacyRun(legacyScore, grade);

    const s = game.state;
    const completedTechs = Object.values(s.technologies).filter(t => t.completed).length;
    const totalTechs = Object.keys(s.technologies).length;
    const bestModel = Math.max(...s.models.map(m => m.compositeScore || m.performance || 0), 0);

    popup.innerHTML = `
        <div class="popup-content game-over" style="max-width:520px">
            <div style="margin-bottom:12px;color:${def.color}">${icon(def.icon, 48)}</div>
            <h2>${def.title}</h2>
            <p style="color:${def.color};margin-bottom:20px">${def.msg}</p>
            <p style="color:var(--text-secondary);font-size:0.82rem;margin-top:-8px;margin-bottom:18px">${s.player.ceoAvatar || '👨‍💼'} ${t('gameover.ceo_company', '{ceo} · {company}', {
                ceo: s.player.ceoName || t('company.default_ceo_name', 'Alex Kim'),
                company: s.player.companyName || t('company.default_name', 'My AI Company')
            })}</p>

            ${renderEndingNarrative(game)}

            <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:22px 0 20px">
                <div style="text-align:center">
                    <div style="font-size:2.5rem;font-weight:800;font-family:var(--font-display);color:${gradeColor}">${grade}</div>
                    <div style="font-size:0.7rem;color:var(--text-tertiary)">${t('gameover.grade', '등급')}</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:2rem;font-weight:700;font-family:var(--font-mono);color:var(--text-primary)">${score}</div>
                    <div style="font-size:0.7rem;color:var(--text-tertiary)">/ 100${t('world.points', '점')}</div>
                </div>
            </div>

            <div class="gameover-stats">
                <div class="go-stat"><span class="go-stat-label">${t('gameover.best_model', '최고 모델')}</span><span class="go-stat-value">${Math.round(bestModel)}${t('world.points', '점')}</span></div>
                <div class="go-stat"><span class="go-stat-label">${t('company.market_share', '시장 점유율')}</span><span class="go-stat-value">${s.reputation.marketShare.toFixed(1)}%</span></div>
                <div class="go-stat"><span class="go-stat-label">${t('game.research', '기술 연구')}</span><span class="go-stat-value">${completedTechs} / ${totalTechs}</span></div>
                <div class="go-stat"><span class="go-stat-label">${t('company.valuation', '기업 가치')}</span><span class="go-stat-value">${_formatMoney(s.economy.valuation)}</span></div>
                <div class="go-stat"><span class="go-stat-label">${t('gameover.team_size', '팀 규모')}</span><span class="go-stat-value">${s.talents.length}${t('creation.stat.people', '명')}</span></div>
                <div class="go-stat"><span class="go-stat-label">${t('company.ownership', '지분율')}</span><span class="go-stat-value">${s.economy.ownershipPct.toFixed(1)}%</span></div>
            </div>

            <div class="popup-buttons" style="margin-top:20px">
                ${!isLoss ? `<button class="btn" onclick="game._continueAfterVictory()">${t('gameover.continue', '계속 플레이')}</button>` : ''}
                <button class="btn btn-primary" onclick="location.reload()">${t('menu.new_game', '새 게임')}</button>
            </div>
        </div>
    `;
    popup.classList.add('show');
    game.time.pause();
    game.sound.stopMusic();
    game.triggerSuccessImpact(isLoss ? 'normal' : 'major', {
        soundId: isLoss ? 'game_over' : 'victory',
        countryId: game.state.player.country,
        pulseType: isLoss ? 'warning' : 'success'
    });
    game.stats.recordGameOver(game.state, score, grade, isLoss);
    game.achievements.checkAll(game.state);
}
