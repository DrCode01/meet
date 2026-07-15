/*
 * store.js — private, on-device data layer.
 *
 * All of your data lives in this browser (localStorage). Nothing is sent
 * anywhere unless you explicitly enable the optional AI coach. The store also
 * acts as a tiny event bus so the UI re-renders whenever data changes — this
 * is what drives the automatic coaching "loop".
 */
(function () {
  'use strict';

  var KEY = 'gymcoach.state.v1';
  var SCHEMA_VERSION = 1;

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function uid() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      onboarded: false,
      profile: {
        name: '',
        sex: 'male',           // 'male' | 'female'
        birthYear: null,
        heightCm: null,
        createdAt: todayISO()
      },
      goals: {
        type: 'recomp',        // fatloss | muscle | recomp | strength | maintain
        experience: 'beginner',// beginner | intermediate | advanced
        trainingDaysPerWeek: 3,
        equipment: 'full_gym', // full_gym | barbell_home | home_dumbbells | bodyweight
        targetWeightKg: null,
        weeklyRatePct: null    // % bodyweight/week; null => engine picks a safe default
      },
      settings: {
        units: 'metric',       // 'metric' | 'imperial'
        theme: 'auto',
        activityLevel: 'moderate', // fallback if no step data: sedentary|light|moderate|active|athlete
        ai: { enabled: false, apiKey: '', model: 'claude-opus-4-8' }
      },
      program: null,           // current mesocycle (see training engine)
      logs: {
        body: [],      // {id,date,weightKg,bodyFatPct,waistCm,notes}
        nutrition: [], // {id,date,kcal,protein,carbs,fat,fiber,water}
        workouts: [],  // {id,date,dayName,exercises:[{exerciseId,sets:[{weightKg,reps,rpe}]}],notes}
        activity: []   // {id,date,steps,sleepHours,restingHr,energy,soreness,stress}
      },
      coach: {
        lastReview: null,
        mesocycleStart: null,
        weekIndex: 0
      }
    };
  }

  var state = null;
  var listeners = [];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        state = migrate(JSON.parse(raw));
      } else {
        state = defaultState();
      }
    } catch (e) {
      console.warn('Failed to load state, starting fresh:', e);
      state = defaultState();
    }
    return state;
  }

  function migrate(s) {
    // Merge onto defaults so new fields are always present after updates.
    var base = defaultState();
    var merged = deepMerge(base, s || {});
    merged.version = SCHEMA_VERSION;
    return merged;
  }

  function deepMerge(target, src) {
    var out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
    if (Array.isArray(src)) return src.slice();
    if (typeof src !== 'object' || src === null) return src;
    Object.keys(src).forEach(function (k) {
      var sv = src[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) &&
          out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = deepMerge(out[k], sv);
      } else {
        out[k] = sv;
      }
    });
    return out;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
    emit();
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  // ---- accessors --------------------------------------------------------
  function get() { return state; }

  function update(mutator) {
    mutator(state);
    save();
  }

  function addLog(kind, entry) {
    if (!state.logs[kind]) state.logs[kind] = [];
    entry = Object.assign({ id: uid(), date: entry.date || todayISO() }, entry);
    // If an entry already exists for this date on single-per-day logs, replace it.
    if (kind === 'body' || kind === 'nutrition' || kind === 'activity') {
      var idx = state.logs[kind].findIndex(function (e) { return e.date === entry.date; });
      if (idx >= 0) {
        entry.id = state.logs[kind][idx].id;
        state.logs[kind][idx] = Object.assign({}, state.logs[kind][idx], entry);
      } else {
        state.logs[kind].push(entry);
      }
    } else {
      state.logs[kind].push(entry);
    }
    state.logs[kind].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    save();
    return entry;
  }

  function removeLog(kind, id) {
    state.logs[kind] = (state.logs[kind] || []).filter(function (e) { return e.id !== id; });
    save();
  }

  function latest(kind) {
    var arr = state.logs[kind] || [];
    return arr.length ? arr[arr.length - 1] : null;
  }

  function byDate(kind, date) {
    return (state.logs[kind] || []).find(function (e) { return e.date === date; }) || null;
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    state = migrate(parsed);
    save();
  }

  function reset() {
    state = defaultState();
    save();
  }

  window.Store = {
    KEY: KEY,
    load: load,
    save: save,
    get: get,
    update: update,
    subscribe: subscribe,
    addLog: addLog,
    removeLog: removeLog,
    latest: latest,
    byDate: byDate,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    todayISO: todayISO,
    uid: uid
  };
})();
