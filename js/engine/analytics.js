/*
 * analytics.js — turns raw logs into trends the coach reasons about.
 *
 *  - Weight is noisy day to day (water, glycogen, food in gut). We report an
 *    exponentially-weighted moving average so the trend, not the noise, drives
 *    decisions.
 *  - Strength is tracked as estimated 1RM via the Epley formula
 *    (1RM = w * (1 + reps/30)), letting different rep ranges be compared.
 *  - Weekly hard sets per muscle are tallied (primary = 1, secondary = 0.5).
 */
(function () {
  'use strict';

  function iso(d) { return d.toISOString().slice(0, 10); }
  function daysAgoISO(n) { var d = new Date(); d.setDate(d.getDate() - n); return iso(d); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  // Exponentially weighted moving average of bodyweight.
  function weightTrend(state) {
    var body = (state.logs.body || []).filter(function (e) { return e.weightKg; });
    if (!body.length) return null;
    var alpha = 0.25; // smoothing (roughly a ~1 week trend)
    var ema = body[0].weightKg;
    var series = body.map(function (e) {
      ema = alpha * e.weightKg + (1 - alpha) * ema;
      return { date: e.date, raw: e.weightKg, ema: Math.round(ema * 10) / 10 };
    });
    var current = series[series.length - 1];

    // Rate of change over the last up-to-14 days of trend.
    var cutoff = daysAgoISO(14);
    var recent = series.filter(function (s) { return s.date >= cutoff; });
    var rateKgPerWeek = null;
    if (recent.length >= 2) {
      var first = recent[0], last = recent[recent.length - 1];
      var days = daysBetween(first.date, last.date);
      if (days >= 4) rateKgPerWeek = Math.round(((last.ema - first.ema) / days) * 7 * 100) / 100;
    }

    return {
      series: series,
      currentKg: current.ema,
      currentRaw: current.raw,
      rateKgPerWeek: rateKgPerWeek,
      count: body.length,
      spanDays: daysBetween(body[0].date, body[body.length - 1].date)
    };
  }

  function epley1RM(weight, reps) {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  }

  function bestSet(sets) {
    // set with the highest estimated 1RM
    var best = null;
    (sets || []).forEach(function (s) {
      var e = epley1RM(s.weightKg, s.reps);
      if (!best || e > best.e1rm) best = { weightKg: s.weightKg, reps: s.reps, rpe: s.rpe, e1rm: e };
    });
    return best;
  }

  // Estimated-1RM history per exercise.
  function strengthByExercise(state) {
    var out = {};
    (state.logs.workouts || []).forEach(function (w) {
      (w.exercises || []).forEach(function (item) {
        var b = bestSet(item.sets);
        if (!b) return;
        if (!out[item.exerciseId]) out[item.exerciseId] = [];
        out[item.exerciseId].push({ date: w.date, e1rm: Math.round(b.e1rm * 10) / 10, top: b });
      });
    });
    return out;
  }

  // Weekly hard sets per muscle over the trailing `days` window.
  function weeklyVolume(state, days) {
    days = days || 7;
    var cutoff = daysAgoISO(days);
    var tally = {};
    var DB = window.ExerciseDB;
    DB.MUSCLES.forEach(function (m) { tally[m] = 0; });

    (state.logs.workouts || []).forEach(function (w) {
      if (w.date < cutoff) return;
      (w.exercises || []).forEach(function (item) {
        var ex = DB.get(item.exerciseId);
        if (!ex) return;
        var hardSets = (item.sets || []).filter(function (s) {
          // "hard" = taken reasonably close to failure (RPE >= 6) or RPE unknown
          return s.reps > 0 && (s.rpe == null || s.rpe >= 6);
        }).length;
        ex.primary.forEach(function (m) { tally[m] += hardSets; });
        ex.secondary.forEach(function (m) { tally[m] += hardSets * 0.5; });
      });
    });
    Object.keys(tally).forEach(function (m) { tally[m] = Math.round(tally[m] * 10) / 10; });
    return tally;
  }

  // Adherence over trailing window: how consistently you log & hit targets.
  function adherence(state, targets, days) {
    days = days || 7;
    var cutoff = daysAgoISO(days);

    var nut = (state.logs.nutrition || []).filter(function (n) { return n.date >= cutoff && n.kcal > 0; });
    var proteinHits = targets ? nut.filter(function (n) { return n.protein >= targets.protein * 0.9; }).length : 0;
    var kcalOnTarget = targets ? nut.filter(function (n) { return Math.abs(n.kcal - targets.kcal) <= targets.kcal * 0.1; }).length : 0;

    var workouts = (state.logs.workouts || []).filter(function (w) { return w.date >= cutoff; }).length;
    var bodyLogs = (state.logs.body || []).filter(function (b) { return b.date >= cutoff; }).length;

    return {
      nutritionDays: nut.length,
      nutritionDaysPct: Math.round((nut.length / days) * 100),
      proteinHitPct: nut.length ? Math.round((proteinHits / nut.length) * 100) : 0,
      kcalOnTargetPct: nut.length ? Math.round((kcalOnTarget / nut.length) * 100) : 0,
      workouts: workouts,
      bodyLogs: bodyLogs
    };
  }

  // Simple recovery/fatigue score from subjective + objective markers (0-100,
  // higher = more fatigued). Drives deload suggestions.
  function fatigueScore(state) {
    var cutoff = daysAgoISO(10);
    var act = (state.logs.activity || []).filter(function (a) { return a.date >= cutoff; });
    if (!act.length) return { score: null, samples: 0 };

    function meanOf(key) {
      var vals = act.map(function (a) { return a[key]; }).filter(function (v) { return v != null; });
      return vals.length ? vals.reduce(function (s, x) { return s + x; }, 0) / vals.length : null;
    }
    var sleep = meanOf('sleepHours');
    var soreness = meanOf('soreness'); // 1 low .. 5 high
    var energy = meanOf('energy');     // 1 low .. 5 high
    var stress = meanOf('stress');     // 1 low .. 5 high

    var score = 0, parts = 0;
    if (sleep != null) { score += clamp((7.5 - sleep) / 3.5, 0, 1) * 100; parts++; }
    if (soreness != null) { score += ((soreness - 1) / 4) * 100; parts++; }
    if (energy != null) { score += ((5 - energy) / 4) * 100; parts++; }
    if (stress != null) { score += ((stress - 1) / 4) * 100; parts++; }
    if (!parts) return { score: null, samples: 0 };

    return {
      score: Math.round(score / parts),
      samples: act.length,
      sleep: sleep != null ? Math.round(sleep * 10) / 10 : null,
      soreness: soreness != null ? Math.round(soreness * 10) / 10 : null,
      energy: energy != null ? Math.round(energy * 10) / 10 : null,
      stress: stress != null ? Math.round(stress * 10) / 10 : null
    };
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // Body composition metrics.
  function bodyStats(state, trend) {
    var p = state.profile;
    var w = trend && trend.currentKg ? trend.currentKg : null;
    if (!w) {
      var b = state.logs.body || [];
      for (var i = b.length - 1; i >= 0; i--) if (b[i].weightKg) { w = b[i].weightKg; break; }
    }
    if (!w || !p.heightCm) return null;
    var hM = p.heightCm / 100;
    var bmi = w / (hM * hM);
    var bf = null;
    var bl = state.logs.body || [];
    for (var j = bl.length - 1; j >= 0; j--) if (bl[j].bodyFatPct) { bf = bl[j].bodyFatPct; break; }
    var lbm = bf ? w * (1 - bf / 100) : null;
    var ffmi = lbm ? (lbm / (hM * hM)) + 6.1 * (1.8 - hM) : null; // normalized FFMI
    return {
      weightKg: Math.round(w * 10) / 10,
      bmi: Math.round(bmi * 10) / 10,
      bodyFatPct: bf,
      lbmKg: lbm ? Math.round(lbm * 10) / 10 : null,
      ffmi: ffmi ? Math.round(ffmi * 10) / 10 : null
    };
  }

  window.Analytics = {
    weightTrend: weightTrend,
    epley1RM: epley1RM,
    bestSet: bestSet,
    strengthByExercise: strengthByExercise,
    weeklyVolume: weeklyVolume,
    adherence: adherence,
    fatigueScore: fatigueScore,
    bodyStats: bodyStats
  };
})();
