/*
 * app.js — UI controller, routing, onboarding, and the interactive views.
 *
 * The coaching "loop" is wired here: every save re-runs Coach.analyze() and
 * re-renders, so logging anything instantly re-plans your day and refreshes
 * insights.
 */
(function () {
  'use strict';

  var S = window.Store;
  var Coach = window.Coach;
  var DB = window.ExerciseDB;

  var currentView = 'dashboard';
  var workoutDraft = null; // in-progress workout (not yet saved)
  var aiState = { loading: false, text: null, error: null };

  // ---- unit helpers -----------------------------------------------------
  function imperial() { return S.get().settings.units === 'imperial'; }
  function kgToDisp(kg) { if (kg == null) return null; return round1(imperial() ? kg * 2.20462 : kg); }
  function dispToKg(v) { return imperial() ? v / 2.20462 : v; }
  function wUnit() { return imperial() ? 'lb' : 'kg'; }
  function cmToDisp(cm) { if (cm == null) return null; return imperial() ? Math.round(cm / 2.54) : cm; }
  function dispToCm(v) { return imperial() ? v * 2.54 : v; }
  function hUnit() { return imperial() ? 'in' : 'cm'; }
  function round1(x) { return Math.round(x * 10) / 10; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- boot -------------------------------------------------------------
  function boot() {
    S.load();
    S.subscribe(function () { renderApp(); });
    window.addEventListener('hashchange', function () {
      var v = location.hash.replace('#', '');
      if (v) { currentView = v; renderApp(); }
    });
    registerSW();
    var v = location.hash.replace('#', '');
    if (v) currentView = v;
    renderApp();
  }

  function renderApp() {
    var state = S.get();
    var root = document.getElementById('app');
    if (!state.onboarded) { root.innerHTML = renderOnboarding(state); wireForms(); return; }

    var analysis = Coach.analyze(state);
    var body;
    switch (currentView) {
      case 'workout': body = renderWorkout(state, analysis); break;
      case 'nutrition': body = renderNutrition(state, analysis); break;
      case 'progress': body = renderProgress(state, analysis); break;
      case 'coach': body = renderCoachView(state, analysis); break;
      case 'settings': body = renderSettings(state); break;
      default: body = renderDashboard(state, analysis);
    }
    root.innerHTML =
      header(state) +
      '<main class="view">' + body + '</main>' +
      nav();
    wireForms();
    if (currentView === 'progress') drawProgressCharts(state, analysis);
  }

  function header(state) {
    var name = state.profile.name ? esc(state.profile.name) : 'Athlete';
    return '<header class="topbar">' +
      '<div class="brand">🏋️ <span>Coach</span></div>' +
      '<div class="who">' + name + '</div>' +
      '<button class="icon-btn" data-nav="settings" aria-label="Settings">⚙️</button>' +
      '</header>';
  }

  function nav() {
    var items = [
      ['dashboard', '🏠', 'Home'],
      ['workout', '💪', 'Train'],
      ['nutrition', '🍽️', 'Eat'],
      ['progress', '📈', 'Progress'],
      ['coach', '🧠', 'Coach']
    ];
    return '<nav class="bottomnav">' + items.map(function (it) {
      var active = currentView === it[0] ? ' active' : '';
      return '<button class="navbtn' + active + '" data-nav="' + it[0] + '">' +
        '<span class="ni">' + it[1] + '</span><span class="nl">' + it[2] + '</span></button>';
    }).join('') + '</nav>';
  }

  // ---- Dashboard --------------------------------------------------------
  function renderDashboard(state, a) {
    var t = a.todayPlan;
    var body = a.metrics.body;
    var top = a.insights.filter(function (i) { return i.priority <= 2; }).slice(0, 3);

    var hero = '<section class="card hero">' +
      '<div class="hero-date">' + esc(t.weekday) + '</div>' +
      '<h1>' + greeting() + '</h1>' +
      '<p class="muted">' + goalLine(state) + '</p>' +
      '</section>';

    // Today's training
    var train;
    if (t.workout) {
      train = '<section class="card">' +
        '<div class="card-head"><h2>Today · ' + esc(t.workout.dayName) + '</h2>' +
        (t.deload ? '<span class="pill warn">Deload</span>' : '') + '</div>' +
        '<ul class="mini-list">' +
        t.workout.exercises.slice(0, 6).map(function (e) {
          return '<li><span>' + esc(e.name) + '</span><span class="muted">' +
            e.sets + '×' + e.repRange[0] + '–' + e.repRange[1] + '</span></li>';
        }).join('') +
        '</ul>' +
        (t.workout.alreadyLoggedToday
          ? '<p class="ok-note">✅ Logged today — nice work.</p>'
          : '<button class="btn primary" data-nav="workout">Start workout →</button>') +
        '</section>';
    } else {
      train = '<section class="card"><h2>Today</h2><p class="muted">No program yet. Generate one in Settings.</p>' +
        '<button class="btn" data-nav="settings">Set up program</button></section>';
    }

    // Nutrition targets
    var nt = a.metrics.targets;
    var todayNut = S.byDate('nutrition', S.todayISO());
    var kcalToday = todayNut ? todayNut.kcal : 0;
    var nutrition = '<section class="card">' +
      '<div class="card-head"><h2>Fuel today</h2><button class="btn small" data-log="nutrition">Log</button></div>' +
      macroRow('Calories', kcalToday, nt.kcal, 'kcal') +
      macroRow('Protein', todayNut ? todayNut.protein : 0, nt.protein, 'g') +
      '<div class="macro-mini">' +
        '<span>Carbs ' + nt.carbs + 'g</span><span>Fat ' + nt.fat + 'g</span>' +
        '<span>Fiber ' + nt.fiber + 'g</span>' +
      '</div>' +
      '<p class="muted small">Maintenance ≈ ' + nt.tdee.value + ' kcal (' + nt.tdee.method + ')</p>' +
      '</section>';

    // Insights
    var insights = '<section class="card">' +
      '<div class="card-head"><h2>Coach says</h2><button class="btn small" data-nav="coach">All →</button></div>' +
      top.map(insightRow).join('') +
      '</section>';

    // Quick log
    var quick = '<section class="quick">' +
      '<button class="qbtn" data-log="body">⚖️ Weight</button>' +
      '<button class="qbtn" data-log="nutrition">🍽️ Food</button>' +
      '<button class="qbtn" data-log="activity">😴 Recovery</button>' +
      '<button class="qbtn" data-nav="workout">💪 Train</button>' +
      '</section>';

    var stats = body ? '<section class="statgrid">' +
      stat('Weight', kgToDisp(body.weightKg) + ' ' + wUnit()) +
      stat('BMI', body.bmi) +
      (body.bodyFatPct ? stat('Body fat', body.bodyFatPct + '%') : stat('Trend', trendLabel(a.metrics.trend))) +
      '</section>' : '';

    return hero + stats + train + nutrition + insights + quick;
  }

  function trendLabel(trend) {
    if (!trend || trend.rateKgPerWeek == null) return '—';
    var r = kgToDisp(trend.rateKgPerWeek);
    return (r > 0 ? '+' : '') + r + ' ' + wUnit() + '/wk';
  }

  function stat(label, val) {
    return '<div class="stat"><div class="sv">' + esc(val) + '</div><div class="sl">' + esc(label) + '</div></div>';
  }

  function macroRow(label, cur, target, unit) {
    var pct = target ? Math.min(100, Math.round((cur / target) * 100)) : 0;
    return '<div class="macro">' +
      '<div class="macro-top"><span>' + label + '</span><span>' + Math.round(cur) + ' / ' + target + ' ' + unit + '</span></div>' +
      '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }

  function insightRow(i) {
    var cls = i.priority === 1 ? 'p1' : (i.priority === 2 ? 'p2' : 'p3');
    return '<div class="insight ' + cls + '">' +
      '<div class="insight-t">' + esc(i.title) + '</div>' +
      '<div class="insight-d">' + esc(i.detail) + '</div>' +
      '</div>';
  }

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
  }
  function goalLine(state) {
    var g = state.goals;
    var map = { fatloss: 'Losing fat', muscle: 'Building muscle', recomp: 'Body recomposition', strength: 'Getting stronger', maintain: 'Maintaining' };
    return (map[g.type] || 'Training') + ' · ' + g.trainingDaysPerWeek + ' days/week · ' + g.experience;
  }

  // ---- Workout ----------------------------------------------------------
  function renderWorkout(state, a) {
    var plan = a.todayPlan.workout;
    if (!plan) {
      return '<section class="card"><h2>No workout today</h2><p class="muted">Set up a program in Settings first.</p>' +
        '<button class="btn" data-nav="settings">Set up program</button></section>';
    }
    if (!workoutDraft || workoutDraft.dayName !== plan.dayName) {
      workoutDraft = {
        dayName: plan.dayName,
        exercises: plan.exercises.map(function (e) {
          return { exerciseId: e.exerciseId, name: e.name, targetSets: e.sets, repRange: e.repRange, rpe: e.rpe, progression: e.progression, sets: [] };
        })
      };
    }

    var head = '<section class="card">' +
      '<div class="card-head"><h2>' + esc(plan.dayName) + '</h2>' +
      (a.todayPlan.deload ? '<span class="pill warn">Deload week</span>' : '') + '</div>' +
      '<p class="muted small">Log each working set. I read your last session to set today\'s target.</p>' +
      '</section>';

    var cards = workoutDraft.exercises.map(function (ex, idx) {
      var prog = ex.progression || {};
      var suggested = prog.suggestedWeightKg != null ? kgToDisp(prog.suggestedWeightKg) : (prog.lastWeightKg != null ? kgToDisp(prog.lastWeightKg) : '');
      var setsHtml = ex.sets.length ? '<div class="setlist">' + ex.sets.map(function (s, si) {
        return '<span class="setchip">' + (si + 1) + ': ' + kgToDisp(s.weightKg) + wUnit() + '×' + s.reps +
          (s.rpe ? ' @' + s.rpe : '') + '</span>';
      }).join('') + '</div>' : '';
      return '<section class="card exercise">' +
        '<div class="card-head"><h3>' + esc(ex.name) + '</h3>' +
        '<span class="muted small">' + ex.targetSets + '×' + ex.repRange[0] + '–' + ex.repRange[1] + ' · RPE ' + ex.rpe[0] + '–' + ex.rpe[1] + '</span></div>' +
        '<p class="prog">💡 ' + esc(prog.suggestion || 'Pick a challenging weight.') + '</p>' +
        setsHtml +
        '<form class="set-form" data-add-set="' + idx + '">' +
        '<input name="weight" type="number" step="0.5" inputmode="decimal" placeholder="' + wUnit() + (suggested !== '' ? ' (' + suggested + ')' : '') + '" value="' + (suggested !== '' ? suggested : '') + '">' +
        '<input name="reps" type="number" inputmode="numeric" placeholder="reps">' +
        '<input name="rpe" type="number" step="0.5" inputmode="decimal" placeholder="RPE">' +
        '<button class="btn small primary" type="submit">Add set</button>' +
        '</form>' +
        '</section>';
    }).join('');

    var totalSets = workoutDraft.exercises.reduce(function (n, e) { return n + e.sets.length; }, 0);
    var finish = '<section class="card">' +
      '<button class="btn primary block" data-finish-workout="1"' + (totalSets === 0 ? ' disabled' : '') + '>Finish & save workout (' + totalSets + ' sets)</button>' +
      '<button class="btn ghost block" data-cancel-workout="1">Discard</button>' +
      '</section>';

    return head + cards + finish;
  }

  // ---- Nutrition --------------------------------------------------------
  function renderNutrition(state, a) {
    var nt = a.metrics.targets;
    var today = S.byDate('nutrition', S.todayISO()) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    var remaining = nt.kcal - (today.kcal || 0);

    var targets = '<section class="card">' +
      '<div class="card-head"><h2>Today\'s targets</h2></div>' +
      macroRow('Calories', today.kcal || 0, nt.kcal, 'kcal') +
      macroRow('Protein', today.protein || 0, nt.protein, 'g') +
      macroRow('Carbs', today.carbs || 0, nt.carbs, 'g') +
      macroRow('Fat', today.fat || 0, nt.fat, 'g') +
      '<p class="muted small">' + (remaining >= 0 ? Math.round(remaining) + ' kcal left today' : Math.abs(Math.round(remaining)) + ' kcal over') +
      ' · aim for ~' + nt.fiber + 'g fiber, ~' + Math.round(nt.waterMl / 1000 * 10) / 10 + 'L water.</p>' +
      '</section>';

    var form = '<section class="card">' +
      '<div class="card-head"><h2>Log today</h2></div>' +
      '<form data-log-form="nutrition" class="grid-form">' +
      field('kcal', 'Calories', 'number', today.kcal || '') +
      field('protein', 'Protein (g)', 'number', today.protein || '') +
      field('carbs', 'Carbs (g)', 'number', today.carbs || '') +
      field('fat', 'Fat (g)', 'number', today.fat || '') +
      '<button class="btn primary block" type="submit">Save today\'s intake</button>' +
      '</form>' +
      '<p class="muted small">Log a few days and I switch your calories from a formula to your real metabolism.</p>' +
      '</section>';

    var recent = recentNutrition(state);
    return targets + form + recent;
  }

  function recentNutrition(state) {
    var arr = (state.logs.nutrition || []).slice(-7).reverse();
    if (!arr.length) return '';
    return '<section class="card"><h2>Recent</h2><ul class="mini-list">' +
      arr.map(function (n) {
        return '<li><span>' + esc(shortDate(n.date)) + '</span><span class="muted">' + n.kcal + ' kcal · ' + n.protein + 'g P</span></li>';
      }).join('') + '</ul></section>';
  }

  // ---- Progress ---------------------------------------------------------
  function renderProgress(state, a) {
    var body = a.metrics.body;
    var stats = body ? '<section class="statgrid">' +
      stat('Weight', kgToDisp(body.weightKg) + ' ' + wUnit()) +
      stat('BMI', body.bmi) +
      (body.lbmKg ? stat('Lean mass', kgToDisp(body.lbmKg) + ' ' + wUnit()) : stat('Rate', trendLabel(a.metrics.trend))) +
      (body.ffmi ? stat('FFMI', body.ffmi) : stat('Body fat', body.bodyFatPct ? body.bodyFatPct + '%' : '—')) +
      '</section>' : '';

    var weightCard = '<section class="card"><div class="card-head"><h2>Weight trend</h2>' +
      '<span class="muted small">' + trendLabel(a.metrics.trend) + '</span></div>' +
      '<div id="chart-weight" class="chart-box"></div>' +
      '<p class="muted small">Line = 7-day trend (smoothed); dots = daily weigh-ins.</p></section>';

    // exercise picker for strength chart
    var strength = a.metrics.strength;
    var ids = Object.keys(strength).filter(function (id) { return strength[id].length >= 2; });
    var selected = window.__progLift && strength[window.__progLift] ? window.__progLift : (ids[0] || null);
    window.__progLift = selected;
    var strengthCard = '<section class="card"><div class="card-head"><h2>Strength (est. 1RM)</h2>' +
      (ids.length ? '<select data-lift-select>' + ids.map(function (id) {
        var ex = DB.get(id);
        return '<option value="' + id + '"' + (id === selected ? ' selected' : '') + '>' + esc(ex ? ex.name : id) + '</option>';
      }).join('') + '</select>' : '') + '</div>' +
      '<div id="chart-strength" class="chart-box"></div>' +
      (ids.length ? '' : '<p class="muted small">Log a couple of workouts to see strength trends.</p>') +
      '</section>';

    var volCard = '<section class="card"><div class="card-head"><h2>Weekly volume vs landmarks</h2></div>' +
      '<div id="chart-volume"></div>' +
      '<p class="muted small">Sets/week per muscle. Ticks mark minimum-effective (MEV), max-adaptive (MAV) and max-recoverable (MRV) volume.</p></section>';

    return stats + weightCard + strengthCard + volCard;
  }

  function drawProgressCharts(state, a) {
    var trend = a.metrics.trend;
    var wbox = document.getElementById('chart-weight');
    if (wbox && trend) {
      var pts = trend.series.map(function (s) { return { x: s.date, y: kgToDisp(s.ema), raw: kgToDisp(s.raw) }; });
      window.Charts.lineChart(wbox, pts, { unit: ' ' + wUnit() });
    }
    var sbox = document.getElementById('chart-strength');
    if (sbox && window.__progLift && a.metrics.strength[window.__progLift]) {
      var arr = a.metrics.strength[window.__progLift];
      var spts = arr.map(function (p) { return { x: p.date, y: kgToDisp(p.e1rm) }; });
      window.Charts.lineChart(sbox, spts, { unit: ' ' + wUnit() });
    }
    var vbox = document.getElementById('chart-volume');
    if (vbox) window.Charts.volumeChart(vbox, a.metrics.volGuidance);
  }

  // ---- Coach view -------------------------------------------------------
  function renderCoachView(state, a) {
    var deload = a.metrics.deload;
    var deloadCard = deload && deload.recommend ? '<section class="card warn-card">' +
      '<h2>🛑 Deload recommended</h2><p>' + esc(deload.prescription) + '</p>' +
      '<ul class="reasons">' + deload.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
      '</section>' : '';

    var insightCards = '<section class="card"><h2>This week\'s priorities</h2>' +
      a.insights.map(function (i) {
        return '<div class="insight ' + (i.priority === 1 ? 'p1' : i.priority === 2 ? 'p2' : 'p3') + '">' +
          '<div class="insight-t">' + priorityDot(i.priority) + ' ' + esc(i.title) + '</div>' +
          '<div class="insight-d">' + esc(i.detail) + '</div>' +
          (i.science ? '<details class="why"><summary>Why (the science)</summary><p>' + esc(i.science) + '</p></details>' : '') +
          '</div>';
      }).join('') + '</section>';

    var fatigue = a.metrics.fatigue;
    var recoveryCard = fatigue && fatigue.score != null ? '<section class="card"><h2>Recovery</h2>' +
      '<div class="gauge"><div class="gauge-fill" style="width:' + fatigue.score + '%"></div></div>' +
      '<p class="muted small">Fatigue ' + fatigue.score + '/100 · sleep ' + (fatigue.sleep || '—') + 'h · soreness ' + (fatigue.soreness || '—') + '/5 · energy ' + (fatigue.energy || '—') + '/5</p>' +
      '</section>' : '';

    // AI review section
    var ai = state.settings.ai || {};
    var aiCard;
    if (window.AICoach.isEnabled(state)) {
      aiCard = '<section class="card ai-card"><div class="card-head"><h2>🤖 AI weekly review</h2></div>' +
        (aiState.loading ? '<p class="muted">Thinking…</p>' :
          aiState.error ? '<p class="error">' + esc(aiState.error) + '</p>' :
          aiState.text ? '<p class="ai-text">' + esc(aiState.text).replace(/\n/g, '<br>') + '</p>' :
          '<p class="muted small">Get a natural-language review from Claude on top of the engine analysis.</p>') +
        '<button class="btn primary block" data-ai-review="1"' + (aiState.loading ? ' disabled' : '') + '>' +
        (aiState.text ? 'Refresh review' : 'Generate review') + '</button>' +
        '</section>';
    } else {
      aiCard = '<section class="card"><div class="card-head"><h2>🤖 AI review (optional)</h2></div>' +
        '<p class="muted small">Enable the AI coach in Settings with a Claude API key to layer conversational reviews on top of the science engine.</p>' +
        '<button class="btn" data-nav="settings">Open Settings</button></section>';
    }

    return deloadCard + insightCards + recoveryCard + aiCard;
  }

  function priorityDot(p) {
    return '<span class="dot ' + (p === 1 ? 'd1' : p === 2 ? 'd2' : 'd3') + '"></span>';
  }

  // ---- Settings ---------------------------------------------------------
  function renderSettings(state) {
    var p = state.profile, g = state.goals, s = state.settings, ai = s.ai || {};
    return '<section class="card"><h2>Profile</h2>' +
      '<form data-settings-form="profile" class="grid-form">' +
      field('name', 'Name', 'text', p.name) +
      selectField('sex', 'Sex', p.sex, [['male', 'Male'], ['female', 'Female']]) +
      field('birthYear', 'Birth year', 'number', p.birthYear || '') +
      field('height', 'Height (' + hUnit() + ')', 'number', cmToDisp(p.heightCm) || '') +
      '<button class="btn primary block" type="submit">Save profile</button>' +
      '</form></section>' +

      '<section class="card"><h2>Goal & training</h2>' +
      '<form data-settings-form="goals" class="grid-form">' +
      selectField('type', 'Goal', g.type, [['fatloss', 'Lose fat'], ['muscle', 'Build muscle'], ['recomp', 'Recomposition'], ['strength', 'Strength'], ['maintain', 'Maintain']]) +
      selectField('experience', 'Experience', g.experience, [['beginner', 'Beginner (<1 yr)'], ['intermediate', 'Intermediate (1–3 yr)'], ['advanced', 'Advanced (3+ yr)']]) +
      selectField('trainingDaysPerWeek', 'Training days/week', String(g.trainingDaysPerWeek), [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]) +
      selectField('equipment', 'Equipment', g.equipment, [['full_gym', 'Full gym'], ['barbell_home', 'Home barbell'], ['home_dumbbells', 'Dumbbells only'], ['bodyweight', 'Bodyweight only']]) +
      '<button class="btn primary block" type="submit">Save & rebuild program</button>' +
      '</form>' +
      '<p class="muted small">Current split: ' + (state.program ? esc(state.program.splitName) + ' · ' + state.program.progression + ' progression' : 'none') + '</p>' +
      '</section>' +

      '<section class="card"><h2>Preferences</h2>' +
      '<form data-settings-form="prefs" class="grid-form">' +
      selectField('units', 'Units', s.units, [['metric', 'Metric (kg/cm)'], ['imperial', 'Imperial (lb/in)']]) +
      selectField('activityLevel', 'Daily activity (non-training)', s.activityLevel, [['sedentary', 'Sedentary'], ['light', 'Lightly active'], ['moderate', 'Moderately active'], ['active', 'Very active'], ['athlete', 'Athlete / labor']]) +
      '<button class="btn primary block" type="submit">Save preferences</button>' +
      '</form></section>' +

      '<section class="card"><h2>🤖 AI coach (optional)</h2>' +
      '<form data-settings-form="ai" class="grid-form">' +
      '<label class="check"><input type="checkbox" name="enabled"' + (ai.enabled ? ' checked' : '') + '> Enable AI reviews</label>' +
      selectField('model', 'Model', ai.model, [['claude-opus-4-8', 'Claude Opus 4.8 (best)'], ['claude-sonnet-5', 'Claude Sonnet 5 (balanced)'], ['claude-haiku-4-5', 'Claude Haiku 4.5 (cheapest)']]) +
      field('apiKey', 'Claude API key', 'password', ai.apiKey) +
      '<button class="btn primary block" type="submit">Save AI settings</button>' +
      '</form>' +
      '<p class="muted small">Your key is stored only in this browser and sent only to Anthropic. Get one at console.anthropic.com. Leave AI off to keep everything fully offline & free.</p>' +
      '</section>' +

      '<section class="card"><h2>Your data</h2>' +
      '<p class="muted small">Everything lives in this browser. Export a backup or move it to another device.</p>' +
      '<button class="btn block" data-export="1">Export backup (JSON)</button>' +
      '<label class="btn block file-btn">Import backup<input type="file" accept="application/json" data-import="1" hidden></label>' +
      '<button class="btn ghost block" data-reset="1">Reset everything</button>' +
      '</section>';
  }

  // ---- Onboarding -------------------------------------------------------
  function renderOnboarding(state) {
    return '<div class="onboard">' +
      '<div class="onboard-hero"><div class="big">🏋️</div><h1>Your science-based coach</h1>' +
      '<p class="muted">Tell me about you. I\'ll build your program and nutrition, then adjust it automatically as you log.</p></div>' +
      '<form data-onboard="1" class="grid-form card">' +
      '<h2>About you</h2>' +
      field('name', 'Name', 'text', '') +
      selectField('sex', 'Sex (for metabolic math)', 'male', [['male', 'Male'], ['female', 'Female']]) +
      field('birthYear', 'Birth year', 'number', '') +
      field('height', 'Height (' + hUnit() + ')', 'number', '') +
      field('weight', 'Current weight (' + wUnit() + ')', 'number', '') +
      field('bodyFat', 'Body fat % (optional)', 'number', '') +
      '<h2>Your goal</h2>' +
      selectField('type', 'Primary goal', 'recomp', [['fatloss', 'Lose fat'], ['muscle', 'Build muscle'], ['recomp', 'Recomposition (lose fat + build)'], ['strength', 'Get stronger'], ['maintain', 'Maintain']]) +
      selectField('experience', 'Training experience', 'beginner', [['beginner', 'Beginner (<1 yr)'], ['intermediate', 'Intermediate (1–3 yr)'], ['advanced', 'Advanced (3+ yr)']]) +
      selectField('trainingDaysPerWeek', 'Days per week you can train', '3', [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]) +
      selectField('equipment', 'Equipment', 'full_gym', [['full_gym', 'Full gym'], ['barbell_home', 'Home barbell'], ['home_dumbbells', 'Dumbbells only'], ['bodyweight', 'Bodyweight only']]) +
      selectField('units', 'Units', imperialGuess(), [['metric', 'Metric (kg/cm)'], ['imperial', 'Imperial (lb/in)']]) +
      '<button class="btn primary block" type="submit">Build my plan →</button>' +
      '</form>' +
      '<p class="muted small center">100% private — your data never leaves this device.</p>' +
      '</div>';
  }
  function imperialGuess() { return 'metric'; }

  // ---- form fields ------------------------------------------------------
  function field(name, label, type, val) {
    return '<label class="fld"><span>' + label + '</span>' +
      '<input name="' + name + '" type="' + type + '" ' +
      (type === 'number' ? 'inputmode="decimal" step="any" ' : '') +
      'value="' + esc(val == null ? '' : val) + '"></label>';
  }
  function selectField(name, label, val, opts) {
    return '<label class="fld"><span>' + label + '</span><select name="' + name + '">' +
      opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(val) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label>';
  }

  // ---- event wiring -----------------------------------------------------
  function wireForms() {
    var root = document.getElementById('app');

    root.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { currentView = b.getAttribute('data-nav'); location.hash = currentView; renderApp(); });
    });
    root.querySelectorAll('[data-log]').forEach(function (b) {
      b.addEventListener('click', function () {
        var kind = b.getAttribute('data-log');
        if (kind === 'nutrition') { currentView = 'nutrition'; location.hash = 'nutrition'; renderApp(); }
        else openLogModal(kind);
      });
    });

    var onb = root.querySelector('[data-onboard]');
    if (onb) onb.addEventListener('submit', onOnboardSubmit);

    root.querySelectorAll('[data-settings-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) { e.preventDefault(); onSettingsSubmit(f.getAttribute('data-settings-form'), f); });
    });

    root.querySelectorAll('[data-add-set]').forEach(function (f) {
      f.addEventListener('submit', function (e) { e.preventDefault(); onAddSet(parseInt(f.getAttribute('data-add-set'), 10), f); });
    });
    var fin = root.querySelector('[data-finish-workout]');
    if (fin) fin.addEventListener('click', onFinishWorkout);
    var can = root.querySelector('[data-cancel-workout]');
    if (can) can.addEventListener('click', function () { workoutDraft = null; currentView = 'dashboard'; location.hash = 'dashboard'; renderApp(); });

    var nf = root.querySelector('[data-log-form="nutrition"]');
    if (nf) nf.addEventListener('submit', function (e) { e.preventDefault(); onNutritionSave(nf); });

    var liftSel = root.querySelector('[data-lift-select]');
    if (liftSel) liftSel.addEventListener('change', function () { window.__progLift = liftSel.value; renderApp(); });

    var exp = root.querySelector('[data-export]');
    if (exp) exp.addEventListener('click', onExport);
    var imp = root.querySelector('[data-import]');
    if (imp) imp.addEventListener('change', onImport);
    var rst = root.querySelector('[data-reset]');
    if (rst) rst.addEventListener('click', onReset);

    var aiBtn = root.querySelector('[data-ai-review]');
    if (aiBtn) aiBtn.addEventListener('click', onAIReview);
  }

  // ---- handlers ---------------------------------------------------------
  function readForm(f) {
    var o = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else o[el.name] = el.value;
    });
    return o;
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function onOnboardSubmit(e) {
    e.preventDefault();
    var d = readForm(e.target);
    S.update(function (st) {
      st.settings.units = d.units || 'metric';
      st.profile.name = d.name || '';
      st.profile.sex = d.sex || 'male';
      st.profile.birthYear = num(d.birthYear);
      // height/weight interpreted in the chosen units
      var imp = st.settings.units === 'imperial';
      st.profile.heightCm = d.height ? (imp ? num(d.height) * 2.54 : num(d.height)) : null;
      st.goals.type = d.type;
      st.goals.experience = d.experience;
      st.goals.trainingDaysPerWeek = parseInt(d.trainingDaysPerWeek, 10);
      st.goals.equipment = d.equipment;
      st.onboarded = true;
      st.coach.mesocycleStart = S.todayISO();
      // starting weight
      var w = num(d.weight);
      if (w != null) {
        var wkg = imp ? w / 2.20462 : w;
        st.logs.body.push({ id: S.uid(), date: S.todayISO(), weightKg: wkg, bodyFatPct: num(d.bodyFat) });
      }
      st.program = window.Training.generateProgram(st);
    });
    currentView = 'dashboard'; location.hash = 'dashboard';
    toast('Program built. Welcome! 💪');
  }

  function onSettingsSubmit(kind, f) {
    var d = readForm(f);
    S.update(function (st) {
      if (kind === 'profile') {
        st.profile.name = d.name || '';
        st.profile.sex = d.sex;
        st.profile.birthYear = num(d.birthYear);
        st.profile.heightCm = d.height ? dispToCm(num(d.height)) : st.profile.heightCm;
      } else if (kind === 'goals') {
        st.goals.type = d.type;
        st.goals.experience = d.experience;
        st.goals.trainingDaysPerWeek = parseInt(d.trainingDaysPerWeek, 10);
        st.goals.equipment = d.equipment;
        st.program = window.Training.generateProgram(st);
        st.coach.mesocycleStart = S.todayISO();
      } else if (kind === 'prefs') {
        st.settings.units = d.units;
        st.settings.activityLevel = d.activityLevel;
      } else if (kind === 'ai') {
        st.settings.ai.enabled = !!d.enabled;
        st.settings.ai.model = d.model;
        st.settings.ai.apiKey = d.apiKey || '';
      }
    });
    toast('Saved.');
  }

  function onAddSet(idx, f) {
    var d = readForm(f);
    var w = num(d.weight), reps = num(d.reps), rpe = num(d.rpe);
    if (reps == null || reps <= 0) { toast('Enter reps.'); return; }
    var wkg = w != null ? dispToKg(w) : 0;
    workoutDraft.exercises[idx].sets.push({ weightKg: wkg, reps: reps, rpe: rpe });
    renderApp();
  }

  function onFinishWorkout() {
    if (!workoutDraft) return;
    var exercises = workoutDraft.exercises
      .filter(function (e) { return e.sets.length; })
      .map(function (e) { return { exerciseId: e.exerciseId, sets: e.sets }; });
    if (!exercises.length) { toast('Log at least one set first.'); return; }
    S.addLog('workouts', { dayName: workoutDraft.dayName, exercises: exercises });
    workoutDraft = null;
    currentView = 'dashboard'; location.hash = 'dashboard';
    toast('Workout saved. Progression updated. 🔥');
  }

  function onNutritionSave(f) {
    var d = readForm(f);
    S.addLog('nutrition', {
      kcal: num(d.kcal) || 0, protein: num(d.protein) || 0,
      carbs: num(d.carbs) || 0, fat: num(d.fat) || 0
    });
    toast('Intake logged.');
  }

  function onExport() {
    var blob = new Blob([S.exportJSON()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'gymcoach-backup-' + S.todayISO() + '.json';
    a.click(); URL.revokeObjectURL(url);
  }
  function onImport(e) {
    var file = e.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try { S.importJSON(r.result); toast('Backup imported.'); currentView = 'dashboard'; location.hash = 'dashboard'; }
      catch (err) { toast('Import failed: not a valid backup.'); }
    };
    r.readAsText(file);
  }
  function onReset() {
    openConfirm('Reset everything?', 'This permanently erases all your data on this device. Export a backup first if you want to keep it.', function () {
      S.reset(); workoutDraft = null; currentView = 'dashboard'; location.hash = '';
    });
  }

  function onAIReview() {
    var state = S.get();
    aiState = { loading: true, text: aiState.text, error: null };
    renderApp();
    var analysis = Coach.analyze(state);
    window.AICoach.review(state, analysis).then(function (text) {
      aiState = { loading: false, text: text, error: null }; renderApp();
    }).catch(function (err) {
      aiState = { loading: false, text: aiState.text, error: err.message }; renderApp();
    });
  }

  // ---- quick-log modals -------------------------------------------------
  function openLogModal(kind) {
    var today = S.byDate(kind, S.todayISO()) || {};
    var html;
    if (kind === 'body') {
      html = '<h2>Log weigh-in</h2><form data-modal-form="body" class="grid-form">' +
        field('weight', 'Weight (' + wUnit() + ')', 'number', today.weightKg ? kgToDisp(today.weightKg) : '') +
        field('bodyFat', 'Body fat % (optional)', 'number', today.bodyFatPct || '') +
        field('waist', 'Waist (' + hUnit() + ', optional)', 'number', today.waistCm ? cmToDisp(today.waistCm) : '') +
        '<button class="btn primary block" type="submit">Save</button></form>';
    } else if (kind === 'activity') {
      html = '<h2>Recovery check-in</h2><form data-modal-form="activity" class="grid-form">' +
        field('sleepHours', 'Sleep (hours)', 'number', today.sleepHours || '') +
        rangeField('energy', 'Energy (1 low – 5 high)', today.energy || 3) +
        rangeField('soreness', 'Soreness (1 low – 5 high)', today.soreness || 2) +
        rangeField('stress', 'Stress (1 low – 5 high)', today.stress || 2) +
        field('steps', 'Steps (optional)', 'number', today.steps || '') +
        '<button class="btn primary block" type="submit">Save</button></form>';
    }
    openModal(html);
    var f = document.querySelector('[data-modal-form]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = readForm(f);
      if (kind === 'body') {
        S.addLog('body', {
          weightKg: d.weight ? dispToKg(num(d.weight)) : null,
          bodyFatPct: num(d.bodyFat), waistCm: d.waist ? dispToCm(num(d.waist)) : null
        });
      } else {
        S.addLog('activity', {
          sleepHours: num(d.sleepHours), energy: num(d.energy),
          soreness: num(d.soreness), stress: num(d.stress), steps: num(d.steps)
        });
      }
      closeModal(); toast('Logged.');
    });
  }

  function rangeField(name, label, val) {
    return '<label class="fld"><span>' + label + '</span>' +
      '<input name="' + name + '" type="range" min="1" max="5" step="1" value="' + val + '" oninput="this.nextElementSibling.textContent=this.value">' +
      '<output>' + val + '</output></label>';
  }

  // ---- modal / toast / confirm -----------------------------------------
  function openModal(html) {
    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.innerHTML = '<div class="modal card">' + html + '<button class="btn ghost block" data-close-modal="1">Cancel</button></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.getAttribute('data-close-modal')) closeModal(); });
  }
  function closeModal() {
    var m = document.querySelector('.modal-overlay'); if (m) m.remove();
  }
  function openConfirm(title, msg, onYes) {
    openModal('<h2>' + esc(title) + '</h2><p class="muted">' + esc(msg) + '</p>' +
      '<button class="btn primary block" data-confirm-yes="1">Yes, do it</button>');
    document.querySelector('[data-confirm-yes]').addEventListener('click', function () { closeModal(); onYes(); });
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  function shortDate(iso) { var d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  // ---- service worker ---------------------------------------------------
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
