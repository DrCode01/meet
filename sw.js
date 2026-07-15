/* Service worker — offline-first caching for the Coach PWA.
   Bump CACHE when you ship changes so clients pick up the new files. */
var CACHE = 'gymcoach-v1';
var ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/store.js',
  'js/data/exercises.js',
  'js/engine/nutrition.js',
  'js/engine/analytics.js',
  'js/engine/training.js',
  'js/engine/coach.js',
  'js/charts.js',
  'js/ai.js',
  'js/app.js',
  'icons/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // Cache best-effort; a single missing optional asset must not fail install.
    return Promise.all(ASSETS.map(function (u) {
      return c.add(u).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Never cache or intercept the Anthropic API (AI coach) calls.
  if (url.hostname.indexOf('anthropic.com') >= 0) return;
  if (url.origin !== location.origin) return;

  // Stale-while-revalidate for same-origin app assets.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
