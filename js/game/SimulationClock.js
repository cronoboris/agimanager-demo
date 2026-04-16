import { TimeSystem } from './TimeSystem.js';

export class SimulationClock {
    constructor(timeSystem = new TimeSystem()) {
        this.time = timeSystem;
        this._callbacks = {
            hour: [],
            sixHours: [],
            day: [],
            month: [],
            quarter: [],
            year: []
        };

        this._bindTimeSystem();
    }

    onHour(cb) {
        this._callbacks.hour.push(cb);
    }

    onSixHours(cb) {
        this._callbacks.sixHours.push(cb);
    }

    onDay(cb) {
        this._callbacks.day.push(cb);
    }

    onMonth(cb) {
        this._callbacks.month.push(cb);
    }

    onQuarter(cb) {
        this._callbacks.quarter.push(cb);
    }

    onYear(cb) {
        this._callbacks.year.push(cb);
    }

    advanceHours(hours = 1) {
        return this.time.advanceHours(hours);
    }

    tick(hours = 1) {
        return this.advanceHours(hours);
    }

    get currentDate() {
        return this.time.currentDate;
    }

    _bindTimeSystem() {
        this.time.onHour((date) => {
            this._emit('hour', date);
            if (date.hour % 6 === 0) {
                this._emit('sixHours', date);
            }
        });
        this.time.onDay((date) => this._emit('day', date));
        this.time.onMonth((date) => this._emit('month', date));
        this.time.onQuarter((date) => this._emit('quarter', date));
        this.time.onYear((date) => this._emit('year', date));
    }

    _emit(type, date) {
        for (const cb of this._callbacks[type]) {
            cb(date);
        }
    }
}
