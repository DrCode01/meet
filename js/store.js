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
        targetWeightKg: null,  // goal bodyweight
        targetDate: null,      // optional ISO deadline for the goal
        weeklyRatePct: null,   // % bodyweight/week; null => engine picks a safe default
        dietApproach: 'balanced' // balanced | lowcarb | highcarb | keto — shifts macro split
      },
      settings: {
        units: 'metric',       // 'metric' | 'imperial'
        theme: 'auto',
        activityLevel: 'moderate', // fallback if no step data: sedentary|light|moderate|active|athlete
        ai: { enabled: false, apiKey: '', model: 'claude-opus-4-8' }
      },
      program: null,           // current mesocycle (see training engine)
      // Locked nutrition targets — MacroFactor-style. Targets stay fixed between
      // weekly check-ins so they don't fluctuate day to day.
      nutritionProgram: null,  // {startDate,weekIndex,kcal,protein,carbs,fat,fiber,waterMl,expenditure,ratePct,kgPerWeek,method}
      checkins: [],            // weekly recalibration history {date,weekIndex,expenditure,oldKcal,newKcal,trendKg,rateKgPerWeek}
      customFoods: [],         // user-defined foods {id,name,brand,serving,unit,kcal,protein,carbs,fat,fiber}
      logs: {
        body: [],      // {id,date,weightKg,bodyFatPct,waistCm,notes}
        nutrition: [], // {id,date,kcal,protein,carbs,fat,fiber} — DERIVED daily totals (sum of food entries)
        food: [],      // {id,date,meal,name,brand,qty,unit,kcal,protein,carbs,fat,fiber,sourceId}
        workouts: [],  // {id,date,dayName,exercises:[{exerciseId,sets:[{weightKg,reps,rpe}]}],notes}
        activity: []   // {id,date,steps,sleepHours,restingHr,energy,soreness,stress}
      },
      coach: {
        lastReview: null,
        mesocycleStart: null,
        weekIndex: 0,
        lastCheckIn: null       // ISO date of the last accepted weekly check-in
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

  // ---- food diary -------------------------------------------------------
  // Individual food entries are the source of truth; logs.nutrition holds the
  // derived daily totals so the analytics/expenditure engines keep working.
  function addFood(entry) {
    entry = Object.assign({ id: uid(), date: entry.date || todayISO(), meal: 'snack' }, entry);
    if (!state.logs.food) state.logs.food = [];
    state.logs.food.push(entry);
    syncDayTotals(entry.date);
    save();
    return entry;
  }

  function removeFood(id) {
    var entry = (state.logs.food || []).find(function (e) { return e.id === id; });
    state.logs.food = (state.logs.food || []).filter(function (e) { return e.id !== id; });
    if (entry) syncDayTotals(entry.date);
    save();
  }

  function foodByDate(date) {
    return (state.logs.food || []).filter(function (e) { return e.date === date; });
  }

  // Recompute the daily nutrition summary for a date from its food entries.
  function syncDayTotals(date) {
    var items = foodByDate(date);
    var idx = state.logs.nutrition.findIndex(function (e) { return e.date === date; });
    if (!items.length) {
      // Keep any legacy/manual total that wasn't produced from food entries.
      if (idx >= 0 && state.logs.nutrition[idx].fromFood) state.logs.nutrition.splice(idx, 1);
      return;
    }
    var tot = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    items.forEach(function (i) {
      tot.kcal += i.kcal || 0; tot.protein += i.protein || 0;
      tot.carbs += i.carbs || 0; tot.fat += i.fat || 0; tot.fiber += i.fiber || 0;
    });
    var rec = {
      date: date, fromFood: true,
      kcal: Math.round(tot.kcal), protein: Math.round(tot.protein),
      carbs: Math.round(tot.carbs), fat: Math.round(tot.fat), fiber: Math.round(tot.fiber)
    };
    if (idx >= 0) { rec.id = state.logs.nutrition[idx].id; state.logs.nutrition[idx] = rec; }
    else { rec.id = uid(); state.logs.nutrition.push(rec); }
    state.logs.nutrition.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  // ---- custom foods -----------------------------------------------------
  function addCustomFood(food) {
    food = Object.assign({ id: uid() }, food);
    if (!state.customFoods) state.customFoods = [];
    state.customFoods.unshift(food);
    save();
    return food;
  }
  function removeCustomFood(id) {
    state.customFoods = (state.customFoods || []).filter(function (f) { return f.id !== id; });
    save();
  }

  // ---- nutrition program (locked weekly targets) ------------------------
  function setNutritionProgram(prog) {
    state.nutritionProgram = prog;
    save();
  }
  function addCheckin(c) {
    if (!state.checkins) state.checkins = [];
    state.checkins.push(Object.assign({ id: uid() }, c));
    state.coach.lastCheckIn = c.date || todayISO();
    save();
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
    addFood: addFood,
    removeFood: removeFood,
    foodByDate: foodByDate,
    addCustomFood: addCustomFood,
    removeCustomFood: removeCustomFood,
    setNutritionProgram: setNutritionProgram,
    addCheckin: addCheckin,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    todayISO: todayISO,
    uid: uid
  };
})();
