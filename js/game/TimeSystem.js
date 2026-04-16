import { getLocale, t } from '../i18n.js';

/**
 * Paradox-style Real-Time with Pause Time System
 *
 * Speed Levels:
 *   0 = Paused (⏸)
 *   1 = Slow      — 1 day / 2.0s
 *   2 = Normal    — 1 day / 1.0s
 *   3 = Fast      — 1 day / 0.4s
 *   4 = Very Fast — 1 day / 0.15s
 *   5 = Max       — 1 day / 0.05s
 *
 * Keyboard: Space=toggle pause, 1-5=set speed, +=speed up, -=speed down
 */
export class TimeSystem {
    constructor() {
        // Calendar (game starts 2017-01-01, which was a Sunday)
        this.currentDate = { year: 2017, month: 1, day: 1, hour: 0 };
        this.dayOfWeek = 0; // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
        this.totalDaysElapsed = 0;

        // Speed
        this.speed = 0;
        this.lastSpeed = 2; // default resume speed (Normal)
        this.SPEED_TABLE = [
            Infinity,  // 0: paused
            2000,      // 1: slow
            1000,      // 2: normal
            400,       // 3: fast
            150,       // 4: very fast
            50         // 5: max
        ];
        this.SPEED_LABEL_KEYS = [
            'time.speed.paused',
            'time.speed.slow',
            'time.speed.normal',
            'time.speed.fast',
            'time.speed.very_fast',
            'time.speed.max'
        ];
        this.SPEED_LABELS = [
            '일시정지', '느리게', '보통', '빠르게', '매우 빠르게', '최고속'
        ];
        this.SPEED_ICONS = ['⏸', '▶', '▶▶', '▶▶▶', '▶▶▶▶', '⏩'];

        // Tick timer
        this._tickTimer = null;
        this._rafId = null;

        // Callbacks
        this._callbacks = {
            hour: [],
            day: [],
            week: [],
            month: [],
            quarter: [],
            year: [],
            speedChange: [],
            render: []     // called on requestAnimationFrame
        };

        this.autoPauseRequested = false;
        this._dirty = false; // marks if UI needs update

        // Start render loop (runs even while paused for responsive UI)
        this._startRenderLoop();
    }

    // ─── Callback Registration ───
    onHour(cb)        { this._callbacks.hour.push(cb); }
    onDay(cb)         { this._callbacks.day.push(cb); }
    onWeek(cb)        { this._callbacks.week.push(cb); }
    onMonth(cb)       { this._callbacks.month.push(cb); }
    onQuarter(cb)     { this._callbacks.quarter.push(cb); }
    onYear(cb)        { this._callbacks.year.push(cb); }
    onSpeedChange(cb) { this._callbacks.speedChange.push(cb); }
    onRender(cb)      { this._callbacks.render.push(cb); }

    // ─── Speed Control (Paradox-style) ───
    setSpeed(level) {
        level = Math.max(0, Math.min(5, level));
        if (level > 0) this.lastSpeed = level;
        const prev = this.speed;
        this.speed = level;
        this._restartTickTimer();
        if (prev !== level) {
            this._dirty = true;
            for (const cb of this._callbacks.speedChange) cb(level, prev);
        }
    }

    pause()       { this.setSpeed(0); }
    isPaused()    { return this.speed === 0; }

    togglePause() {
        if (this.speed === 0) {
            this.setSpeed(this.lastSpeed || 2);
        } else {
            this.pause();
        }
    }

    speedUp() {
        if (this.speed === 0) {
            this.setSpeed(this.lastSpeed || 2);
        } else if (this.speed < 5) {
            this.setSpeed(this.speed + 1);
        }
    }

    speedDown() {
        if (this.speed > 1) {
            this.setSpeed(this.speed - 1);
        } else if (this.speed === 1) {
            this.pause();
        }
    }

    requestAutoPause() {
        this.autoPauseRequested = true;
    }

    // ─── Tick Timer ───
    _restartTickTimer() {
        if (this._tickTimer) {
            clearInterval(this._tickTimer);
            this._tickTimer = null;
        }
        if (this.speed > 0) {
            const ms = this.SPEED_TABLE[this.speed];
            this._tickTimer = setInterval(() => this._tick(), ms);
        }
    }

    _tick() {
        if (this.autoPauseRequested) {
            this.autoPauseRequested = false;
            this.pause();
            return;
        }
        this.advanceHours(this._getHoursPerTick());
    }

    // ─── Render Loop (decoupled from game ticks) ───
    _startRenderLoop() {
        const loop = () => {
            this._rafId = requestAnimationFrame(loop);
            if (this._dirty) {
                this._dirty = false;
                for (const cb of this._callbacks.render) cb();
            }
        };
        this._rafId = requestAnimationFrame(loop);
    }

