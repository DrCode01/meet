/*
 * nutrition.js — energy & macronutrient science (the building blocks).
 *
 * This module holds the pure, formula-based math:
 *  - BMR: Mifflin-St Jeor (1990); Katch-McArdle when body-fat % is known
 *    (scales with fat-free mass, better for lean/muscular people).
 *  - Formula TDEE: BMR × an activity multiplier (used until there is enough
 *    logged data for the adaptive expenditure engine to take over).
 *  - Macro split: protein 1.6–2.2 g/kg (Morton et al. 2018), a fat floor to
 *    protect hormones, carbs filling the remainder — shifted by your chosen
 *    diet approach (balanced / low-carb / high-carb / keto).
 *
 * The adaptive, data-driven side (real expenditure from your weight trend,
 * locked weekly targets, and check-ins) lives in expenditure.js.
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

  // Population-formula maintenance estimate.
  function formulaTDEE(state, weightKg, bf) {
    var mult = ACTIVITY_MULT[state.settings.activityLevel] || 1.55;
    return bmr(state.profile, weightKg, bf) * mult;
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

  // Turn a calorie target into protein/carb/fat/fiber/water, honouring the goal
  // and the chosen diet approach. weightKg/bf are the current trend values.
  function macroSplit(state, kcal, weightKg, bf) {
    var goals = state.goals;
    var lbm = bf ? weightKg * (1 - bf / 100) : null;
    var approach = goals.dietApproach || 'balanced';

    // Protein (g/kg of bodyweight; higher in a deficit). If LBM known, base it
    // on LBM + a small bump so protein stays adequate at any body-fat level.
    var proteinPerKg = goals.type === 'fatloss' ? 2.2 : (goals.type === 'muscle' ? 2.0 : 1.8);
    if (approach === 'keto') proteinPerKg = Math.min(proteinPerKg, 1.8); // moderate protein on keto
    var protein = Math.round(lbm ? lbm * (proteinPerKg + 0.2) : weightKg * proteinPerKg);

    var fat, carbs;
    if (approach === 'keto') {
      carbs = Math.min(40, Math.round(kcal * 0.05 / 4)); // ~cap carbs near 30–40 g
      var kcalLeftK = kcal - protein * 4 - carbs * 4;
      fat = Math.max(Math.round(weightKg * 0.5), Math.round(kcalLeftK / 9));
    } else if (approach === 'lowcarb') {
      fat = Math.round(weightKg * 1.1);                 // more fat
      carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    } else if (approach === 'highcarb') {
      fat = Math.round(Math.max(weightKg * 0.6, weightKg * 0.5)); // fat near floor
      carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    } else { // balanced
      fat = Math.round(Math.max(weightKg * 0.8, weightKg * 0.5));
      carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    }

    var fiber = Math.round((kcal / 1000) * 14); // 14 g / 1000 kcal
    var waterMl = Math.round(weightKg * 35);    // ~35 ml/kg baseline

    return {
      protein: protein, carbs: carbs, fat: fat,
      fiber: fiber, waterMl: waterMl, proteinPerKg: proteinPerKg
    };
  }

  window.Nutrition = {
    ACTIVITY_MULT: ACTIVITY_MULT,
    KCAL_PER_KG: KCAL_PER_KG,
    bmr: bmr,
    age: age,
    formulaTDEE: formulaTDEE,
    defaultRatePct: defaultRatePct,
    macroSplit: macroSplit
  };
})();
