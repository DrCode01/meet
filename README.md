# 🏋️ Coach — a science-based personal gym app

A private, installable web app that acts as your evidence-based strength &
physique coach. You log your body, food, training and recovery; it studies the
data and **automatically adjusts your program and nutrition in a loop** — no
accounts, no server, no subscription. Everything runs in your browser and your
data never leaves your device (unless you explicitly turn on the optional AI
layer).

> This branch (`claude/gym-coach-webapp-pr6ff6`) contains the gym app at the
> repo root (`index.html`, `css/`, `js/`, `icons/`, `sw.js`). Unrelated files
> from other branches may still be present and can be ignored.

---

## What it does

- **Onboarding** collects your body metrics, goal, experience, available days
  and equipment, then builds a full training program + nutrition targets.
- **The coaching loop** (`js/engine/coach.js`) re-runs every time you log
  anything. It re-derives every metric from your current data and produces a
  prioritised list of actions plus today's plan — so the app is self-adjusting,
  not a static tracker.
- **Workout logger** shows today's session with a progression suggestion for
  each lift (read from your last session) and lets you log sets with RPE.
- **Nutrition tracker** with adaptive calorie targets and macro breakdown.
- **Progress** charts: weight trend, estimated 1RM per lift, and weekly volume
  vs. scientific landmarks.
- **Coach view** explains *why* behind every recommendation, with the science.
- **Optional AI review**: enable a Claude API key to get a natural-language
  weekly review layered on top of the engine.

---

## The science

Everything the engine does is grounded in published sports-science. Key pieces:

### Nutrition (`js/engine/nutrition.js`)
- **BMR** via **Mifflin-St Jeor**; **Katch-McArdle** when body-fat % is known
  (scales with fat-free mass, more accurate for lean/muscular people).
- **TDEE** starts from the formula but switches to **empirical TDEE** once you
  have ~10+ days of intake + weight data (maintenance = average intake − energy
  from weight change). This individualises your calories to your real
  metabolism.
- **Adaptive calories**: your goal is expressed as a % bodyweight/week rate and
  compared to your actual smoothed weight trend; targets nudge toward the goal
  rate. Fat-loss has guard-rails so calories never drop below a safe floor.
- **Protein** 1.6–2.2 g/kg (higher in a deficit to protect muscle — Morton et
  al. 2018), **fat** ≥0.5 g/kg for hormones, **carbs** fill the rest, **fiber**
  ~14 g/1000 kcal.

### Training (`js/engine/training.js` + `js/data/exercises.js`)
- **Volume landmarks** per muscle (MEV / MAV / MRV — minimum-effective /
  maximum-adaptive / maximum-recoverable weekly hard sets) from Renaissance
  Periodization guidelines. The engine tells you which muscles are under- or
  over-trained.
- **Split selection** scales with your training days (full-body → upper/lower →
  push/pull/legs) so each muscle is hit ~2×/week (Schoenfeld et al. 2016).
- **Progressive overload** via **double progression** (add reps within the
  range, then add load), with **linear progression** for beginners.
- **Autoregulation** with RPE/RIR — hypertrophy work sits at RPE 7–9.
- **Deload detection** from mesocycle timing, a fatigue score, and volume at/over
  MRV; prescribes a ~50%-volume week.

### Analytics (`js/engine/analytics.js`)
- Bodyweight reported as an **exponentially-weighted moving average** so the
  *trend*, not daily water noise, drives decisions.
- Strength tracked as **estimated 1RM (Epley)** so different rep ranges compare.
- **Fatigue score** from sleep, soreness, energy and stress.

> Educational tool, not medical advice. See a professional for pain, injury, or
> health concerns.

---

## Run it

It's a plain static app — no build step.

**Locally:**
```bash
python3 serve.py        # serves on http://localhost:8000
```
Open the printed URL. (A server is used rather than opening the file directly so
the service worker / offline install works.)

**Install to your phone:** deploy the folder to any static host (Render static
site, GitHub Pages, Netlify, Vercel, …), open the URL on your phone, and use
"Add to Home Screen". It then works offline and behaves like a native app.

**Your data:** stored in your browser's `localStorage`. Use
Settings → Export to back it up or move it to another device.

---

## Optional AI coach

Off by default and fully optional. In Settings you can enable AI reviews and
paste a Claude API key (from `console.anthropic.com`). When enabled, the app
sends a compact summary of your metrics + the engine's analysis to Claude and
shows a short conversational weekly review. The key is stored only in your
browser and is sent only to Anthropic. Leave it off to keep the app 100%
offline and free — the science engine works fully without it.

---

## Project layout

```
index.html              app shell (loads scripts in order)
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline cache)
serve.py                local static server
css/styles.css          theme-aware styles (dark default + light)
icons/                  app icons (SVG + PNG)
js/
  store.js              private localStorage data layer + event bus
  data/exercises.js     exercise library + volume landmarks
  engine/
    nutrition.js        BMR/TDEE, adaptive calories, macros
    analytics.js        weight trend, 1RM, volume, adherence, fatigue
    training.js         program generation, progression, deload
    coach.js            the loop — ties it together into insights + plan
  charts.js             tiny dependency-free SVG charts
  ai.js                 optional Claude review layer
  app.js                UI, routing, onboarding, views
```
