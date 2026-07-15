/*
 * foods.js — offline food database + search + optional online lookup.
 *
 * The built-in list covers common whole foods and staples so the diary works
 * fully offline. Nutrients are per 100 g (or per 100 ml for drinks). Each food
 * carries sensible serving sizes so you log "1 cup" or "1 egg", not grams.
 *
 * When online, you can also search Open Food Facts (a free, open, keyless
 * database of ~3M packaged products) and look up barcodes — results are
 * normalised into the same shape. Nothing about you is sent; only the search
 * text or barcode you type.
 */
(function () {
  'use strict';

  // f(id, name, group, kcal, protein, carbs, fat, fiber, servings)
  // macros are per 100 g/ml. servings: [[label, grams], ...]
  function f(id, name, group, kcal, p, c, ft, fib, servings) {
    return {
      id: 'db:' + id, name: name, group: group, source: 'builtin',
      kcal: kcal, protein: p, carbs: c, fat: ft, fiber: fib || 0,
      servings: (servings || []).map(function (s) { return { label: s[0], g: s[1] }; })
    };
  }

  var FOODS = [
    // ---- Protein: meat, poultry, fish, eggs -----------------------------
    f('chicken_breast', 'Chicken breast, cooked', 'Protein', 165, 31, 0, 3.6, 0, [['1 breast (170 g)', 170], ['100 g', 100]]),
    f('chicken_thigh', 'Chicken thigh, cooked', 'Protein', 209, 26, 0, 10.9, 0, [['1 thigh (110 g)', 110], ['100 g', 100]]),
    f('ground_beef_90', 'Ground beef 90/10, cooked', 'Protein', 176, 26, 0, 8, 0, [['100 g', 100], ['1 patty (85 g)', 85]]),
    f('ground_beef_80', 'Ground beef 80/20, cooked', 'Protein', 254, 25, 0, 17, 0, [['100 g', 100], ['1 patty (85 g)', 85]]),
    f('steak_sirloin', 'Sirloin steak, cooked', 'Protein', 212, 30, 0, 10, 0, [['100 g', 100], ['1 steak (200 g)', 200]]),
    f('pork_loin', 'Pork loin, cooked', 'Protein', 242, 27, 0, 14, 0, [['100 g', 100]]),
    f('bacon', 'Bacon, cooked', 'Protein', 541, 37, 1.4, 42, 0, [['1 slice (10 g)', 10], ['100 g', 100]]),
    f('salmon', 'Salmon, cooked', 'Protein', 208, 22, 0, 13, 0, [['1 fillet (170 g)', 170], ['100 g', 100]]),
    f('tuna_canned', 'Tuna, canned in water', 'Protein', 116, 26, 0, 1, 0, [['1 can (140 g)', 140], ['100 g', 100]]),
    f('shrimp', 'Shrimp, cooked', 'Protein', 99, 24, 0.2, 0.3, 0, [['100 g', 100]]),
    f('cod', 'Cod, cooked', 'Protein', 105, 23, 0, 0.9, 0, [['1 fillet (150 g)', 150], ['100 g', 100]]),
    f('egg', 'Egg, whole', 'Protein', 143, 13, 0.7, 9.5, 0, [['1 large egg (50 g)', 50], ['100 g', 100]]),
    f('egg_white', 'Egg white', 'Protein', 52, 11, 0.7, 0.2, 0, [['1 white (33 g)', 33], ['100 g', 100]]),
    f('turkey_breast', 'Turkey breast, cooked', 'Protein', 135, 30, 0, 1, 0, [['100 g', 100]]),
    f('tofu_firm', 'Tofu, firm', 'Protein', 144, 17, 3, 9, 2, [['100 g', 100], ['1/2 block (126 g)', 126]]),
    f('tempeh', 'Tempeh', 'Protein', 192, 20, 8, 11, 0, [['100 g', 100]]),
    f('seitan', 'Seitan', 'Protein', 141, 25, 4, 2, 0, [['100 g', 100]]),

    // ---- Dairy ----------------------------------------------------------
    f('milk_whole', 'Milk, whole', 'Dairy', 61, 3.2, 4.8, 3.3, 0, [['1 cup (240 ml)', 240], ['100 ml', 100]]),
    f('milk_skim', 'Milk, skim', 'Dairy', 34, 3.4, 5, 0.1, 0, [['1 cup (240 ml)', 240], ['100 ml', 100]]),
    f('greek_yogurt', 'Greek yogurt, plain nonfat', 'Dairy', 59, 10, 3.6, 0.4, 0, [['1 cup (170 g)', 170], ['100 g', 100]]),
    f('yogurt_whole', 'Yogurt, plain whole milk', 'Dairy', 61, 3.5, 4.7, 3.3, 0, [['1 cup (245 g)', 245], ['100 g', 100]]),
    f('cottage_cheese', 'Cottage cheese, low-fat', 'Dairy', 72, 12, 3, 1, 0, [['1/2 cup (113 g)', 113], ['100 g', 100]]),
    f('cheddar', 'Cheddar cheese', 'Dairy', 403, 25, 1.3, 33, 0, [['1 slice (28 g)', 28], ['100 g', 100]]),
    f('mozzarella', 'Mozzarella, part-skim', 'Dairy', 254, 24, 2.8, 16, 0, [['1 oz (28 g)', 28], ['100 g', 100]]),
    f('butter', 'Butter', 'Dairy', 717, 0.9, 0.1, 81, 0, [['1 tbsp (14 g)', 14], ['1 tsp (5 g)', 5]]),
    f('whey_protein', 'Whey protein powder', 'Dairy', 400, 80, 8, 6, 0, [['1 scoop (30 g)', 30], ['100 g', 100]]),

    // ---- Grains & starches ---------------------------------------------
    f('rice_white', 'White rice, cooked', 'Grains', 130, 2.7, 28, 0.3, 0.4, [['1 cup (158 g)', 158], ['100 g', 100]]),
    f('rice_brown', 'Brown rice, cooked', 'Grains', 123, 2.7, 26, 1, 1.6, [['1 cup (195 g)', 195], ['100 g', 100]]),
    f('oats', 'Oats, dry', 'Grains', 389, 17, 66, 7, 11, [['1/2 cup (40 g)', 40], ['100 g', 100]]),
    f('bread_white', 'White bread', 'Grains', 265, 9, 49, 3.2, 2.7, [['1 slice (28 g)', 28], ['100 g', 100]]),
    f('bread_whole', 'Whole wheat bread', 'Grains', 247, 13, 41, 3.4, 7, [['1 slice (32 g)', 32], ['100 g', 100]]),
    f('pasta', 'Pasta, cooked', 'Grains', 158, 5.8, 31, 0.9, 1.8, [['1 cup (140 g)', 140], ['100 g', 100]]),
    f('potato', 'Potato, baked', 'Grains', 93, 2.5, 21, 0.1, 2.2, [['1 medium (173 g)', 173], ['100 g', 100]]),
    f('sweet_potato', 'Sweet potato, baked', 'Grains', 90, 2, 21, 0.2, 3.3, [['1 medium (150 g)', 150], ['100 g', 100]]),
    f('quinoa', 'Quinoa, cooked', 'Grains', 120, 4.4, 21, 1.9, 2.8, [['1 cup (185 g)', 185], ['100 g', 100]]),
    f('tortilla', 'Flour tortilla', 'Grains', 306, 8, 51, 7, 3, [['1 tortilla (45 g)', 45], ['100 g', 100]]),
    f('bagel', 'Bagel, plain', 'Grains', 250, 10, 49, 1.5, 2, [['1 bagel (95 g)', 95], ['100 g', 100]]),
    f('cereal', 'Corn flakes cereal', 'Grains', 357, 7, 84, 0.4, 3, [['1 cup (28 g)', 28], ['100 g', 100]]),

    // ---- Legumes --------------------------------------------------------
    f('black_beans', 'Black beans, cooked', 'Legumes', 132, 8.9, 24, 0.5, 8.7, [['1 cup (172 g)', 172], ['100 g', 100]]),
    f('chickpeas', 'Chickpeas, cooked', 'Legumes', 164, 8.9, 27, 2.6, 7.6, [['1 cup (164 g)', 164], ['100 g', 100]]),
    f('lentils', 'Lentils, cooked', 'Legumes', 116, 9, 20, 0.4, 7.9, [['1 cup (198 g)', 198], ['100 g', 100]]),
    f('kidney_beans', 'Kidney beans, cooked', 'Legumes', 127, 8.7, 23, 0.5, 6.4, [['1 cup (177 g)', 177], ['100 g', 100]]),
    f('edamame', 'Edamame, cooked', 'Legumes', 121, 12, 9, 5, 5, [['1 cup (155 g)', 155], ['100 g', 100]]),
    f('peanut_butter', 'Peanut butter', 'Legumes', 588, 25, 20, 50, 6, [['1 tbsp (16 g)', 16], ['2 tbsp (32 g)', 32]]),
    f('hummus', 'Hummus', 'Legumes', 166, 8, 14, 10, 6, [['2 tbsp (30 g)', 30], ['100 g', 100]]),

    // ---- Vegetables -----------------------------------------------------
    f('broccoli', 'Broccoli, cooked', 'Vegetables', 35, 2.4, 7, 0.4, 3.3, [['1 cup (156 g)', 156], ['100 g', 100]]),
    f('spinach', 'Spinach, raw', 'Vegetables', 23, 2.9, 3.6, 0.4, 2.2, [['1 cup (30 g)', 30], ['100 g', 100]]),
    f('broccoli_raw', 'Mixed salad greens', 'Vegetables', 20, 1.8, 3.5, 0.3, 2, [['1 cup (36 g)', 36], ['100 g', 100]]),
    f('carrot', 'Carrot, raw', 'Vegetables', 41, 0.9, 10, 0.2, 2.8, [['1 medium (61 g)', 61], ['100 g', 100]]),
    f('tomato', 'Tomato, raw', 'Vegetables', 18, 0.9, 3.9, 0.2, 1.2, [['1 medium (123 g)', 123], ['100 g', 100]]),
    f('bell_pepper', 'Bell pepper, raw', 'Vegetables', 31, 1, 6, 0.3, 2.1, [['1 medium (119 g)', 119], ['100 g', 100]]),
    f('onion', 'Onion, raw', 'Vegetables', 40, 1.1, 9.3, 0.1, 1.7, [['1/2 cup (80 g)', 80], ['100 g', 100]]),
    f('cucumber', 'Cucumber', 'Vegetables', 15, 0.7, 3.6, 0.1, 0.5, [['1 cup (104 g)', 104], ['100 g', 100]]),
    f('mushroom', 'Mushrooms, cooked', 'Vegetables', 28, 2.2, 5.3, 0.5, 2.2, [['1 cup (156 g)', 156], ['100 g', 100]]),
    f('green_beans', 'Green beans, cooked', 'Vegetables', 35, 1.9, 8, 0.3, 3.4, [['1 cup (125 g)', 125], ['100 g', 100]]),
    f('avocado', 'Avocado', 'Vegetables', 160, 2, 9, 15, 7, [['1/2 avocado (100 g)', 100], ['100 g', 100]]),

    // ---- Fruits ---------------------------------------------------------
    f('banana', 'Banana', 'Fruits', 89, 1.1, 23, 0.3, 2.6, [['1 medium (118 g)', 118], ['100 g', 100]]),
    f('apple', 'Apple', 'Fruits', 52, 0.3, 14, 0.2, 2.4, [['1 medium (182 g)', 182], ['100 g', 100]]),
    f('orange', 'Orange', 'Fruits', 47, 0.9, 12, 0.1, 2.4, [['1 medium (131 g)', 131], ['100 g', 100]]),
    f('berries', 'Mixed berries', 'Fruits', 57, 0.7, 14, 0.3, 2.4, [['1 cup (140 g)', 140], ['100 g', 100]]),
    f('strawberry', 'Strawberries', 'Fruits', 32, 0.7, 7.7, 0.3, 2, [['1 cup (152 g)', 152], ['100 g', 100]]),
    f('blueberry', 'Blueberries', 'Fruits', 57, 0.7, 14, 0.3, 2.4, [['1 cup (148 g)', 148], ['100 g', 100]]),
    f('grapes', 'Grapes', 'Fruits', 69, 0.7, 18, 0.2, 0.9, [['1 cup (151 g)', 151], ['100 g', 100]]),
    f('pineapple', 'Pineapple', 'Fruits', 50, 0.5, 13, 0.1, 1.4, [['1 cup (165 g)', 165], ['100 g', 100]]),
    f('mango', 'Mango', 'Fruits', 60, 0.8, 15, 0.4, 1.6, [['1 cup (165 g)', 165], ['100 g', 100]]),
    f('dates', 'Dates, pitted', 'Fruits', 282, 2.5, 75, 0.4, 8, [['1 date (24 g)', 24], ['100 g', 100]]),

    // ---- Nuts, seeds, fats ---------------------------------------------
    f('almonds', 'Almonds', 'Fats', 579, 21, 22, 50, 12, [['1 oz (28 g)', 28], ['100 g', 100]]),
    f('walnuts', 'Walnuts', 'Fats', 654, 15, 14, 65, 7, [['1 oz (28 g)', 28], ['100 g', 100]]),
    f('cashews', 'Cashews', 'Fats', 553, 18, 30, 44, 3.3, [['1 oz (28 g)', 28], ['100 g', 100]]),
    f('chia', 'Chia seeds', 'Fats', 486, 17, 42, 31, 34, [['1 tbsp (12 g)', 12], ['100 g', 100]]),
    f('olive_oil', 'Olive oil', 'Fats', 884, 0, 0, 100, 0, [['1 tbsp (14 g)', 14], ['1 tsp (5 g)', 5]]),
    f('coconut_oil', 'Coconut oil', 'Fats', 862, 0, 0, 100, 0, [['1 tbsp (14 g)', 14], ['1 tsp (5 g)', 5]]),

    // ---- Snacks, sweets, misc ------------------------------------------
    f('dark_chocolate', 'Dark chocolate 70%', 'Snacks', 598, 7.8, 46, 43, 11, [['1 oz (28 g)', 28], ['100 g', 100]]),
    f('protein_bar', 'Protein bar', 'Snacks', 350, 30, 35, 10, 8, [['1 bar (60 g)', 60], ['100 g', 100]]),
    f('chips', 'Potato chips', 'Snacks', 536, 7, 53, 34, 4.8, [['1 oz (28 g)', 28], ['100 g', 100]]),
    f('ice_cream', 'Ice cream, vanilla', 'Snacks', 207, 3.5, 24, 11, 0.7, [['1/2 cup (66 g)', 66], ['100 g', 100]]),
    f('honey', 'Honey', 'Snacks', 304, 0.3, 82, 0, 0.2, [['1 tbsp (21 g)', 21], ['1 tsp (7 g)', 7]]),
    f('olive', 'Olives', 'Snacks', 115, 0.8, 6, 11, 3.2, [['5 olives (17 g)', 17], ['100 g', 100]]),

    // ---- Beverages ------------------------------------------------------
    f('orange_juice', 'Orange juice', 'Beverages', 45, 0.7, 10, 0.2, 0.2, [['1 cup (248 ml)', 248], ['100 ml', 100]]),
    f('coffee_black', 'Coffee, black', 'Beverages', 1, 0.1, 0, 0, 0, [['1 cup (240 ml)', 240], ['100 ml', 100]]),
    f('soda', 'Cola soda', 'Beverages', 42, 0, 11, 0, 0, [['1 can (355 ml)', 355], ['100 ml', 100]]),
    f('beer', 'Beer', 'Beverages', 43, 0.5, 3.6, 0, 0, [['1 can (355 ml)', 355], ['100 ml', 100]]),
    f('wine', 'Wine, red', 'Beverages', 85, 0.1, 2.6, 0, 0, [['1 glass (147 ml)', 147], ['100 ml', 100]]),
    f('sports_drink', 'Sports drink', 'Beverages', 26, 0, 6, 0, 0, [['1 bottle (500 ml)', 500], ['100 ml', 100]]),

    // ---- Fast food / prepared ------------------------------------------
    f('pizza', 'Cheese pizza', 'Prepared', 266, 11, 33, 10, 2.3, [['1 slice (107 g)', 107], ['100 g', 100]]),
    f('burger', 'Cheeseburger', 'Prepared', 254, 13, 25, 12, 1.5, [['1 burger (115 g)', 115], ['100 g', 100]]),
    f('fries', 'French fries', 'Prepared', 312, 3.4, 41, 15, 3.8, [['medium (117 g)', 117], ['100 g', 100]]),
    f('sushi_roll', 'Sushi roll', 'Prepared', 150, 5.8, 28, 1.5, 2, [['1 roll (150 g)', 150], ['100 g', 100]]),
    f('sandwich', 'Turkey sandwich', 'Prepared', 220, 14, 28, 6, 3, [['1 sandwich (200 g)', 200], ['100 g', 100]])
  ];

  // ---- search -----------------------------------------------------------
  function tokenize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean); }

  function scoreMatch(name, terms) {
    var lower = name.toLowerCase();
    var score = 0;
    terms.forEach(function (t) {
      var idx = lower.indexOf(t);
      if (idx < 0) { score -= 5; return; }
      score += 3;
      if (idx === 0) score += 3;                 // starts with term
      else if (lower[idx - 1] === ' ') score += 2; // word boundary
    });
    return score;
  }

  // Search built-in DB + user custom foods. Returns ranked array.
  function search(query, customFoods) {
    var terms = tokenize(query);
    if (!terms.length) return [];
    var pool = (customFoods || []).map(function (c) {
      return Object.assign({ source: 'custom' }, c);
    }).concat(FOODS);
    return pool
      .map(function (food) { return { food: food, s: scoreMatch(food.name + ' ' + (food.brand || ''), terms) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 30)
      .map(function (r) { return r.food; });
  }

  // Macros for a given portion (grams). Custom "per serving" foods store their
  // numbers already scaled to one serving with servingG defining the grams.
  function portion(food, grams) {
    var factor = grams / 100;
    return {
      kcal: Math.round((food.kcal || 0) * factor),
      protein: r1((food.protein || 0) * factor),
      carbs: r1((food.carbs || 0) * factor),
      fat: r1((food.fat || 0) * factor),
      fiber: r1((food.fiber || 0) * factor)
    };
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  function defaultServing(food) {
    if (food.servings && food.servings.length) return food.servings[0];
    return { label: '100 g', g: 100 };
  }

  // ---- Open Food Facts (optional, online) -------------------------------
  // Normalise an OFF product to our food shape (per 100 g/ml).
  function fromOFF(prod) {
    var n = prod.nutriments || {};
    var kcal = n['energy-kcal_100g'];
    if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;
    if (kcal == null) return null;
    var name = prod.product_name || prod.generic_name || '';
    if (!name) return null;
    var qty = prod.serving_quantity ? parseFloat(prod.serving_quantity) : null;
    var servings = [['100 g', 100]];
    if (qty && qty > 0) servings.unshift([(prod.serving_size || (qty + ' g')), qty]);
    return {
      id: 'off:' + (prod.code || name), name: name, brand: prod.brands || '',
      group: 'Packaged', source: 'off',
      kcal: Math.round(kcal),
      protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g),
      fat: num(n.fat_100g), fiber: num(n.fiber_100g),
      servings: servings.map(function (s) { return { label: s[0], g: s[1] }; })
    };
  }
  function num(x) { var v = parseFloat(x); return isNaN(v) ? 0 : Math.round(v * 10) / 10; }

  function searchOnline(query) {
    if (!navigator.onLine) return Promise.reject(new Error('offline'));
    var url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' +
      encodeURIComponent(query) + '&search_simple=1&action=process&json=1&page_size=25' +
      '&fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments';
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      return (d.products || []).map(fromOFF).filter(Boolean);
    });
  }

  function lookupBarcode(code) {
    if (!navigator.onLine) return Promise.reject(new Error('offline'));
    var url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) +
      '.json?fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments';
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (d.status !== 1 || !d.product) return null;
      return fromOFF(d.product);
    });
  }

  window.Foods = {
    FOODS: FOODS,
    search: search,
    searchOnline: searchOnline,
    lookupBarcode: lookupBarcode,
    portion: portion,
    defaultServing: defaultServing
  };
})();
