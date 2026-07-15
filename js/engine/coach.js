/*
 * coach.js — the loop.
 *
 * analyze(state) is the single entry point the whole app calls. It runs every
 * time you open the app or log anything, re-derives every metric from your
 * current data, and returns:
 *   - metrics: body, TDEE, targets, trend, volume, adherence, fatigue
 *   - insights: a prioritised, plain-language list of what to do next, each
 *     with the science behind it
 *   - todayPlan: today's workout + nutrition targets
 * This is what makes the app self-adjusting rather than a static tracker.
 */
(function () {
  'use strict';

  var T = window.Training, A = window.Analytics, DB = window.ExerciseDB, X = window.Expenditure;

  function analyze(state) {
    var trend = A.weightTrend(state);
    var body = A.bodyStats(state, trend);
    var targets = X.currentTargets(state, trend);
    var checkin = X.checkInStatus(state, trend);
    var weeklyVol = A.weeklyVolume(state, 7);
    var volGuidance = T.volumeGuidance(weeklyVol);
    var adherence = A.adherence(state, targets, 7);
    var fatigue = A.fatigueScore(state);
    var deload = T.deloadCheck(state, fatigue, weeklyVol, state.program);
    var strength = A.strengthByExercise(state);
    var plan = buildPlan(state, trend, body, targets);

    var insights = buildInsights(state, {
      trend: trend, body: body, targets: targets, weeklyVol: weeklyVol,
      volGuidance: volGuidance, adherence: adherence, fatigue: fatigue,
      deload: deload, strength: strength, checkin: checkin, plan: plan
    });

    var todayPlan = planToday(state, targets, deload);

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        trend: trend, body: body, targets: targets, weeklyVol: weeklyVol,
        volGuidance: volGuidance, adherence: adherence, fatigue: fatigue,
        deload: deload, strength: strength, checkin: checkin
      },
      plan: plan,
      insights: insights,
      todayPlan: todayPlan
    };
  }

  // A concrete, goal-specific plan: where you are, where you're going, and the
  // timeline the current targets imply.
  function buildPlan(state, trend, body, targets) {
    var g = state.goals;
    var curW = trend && trend.currentKg ? trend.currentKg : (body ? body.weightKg : null);
    var plan = {
      goalType: g.type,
      currentKg: curW,
      targetKg: g.targetWeightKg || null,
      ratePct: targets.ratePct,
      kgPerWeek: targets.kgPerWeek,
      kcal: targets.kcal,
      protein: targets.protein,
      expenditure: targets.expenditure,
      etaWeeks: null, etaDate: null, toGoKg: null
    };
    if (curW && g.targetWeightKg) {
      var toGo = g.targetWeightKg - curW;
      plan.toGoKg = Math.round(toGo * 10) / 10;
      var perWeek = targets.kgPerWeek;
      if (perWeek && ((toGo < 0 && perWeek < 0) || (toGo > 0 && perWeek > 0))) {
        var weeks = Math.abs(toGo / perWeek);
        plan.etaWeeks = Math.ceil(weeks);
        var d = new Date(); d.setDate(d.getDate() + Math.ceil(weeks * 7));
        plan.etaDate = d.toISOString().slice(0, 10);
      }
    }
    return plan;
  }

  // priority: 1 = act now, 2 = this week, 3 = FYI
  function ins(priority, kind, title, detail, science) {
    return { priority: priority, kind: kind, title: title, detail: detail, science: science };
  }

  function buildInsights(state, m) {
    var out = [];
    var goals = state.goals;

    // ---- Weekly check-in (the MacroFactor cadence) --------------------
    if (m.checkin && m.checkin.due) {
      out.push(ins(1, 'checkin', 'Weekly check-in is ready',
        'It\'s been ' + m.checkin.daysSince + ' days. I can recalculate your real expenditure from this week\'s data and update your targets to keep you on your goal rate. Open the check-in to review and apply.',
        'Recalibrating targets on a weekly cadence from the measured trend — rather than daily — keeps calories stable while still adapting to metabolic changes.'));
    }

    // ---- Weight trend vs goal rate ------------------------------------
    if (m.trend && m.trend.rateKgPerWeek != null && m.targets) {
      var actual = m.trend.rateKgPerWeek;
      var target = m.targets.kgPerWeek;
      var diff = actual - target;
      var tol = Math.max(0.15, Math.abs(target) * 0.5);
      if (goals.type === 'fatloss') {
        if (actual >= -0.05) {
          out.push(ins(1, 'nutrition', 'Fat loss has stalled',
            'Your trend weight is flat (' + fmtRate(actual) + '/wk) but you want ' + fmtRate(target) + '/wk. Drop intake ~150–200 kcal or add ~2k steps/day.',
            'When weight stalls in a deficit, measured energy balance has drifted to maintenance — a small further deficit restores the trend.'));
        } else if (actual < target - tol) {
          out.push(ins(2, 'nutrition', 'Losing faster than planned',
            'You are dropping ' + fmtRate(actual) + '/wk vs a ' + fmtRate(target) + '/wk target. Fast loss risks muscle — add ~150 kcal (mostly carbs) and keep protein high.',
            'Losses beyond ~1%/wk increase lean-mass loss; slowing the rate protects muscle and performance.'));
        }
      } else if (goals.type === 'muscle') {
        if (actual <= 0.02) {
          out.push(ins(1, 'nutrition', 'Not gaining — add fuel',
            'Trend weight is flat but you are bulking. Add ~150–200 kcal/day (carbs) to resume a lean gain of ' + fmtRate(target) + '/wk.',
            'Muscle gain requires a modest surplus; without upward trend weight there is no consistent energy surplus to build tissue.'));
        } else if (actual > Math.abs(target) * 2.2) {
          out.push(ins(2, 'nutrition', 'Gaining too fast',
            'You are gaining ' + fmtRate(actual) + '/wk — faster than a lean bulk needs. Trim ~150 kcal to limit fat gain.',
            'Above ~0.5%/wk (trained lifters), extra gain is disproportionately fat; a slower surplus improves the muscle:fat ratio.'));
        }
      }
    } else if (!m.trend || m.trend.count < 3) {
      out.push(ins(2, 'data', 'Log your weight a few times',
        'Weigh in 3–4×/week (same conditions). Once there is a trend, I adjust your calories automatically from real data instead of a formula.',
        'A weekly-averaged weight trend is the most reliable readout of energy balance and drives adaptive calorie targets.'));
    }

    // ---- Goal timeline ------------------------------------------------
    if (m.plan && m.plan.etaWeeks != null && m.plan.toGoKg != null && Math.abs(m.plan.toGoKg) > 0.3) {
      out.push(ins(3, 'goal', 'On pace for your goal',
        (m.plan.toGoKg > 0 ? '+' : '') + m.plan.toGoKg + ' kg to your target of ' + m.plan.targetKg + ' kg. At your current rate that\'s about ' + m.plan.etaWeeks + ' weeks (~' + shortDate(m.plan.etaDate) + ').',
        'A defined target and rate turns a vague goal into a schedule you can actually hold yourself to.'));
    }

    // ---- TDEE method note ---------------------------------------------
    if (m.targets && m.targets.tdee && m.targets.tdee.method === 'adaptive') {
      out.push(ins(3, 'nutrition', 'Calories are now data-driven',
        'Your maintenance is measured at ~' + m.targets.tdee.value + ' kcal from your real intake and weight change (not just the formula).',
        'Adaptive expenditure (intake minus weight-change energy) individualises targets far better than population equations, and tracks metabolic adaptation as it happens.'));
    }

    // ---- Deload -------------------------------------------------------
    if (m.deload && m.deload.recommend) {
      out.push(ins(1, 'recovery', 'Time to deload', m.deload.prescription + ' Why: ' + m.deload.reasons.join(' '),
        'Planned fatigue dissipation (deload) restores performance and lets the next block start fresh — a core tenet of periodization.'));
    } else if (m.fatigue && m.fatigue.score != null && m.fatigue.score >= 55) {
      out.push(ins(2, 'recovery', 'Recovery is dipping',
        'Fatigue markers are elevated (' + m.fatigue.score + '/100). Prioritise 7–9 h sleep and keep sets 2–3 reps from failure this week.',
        'Sleep and subjective readiness predict training performance; managing them prevents a forced deload later.'));
    }

    // ---- Volume landmarks --------------------------------------------
    var under = m.volGuidance.filter(function (g) { return g.status === 'under' && g.landmarks.mev > 0; });
    var over = m.volGuidance.filter(function (g) { return g.status === 'over'; });
    if (under.length && hasTrainedRecently(state)) {
      var names = under.slice(0, 3).map(function (g) { return g.label + ' (' + g.sets + '/' + g.landmarks.mev + ')'; });
      out.push(ins(2, 'training', 'Under-trained muscles',
        'Below the minimum effective volume: ' + names.join(', ') + '. Add 1–3 sets/week to each to drive growth.',
        'Muscles need roughly their MEV in weekly hard sets to grow; below it, the stimulus is maintenance at best.'));
    }
    if (over.length) {
      var onames = over.slice(0, 3).map(function (g) { return g.label; });
      out.push(ins(2, 'training', 'Possibly too much volume',
        onames.join(', ') + ' are above MRV. Trim 2–4 sets so recovery keeps up with the workload.',
        'Beyond the maximum recoverable volume, extra sets add fatigue without extra growth ("junk volume").'));
    }

    // ---- Progression wins --------------------------------------------
    var pr = recentPRs(state, m.strength);
    if (pr.length) {
      out.push(ins(3, 'training', 'Strength is trending up',
        'Recent estimated-1RM gains: ' + pr.slice(0, 3).map(function (p) { return p.name + ' +' + p.gain + ' kg'; }).join(', ') + '. Keep the progression going.',
        'Rising estimated 1RM confirms the overload stimulus is working — the clearest sign your program is effective.'));
    }

    // ---- Protein adherence -------------------------------------------
    if (m.adherence.nutritionDays >= 3 && m.adherence.proteinHitPct < 70 && m.targets) {
      out.push(ins(2, 'nutrition', 'Hit your protein more often',
        'You reached your protein target on only ' + m.adherence.proteinHitPct + '% of logged days. Aim for ~' + m.targets.protein + ' g/day.',
        'Total daily protein (~1.6–2.2 g/kg) is the strongest dietary lever for muscle retention and growth.'));
    }

    // ---- Logging nudges ----------------------------------------------
    if (m.adherence.nutritionDaysPct < 40) {
      out.push(ins(3, 'data', 'Log food to unlock adaptive calories',
        'Track intake on most days and I can fine-tune your calories to your real metabolism.',
        'Adaptive targets need intake data; even quick calorie+protein entries are enough.'));
    }

    // priority sort, stable
    out.sort(function (a, b) { return a.priority - b.priority; });
    if (!out.length) {
      out.push(ins(3, 'ok', 'On track', 'Everything is within range. Keep logging and progressing — I will flag the moment something needs a change.', null));
    }
    return out;
  }

  function planToday(state, targets, deload) {
    var program = state.program;
    var todayName = new Date().toLocaleDateString(undefined, { weekday: 'long' });
    var plan = { date: window.Store.todayISO(), weekday: todayName, nutrition: targets, deload: deload && deload.recommend };

    if (!program || !program.days || !program.days.length) {
      plan.workout = null;
      return plan;
    }

    // Rotate through program days by how many workouts already logged.
    var doneCount = (state.logs.workouts || []).length;
    var alreadyToday = (state.logs.workouts || []).some(function (w) { return w.date === plan.date; });
    var dayIdx = doneCount % program.days.length;
    var day = program.days[dayIdx];

    plan.workout = {
      dayName: day.name,
      alreadyLoggedToday: alreadyToday,
      exercises: day.exercises.map(function (pl) {
        var prog = T.progressExercise(state, program, pl.exerciseId, pl);
        return {
          exerciseId: pl.exerciseId,
          name: pl.name,
          sets: deload && deload.recommend ? Math.max(1, Math.round(pl.sets / 2)) : pl.sets,
          repRange: pl.repRange,
          rpe: deload && deload.recommend ? [6, 7] : pl.rpe,
          progression: prog
        };
      })
    };
    return plan;
  }

  // ---- helpers ----------------------------------------------------------
  function hasTrainedRecently(state) {
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 10);
    var c = cutoff.toISOString().slice(0, 10);
    return (state.logs.workouts || []).some(function (w) { return w.date >= c; });
  }

  function recentPRs(state, strength) {
    var out = [];
    Object.keys(strength || {}).forEach(function (id) {
      var arr = strength[id];
      if (arr.length < 2) return;
      var first = arr[0].e1rm, last = arr[arr.length - 1].e1rm;
      var gain = Math.round((last - first) * 10) / 10;
      if (gain >= 2.5) {
        var ex = DB.get(id);
        out.push({ id: id, name: ex ? ex.name : id, gain: gain });
      }
    });
    out.sort(function (a, b) { return b.gain - a.gain; });
    return out;
  }

  function fmtRate(kg) {
    var s = kg > 0 ? '+' : '';
    return s + (Math.round(kg * 100) / 100) + ' kg';
  }

  function shortDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  window.Coach = { analyze: analyze };
})();
