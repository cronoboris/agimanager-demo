/**
 * Game Logger — 릴리즈 빌드용 로그 시스템
 *
 * 게임 이벤트, 에러, 상태 변화를 기록합니다.
 * 최근 500개 로그를 메모리에 보관, 디버그 모드에서 콘솔 출력.
 */

const MAX_LOGS = 500;

class GameLogger {
    constructor() {
        this._logs = [];
        this._debug = location.hostname === 'localhost' || location.protocol === 'tauri:';
    }

    _add(level, category, message, data) {
        const entry = {
            time: new Date().toISOString(),
            level,
            category,
            message,
            data: data || null
        };
        this._logs.push(entry);
        if (this._logs.length > MAX_LOGS) this._logs.shift();

        if (this._debug) {
            const prefix = `[${level.toUpperCase()}][${category}]`;
            if (level === 'error') console.error(prefix, message, data || '');
            else if (level === 'warn') console.warn(prefix, message, data || '');
            else console.log(prefix, message, data || '');
        }
    }

    info(category, message, data) { this._add('info', category, message, data); }
    warn(category, message, data) { this._add('warn', category, message, data); }
    error(category, message, data) { this._add('error', category, message, data); }

    /** Get recent logs for crash report / debug */
    getRecentLogs(count = 50) {
        return this._logs.slice(-count);
    }

    /** Export all logs as string */
    export() {
        return this._logs.map(l =>
            `${l.time} [${l.level}][${l.category}] ${l.message}${l.data ? ' | ' + JSON.stringify(l.data) : ''}`
        ).join('\n');
    }
}

export const logger = new GameLogger();
