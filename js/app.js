/*
 * app.js — UI controller, routing, onboarding, and the interactive views.
 *
 * The coaching "loop" is wired here: every save re-runs Coach.analyze() and
 * re-renders, so logging anything instantly re-plans your day and refreshes
 * insights. The nutrition experience is MacroFactor-style: a real food diary
 * (meals + individual foods), a live expenditure trend, and weekly check-ins
 * that recalibrate your targets from your own data.
 */
(function () {
  'use strict';

  var S = window.Store;
  var Coach = window.Coach;
  var DB = window.ExerciseDB;
  var F = window.Foods;
  var X = window.Expenditure;

  var currentView = 'dashboard';
  var workoutDraft = null;          // in-progress workout (not yet saved)
  var aiState = { loading: false, text: null, error: null };
  var diaryDate = null;             // which day the diary shows (null => today)
  var addFoodState = null;          // state for the add-food modal

  var MEALS = [['breakfast', 'Breakfast', '🌅'], ['lunch', 'Lunch', '🥗'], ['dinner', 'Dinner', '🍽️'], ['snack', 'Snacks', '🍎']];

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
      case 'diary': body = renderDiary(state, analysis); break;
      case 'progress': body = renderProgress(state, analysis); break;
      case 'coach': body = renderCoachView(state, analysis); break;
      case 'checkin': body = renderCheckIn(state, analysis); break;
      case 'settings': body = renderSettings(state); break;
      default: body = renderDashboard(state, analysis);
    }
    root.innerHTML =
      header(state) +
      '<main class="view">' + body + '</main>' +
      nav();
    wireForms();
    if (currentView === 'progress') drawProgressCharts(state, analysis);
    if (currentView === 'checkin') drawCheckInChart(state, analysis);
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
      ['diary', '🍽️', 'Diary'],
      ['progress', '📈', 'Trends'],
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
    var nt = a.metrics.targets;
    var top = a.insights.filter(function (i) { return i.priority <= 2; }).slice(0, 3);

    var hero = '<section class="card hero">' +
      '<div class="hero-date">' + esc(t.weekday) + '</div>' +
      '<h1>' + greeting() + '</h1>' +
      '<p class="muted">' + goalLine(state) + '</p>' +
      '</section>';

    // Weekly check-in banner (MacroFactor cadence)
    var checkinBanner = a.metrics.checkin && a.metrics.checkin.due ?
      '<section class="card checkin-banner" data-nav="checkin">' +
      '<div class="cib-l"><div class="cib-t">🔄 Weekly check-in ready</div>' +
      '<div class="cib-d muted small">' + a.metrics.checkin.daysSince + ' days of data — recalibrate your targets</div></div>' +
      '<button class="btn primary small" data-nav="checkin">Review →</button>' +
      '</section>' : '';

    // Energy summary — remaining calories front and centre
    var today = dayTotals(state, S.todayISO());
    var remaining = nt.kcal - today.kcal;
    var energy = '<section class="card energy">' +
      '<div class="card-head"><h2>Today\'s energy</h2><button class="btn small" data-nav="diary">Diary →</button></div>' +
      '<div class="energy-row">' +
        energyCell('Target', nt.kcal, 'kcal') +
        energyCell('Food', Math.round(today.kcal), 'kcal') +
        energyCell(remaining >= 0 ? 'Left' : 'Over', Math.abs(Math.round(remaining)), 'kcal', remaining < 0 ? 'over' : 'good') +
      '</div>' +
      ring(today.kcal, nt.kcal) +
      '<div class="macro-set">' +
        macroPill('Protein', today.protein, nt.protein) +
        macroPill('Carbs', today.carbs, nt.carbs) +
        macroPill('Fat', today.fat, nt.fat) +
      '</div>' +
      '<p class="muted small">Expenditure ≈ ' + nt.expenditure + ' kcal · ' + methodLabel(nt.expenditureMethod) + '</p>' +
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

    var insights = '<section class="card">' +
      '<div class="card-head"><h2>Coach says</h2><button class="btn small" data-nav="coach">All →</button></div>' +
      top.map(insightRow).join('') +
      '</section>';

    var quick = '<section class="quick">' +
      '<button class="qbtn" data-log="body">⚖️ Weight</button>' +
      '<button class="qbtn" data-nav="diary">🍽️ Food</button>' +
      '<button class="qbtn" data-log="activity">😴 Recovery</button>' +
      '<button class="qbtn" data-nav="workout">💪 Train</button>' +
      '</section>';

    var stats = body ? '<section class="statgrid">' +
      stat('Weight', kgToDisp(body.weightKg) + ' ' + wUnit()) +
      stat('Trend', trendLabel(a.metrics.trend)) +
      (body.bodyFatPct ? stat('Body fat', body.bodyFatPct + '%') : stat('BMI', body.bmi)) +
      '</section>' : '';

    return hero + checkinBanner + stats + energy + train + insights + quick;
  }

  function energyCell(label, val, unit, cls) {
    return '<div class="ecell ' + (cls || '') + '"><div class="ev">' + Math.round(val) + '</div>' +
      '<div class="el">' + label + ' <span class="muted">' + unit + '</span></div></div>';
  }
  function ring(cur, target) {
    var pct = target ? Math.max(0, Math.min(100, (cur / target) * 100)) : 0;
    return '<div class="bigbar"><div class="bigbar-fill" style="width:' + pct + '%"></div></div>';
  }
  function macroPill(label, cur, target) {
    var pct = target ? Math.min(100, Math.round((cur / target) * 100)) : 0;
    return '<div class="mp"><div class="mp-top"><span>' + label + '</span><span class="muted">' + Math.round(cur) + '/' + target + 'g</span></div>' +
      '<div class="mp-bar"><div class="mp-fill mp-' + label.toLowerCase() + '" style="width:' + pct + '%"></div></div></div>';
  }
  function methodLabel(m) { return m === 'adaptive' ? 'measured from your data' : 'formula estimate (log more to refine)'; }

  function trendLabel(trend) {
    if (!trend || trend.rateKgPerWeek == null) return '—';
    var r = kgToDisp(trend.rateKgPerWeek);
    return (r > 0 ? '+' : '') + r + ' ' + wUnit() + '/wk';
  }
  function stat(label, val) {
    return '<div class="stat"><div class="sv">' + esc(val) + '</div><div class="sl">' + esc(label) + '</div></div>';
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

  // Sum food entries for a date (falls back to any derived nutrition total).
  function dayTotals(state, date) {
    var items = S.foodByDate(date);
    if (items.length) {
      return items.reduce(function (t, i) {
        t.kcal += i.kcal || 0; t.protein += i.protein || 0; t.carbs += i.carbs || 0; t.fat += i.fat || 0; t.fiber += i.fiber || 0;
        return t;
      }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    }
    var n = S.byDate('nutrition', date);
    return n ? { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fiber: n.fiber || 0 } : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }

  // ---- Food diary (MacroFactor-style) -----------------------------------
  function renderDiary(state, a) {
    var date = diaryDate || S.todayISO();
    var nt = a.metrics.targets;
    var totals = dayTotals(state, date);
    var remaining = nt.kcal - totals.kcal;

    var head = '<section class="card diary-head">' +
      '<div class="date-nav">' +
        '<button class="icon-btn" data-diary-day="-1">‹</button>' +
        '<div class="date-label">' + esc(dayLabel(date)) + '</div>' +
        '<button class="icon-btn" data-diary-day="1"' + (date >= S.todayISO() ? ' disabled' : '') + '>›</button>' +
      '</div>' +
      '<div class="energy-row">' +
        energyCell('Target', nt.kcal, 'kcal') +
        energyCell('Food', Math.round(totals.kcal), 'kcal') +
        energyCell(remaining >= 0 ? 'Left' : 'Over', Math.abs(Math.round(remaining)), 'kcal', remaining < 0 ? 'over' : 'good') +
      '</div>' +
      ring(totals.kcal, nt.kcal) +
      '<div class="macro-set">' +
        macroPill('Protein', totals.protein, nt.protein) +
        macroPill('Carbs', totals.carbs, nt.carbs) +
        macroPill('Fat', totals.fat, nt.fat) +
      '</div>' +
      '</section>';

    var items = S.foodByDate(date);
    var meals = MEALS.map(function (m) {
      var mealItems = items.filter(function (i) { return i.meal === m[0]; });
      var mealKcal = mealItems.reduce(function (s, i) { return s + (i.kcal || 0); }, 0);
      var rows = mealItems.map(function (i) {
        return '<li class="food-row">' +
          '<div class="fr-main"><div class="fr-name">' + esc(i.name) + '</div>' +
          '<div class="fr-sub muted small">' + esc(i.qty ? (i.qty + ' × ' + i.unit) : '') +
            ' · ' + Math.round(i.protein) + 'P ' + Math.round(i.carbs) + 'C ' + Math.round(i.fat) + 'F</div></div>' +
          '<div class="fr-kcal">' + Math.round(i.kcal) + '</div>' +
          '<button class="icon-btn fr-del" data-del-food="' + i.id + '" aria-label="Remove">✕</button>' +
          '</li>';
      }).join('');
      return '<section class="card meal">' +
        '<div class="card-head"><h3>' + m[2] + ' ' + m[1] + '</h3>' +
        '<span class="muted small">' + Math.round(mealKcal) + ' kcal</span></div>' +
        (rows ? '<ul class="mini-list food-list">' + rows + '</ul>' : '<p class="muted small empty-meal">Nothing logged yet.</p>') +
        '<button class="btn small block add-food" data-add-food="' + m[0] + '">+ Add food</button>' +
        '</section>';
    }).join('');

    var note = totals.kcal > 0 ? '' :
      '<p class="muted small center">Log foods and your calories switch from a formula to your real metabolism within ~2 weeks.</p>';

    return head + meals + note;
  }

  function dayLabel(date) {
    if (date === S.todayISO()) return 'Today';
    var d = new Date(date + 'T00:00:00');
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (date === y.toISOString().slice(0, 10)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ---- Add-food modal ---------------------------------------------------
  function openAddFood(meal) {
    addFoodState = { meal: meal, date: diaryDate || S.todayISO(), mode: 'search', query: '', results: [], online: [], loading: false, selected: null, servingIdx: 0, qty: 1, grams: null, useGrams: false, error: null };
    renderAddFood();
  }

  function renderAddFood() {
    var st = addFoodState;
    if (!st) { closeModal(); return; }
    var mealName = (MEALS.filter(function (m) { return m[0] === st.meal; })[0] || ['', 'Meal'])[1];
    var html;

    if (st.selected) {
      html = renderServingPicker(st, mealName);
    } else {
      var tabs = '<div class="af-tabs">' +
        afTab('search', 'Search') + afTab('quick', 'Quick add') + afTab('custom', 'Custom food') +
        '</div>';
      var bodyHtml;
      if (st.mode === 'quick') bodyHtml = renderQuickAdd(st);
      else if (st.mode === 'custom') bodyHtml = renderCustomForm(st);
      else bodyHtml = renderSearch(st);
      html = '<div class="card-head"><h2>Add to ' + esc(mealName) + '</h2></div>' + tabs + bodyHtml;
    }

    var m = document.querySelector('.modal-overlay');
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal-overlay';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m) { addFoodState = null; closeModal(); } });
    }
    m.innerHTML = '<div class="modal card af-modal">' + html +
      '<button class="btn ghost block" data-close-af="1">' + (st.selected ? 'Back' : 'Done') + '</button></div>';
    wireAddFood();
  }

  function afTab(mode, label) {
    var st = addFoodState;
    return '<button class="af-tab' + (st.mode === mode ? ' active' : '') + '" data-af-mode="' + mode + '">' + label + '</button>';
  }

  function renderSearch(st) {
    var list = '';
    if (st.loading) list = '<p class="muted small">Searching…</p>';
    else {
      var local = F.search(st.query, S.get().customFoods);
      var combined = local.concat(st.online || []);
      if (st.query && !combined.length) list = '<p class="muted small">No matches. Try “Search online”, Quick add, or make a Custom food.</p>';
      else if (!st.query) list = '<p class="muted small">Search a food, or add one online / by barcode.</p>';
      else list = '<ul class="mini-list food-results">' + combined.slice(0, 30).map(function (f, i) {
        var src = f.source === 'off' ? '🌐' : (f.source === 'custom' ? '⭐' : '');
        return '<li class="food-result" data-pick-food="' + i + '">' +
          '<div class="fr-main"><div class="fr-name">' + src + ' ' + esc(f.name) + (f.brand ? ' <span class="muted small">' + esc(f.brand) + '</span>' : '') + '</div>' +
          '<div class="fr-sub muted small">' + f.kcal + ' kcal / 100' + servingUnit(f) + ' · ' + f.protein + 'P ' + f.carbs + 'C ' + f.fat + 'F</div></div>' +
          '<div class="fr-add">+</div></li>';
      }).join('') + '</ul>';
      // stash combined for pick handler
      st._combined = combined.slice(0, 30);
    }
    return '<input class="af-input" data-af-query type="search" inputmode="search" placeholder="Search foods (e.g. chicken, oats)…" value="' + esc(st.query) + '">' +
      '<div class="af-actions">' +
        '<button class="btn small" data-af-online="1"' + (st.query ? '' : ' disabled') + '>🌐 Search online</button>' +
        '<button class="btn small" data-af-barcode="1">📷 Barcode</button>' +
      '</div>' +
      (st.error ? '<p class="error small">' + esc(st.error) + '</p>' : '') +
      list;
  }
  function servingUnit(f) { return f.group === 'Beverages' ? 'ml' : 'g'; }

  function renderServingPicker(st, mealName) {
    var f = st.selected;
    var servings = f.servings && f.servings.length ? f.servings : [{ label: '100 g', g: 100 }];
    var grams = st.useGrams ? (st.grams || 100) : (servings[st.servingIdx].g * (st.qty || 1));
    var p = F.portion(f, grams);
    var opts = servings.map(function (s, i) {
      return '<option value="' + i + '"' + (i === st.servingIdx ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
    return '<div class="card-head"><h2>' + esc(f.name) + '</h2></div>' +
      (f.brand ? '<p class="muted small">' + esc(f.brand) + '</p>' : '') +
      '<div class="serving-grid">' +
        '<label class="fld"><span>Servings</span><input type="number" step="0.25" min="0" inputmode="decimal" data-af-qty value="' + (st.qty || 1) + '"' + (st.useGrams ? ' disabled' : '') + '></label>' +
        '<label class="fld"><span>Serving size</span><select data-af-serving' + (st.useGrams ? ' disabled' : '') + '>' + opts + '</select></label>' +
      '</div>' +
      '<label class="check"><input type="checkbox" data-af-usegrams' + (st.useGrams ? ' checked' : '') + '> Enter grams directly</label>' +
      (st.useGrams ? '<label class="fld"><span>Grams</span><input type="number" inputmode="decimal" data-af-grams value="' + (st.grams || 100) + '"></label>' : '') +
      '<div class="portion-preview">' +
        '<div class="pp-kcal">' + p.kcal + ' <span class="muted small">kcal</span></div>' +
        '<div class="pp-macros muted small">' + p.protein + 'g protein · ' + p.carbs + 'g carbs · ' + p.fat + 'g fat</div>' +
      '</div>' +
      '<button class="btn primary block" data-af-confirm="1">Add to ' + esc(mealName) + '</button>';
  }

  function renderQuickAdd(st) {
    return '<form data-af-quick class="grid-form">' +
      '<p class="muted small">Log calories and macros directly when you don\'t have the exact food.</p>' +
      field('name', 'Name (optional)', 'text', st.qName || '') +
      '<div class="serving-grid">' +
        field('kcal', 'Calories', 'number', '') +
        field('protein', 'Protein (g)', 'number', '') +
      '</div>' +
      '<div class="serving-grid">' +
        field('carbs', 'Carbs (g)', 'number', '') +
        field('fat', 'Fat (g)', 'number', '') +
      '</div>' +
      '<button class="btn primary block" type="submit">Add</button>' +
      '</form>';
  }

  function renderCustomForm(st) {
    return '<form data-af-custom class="grid-form">' +
      '<p class="muted small">Create a reusable food (values per serving). It\'s saved for future searches.</p>' +
      field('name', 'Name', 'text', '') +
      field('brand', 'Brand (optional)', 'text', '') +
      '<div class="serving-grid">' +
        field('serving', 'Serving size (g)', 'number', '100') +
        field('kcal', 'Calories / serving', 'number', '') +
      '</div>' +
      '<div class="serving-grid">' +
        field('protein', 'Protein (g)', 'number', '') +
        field('carbs', 'Carbs (g)', 'number', '') +
      '</div>' +
      field('fat', 'Fat (g)', 'number', '') +
      '<button class="btn primary block" type="submit">Save & add</button>' +
      '</form>';
  }

  function wireAddFood() {
    var m = document.querySelector('.modal-overlay');
    if (!m) return;
    var st = addFoodState;

    var closeBtn = m.querySelector('[data-close-af]');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      if (st.selected) { st.selected = null; renderAddFood(); }
      else { addFoodState = null; closeModal(); }
    });

    m.querySelectorAll('[data-af-mode]').forEach(function (b) {
      b.addEventListener('click', function () { st.mode = b.getAttribute('data-af-mode'); st.error = null; renderAddFood(); });
    });

    var q = m.querySelector('[data-af-query]');
    if (q) {
      q.addEventListener('input', function () { st.query = q.value; st.online = []; scheduleRenderSearch(); });
      // keep focus & caret
      q.focus(); var val = q.value; q.value = ''; q.value = val;
    }

    var onlineBtn = m.querySelector('[data-af-online]');
    if (onlineBtn) onlineBtn.addEventListener('click', doOnlineSearch);
    var barcodeBtn = m.querySelector('[data-af-barcode]');
    if (barcodeBtn) barcodeBtn.addEventListener('click', doBarcode);

    m.querySelectorAll('[data-pick-food]').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = parseInt(el.getAttribute('data-pick-food'), 10);
        var f = st._combined[idx];
        if (f) { st.selected = f; st.servingIdx = 0; st.qty = 1; st.useGrams = false; st.grams = (f.servings && f.servings[0] ? f.servings[0].g : 100); renderAddFood(); }
      });
    });

    // serving picker
    var qtyEl = m.querySelector('[data-af-qty]');
    if (qtyEl) qtyEl.addEventListener('input', function () { st.qty = parseFloat(qtyEl.value) || 0; updatePreview(); });
    var servEl = m.querySelector('[data-af-serving]');
    if (servEl) servEl.addEventListener('change', function () { st.servingIdx = parseInt(servEl.value, 10); updatePreview(); });
    var gramsToggle = m.querySelector('[data-af-usegrams]');
    if (gramsToggle) gramsToggle.addEventListener('change', function () { st.useGrams = gramsToggle.checked; renderAddFood(); });
    var gramsEl = m.querySelector('[data-af-grams]');
    if (gramsEl) gramsEl.addEventListener('input', function () { st.grams = parseFloat(gramsEl.value) || 0; updatePreview(); });
    var confirmBtn = m.querySelector('[data-af-confirm]');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmAddFood);

    var quickForm = m.querySelector('[data-af-quick]');
    if (quickForm) quickForm.addEventListener('submit', function (e) { e.preventDefault(); submitQuickAdd(quickForm); });
    var customForm = m.querySelector('[data-af-custom]');
    if (customForm) customForm.addEventListener('submit', function (e) { e.preventDefault(); submitCustom(customForm); });
  }

  var searchTimer = null;
  function scheduleRenderSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    // local search is instant; debounce only the re-render slightly
    searchTimer = setTimeout(function () { if (addFoodState) renderAddFood(); }, 120);
  }

  function updatePreview() {
    var st = addFoodState; var m = document.querySelector('.modal-overlay');
    if (!st || !st.selected || !m) return;
    var f = st.selected;
    var servings = f.servings && f.servings.length ? f.servings : [{ label: '100 g', g: 100 }];
    var grams = st.useGrams ? (st.grams || 0) : (servings[st.servingIdx].g * (st.qty || 0));
    var p = F.portion(f, grams);
    var kEl = m.querySelector('.pp-kcal'); var mEl = m.querySelector('.pp-macros');
    if (kEl) kEl.innerHTML = p.kcal + ' <span class="muted small">kcal</span>';
    if (mEl) mEl.textContent = p.protein + 'g protein · ' + p.carbs + 'g carbs · ' + p.fat + 'g fat';
  }

  function doOnlineSearch() {
    var st = addFoodState;
    if (!st.query) return;
    st.loading = true; st.error = null; renderAddFood();
    F.searchOnline(st.query).then(function (results) {
      st.loading = false;
      st.online = results;
      if (!results.length) st.error = 'No online results.';
      renderAddFood();
    }).catch(function (err) {
      st.loading = false;
      st.error = err.message === 'offline' ? 'You\'re offline — online search needs a connection.' : 'Online search failed.';
      renderAddFood();
    });
  }

  function doBarcode() {
    var st = addFoodState;
    function handleCode(code) {
      if (!code) return;
      st.loading = true; st.error = null; renderAddFood();
      F.lookupBarcode(code).then(function (food) {
        st.loading = false;
        if (!food) { st.error = 'Barcode not found in the database.'; renderAddFood(); return; }
        st.selected = food; st.servingIdx = 0; st.qty = 1; st.useGrams = false; st.grams = (food.servings[0] ? food.servings[0].g : 100);
        renderAddFood();
      }).catch(function (err) {
        st.loading = false;
        st.error = err.message === 'offline' ? 'You\'re offline — barcode lookup needs a connection.' : 'Lookup failed.';
        renderAddFood();
      });
    }
    scanBarcode(handleCode);
  }

  function confirmAddFood() {
    var st = addFoodState;
    var f = st.selected;
    var servings = f.servings && f.servings.length ? f.servings : [{ label: '100 g', g: 100 }];
    var serving = servings[st.servingIdx] || servings[0];
    var grams = st.useGrams ? (st.grams || 0) : (serving.g * (st.qty || 0));
    if (!grams) { toast('Enter an amount.'); return; }
    var p = F.portion(f, grams);
    S.addFood({
      date: st.date, meal: st.meal, name: f.name, brand: f.brand || '',
      qty: st.useGrams ? grams : (st.qty || 1), unit: st.useGrams ? 'g' : serving.label,
      kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber,
      sourceId: f.id
    });
    toast('Added ' + f.name + '.');
    st.selected = null; st.query = ''; st.online = []; st.mode = 'search';
    renderAddFood();
  }

  function submitQuickAdd(form) {
    var d = readForm(form);
    var st = addFoodState;
    if (!num(d.kcal)) { toast('Enter calories.'); return; }
    S.addFood({
      date: st.date, meal: st.meal, name: d.name || 'Quick add', qty: 1, unit: 'entry',
      kcal: Math.round(num(d.kcal) || 0), protein: num(d.protein) || 0, carbs: num(d.carbs) || 0, fat: num(d.fat) || 0, fiber: 0,
      sourceId: 'quick'
    });
    toast('Added.');
    renderAddFood();
  }

  function submitCustom(form) {
    var d = readForm(form);
    if (!d.name || !num(d.kcal)) { toast('Name and calories required.'); return; }
    var servingG = num(d.serving) || 100;
    // Store per-100g so it behaves like any DB food.
    var factor = 100 / servingG;
    var food = S.addCustomFood({
      name: d.name, brand: d.brand || '', group: 'Custom', source: 'custom',
      kcal: Math.round((num(d.kcal) || 0) * factor),
      protein: round1((num(d.protein) || 0) * factor),
      carbs: round1((num(d.carbs) || 0) * factor),
      fat: round1((num(d.fat) || 0) * factor),
      fiber: 0,
      servings: [{ label: '1 serving (' + servingG + ' g)', g: servingG }, { label: '100 g', g: 100 }]
    });
    var st = addFoodState;
    st.selected = Object.assign({ source: 'custom' }, food);
    st.servingIdx = 0; st.qty = 1; st.useGrams = false; st.grams = servingG;
    renderAddFood();
  }

  // Barcode scan: camera via BarcodeDetector when available, else manual entry.
  function scanBarcode(onResult) {
    var supported = ('BarcodeDetector' in window) && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!supported) {
      var code = window.prompt('Enter the barcode number:');
      onResult(code ? code.trim() : null);
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = '<div class="scanner"><video autoplay playsinline muted></video>' +
      '<div class="scan-frame"></div>' +
      '<div class="scan-actions"><button class="btn small" data-scan-manual>Enter manually</button>' +
      '<button class="btn small" data-scan-cancel>Cancel</button></div></div>';
    document.body.appendChild(overlay);
    var video = overlay.querySelector('video');
    var stream = null, raf = null, detector, stopped = false;
    try { detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }); }
    catch (e) { detector = new window.BarcodeDetector(); }

    function stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      overlay.remove();
    }
    overlay.querySelector('[data-scan-cancel]').addEventListener('click', function () { stop(); onResult(null); });
    overlay.querySelector('[data-scan-manual]').addEventListener('click', function () {
      stop(); var code = window.prompt('Enter the barcode number:'); onResult(code ? code.trim() : null);
    });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
      stream = s; video.srcObject = s;
      function tick() {
        if (stopped) return;
        detector.detect(video).then(function (codes) {
          if (codes && codes.length) { var v = codes[0].rawValue; stop(); onResult(v); }
          else raf = requestAnimationFrame(tick);
        }).catch(function () { raf = requestAnimationFrame(tick); });
      }
      raf = requestAnimationFrame(tick);
    }).catch(function () {
      stop(); var code = window.prompt('Camera unavailable. Enter the barcode number:'); onResult(code ? code.trim() : null);
    });
  }

  // ---- Weekly check-in --------------------------------------------------
  function renderCheckIn(state, a) {
    var trend = a.metrics.trend;
    var prop = X.proposeCheckIn(state, trend);
    var cur = prop.current || {};
    var pr = prop.proposed;

    var head = '<section class="card">' +
      '<div class="card-head"><h2>🔄 Weekly check-in</h2></div>' +
      '<p class="muted small">Adherence-neutral: I read your logged intake and weight trend and recalibrate your targets. No judgement about missed or over days — just the math.</p>' +
      '</section>';

    var expCard = '<section class="card"><h2>Your expenditure</h2>' +
      '<div class="big-number">' + prop.expenditure.value + ' <span class="muted small">kcal/day</span></div>' +
      '<p class="muted small">' + methodLabel(prop.expenditure.method) +
      (prop.expenditure.method === 'adaptive' ? ' · ' + prop.expenditure.confidence + ' confidence' : '') + '</p>' +
      '<div id="chart-expenditure" class="chart-box"></div>' +
      '<p class="muted small">Line = measured expenditure over time. It falls in a deficit and rises in a surplus as your body adapts — the whole point of tracking it.</p>' +
      '</section>';

    var rows =
      compareRow('Calories', cur.kcal, pr.kcal, 'kcal') +
      compareRow('Protein', cur.protein, pr.protein, 'g') +
      compareRow('Carbs', cur.carbs, pr.carbs, 'g') +
      compareRow('Fat', cur.fat, pr.fat, 'g');

    var propCard = '<section class="card"><h2>Proposed targets · week ' + (pr.weekIndex) + '</h2>' +
      '<div class="compare">' + rows + '</div>' +
      '<p class="muted small">' + esc(prop.rationale) + '</p>' +
      '<button class="btn primary block" data-apply-checkin="1">Apply new targets</button>' +
      '<button class="btn ghost block" data-nav="dashboard">Not now</button>' +
      '</section>';

    var history = (state.checkins || []).length ? '<section class="card"><h2>History</h2><ul class="mini-list">' +
      state.checkins.slice(-6).reverse().map(function (c) {
        return '<li><span>' + esc(shortDate(c.date)) + '</span><span class="muted">' + c.newKcal + ' kcal · exp ' + c.expenditure + '</span></li>';
      }).join('') + '</ul></section>' : '';

    return head + expCard + propCard + history;
  }

  function compareRow(label, oldV, newV, unit) {
    var delta = (oldV != null) ? Math.round(newV - oldV) : null;
    var arrow = delta == null || delta === 0 ? '' : (delta > 0 ? '<span class="up">▲ ' + delta + '</span>' : '<span class="down">▼ ' + Math.abs(delta) + '</span>');
    return '<div class="cmp-row"><span class="cmp-label">' + label + '</span>' +
      '<span class="cmp-old muted">' + (oldV != null ? Math.round(oldV) : '—') + '</span>' +
      '<span class="cmp-arrow">→</span>' +
      '<span class="cmp-new">' + Math.round(newV) + ' ' + unit + '</span>' +
      '<span class="cmp-delta">' + arrow + '</span></div>';
  }

  function drawCheckInChart(state, a) {
    var box = document.getElementById('chart-expenditure');
    if (!box) return;
    var series = a.metrics.targets.series || [];
    if (series.length < 2) { box.innerHTML = '<div class="chart-empty">Log ~2 weeks of food + weigh-ins to chart your expenditure.</div>'; return; }
    var pts = series.map(function (s) { return { x: s.date, y: s.expenditure }; });
    window.Charts.lineChart(box, pts, { unit: ' kcal' });
  }

  function applyCheckIn() {
    var state = S.get();
    var trend = Coach.analyze(state).metrics.trend;
    var prop = X.proposeCheckIn(state, trend);
    var pr = prop.proposed;
    S.setNutritionProgram(pr);
    S.addCheckin({
      date: S.todayISO(), weekIndex: pr.weekIndex, expenditure: prop.expenditure.value,
      oldKcal: prop.current ? prop.current.kcal : null, newKcal: pr.kcal,
      trendKg: trend ? trend.currentKg : null, rateKgPerWeek: prop.trendRate
    });
    currentView = 'dashboard'; location.hash = 'dashboard';
    toast('Targets updated for the week. 🎯');
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

  // ---- Progress / Trends ------------------------------------------------
  function renderProgress(state, a) {
    var body = a.metrics.body;
    var nt = a.metrics.targets;
    var stats = body ? '<section class="statgrid">' +
      stat('Weight', kgToDisp(body.weightKg) + ' ' + wUnit()) +
      stat('Rate', trendLabel(a.metrics.trend)) +
      (body.lbmKg ? stat('Lean mass', kgToDisp(body.lbmKg) + ' ' + wUnit()) : stat('BMI', body.bmi)) +
      (body.ffmi ? stat('FFMI', body.ffmi) : stat('Body fat', body.bodyFatPct ? body.bodyFatPct + '%' : '—')) +
      '</section>' : '';

    var weightCard = '<section class="card"><div class="card-head"><h2>Weight trend</h2>' +
      '<span class="muted small">' + trendLabel(a.metrics.trend) + '</span></div>' +
      '<div id="chart-weight" class="chart-box"></div>' +
      '<p class="muted small">Line = 7-day trend (smoothed); dots = daily weigh-ins.</p></section>';

    var expCard = '<section class="card"><div class="card-head"><h2>Expenditure</h2>' +
      '<span class="muted small">' + nt.expenditure + ' kcal</span></div>' +
      '<div id="chart-expenditure" class="chart-box"></div>' +
      '<p class="muted small">Your measured maintenance calories over time (' + methodLabel(nt.expenditureMethod) + ').</p></section>';

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

    return stats + weightCard + expCard + strengthCard + volCard;
  }

  function drawProgressCharts(state, a) {
    var trend = a.metrics.trend;
    var wbox = document.getElementById('chart-weight');
    if (wbox && trend) {
      var pts = trend.series.map(function (s) { return { x: s.date, y: kgToDisp(s.ema), raw: kgToDisp(s.raw) }; });
      window.Charts.lineChart(wbox, pts, { unit: ' ' + wUnit() });
    }
    var ebox = document.getElementById('chart-expenditure');
    if (ebox) {
      var series = a.metrics.targets.series || [];
      if (series.length < 2) ebox.innerHTML = '<div class="chart-empty">Log ~2 weeks of food + weigh-ins to chart your expenditure.</div>';
      else window.Charts.lineChart(ebox, series.map(function (s) { return { x: s.date, y: s.expenditure }; }), { unit: ' kcal' });
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
    var plan = a.plan;
    var planCard = '<section class="card plan-card"><div class="card-head"><h2>🎯 Your plan</h2></div>' +
      '<div class="plan-grid">' +
        planStat(goalWord(plan.goalType), 'Goal') +
        planStat(plan.kcal + ' kcal', 'Daily target') +
        planStat(plan.protein + ' g', 'Protein/day') +
        planStat((plan.kgPerWeek > 0 ? '+' : '') + kgToDisp(plan.kgPerWeek) + ' ' + wUnit() + '/wk', 'Target rate') +
      '</div>' +
      (plan.targetKg ? '<p class="muted small">Target ' + kgToDisp(plan.targetKg) + ' ' + wUnit() +
        (plan.etaWeeks != null ? ' · about ' + plan.etaWeeks + ' weeks to go (~' + shortDate(plan.etaDate) + ')' :
          (plan.toGoKg != null ? ' · ' + (plan.toGoKg > 0 ? '+' : '') + kgToDisp(plan.toGoKg) + ' ' + wUnit() + ' to go' : '')) + '</p>'
        : '<p class="muted small">Set a target weight in Settings for a dated timeline.</p>') +
      '<button class="btn small" data-nav="settings">Adjust plan</button>' +
      '</section>';

    var checkinCard = a.metrics.checkin && a.metrics.checkin.due ?
      '<section class="card checkin-banner" data-nav="checkin">' +
      '<div class="cib-l"><div class="cib-t">🔄 Weekly check-in ready</div>' +
      '<div class="cib-d muted small">Recalibrate targets from this week\'s data</div></div>' +
      '<button class="btn primary small" data-nav="checkin">Review →</button></section>' : '';

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

    return planCard + checkinCard + deloadCard + insightCards + recoveryCard + aiCard;
  }

  function planStat(val, label) { return '<div class="pstat"><div class="psv">' + esc(val) + '</div><div class="psl">' + esc(label) + '</div></div>'; }
  function goalWord(t) { return ({ fatloss: 'Lose fat', muscle: 'Build muscle', recomp: 'Recomp', strength: 'Strength', maintain: 'Maintain' })[t] || t; }
  function priorityDot(p) { return '<span class="dot ' + (p === 1 ? 'd1' : p === 2 ? 'd2' : 'd3') + '"></span>'; }

  // ---- Settings ---------------------------------------------------------
  function renderSettings(state) {
    var p = state.profile, g = state.goals, s = state.settings, ai = s.ai || {};
    var customList = (state.customFoods || []).length ? '<ul class="mini-list">' +
      state.customFoods.map(function (c) {
        return '<li><span>' + esc(c.name) + '</span><button class="icon-btn" data-del-custom="' + c.id + '" aria-label="Delete">✕</button></li>';
      }).join('') + '</ul>' : '<p class="muted small">No custom foods yet — create them from the diary.</p>';

    return '<section class="card"><h2>Profile</h2>' +
      '<form data-settings-form="profile" class="grid-form">' +
      field('name', 'Name', 'text', p.name) +
      selectField('sex', 'Sex', p.sex, [['male', 'Male'], ['female', 'Female']]) +
      field('birthYear', 'Birth year', 'number', p.birthYear || '') +
      field('height', 'Height (' + hUnit() + ')', 'number', cmToDisp(p.heightCm) || '') +
      '<button class="btn primary block" type="submit">Save profile</button>' +
      '</form></section>' +

      '<section class="card"><h2>Goal & nutrition plan</h2>' +
      '<form data-settings-form="goals" class="grid-form">' +
      selectField('type', 'Goal', g.type, [['fatloss', 'Lose fat'], ['muscle', 'Build muscle'], ['recomp', 'Recomposition'], ['strength', 'Strength'], ['maintain', 'Maintain']]) +
      field('targetWeight', 'Target weight (' + wUnit() + ', optional)', 'number', kgToDisp(g.targetWeightKg) || '') +
      selectField('pace', 'Pace', paceOf(g), [['auto', 'Recommended'], ['slow', 'Relaxed'], ['standard', 'Standard'], ['aggressive', 'Aggressive']]) +
      selectField('dietApproach', 'Diet approach', g.dietApproach || 'balanced', [['balanced', 'Balanced'], ['lowcarb', 'Lower carb'], ['highcarb', 'Higher carb (performance)'], ['keto', 'Keto']]) +
      selectField('experience', 'Experience', g.experience, [['beginner', 'Beginner (<1 yr)'], ['intermediate', 'Intermediate (1–3 yr)'], ['advanced', 'Advanced (3+ yr)']]) +
      selectField('trainingDaysPerWeek', 'Training days/week', String(g.trainingDaysPerWeek), [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]) +
      selectField('equipment', 'Equipment', g.equipment, [['full_gym', 'Full gym'], ['barbell_home', 'Home barbell'], ['home_dumbbells', 'Dumbbells only'], ['bodyweight', 'Bodyweight only']]) +
      '<button class="btn primary block" type="submit">Save & rebuild plan</button>' +
      '</form>' +
      '<p class="muted small">Saving rebuilds both your training split and your nutrition targets from your current data. Current split: ' + (state.program ? esc(state.program.splitName) : 'none') + '</p>' +
      '</section>' +

      '<section class="card"><h2>Preferences</h2>' +
      '<form data-settings-form="prefs" class="grid-form">' +
      selectField('units', 'Units', s.units, [['metric', 'Metric (kg/cm)'], ['imperial', 'Imperial (lb/in)']]) +
      selectField('activityLevel', 'Daily activity (non-training)', s.activityLevel, [['sedentary', 'Sedentary'], ['light', 'Lightly active'], ['moderate', 'Moderately active'], ['active', 'Very active'], ['athlete', 'Athlete / labor']]) +
      '<button class="btn primary block" type="submit">Save preferences</button>' +
      '</form></section>' +

      '<section class="card"><h2>Custom foods</h2>' + customList + '</section>' +

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

  function paceOf(g) {
    if (g.weeklyRatePct == null) return 'auto';
    var abs = Math.abs(g.weeklyRatePct);
    if (abs <= 0.3) return 'slow';
    if (abs >= 0.9) return 'aggressive';
    return 'standard';
  }
  function paceToRatePct(goalType, pace) {
    if (pace === 'auto') return null;
    var tables = {
      fatloss: { slow: -0.4, standard: -0.7, aggressive: -1.0 },
      muscle: { slow: 0.2, standard: 0.35, aggressive: 0.5 },
      recomp: { slow: 0, standard: 0, aggressive: -0.2 },
      strength: { slow: 0.1, standard: 0.2, aggressive: 0.3 },
      maintain: { slow: 0, standard: 0, aggressive: 0 }
    };
    var t = tables[goalType] || tables.recomp;
    return t[pace] != null ? t[pace] : null;
  }

  // ---- Onboarding -------------------------------------------------------
  function renderOnboarding(state) {
    return '<div class="onboard">' +
      '<div class="onboard-hero"><div class="big">🏋️</div><h1>Your science-based coach</h1>' +
      '<p class="muted">Tell me about you and your goal. I\'ll build a specific training + nutrition plan, then adapt it automatically from your data — like having a coach in your pocket.</p></div>' +
      '<form data-onboard="1" class="grid-form card">' +
      '<h2>About you</h2>' +
      field('name', 'Name', 'text', '') +
      selectField('units', 'Units', 'metric', [['metric', 'Metric (kg/cm)'], ['imperial', 'Imperial (lb/in)']]) +
      selectField('sex', 'Sex (for metabolic math)', 'male', [['male', 'Male'], ['female', 'Female']]) +
      field('birthYear', 'Birth year', 'number', '') +
      field('height', 'Height (cm or in)', 'number', '') +
      field('weight', 'Current weight (kg or lb)', 'number', '') +
      field('bodyFat', 'Body fat % (optional, sharpens the math)', 'number', '') +
      field('waist', 'Waist (optional)', 'number', '') +
      selectField('activityLevel', 'Daily activity outside training', 'moderate', [['sedentary', 'Sedentary (desk)'], ['light', 'Lightly active'], ['moderate', 'Moderately active'], ['active', 'Very active'], ['athlete', 'On feet all day / labor']]) +
      '<h2>Your goal</h2>' +
      selectField('type', 'Primary goal', 'recomp', [['fatloss', 'Lose fat'], ['muscle', 'Build muscle'], ['recomp', 'Recomposition (lose fat + build)'], ['strength', 'Get stronger'], ['maintain', 'Maintain']]) +
      field('targetWeight', 'Goal weight (optional)', 'number', '') +
      selectField('pace', 'How fast?', 'auto', [['auto', 'Recommended for my goal'], ['slow', 'Relaxed'], ['standard', 'Standard'], ['aggressive', 'Aggressive']]) +
      selectField('dietApproach', 'Diet style', 'balanced', [['balanced', 'Balanced'], ['lowcarb', 'Lower carb'], ['highcarb', 'Higher carb (performance)'], ['keto', 'Keto']]) +
      '<h2>Training</h2>' +
      selectField('experience', 'Training experience', 'beginner', [['beginner', 'Beginner (<1 yr)'], ['intermediate', 'Intermediate (1–3 yr)'], ['advanced', 'Advanced (3+ yr)']]) +
      selectField('trainingDaysPerWeek', 'Days per week you can train', '3', [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]) +
      selectField('equipment', 'Equipment', 'full_gym', [['full_gym', 'Full gym'], ['barbell_home', 'Home barbell'], ['home_dumbbells', 'Dumbbells only'], ['bodyweight', 'Bodyweight only']]) +
      '<button class="btn primary block" type="submit">Build my plan →</button>' +
      '</form>' +
      '<p class="muted small center">100% private — your data never leaves this device.</p>' +
      '</div>';
  }

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
      b.addEventListener('click', function () { openLogModal(b.getAttribute('data-log')); });
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

    // diary
    root.querySelectorAll('[data-add-food]').forEach(function (b) {
      b.addEventListener('click', function () { openAddFood(b.getAttribute('data-add-food')); });
    });
    root.querySelectorAll('[data-del-food]').forEach(function (b) {
      b.addEventListener('click', function () { S.removeFood(b.getAttribute('data-del-food')); toast('Removed.'); });
    });
    root.querySelectorAll('[data-diary-day]').forEach(function (b) {
      b.addEventListener('click', function () {
        var delta = parseInt(b.getAttribute('data-diary-day'), 10);
        var d = new Date((diaryDate || S.todayISO()) + 'T00:00:00'); d.setDate(d.getDate() + delta);
        var next = d.toISOString().slice(0, 10);
        if (next > S.todayISO()) return;
        diaryDate = next === S.todayISO() ? null : next;
        renderApp();
      });
    });

    // check-in
    var apply = root.querySelector('[data-apply-checkin]');
    if (apply) apply.addEventListener('click', applyCheckIn);

    var liftSel = root.querySelector('[data-lift-select]');
    if (liftSel) liftSel.addEventListener('change', function () { window.__progLift = liftSel.value; renderApp(); });

    var exp = root.querySelector('[data-export]');
    if (exp) exp.addEventListener('click', onExport);
    var imp = root.querySelector('[data-import]');
    if (imp) imp.addEventListener('change', onImport);
    var rst = root.querySelector('[data-reset]');
    if (rst) rst.addEventListener('click', onReset);

    root.querySelectorAll('[data-del-custom]').forEach(function (b) {
      b.addEventListener('click', function () { S.removeCustomFood(b.getAttribute('data-del-custom')); toast('Deleted.'); });
    });

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
      st.settings.activityLevel = d.activityLevel || 'moderate';
      st.profile.name = d.name || '';
      st.profile.sex = d.sex || 'male';
      st.profile.birthYear = num(d.birthYear);
      var imp = st.settings.units === 'imperial';
      st.profile.heightCm = d.height ? (imp ? num(d.height) * 2.54 : num(d.height)) : null;
      st.goals.type = d.type;
      st.goals.experience = d.experience;
      st.goals.trainingDaysPerWeek = parseInt(d.trainingDaysPerWeek, 10);
      st.goals.equipment = d.equipment;
      st.goals.dietApproach = d.dietApproach || 'balanced';
      st.goals.targetWeightKg = d.targetWeight ? (imp ? num(d.targetWeight) / 2.20462 : num(d.targetWeight)) : null;
      st.goals.weeklyRatePct = paceToRatePct(d.type, d.pace);
      st.onboarded = true;
      st.coach.mesocycleStart = S.todayISO();
      var w = num(d.weight);
      if (w != null) {
        var wkg = imp ? w / 2.20462 : w;
        st.logs.body.push({ id: S.uid(), date: S.todayISO(), weightKg: wkg, bodyFatPct: num(d.bodyFat), waistCm: d.waist ? (imp ? num(d.waist) * 2.54 : num(d.waist)) : null });
      }
      st.program = window.Training.generateProgram(st);
    });
    // Build the initial locked nutrition program from the fresh profile.
    var state = S.get();
    var trend = window.Analytics.weightTrend(state);
    S.setNutritionProgram(X.buildProgram(state, trend, { startDate: S.todayISO(), weekIndex: 0 }));
    currentView = 'dashboard'; location.hash = 'dashboard';
    toast('Your plan is ready. Welcome! 💪');
  }

  function onSettingsSubmit(kind, f) {
    var d = readForm(f);
    var rebuildNutrition = false;
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
        st.goals.dietApproach = d.dietApproach || 'balanced';
        st.goals.targetWeightKg = d.targetWeight ? dispToKg(num(d.targetWeight)) : null;
        st.goals.weeklyRatePct = paceToRatePct(d.type, d.pace);
        st.program = window.Training.generateProgram(st);
        st.coach.mesocycleStart = S.todayISO();
        rebuildNutrition = true;
      } else if (kind === 'prefs') {
        st.settings.units = d.units;
        st.settings.activityLevel = d.activityLevel;
      } else if (kind === 'ai') {
        st.settings.ai.enabled = !!d.enabled;
        st.settings.ai.model = d.model;
        st.settings.ai.apiKey = d.apiKey || '';
      }
    });
    if (rebuildNutrition) {
      var state = S.get();
      var trend = window.Analytics.weightTrend(state);
      S.setNutritionProgram(X.buildProgram(state, trend, { startDate: S.todayISO(), weekIndex: 0 }));
    }
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
      S.reset(); workoutDraft = null; diaryDate = null; currentView = 'dashboard'; location.hash = '';
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

  // ---- quick-log modals (weight & recovery) -----------------------------
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
    addFoodState = null;
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

  function shortDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  // ---- service worker ---------------------------------------------------
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
