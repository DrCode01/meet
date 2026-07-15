/*
 * ai.js — OPTIONAL AI coach layer (off by default).
 *
 * The science engine is the always-on core. This layer only runs when you
 * explicitly enable AI in Settings and paste a Claude API key. When enabled it
 * sends a compact summary of your metrics + the engine's own analysis to
 * Claude and asks for a short, natural-language review on top.
 *
 * PRIVACY: nothing here runs unless settings.ai.enabled is true and a key is
 * present. Your key is stored only in this browser's localStorage and is sent
 * only to Anthropic's API. No third party ever sees your data.
 *
 * This calls the Messages API directly from the browser using the documented
 * `anthropic-dangerous-direct-browser-access` header.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var API_VERSION = '2023-06-01';

  var SYSTEM_PROMPT = [
    'You are an evidence-based strength & physique coach embedded in a personal',
    'gym app. You receive the user\'s current metrics and the app\'s own',
    'rules-engine analysis (TDEE, macro targets, weekly training volume vs',
    'MEV/MAV/MRV landmarks, progression, recovery/fatigue).',
    '',
    'Write a short, direct weekly review (max ~200 words). Structure:',
    '1) One-line assessment of how things are going.',
    '2) The 1-3 highest-impact changes for the coming week, each with a brief',
    '   physiological reason.',
    '3) One thing they are doing well, to reinforce it.',
    'Be specific and reference their numbers. Do not invent data you were not',
    'given. Do not give medical advice; suggest seeing a professional for pain,',
    'injury, or health concerns. No preamble, no markdown headers.'
  ].join('\n');

  function isEnabled(state) {
    var ai = state.settings.ai || {};
    return !!(ai.enabled && ai.apiKey && ai.apiKey.trim());
  }

  // Build a compact, privacy-minimal payload from the engine analysis.
  function buildSummary(state, analysis) {
    var m = analysis.metrics;
    return {
      profile: {
        sex: state.profile.sex,
        age: window.Nutrition.age(state.profile),
        heightCm: state.profile.heightCm
      },
      goal: state.goals,
      body: m.body,
      weightTrend: m.trend ? {
        currentKg: m.trend.currentKg,
        rateKgPerWeek: m.trend.rateKgPerWeek,
        dataPoints: m.trend.count
      } : null,
      nutritionTargets: m.targets ? {
        kcal: m.targets.kcal, protein: m.targets.protein,
        carbs: m.targets.carbs, fat: m.targets.fat,
        tdee: m.targets.tdee.value, tdeeMethod: m.targets.tdee.method,
        goalRateKgPerWeek: m.targets.kgPerWeek
      } : null,
      weeklyVolume: m.weeklyVol,
      volumeStatus: m.volGuidance.map(function (g) {
        return { muscle: g.label, sets: g.sets, status: g.status, mev: g.landmarks.mev, mrv: g.landmarks.mrv };
      }),
      adherence: m.adherence,
      recovery: m.fatigue,
      deloadRecommended: m.deload ? m.deload.recommend : false,
      engineInsights: (analysis.insights || []).slice(0, 6).map(function (i) {
        return { priority: i.priority, title: i.title, detail: i.detail };
      })
    };
  }

  function review(state, analysis) {
    if (!isEnabled(state)) {
      return Promise.reject(new Error('AI coach is not enabled. Turn it on in Settings and add a Claude API key.'));
    }
    var ai = state.settings.ai;
    var summary = buildSummary(state, analysis);
    var userMsg = 'Here is my current data and the engine analysis as JSON. Give me my weekly coaching review.\n\n' +
      JSON.stringify(summary, null, 2);

    var body = {
      model: ai.model || 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }]
    };

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ai.apiKey.trim(),
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = 'AI request failed (' + res.status + ').';
          if (res.status === 401) msg = 'Your API key was rejected (401). Check it in Settings.';
          else if (res.status === 429) msg = 'Rate limited (429). Try again shortly.';
          else {
            try { var j = JSON.parse(t); if (j.error && j.error.message) msg += ' ' + j.error.message; } catch (e) {}
          }
          throw new Error(msg);
        });
      }
      return res.json();
    }).then(function (data) {
      var text = '';
      (data.content || []).forEach(function (b) { if (b.type === 'text') text += b.text; });
      return text.trim() || 'No response text returned.';
    });
  }

  window.AICoach = { isEnabled: isEnabled, review: review };
})();
