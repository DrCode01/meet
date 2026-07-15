/*
 * nutrition.js — energy & macronutrient science.
 *
 * References:
 *  - BMR: Mifflin-St Jeor (1990). Katch-McArdle when body-fat % is known
 *    (more accurate for lean/muscular individuals because it scales with
 *    fat-free mass).
 *  - Protein: 1.6–2.2 g/kg supports maximal muscle protein synthesis
 *    (Morton et al. 2018 meta-analysis); higher end during a deficit to
 *    protect lean mass.
 *  - Fat floor: ~0.5 g/kg to protect hormonal function.
 *  - Adaptive calories: energy balance is estimated from your real weight
 *    trend, not just a formula, and nudged toward your goal rate. This is the
 *    nutrition half of the coaching loop.
 */
(function () {
  'use strict';

  var ACTIVITY_MULT = {
    sedentary: 1.2,   // desk job, little exercise
    light: 1.375,     // light exercise 1-3 d/wk
    moderate: 1.55,   // 3-5 d/wk
    active: 1.725,    // 6-7 d/wk hard
    athlete: 1.9      // physical job + hard training
  };

  var KCAL_PER_KG = 7700; // approx energy in 1 kg of body mass change

  function age(profile) {
    if (!profile.birthYear) return 30;
    return new Date().getFullYear() - profile.birthYear;
  }

  // Mifflin-St Jeor BMR (kcal/day)
  function bmrMifflin(profile, weightKg) {
    var a = age(profile);
    var h = profile.heightCm || 175;
    var s = profile.sex === 'female' ? -161 : 5;
    return 10 * weightKg + 6.25 * h - 5 * a + s;
  }

  // Katch-McArdle BMR from lean body mass
  function bmrKatch(weightKg, bodyFatPct) {
    var lbm = weightKg * (1 - bodyFatPct / 100);
    return 370 + 21.6 * lbm;
  }

  function bmr(profile, weightKg, bodyFatPct) {
    if (bodyFatPct && bodyFatPct > 3 && bodyFatPct < 60) {
      return bmrKatch(weightKg, bodyFatPct);
    }
    return bmrMifflin(profile, weightKg);
  }

  // Estimate TDEE. If we have >= ~10 days of intake + weight data, derive it
  // empirically (the most accurate method); otherwise fall back to the formula.
  function estimateTDEE(state, trend) {
    var profile = state.profile;
    var weight = trend && trend.currentKg ? trend.currentKg : latestWeight(state) || 75;
    var bf = latestBodyFat(state);
    var formulaTDEE = bmr(profile, weight, bf) * (ACTIVITY_MULT[state.settings.activityLevel] || 1.55);

    var empirical = empiricalTDEE(state, trend);
    if (empirical) {
      return {
        value: Math.round(empirical.tdee),
        method: 'empirical',
        detail: empirical,
        formula: Math.round(formulaTDEE)
      };
    }
    return { value: Math.round(formulaTDEE), method: 'formula', formula: Math.round(formulaTDEE) };
  }

  // TDEE = avg intake - (weight change in kcal / days)
  function empiricalTDEE(state, trend) {
    var nut = state.logs.nutrition || [];
    var body = state.logs.body || [];
    if (nut.length < 7 || body.length < 2) return null;

    // Use the most recent up-to-21-day window that has intake logged.
    var days = 21;
    var cutoff = daysAgoISO(days);
    var window = nut.filter(function (n) { return n.date >= cutoff && n.kcal > 0; });
    if (window.length < 7) return null;

    var avgIntake = avg(window.map(function (n) { return n.kcal; }));

    // Weight change across the same window using trend endpoints if available.
    var wStart = weightNear(body, window[0].date);
    var wEnd = trend && trend.currentKg ? trend.currentKg : weightNear(body, window[window.length - 1].date);
    if (wStart == null || wEnd == null) return null;
    var spanDays = daysBetween(window[0].date, window[window.length - 1].date) || days;
    if (spanDays < 7) return null;

    var kgChange = wEnd - wStart;
    var kcalFromChange = (kgChange * KCAL_PER_KG) / spanDays; // + if gaining
    var tdee = avgIntake - kcalFromChange;

    // Sanity clamp against the formula so a noisy scale can't produce nonsense.
    return { tdee: tdee, avgIntake: Math.round(avgIntake), kgChange: round1(kgChange), spanDays: spanDays, samples: window.length };
  }

  // Pick a safe weekly rate (% bodyweight) for the goal if the user hasn't set one.
  function defaultRatePct(goals) {
    switch (goals.type) {
      case 'fatloss': return -0.7;       // ~0.5–1%/wk; 0.7 preserves muscle
      case 'muscle':  return goals.experience === 'beginner' ? 0.5 : 0.25;
      case 'recomp':  return 0;
      case 'strength':return 0.15;
      case 'maintain':return 0;
      default: return 0;
    }
  }

  function targets(state, trend) {
    var goals = state.goals;
    var weight = trend && trend.currentKg ? trend.currentKg : latestWeight(state) || 75;
    var bf = latestBodyFat(state);
    var lbm = bf ? weight * (1 - bf / 100) : null;

    var tdee = estimateTDEE(state, trend);
    var ratePct = goals.weeklyRatePct != null ? goals.weeklyRatePct : defaultRatePct(goals);

    // Convert %BW/week target into a daily calorie offset.
    var kgPerWeek = (ratePct / 100) * weight;
    var dailyOffset = (kgPerWeek * KCAL_PER_KG) / 7;

    // Guard-rails: never let a cut drop below BMR or below ~10 kcal/kg.
    var kcal = tdee.value + dailyOffset;
    var floor = Math.max(bmr(state.profile, weight, bf) * 1.05, weight * 22);
    if (goals.type === 'fatloss') {
      floor = Math.max(bmr(state.profile, weight, bf) + 100, weight * 24);
      if (kcal < floor) kcal = floor;
    }
    kcal = Math.round(kcal / 10) * 10;

    // Protein (g/kg of bodyweight; higher in a deficit).
    var proteinPerKg = goals.type === 'fatloss' ? 2.2 : (goals.type === 'muscle' ? 2.0 : 1.8);
    var proteinBase = lbm ? lbm * (proteinPerKg + 0.2) : weight * proteinPerKg;
    var protein = Math.round(proteinBase);

    // Fat: ~0.8 g/kg, floor 0.5.
    var fat = Math.round(Math.max(weight * 0.8, weight * 0.5));

    // Carbs: remaining calories (4/4/9 kcal per g P/C/F).
    var kcalFromPF = protein * 4 + fat * 9;
    var carbs = Math.max(0, Math.round((kcal - kcalFromPF) / 4));

    var fiber = Math.round((kcal / 1000) * 14); // 14 g / 1000 kcal
    var waterMl = Math.round(weight * 35);      // ~35 ml/kg baseline

    return {
      kcal: kcal,
      protein: protein,
      carbs: carbs,
      fat: fat,
      fiber: fiber,
      waterMl: waterMl,
      tdee: tdee,
      ratePct: ratePct,
      kgPerWeek: round2(kgPerWeek),
      proteinPerKg: proteinPerKg
    };
  }

  // ---- helpers ----------------------------------------------------------
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
  function weightNear(body, date) {
    // nearest logged weight on/after date, else nearest before
    var after = body.filter(function (e) { return e.weightKg && e.date >= date; });
    if (after.length) return after[0].weightKg;
    var before = body.filter(function (e) { return e.weightKg && e.date < date; });
    return before.length ? before[before.length - 1].weightKg : null;
  }
  function daysAgoISO(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  function avg(arr) { return arr.reduce(function (s, x) { return s + x; }, 0) / (arr.length || 1); }
  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(x * 100) / 100; }

  window.Nutrition = {
    ACTIVITY_MULT: ACTIVITY_MULT,
    KCAL_PER_KG: KCAL_PER_KG,
    bmr: bmr,
    age: age,
    estimateTDEE: estimateTDEE,
    empiricalTDEE: empiricalTDEE,
    defaultRatePct: defaultRatePct,
    targets: targets
  };
})();