    markDirty() { this._dirty = true; }

    advanceHours(hours = 1) {
        const steps = Math.max(0, Math.floor(Number(hours) || 0));
        for (let i = 0; i < steps; i++) {
            this._advanceHour();
        }
        if (steps > 0) {
            this._dirty = true;
        }
        return this.currentDate;
    }

    _getHoursPerTick() {
        switch (this.speed) {
            case 1:
                return 1;
            case 2:
            case 3:
                return 6;
            case 4:
                return 12;
            case 5:
                return 24;
            default:
                return 0;
        }
    }

    // ─── Calendar Helpers ───
    _advanceHour() {
        const prevMonth = this.currentDate.month;
        const prevYear = this.currentDate.year;

        this.currentDate.hour = Number(this.currentDate.hour || 0) + 1;
        const rolledDay = this.currentDate.hour >= 24;
        if (rolledDay) {
            this.currentDate.hour = 0;
            this._advanceDay();
            this.totalDaysElapsed++;
            this.dayOfWeek = (this.dayOfWeek + 1) % 7;
        }

        for (const cb of this._callbacks.hour) cb(this.currentDate);

        if (!rolledDay) return;

        for (const cb of this._callbacks.day) cb(this.currentDate);

        // Week (Monday)
        if (this.dayOfWeek === 1) {
            for (const cb of this._callbacks.week) cb(this.currentDate);
        }

        // Month
        if (this.currentDate.month !== prevMonth) {
            for (const cb of this._callbacks.month) cb(this.currentDate);
        }

        // Quarter
        if (this.currentDate.month !== prevMonth && [1, 4, 7, 10].includes(this.currentDate.month)) {
            for (const cb of this._callbacks.quarter) cb(this.currentDate);
        }

        // Year
        if (this.currentDate.year !== prevYear) {
            for (const cb of this._callbacks.year) cb(this.currentDate);
        }
    }

    _advanceDay() {
        const dim = this._getDaysInMonth(this.currentDate.year, this.currentDate.month);
        this.currentDate.day++;
        if (this.currentDate.day > dim) {
            this.currentDate.day = 1;
            this.currentDate.month++;
            if (this.currentDate.month > 12) {
                this.currentDate.month = 1;
                this.currentDate.year++;
            }
        }
    }

    _getDaysInMonth(y, m) {
        return new Date(y, m, 0).getDate();
    }

    // ─── Date Formatting ───
    getDayOfWeekName() {
        const locale = getLocale();
        if (locale === 'en') {
            return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][this.dayOfWeek];
        }
        return ['일', '월', '화', '수', '목', '금', '토'][this.dayOfWeek];
    }

    getDateString() {
        const d = this.currentDate;
        if (getLocale() === 'en') {
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
            }).format(new Date(d.year, d.month - 1, d.day));
        }
        return `${d.year}년 ${d.month}월 ${d.day}일 (${this.getDayOfWeekName()})`;
    }

    getShortDate() {
        const d = this.currentDate;
        return `${d.year}.${String(d.month).padStart(2, '0')}.${String(d.day).padStart(2, '0')}`;
    }

    getSpeedLabel() {
        return t(this.SPEED_LABEL_KEYS[this.speed], this.SPEED_LABELS[this.speed] || '');
    }

    getSpeedIcon() {
        return this.SPEED_ICONS[this.speed] || '';
    }

    getElapsedMonths() {
        return (this.currentDate.year - 2017) * 12 + (this.currentDate.month - 1);
    }

    getElapsedDays() {
        return this.totalDaysElapsed;
    }

    // Current date as comparable integer (YYYYMMDD)
    getDateInt() {
        const d = this.currentDate;
        return d.year * 10000 + d.month * 100 + d.day;
    }

    // ─── Serialization ───
    toJSON() {
        return {
            currentDate: { ...this.currentDate },
            totalDaysElapsed: this.totalDaysElapsed,
            dayOfWeek: this.dayOfWeek,
            lastSpeed: this.lastSpeed
        };
    }

    fromJSON(data) {
        const sourceDate = data?.currentDate || data || {};
        this.currentDate = {
            year: sourceDate.year ?? 2017,
            month: sourceDate.month ?? 1,
            day: sourceDate.day ?? 1,
            hour: sourceDate.hour ?? 0
        };
        this.totalDaysElapsed = data?.totalDaysElapsed || 0;
        this.dayOfWeek = data?.dayOfWeek || 0;
        this.lastSpeed = data?.lastSpeed || 2;
    }

    destroy() {
        if (this._tickTimer) clearInterval(this._tickTimer);
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }
}
