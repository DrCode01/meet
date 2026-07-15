# 🏋️ Coach — a science-based personal gym app (MacroFactor-style nutrition)

A private, installable web app that acts as your evidence-based strength &
physique coach. You log your body, food, training and recovery; it studies the
data and **automatically adjusts your program and nutrition in a loop** — no
accounts, no server, no subscription. Everything runs in your browser and your
data never leaves your device (unless you explicitly turn on the optional AI
layer).

The nutrition side is modelled on **MacroFactor**: a real food diary, a
**dynamic expenditure** estimate measured from your own data, and **weekly,
adherence-neutral check-ins** that recalibrate your targets automatically.

> The app lives at the repo root (`index.html`, `css/`, `js/`, `icons/`,
> `sw.js`). Unrelated files from other branches may still be present and can be
> ignored — only the app files above need to be hosted.

---

## What it does

- **Deep onboarding** collects your body metrics, body-fat %, daily activity,
  goal + *goal weight*, pace, diet approach, experience, days and equipment,
  then builds a **specific** training program **and** a locked nutrition plan.
- **Food diary** (MacroFactor-style): log individual foods per meal
  (Breakfast / Lunch / Dinner / Snacks) from a built-in offline database,
  create custom foods, quick-add calories+macros, search **Open Food Facts**
  online, and **scan barcodes** (camera where supported, else manual entry).
- **Dynamic expenditure**: your real maintenance calories are back-calculated
  from your intake and weight trend and updated continuously — see the trend
  chart in *Trends* and the check-in.
- **Weekly check-ins**: once a week the app recalculates your expenditure and
  proposes new targets to keep you on your goal rate. Adherence-neutral — it
  never scolds missed/over days, it just reads the trend and recalibrates.
- **The coaching loop** (`js/engine/coach.js`) re-runs every time you log
  anything, re-deriving every metric and producing a prioritised action list,
  today's plan, and a goal timeline (ETA to your target weight).
- **Workout logger** with a per-lift progression suggestion read from your last
  session; **Trends** charts (weight, expenditure, est. 1RM, weekly volume vs
  landmarks); **Coach view** explains the *why* with the science.
- **Optional AI review**: enable a Claude API key for a natural-language weekly
  review layered on top of the engine.

---

## The science

### Nutrition & expenditure (`js/engine/nutrition.js`, `js/engine/expenditure.js`)
- **BMR** via **Mifflin-St Jeor**; **Katch-McArdle** when body-fat % is known.
- **Dynamic expenditure** — the MacroFactor idea: over a trailing window,
  `expenditure ≈ average intake − (Δ trend-weight × 7700 kcal/kg) / days`,
  computed from your smoothed weight trend. It starts from the formula and
  switches to the data-driven value once you have ~10+ logged days, then keeps
  self-correcting as your metabolism adapts.
- **Locked weekly targets**: your calories/macros stay fixed between check-ins
  so they don't fluctuate day to day; each **check-in** recomputes them from the
  latest expenditure to hold your chosen % bodyweight/week rate, with guard-rails
  so a cut never drops below a safe floor.
- **Macros** honour your **diet approach** (balanced / low-carb / high-carb /
  keto): **protein** 1.6–2.2 g/kg (Morton et al. 2018), a **fat** floor for
  hormones, **carbs** fill the rest, **fiber** ~14 g/1000 kcal.

### Training (`js/engine/training.js` + `js/data/exercises.js`)
- **Volume landmarks** per muscle (MEV / MAV / MRV) from Renaissance
  Periodization; the engine flags under- and over-trained muscles.
- **Split selection** scales with your days so each muscle is hit ~2×/week
  (Schoenfeld et al. 2016).
- **Progressive overload** via **double progression** (linear for beginners),
  **RPE autoregulation** at 7–9, and **deload detection**.

### Analytics (`js/engine/analytics.js`)
- Bodyweight as an **exponentially-weighted moving average** (trend, not noise).
- Strength as **estimated 1RM (Epley)**; **fatigue score** from sleep,
  soreness, energy and stress.

> Educational tool, not medical advice. See a professional for pain, injury, or
> health concerns.

---

## Run it

Plain static app — no build step.

**Locally:**
```bash
python3 serve.py        # serves on http://localhost:8000
```
Open the printed URL. (A server is used so the service worker / offline install
works.)

**Host it yourself:** the app is fully static, so hosting is drag-and-drop. Two
easy options:
- **Netlify / Vercel / Cloudflare Pages:** drop the app files
  (`index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `icons/`) into
  a new site — no build settings needed.
- **GitHub Pages:** put those files on a branch and set **Settings → Pages →
  Source** to that branch; your URL will be `https://<owner>.github.io/<repo>/`.

Whichever you pick, only the static files are served — your logged data always
stays in your own browser.

**Install to your phone:** open the URL and use “Add to Home Screen.” It then
works offline like a native app.

**Your data:** stored in your browser's `localStorage`. Settings → Export backs
it up or moves it to another device. Online food search / barcode lookup send
only your search text or barcode to Open Food Facts.

---

## Optional AI coach

Off by default. In Settings you can enable AI reviews and paste a Claude API key
(from `console.anthropic.com`). When enabled, the app sends a compact summary of
your metrics + the engine's analysis to Claude and shows a short weekly review.
The key is stored only in your browser and sent only to Anthropic. Leave it off
to keep the app 100% offline and free — the engine works fully without it.

---

## Project layout

```
index.html              app shell (loads scripts in order)
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline cache)
serve.py                local static server
.github/workflows/      GitHub Pages deploy workflow
css/styles.css          theme-aware styles (dark default + light)
icons/                  app icons (SVG + PNG)
js/
  store.js              private localStorage data layer + event bus
  data/exercises.js     exercise library + volume landmarks
  data/foods.js         offline food database + search + Open Food Facts
  engine/
    nutrition.js        BMR, formula TDEE, macro split (diet approaches)
    expenditure.js      dynamic expenditure, locked targets, weekly check-ins
    analytics.js        weight trend, 1RM, volume, adherence, fatigue
    training.js         program generation, progression, deload
    coach.js            the loop — insights + today's plan + goal timeline
  charts.js             tiny dependency-free SVG charts
  ai.js                 optional Claude review layer
  app.js                UI, routing, onboarding, diary, check-in, views
```
