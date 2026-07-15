/*
 * exercises.js — exercise library + per-muscle weekly volume landmarks.
 *
 * Volume landmarks (MV/MEV/MAV/MRV = maintenance / minimum-effective /
 * maximum-adaptive / maximum-recoverable weekly hard sets) are drawn from
 * Renaissance Periodization training-volume guidelines (Israetel et al.).
 * They are population starting points the coach personalises from your
 * recovery and progress data over time.
 */
(function () {
  'use strict';

  // Weekly hard sets per muscle group.
  var LANDMARKS = {
    chest:      { mv: 8,  mev: 10, mav: 18, mrv: 22 },
    back:       { mv: 10, mev: 12, mav: 20, mrv: 25 },
    quads:      { mv: 8,  mev: 10, mav: 18, mrv: 22 },
    hamstrings: { mv: 6,  mev: 8,  mav: 14, mrv: 18 },
    glutes:     { mv: 6,  mev: 8,  mav: 14, mrv: 18 },
    shoulders:  { mv: 8,  mev: 10, mav: 18, mrv: 22 }, // side/rear delts especially
    biceps:     { mv: 6,  mev: 8,  mav: 16, mrv: 20 },
    triceps:    { mv: 6,  mev: 8,  mav: 16, mrv: 20 },
    calves:     { mv: 6,  mev: 8,  mav: 16, mrv: 20 },
    abs:        { mv: 0,  mev: 6,  mav: 16, mrv: 25 }
  };

  var MUSCLE_LABELS = {
    chest: 'Chest', back: 'Back', quads: 'Quads', hamstrings: 'Hamstrings',
    glutes: 'Glutes', shoulders: 'Shoulders', biceps: 'Biceps',
    triceps: 'Triceps', calves: 'Calves', abs: 'Abs'
  };

  // Each exercise credits primary muscles at 1.0 set and secondary at 0.5 set
  // toward weekly volume (a common way to count fractional stimulus).
  // equip: which equipment tiers can perform it.
  // pattern: used for program balance. compound: multi-joint.
  function ex(id, name, primary, secondary, equip, pattern, compound, unit) {
    return {
      id: id, name: name,
      primary: primary || [], secondary: secondary || [],
      equip: equip, pattern: pattern, compound: !!compound,
      unit: unit || 'load' // 'load' | 'bodyweight' | 'assisted'
    };
  }

  var E = [
    // ---- Squat / quad ----
    ex('back_squat', 'Barbell Back Squat', ['quads', 'glutes'], ['hamstrings', 'abs'], ['full_gym', 'barbell_home'], 'squat', true),
    ex('front_squat', 'Front Squat', ['quads'], ['glutes', 'abs'], ['full_gym', 'barbell_home'], 'squat', true),
    ex('leg_press', 'Leg Press', ['quads', 'glutes'], ['hamstrings'], ['full_gym'], 'squat', true),
    ex('goblet_squat', 'Goblet Squat', ['quads', 'glutes'], ['abs'], ['full_gym', 'home_dumbbells'], 'squat', true),
    ex('bulgarian_split', 'Bulgarian Split Squat', ['quads', 'glutes'], ['hamstrings'], ['full_gym', 'home_dumbbells', 'bodyweight'], 'lunge', true),
    ex('walking_lunge', 'Walking Lunge', ['quads', 'glutes'], ['hamstrings'], ['full_gym', 'home_dumbbells', 'bodyweight'], 'lunge', true),
    ex('leg_extension', 'Leg Extension', ['quads'], [], ['full_gym'], 'isolation', false),

    // ---- Hinge / posterior ----
    ex('deadlift', 'Conventional Deadlift', ['hamstrings', 'glutes', 'back'], ['quads'], ['full_gym', 'barbell_home'], 'hinge', true),
    ex('rdl', 'Romanian Deadlift', ['hamstrings', 'glutes'], ['back'], ['full_gym', 'barbell_home', 'home_dumbbells'], 'hinge', true),
    ex('hip_thrust', 'Barbell Hip Thrust', ['glutes'], ['hamstrings'], ['full_gym', 'barbell_home'], 'hinge', true),
    ex('leg_curl', 'Seated/Lying Leg Curl', ['hamstrings'], [], ['full_gym'], 'isolation', false),
    ex('back_extension', 'Back Extension', ['glutes', 'hamstrings'], ['back'], ['full_gym'], 'hinge', false, 'bodyweight'),

    // ---- Horizontal push ----
    ex('bench', 'Barbell Bench Press', ['chest'], ['triceps', 'shoulders'], ['full_gym', 'barbell_home'], 'h_push', true),
    ex('incline_bench', 'Incline Barbell Bench', ['chest', 'shoulders'], ['triceps'], ['full_gym', 'barbell_home'], 'h_push', true),
    ex('db_bench', 'Dumbbell Bench Press', ['chest'], ['triceps', 'shoulders'], ['full_gym', 'home_dumbbells'], 'h_push', true),
    ex('incline_db', 'Incline Dumbbell Press', ['chest', 'shoulders'], ['triceps'], ['full_gym', 'home_dumbbells'], 'h_push', true),
    ex('pushup', 'Push-Up', ['chest'], ['triceps', 'shoulders'], ['full_gym', 'home_dumbbells', 'bodyweight'], 'h_push', true, 'bodyweight'),
    ex('cable_fly', 'Cable / Pec Fly', ['chest'], [], ['full_gym'], 'isolation', false),

    // ---- Vertical push ----
    ex('ohp', 'Overhead Press', ['shoulders'], ['triceps'], ['full_gym', 'barbell_home'], 'v_push', true),
    ex('db_ohp', 'Dumbbell Shoulder Press', ['shoulders'], ['triceps'], ['full_gym', 'home_dumbbells'], 'v_push', true),
    ex('lateral_raise', 'Lateral Raise', ['shoulders'], [], ['full_gym', 'home_dumbbells'], 'isolation', false),
    ex('rear_delt_fly', 'Rear Delt Fly', ['shoulders'], ['back'], ['full_gym', 'home_dumbbells'], 'isolation', false),

    // ---- Vertical pull ----
    ex('pullup', 'Pull-Up', ['back'], ['biceps'], ['full_gym', 'bodyweight'], 'v_pull', true, 'bodyweight'),
    ex('lat_pulldown', 'Lat Pulldown', ['back'], ['biceps'], ['full_gym'], 'v_pull', true),
    ex('assisted_pullup', 'Assisted Pull-Up', ['back'], ['biceps'], ['full_gym'], 'v_pull', true, 'assisted'),

    // ---- Horizontal pull ----
    ex('barbell_row', 'Barbell Row', ['back'], ['biceps'], ['full_gym', 'barbell_home'], 'h_pull', true),
    ex('db_row', 'One-Arm Dumbbell Row', ['back'], ['biceps'], ['full_gym', 'home_dumbbells'], 'h_pull', true),
    ex('seated_row', 'Seated Cable Row', ['back'], ['biceps'], ['full_gym'], 'h_pull', true),
    ex('face_pull', 'Face Pull', ['shoulders', 'back'], [], ['full_gym'], 'isolation', false),

    // ---- Arms ----
    ex('barbell_curl', 'Barbell Curl', ['biceps'], [], ['full_gym', 'barbell_home', 'home_dumbbells'], 'isolation', false),
    ex('db_curl', 'Dumbbell Curl', ['biceps'], [], ['full_gym', 'home_dumbbells'], 'isolation', false),
    ex('hammer_curl', 'Hammer Curl', ['biceps'], [], ['full_gym', 'home_dumbbells'], 'isolation', false),
    ex('triceps_pushdown', 'Triceps Pushdown', ['triceps'], [], ['full_gym'], 'isolation', false),
    ex('overhead_ext', 'Overhead Triceps Extension', ['triceps'], [], ['full_gym', 'home_dumbbells'], 'isolation', false),
    ex('dips', 'Dips', ['triceps', 'chest'], ['shoulders'], ['full_gym', 'bodyweight'], 'h_push', true, 'bodyweight'),

    // ---- Calves / abs ----
    ex('calf_raise', 'Standing Calf Raise', ['calves'], [], ['full_gym', 'home_dumbbells', 'bodyweight'], 'isolation', false),
    ex('hanging_leg_raise', 'Hanging Leg Raise', ['abs'], [], ['full_gym', 'bodyweight'], 'isolation', false, 'bodyweight'),
    ex('plank', 'Plank', ['abs'], [], ['full_gym', 'home_dumbbells', 'bodyweight'], 'isolation', false, 'bodyweight'),
    ex('cable_crunch', 'Cable Crunch', ['abs'], [], ['full_gym'], 'isolation', false)
  ];

  var BY_ID = {};
  E.forEach(function (e) { BY_ID[e.id] = e; });

  function get(id) { return BY_ID[id] || null; }
  function all() { return E.slice(); }
  function forEquipment(equip) {
    return E.filter(function (e) { return e.equip.indexOf(equip) >= 0; });
  }

  window.ExerciseDB = {
    LANDMARKS: LANDMARKS,
    MUSCLE_LABELS: MUSCLE_LABELS,
    MUSCLES: Object.keys(LANDMARKS),
    get: get,
    all: all,
    forEquipment: forEquipment
  };
})();
