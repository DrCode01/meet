/*
 * training.js — program design + progression science.
 *
 *  - Split selection scales with training days (full-body -> upper/lower ->
 *    push/pull/legs) so each muscle is trained ~2x/week, which beats 1x for
 *    hypertrophy at matched volume (Schoenfeld et al. 2016).
 *  - Starting volume is set near each muscle's MEV and progresses toward MAV
 *    across a mesocycle, then deloads (RP-style volume progression).
 *  - Load/reps use double progression: add reps within the target range, then
 *    add load and drop back to the bottom of the range.
 *  - Autoregulation via RPE/RIR: hypertrophy work sits at RPE 7-9 (1-3 reps in
 *    reserve). Beginners run linear progression (add load most sessions).
 */
(function () {
  'use strict';

  var DB = window.ExerciseDB;

  // Rep ranges & RPE targets per goal.
  var SCHEME = {
    fatloss:  { mainReps: [6, 10], accReps: [10, 15], rpe: [7, 9] },
    muscle:   { mainReps: [6, 10], accReps: [10, 15], rpe: [7, 9] },
    recomp:   { mainReps: [6, 10], accReps: [10, 15], rpe: [7, 9] },
    strength: { mainReps: [3, 5],  accReps: [6, 10],  rpe: [7, 9] },
    maintain: { mainReps: [6, 10], accReps: [10, 15], rpe: [6, 8] }
  };

  var MESO_WEEKS = 5; // 4 accumulation weeks + 1 deload

  // Day templates: ordered list of movement patterns to fill.
  var SPLITS = {
    3: {
      name: 'Full Body ×3',
      days: [
        { name: 'Full Body A', slots: ['squat', 'h_push', 'h_pull', 'v_push', 'isolation:biceps', 'isolation:calves'] },
        { name: 'Full Body B', slots: ['hinge', 'v_pull', 'h_push', 'lunge', 'isolation:triceps', 'isolation:abs'] },
        { name: 'Full Body C', slots: ['squat', 'v_push', 'h_pull', 'hinge', 'isolation:shoulders', 'isolation:abs'] }
      ]
    },
    4: {
      name: 'Upper / Lower ×4',
      days: [
        { name: 'Upper A', slots: ['h_push', 'h_pull', 'v_push', 'v_pull', 'isolation:biceps', 'isolation:triceps'] },
        { name: 'Lower A', slots: ['squat', 'hinge', 'lunge', 'isolation:hamstrings', 'isolation:calves', 'isolation:abs'] },
        { name: 'Upper B', slots: ['v_push', 'v_pull', 'h_push', 'h_pull', 'isolation:shoulders', 'isolation:biceps'] },
        { name: 'Lower B', slots: ['hinge', 'squat', 'isolation:quads', 'isolation:glutes', 'isolation:calves', 'isolation:abs'] }
      ]
    },
    5: {
      name: 'Push / Pull / Legs + Upper / Lower',
      days: [
        { name: 'Push', slots: ['h_push', 'v_push', 'h_push', 'isolation:shoulders', 'isolation:triceps', 'isolation:triceps'] },
        { name: 'Pull', slots: ['v_pull', 'h_pull', 'h_pull', 'isolation:shoulders', 'isolation:biceps', 'isolation:biceps'] },
        { name: 'Legs', slots: ['squat', 'hinge', 'lunge', 'isolation:hamstrings', 'isolation:calves', 'isolation:abs'] },
        { name: 'Upper', slots: ['h_push', 'v_pull', 'v_push', 'h_pull', 'isolation:biceps', 'isolation:triceps'] },
        { name: 'Lower', slots: ['hinge', 'squat', 'isolation:quads', 'isolation:glutes', 'isolation:calves', 'isolation:abs'] }
      ]
    },
    6: {
      name: 'Push / Pull / Legs ×2',
      days: [
        { name: 'Push A', slots: ['h_push', 'v_push', 'h_push', 'isolation:shoulders', 'isolation:triceps', 'isolation:triceps'] },
        { name: 'Pull A', slots: ['v_pull', 'h_pull', 'h_pull', 'isolation:shoulders', 'isolation:biceps', 'isolation:biceps'] },
        { name: 'Legs A', slots: ['squat', 'hinge', 'lunge', 'isolation:hamstrings', 'isolation:calves', 'isolation:abs'] },
        { name: 'Push B', slots: ['v_push', 'h_push', 'h_push', 'isolation:shoulders', 'isolation:triceps', 'isolation:chest'] },
        { name: 'Pull B', slots: ['h_pull', 'v_pull', 'h_pull', 'isolation:shoulders', 'isolation:biceps', 'isolation:back'] },
        { name: 'Legs B', slots: ['hinge', 'squat', 'isolation:quads', 'isolation:glutes', 'isolation:calves', 'isolation:abs'] }
      ]
    }
  };

  function pickSplit(days) {
    if (days <= 3) return SPLITS[3];
    if (days >= 6) return SPLITS[6];
    return SPLITS[days];
  }

  // Choose an exercise for a slot given equipment, avoiding repeats where we can.
  function chooseForSlot(slot, equip, used) {
    var pool;
    if (slot.indexOf('isolation:') === 0) {
      var muscle = slot.split(':')[1];
      pool = DB.forEquipment(equip).filter(function (e) {
        return e.primary.indexOf(muscle) >= 0 && !e.compound || (e.primary.indexOf(muscle) >= 0 && e.pattern === 'isolation');
      });
      if (!pool.length) {
        pool = DB.forEquipment(equip).filter(function (e) { return e.primary.indexOf(muscle) >= 0; });
      }
    } else {
      pool = DB.forEquipment(equip).filter(function (e) { return e.pattern === slot; });
    }
    if (!pool.length) return null;
    // Prefer an exercise not yet used this session, then this week.
    var fresh = pool.filter(function (e) { return !used[e.id]; });
    var chosen = (fresh.length ? fresh : pool)[0];
    return chosen;
  }

  function repRangeFor(ex, scheme) {
    return ex.compound ? scheme.mainReps : scheme.accReps;
  }

  // Starting sets per exercise so that per-muscle weekly volume lands near MEV.
  function generateProgram(state) {
    var goals = state.goals;
    var equip = goals.equipment || 'full_gym';
    var scheme = SCHEME[goals.type] || SCHEME.recomp;
    var split = pickSplit(goals.trainingDaysPerWeek);

    var days = split.days.map(function (day) {
      var used = {};
      var exercises = [];
      day.slots.forEach(function (slot) {
        var ex = chooseForSlot(slot, equip, used);
        if (!ex) return;
        used[ex.id] = true;
        var range = repRangeFor(ex, scheme);
        exercises.push({
          exerciseId: ex.id,
          name: ex.name,
          sets: goals.experience === 'beginner' ? 3 : (ex.compound ? 3 : 2),
          repRange: range.slice(),
          rpe: scheme.rpe.slice()
        });
      });
      return { name: day.name, exercises: exercises };
    });

    return {
      id: window.Store.uid(),
      createdAt: window.Store.todayISO(),
      splitName: split.name,
      daysPerWeek: split.days.length,
      mesoWeeks: MESO_WEEKS,
      scheme: scheme,
      progression: goals.experience === 'beginner' ? 'linear' : 'double',
      days: days
    };
  }

  // Given the last logged sets for an exercise, suggest today's target.
  // Implements double progression + beginner linear progression.
  function progressExercise(state, program, exerciseId, planned) {
    var ex = DB.get(exerciseId);
    var scheme = program.scheme;
    var range = planned && planned.repRange ? planned.repRange : (ex && ex.compound ? scheme.mainReps : scheme.accReps);

    // Find the most recent workout containing this exercise.
    var history = [];
    (state.logs.workouts || []).forEach(function (w) {
      (w.exercises || []).forEach(function (item) {
        if (item.exerciseId === exerciseId && item.sets && item.sets.length) {
          history.push({ date: w.date, sets: item.sets });
        }
      });
    });
    if (!history.length) {
      return {
        suggestion: 'Establish a working weight at RPE ' + scheme.rpe[0] + '-' + scheme.rpe[1] +
          ' for ' + range[0] + '-' + range[1] + ' reps.',
        targetReps: range,
        targetRpe: scheme.rpe,
        lastWeightKg: null,
        newWeight: false
      };
    }

    var last = history[history.length - 1];
    var top = window.Analytics.bestSet(last.sets);
    var topReps = top ? top.reps : range[0];
    var topWeight = top ? top.weightKg : 0;
    var topRpe = top ? top.rpe : null;
    var incrementKg = ex && ex.compound ? 2.5 : 1.25; // smaller jumps on isolation

    if (program.progression === 'linear') {
      // Beginners: if last session hit the target reps at RPE < 9, add load.
      var hitReps = topReps >= range[1] || (last.sets.filter(function (s) { return s.reps >= range[0]; }).length >= planned.sets);
      if (hitReps && (topRpe == null || topRpe < 9.5)) {
        return {
          suggestion: 'Add ' + incrementKg + ' kg — you cleared the range last time.',
          targetReps: range,
          targetRpe: scheme.rpe,
          lastWeightKg: topWeight,
          suggestedWeightKg: round(topWeight + incrementKg),
          newWeight: true
        };
      }
      return {
        suggestion: 'Repeat ' + topWeight + ' kg and push reps toward ' + range[1] + '.',
        targetReps: range,
        targetRpe: scheme.rpe,
        lastWeightKg: topWeight,
        suggestedWeightKg: topWeight,
        newWeight: false
      };
    }

    // Double progression: fill top of the range across all sets, then add load.
    var allSetsAtTop = last.sets.length >= (planned.sets || last.sets.length) &&
      last.sets.every(function (s) { return s.reps >= range[1]; });
    if (allSetsAtTop && (topRpe == null || topRpe <= 9)) {
      return {
        suggestion: 'All sets hit ' + range[1] + ' reps — add ' + incrementKg + ' kg and drop back to ' + range[0] + '.',
        targetReps: range,
        targetRpe: scheme.rpe,
        lastWeightKg: topWeight,
        suggestedWeightKg: round(topWeight + incrementKg),
        newWeight: true
      };
    }
    return {
      suggestion: 'Keep ' + topWeight + ' kg and add reps toward ' + range[1] + ' per set (RPE ' +
        scheme.rpe[0] + '-' + scheme.rpe[1] + ').',
      targetReps: range,
      targetRpe: scheme.rpe,
      lastWeightKg: topWeight,
      suggestedWeightKg: topWeight,
      newWeight: false
    };
  }

  // Volume analysis vs landmarks -> per-muscle guidance.
  function volumeGuidance(weeklyVolume) {
    var out = [];
    DB.MUSCLES.forEach(function (m) {
      var v = weeklyVolume[m] || 0;
      var lm = DB.LANDMARKS[m];
      var status, advice;
      if (v < lm.mev) { status = 'under'; advice = 'Below MEV (' + lm.mev + ') — add sets to grow.'; }
      else if (v < lm.mav) { status = 'building'; advice = 'In the effective range — progress toward ' + lm.mav + '.'; }
      else if (v <= lm.mrv) { status = 'optimal'; advice = 'Near max adaptive volume — hold and add load.'; }
      else { status = 'over'; advice = 'Above MRV (' + lm.mrv + ') — risk of junk volume, consider trimming.'; }
      out.push({ muscle: m, label: DB.MUSCLE_LABELS[m], sets: v, landmarks: lm, status: status, advice: advice });
    });
    return out;
  }

  // Decide whether a deload is warranted this week.
  function deloadCheck(state, fatigue, weeklyVolume, program) {
    var reasons = [];
    // Calendar: end of mesocycle.
    if (program && state.coach.mesocycleStart) {
      var weeksIn = Math.floor((new Date(window.Store.todayISO()) - new Date(state.coach.mesocycleStart)) / (7 * 86400000));
      if (weeksIn >= (program.mesoWeeks - 1)) reasons.push('Reached the planned deload week (week ' + (weeksIn + 1) + ' of ' + program.mesoWeeks + ').');
    }
    // Fatigue markers.
    if (fatigue && fatigue.score != null && fatigue.score >= 70) {
      reasons.push('High fatigue score (' + fatigue.score + '/100) from sleep/soreness/energy.');
    }
    // Volume at/over MRV across several muscles.
    var overMrv = 0;
    DB.MUSCLES.forEach(function (m) {
      if ((weeklyVolume[m] || 0) > DB.LANDMARKS[m].mrv) overMrv++;
    });
    if (overMrv >= 3) reasons.push(overMrv + ' muscle groups above MRV — accumulated fatigue likely.');

    return {
      recommend: reasons.length > 0,
      reasons: reasons,
      prescription: reasons.length ? 'Run a deload: ~50% of your usual sets, keep load ~90% and stay 3-4 reps shy of failure for one week.' : null
    };
  }

  function round(x) { return Math.round(x * 4) / 4; } // nearest 0.25 kg

  window.Training = {
    SCHEME: SCHEME,
    MESO_WEEKS: MESO_WEEKS,
    pickSplit: pickSplit,
    generateProgram: generateProgram,
    progressExercise: progressExercise,
    volumeGuidance: volumeGuidance,
    deloadCheck: deloadCheck
  };
})();
