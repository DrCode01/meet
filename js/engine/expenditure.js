/*
 * expenditure.js — the adaptive engine (MacroFactor-style).
 *
 * The signature idea: your real energy expenditure (TDEE) is not a fixed
 * formula number — it is measured from what you actually eat and how your
 * weight trend actually moves:
 *
 *     expenditure ≈ average intake − (Δ trend-weight × 7700 kcal/kg) / days
 *
 * We compute this over a trailing window from your smoothed weight trend, so
 * it self-corrects as your metabolism adapts (a deficit lowers expenditure;
 * a surplus raises it). Until there is enough logged data we fall back to the
 * Mifflin/Katch formula, then switch to the data-driven value automatically.
 *
 * Targets are LOCKED into a weekly program so they don't fluctuate day to day.
 * Each week a check-in recalculates expenditure and proposes a new target that
 * keeps you on your goal rate — adherence-neutral: it never scolds missed or
 * over days, it just reads the trend and recalibrates.
 */
(function () {
  'use strict';

  var N = window.Nutrition;
  var KCAL_PER_KG = 7700;
  var WINDOW = 28;      // days of history for the current expenditure estimate
  var MIN_DAYS = 10;    // logged-intake days needed before going data-driven
  var MIN_SPAN = 10;    // days the window must span

  function iso(d) { return d.toISOString().slice(0, 10); }
  function today() { return window.Store.todayISO(); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function addDays(dateISO, n) { var d = new Date(dateISO + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function r0(x) { return Math.round(x); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }

  function latestWeight(state) {
    var b = state.logs.body || [];
    for (var i = b.length - 1; i >= 0; i--) if (b[i].weightKg) return b[i].weightKg;
    return null;
  }
  function latestBodyFat(state) {
    var b = state.logs.body || [];
    for (var i = b.length - 1; i >= 0; i--) if (b[i].bodyFatPct) return b[i].bodyFatPct;
    return null;
  }
  function currentWeight(state, trend) {
    if (trend && trend.currentKg) return trend.currentKg;
    return latestWeight(state) || 75;
  }

  // Interpolate the smoothed trend weight to any date.
  function trendInterpolator(trend) {
    if (!trend || !trend.series || !trend.series.length) return null;
    var s = trend.series;
    return function (dateISO) {
      if (dateISO <= s[0].date) return s[0].ema;
      if (dateISO >= s[s.length - 1].date) return s[s.length - 1].ema;
      for (var i = 1; i < s.length; i++) {
        if (dateISO <= s[i].date) {
          var span = daysBetween(s[i - 1].date, s[i].date) || 1;
          var frac = daysBetween(s[i - 1].date, dateISO) / span;
          return s[i - 1].ema + frac * (s[i].ema - s[i - 1].ema);
        }
      }
      return s[s.length - 1].ema;
    };
  }

  // Daily logged intake, keyed by date (kcal > 0 only).
  function intakeMap(state) {
    var m = {};
    (state.logs.nutrition || []).forEach(function (n) { if (n.kcal > 0) m[n.date] = n.kcal; });
    return m;
  }

  // Expenditure over a window ending at `endISO` using energy balance.
  function windowExpenditure(intake, interp, endISO, windowDays) {
    if (!interp) return null;
    var startISO = addDays(endISO, -(windowDays - 1));
    var kcals = [];
    var firstDay = null, lastDay = null;
    for (var d = startISO; d <= endISO; d = addDays(d, 1)) {
      if (intake[d] != null) {
        kcals.push(intake[d]);
        if (!firstDay) firstDay = d;
        lastDay = d;
      }
    }
    if (kcals.length < MIN_DAYS || !firstDay) return null;
    var span = daysBetween(firstDay, lastDay);
    if (span < MIN_SPAN) return null;
    var meanIntake = kcals.reduce(function (s, x) { return s + x; }, 0) / kcals.length;
    var wStart = interp(firstDay), wEnd = interp(lastDay);
    var kcalFromChange = ((wEnd - wStart) * KCAL_PER_KG) / span; // + if gaining
    return {
      tdee: meanIntake - kcalFromChange,
      meanIntake: r0(meanIntake),
      kgChange: r2(wEnd - wStart),
      span: span,
      samples: kcals.length,
      endISO: endISO
    };
  }

  // Full estimate: current value + method + a time series for charting.
  function estimate(state, trend) {
    var weight = currentWeight(state, trend);
    var bf = latestBodyFat(state);
    var formula = N.formulaTDEE(state, weight, bf);

    var interp = trendInterpolator(trend);
    var intake = intakeMap(state);
    var current = interp ? windowExpenditure(intake, interp, today(), WINDOW) : null;

    // Build a daily series once enough data exists (for the expenditure chart).
    var series = [];
    if (interp && trend && trend.series.length) {
      var start = trend.series[0].date;
      var firstComputable = addDays(start, MIN_SPAN);
      for (var d = firstComputable; d <= today(); d = addDays(d, 1)) {
        var w = windowExpenditure(intake, interp, d, WINDOW);
        if (w) series.push({ date: d, expenditure: r0(w.tdee), formula: r0(N.formulaTDEE(state, interp(d), bf)) });
      }
    }

    if (current) {
      var conf = current.samples >= 18 ? 'high' : (current.samples >= 13 ? 'medium' : 'low');
      return {
        value: r0(current.tdee), method: 'adaptive', confidence: conf,
        formula: r0(formula), detail: current, series: series
      };
    }
    return {
      value: r0(formula), method: 'formula', confidence: 'formula',
      formula: r0(formula), detail: null, series: series
    };
  }

  // Build a nutrition program (locked targets) from an expenditure value + goal.
  function buildProgram(state, trend, opts) {
    opts = opts || {};
    var goals = state.goals;
    var weight = currentWeight(state, trend);
    var bf = latestBodyFat(state);

    var est = opts.expenditure != null
      ? { value: opts.expenditure, method: opts.method || 'formula' }
      : estimate(state, trend);

    var ratePct = goals.weeklyRatePct != null ? goals.weeklyRatePct : N.defaultRatePct(goals);

    // Goal-weight guard: if we're within ~0.5 kg of target weight, hold (maintain).
    if (goals.targetWeightKg && trend && trend.currentKg) {
      var toGo = goals.targetWeightKg - trend.currentKg;
      if ((ratePct < 0 && toGo >= -0.5) || (ratePct > 0 && toGo <= 0.5)) ratePct = 0;
    }

    var kgPerWeek = (ratePct / 100) * weight;
    var dailyOffset = (kgPerWeek * KCAL_PER_KG) / 7;
    var kcal = est.value + dailyOffset;

    // Guard-rails: never program below a safe floor.
    var floor = Math.max(N.bmr(state.profile, weight, bf) * 1.05, weight * 22);
    if (goals.type === 'fatloss') floor = Math.max(N.bmr(state.profile, weight, bf) + 100, weight * 24);
    if (kcal < floor) kcal = floor;
    kcal = Math.round(kcal / 10) * 10;

    var macros = N.macroSplit(state, kcal, weight, bf);

    return {
      startDate: opts.startDate || today(),
      weekIndex: opts.weekIndex != null ? opts.weekIndex : 0,
      method: est.method,
      expenditure: r0(est.value),
      kcal: kcal,
      protein: macros.protein, carbs: macros.carbs, fat: macros.fat,
      fiber: macros.fiber, waterMl: macros.waterMl, proteinPerKg: macros.proteinPerKg,
      ratePct: ratePct, kgPerWeek: r2(kgPerWeek)
    };
  }

  // The targets the rest of the app consumes. Locked program values for the
  // day, plus the live expenditure estimate for display and insights.
  function currentTargets(state, trend) {
    var est = estimate(state, trend);
    var prog = state.nutritionProgram;
    if (!prog) prog = buildProgram(state, trend, {}); // fallback if not onboarded via wizard
    return {
      kcal: prog.kcal, protein: prog.protein, carbs: prog.carbs, fat: prog.fat,
      fiber: prog.fiber, waterMl: prog.waterMl, proteinPerKg: prog.proteinPerKg,
      ratePct: prog.ratePct, kgPerWeek: prog.kgPerWeek,
      tdee: { value: est.value, method: est.method, confidence: est.confidence, formula: est.formula },
      expenditure: est.value, expenditureMethod: est.method,
      series: est.series, confidence: est.confidence,
      locked: !!state.nutritionProgram, weekIndex: prog.weekIndex, startDate: prog.startDate
    };
  }

  // Anchor date for the current week (last check-in, else program start).
  function weekAnchor(state) {
    var prog = state.nutritionProgram;
    if (!prog) return null;
    return state.coach.lastCheckIn && state.coach.lastCheckIn > prog.startDate
      ? state.coach.lastCheckIn : prog.startDate;
  }

  function checkInStatus(state, trend) {
    var anchor = weekAnchor(state);
    if (!anchor) return { due: false, daysSince: 0, hasData: false, nextDate: null };
    var daysSince = daysBetween(anchor, today());
    // Enough fresh data since the anchor to recalibrate on?
    var newNut = (state.logs.nutrition || []).filter(function (n) { return n.date > anchor && n.kcal > 0; }).length;
    var newBody = (state.logs.body || []).filter(function (b) { return b.date > anchor && b.weightKg; }).length;
    var hasData = newNut >= 3 && newBody >= 1;
    return {
      due: daysSince >= 7 && hasData,
      daysSince: daysSince,
      hasData: hasData,
      newNutritionDays: newNut,
      newBodyLogs: newBody,
      nextDate: addDays(anchor, 7)
    };
  }

  // Propose the next weekly program (does not persist — the UI confirms it).
  function proposeCheckIn(state, trend) {
    var current = state.nutritionProgram;
    var est = estimate(state, trend);
    var proposed = buildProgram(state, trend, {
      startDate: today(),
      weekIndex: (current ? current.weekIndex : 0) + 1,
      expenditure: est.value, method: est.method
    });
    var deltaKcal = current ? proposed.kcal - current.kcal : 0;
    var rate = trend ? trend.rateKgPerWeek : null;
    return {
      current: current, proposed: proposed, expenditure: est,
      deltaKcal: deltaKcal, trendRate: rate,
      rationale: buildRationale(state, current, proposed, est, rate)
    };
  }

  function buildRationale(state, current, proposed, est, rate) {
    var parts = [];
    if (est.method === 'adaptive') {
      parts.push('Your real expenditure is now ~' + est.value + ' kcal, measured from a ' +
        est.detail.samples + '-day intake average against your weight trend.');
    } else {
      parts.push('Not enough logged days yet for a data-driven number, so this uses the formula estimate (~' + est.value + ' kcal). Keep logging to unlock adaptive targets.');
    }
    if (rate != null) {
      parts.push('Your trend weight moved ' + fmtRate(rate) + '/week over the last stretch.');
    }
    var goalRate = proposed.kgPerWeek;
    if (current) {
      if (proposed.kcal > current.kcal) parts.push('Calories go up ' + (proposed.kcal - current.kcal) + ' to keep you moving at your ' + fmtRate(goalRate) + '/week goal.');
      else if (proposed.kcal < current.kcal) parts.push('Calories come down ' + (current.kcal - proposed.kcal) + ' to keep you on your ' + fmtRate(goalRate) + '/week goal.');
      else parts.push('Your target is right where it should be — no change this week.');
    }
    return parts.join(' ');
  }

  function fmtRate(kg) { var s = kg > 0 ? '+' : ''; return s + (Math.round(kg * 100) / 100) + ' kg'; }

  window.Expenditure = {
    estimate: estimate,
    buildProgram: buildProgram,
    currentTargets: currentTargets,
    checkInStatus: checkInStatus,
    proposeCheckIn: proposeCheckIn
  };
})();
