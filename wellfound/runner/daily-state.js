/**
 * runner/daily-state.js
 * Tracks how many applications have been submitted today (persisted to disk).
 * Multiple runs in one day resume the count instead of restarting it.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

class DailyState {
  /**
   * @param {string} siteName  Used to name the state file: apply-state-<siteName>.json
   * @param {number} cap       Daily application cap
   */
  constructor(siteName, cap = 50) {
    this.siteName = siteName;
    this.cap      = cap;
    this.file     = path.join(__dirname, '..', '..', `apply-state-${siteName}.json`);
    this.todayKey = new Date().toDateString();
    this._load();
  }

  _load() {
    try {
      const raw  = fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, '');
      const data = JSON.parse(raw);
      this.state = data.date === this.todayKey ? data : { date: this.todayKey, count: 0 };
    } catch (_) {
      // File missing or corrupt — start a fresh count for today
      this.state = { date: this.todayKey, count: 0 };
    }
  }

  _save() {
    try { fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2)); } catch (e) {
      // Non-fatal but important: if this keeps failing, daily cap won't persist across runs
      console.warn(`[daily-state] ⚠ Could not persist count to ${this.file}: ${e.message.split('\n')[0]}`);
    }
  }

  /** Number of applications submitted today so far. */
  get count()  { return this.state.count; }

  /** How many more we can submit today before hitting the cap. */
  get target() { return Math.max(0, this.cap - this.state.count); }

  /** True if the daily cap is already reached. */
  get atCap()  { return this.state.count >= this.cap; }

  /** Increment the counter and persist to disk. Returns the new count. */
  bump() {
    this.state.count++;
    this._save();
    return this.state.count;
  }
}

module.exports = DailyState;
