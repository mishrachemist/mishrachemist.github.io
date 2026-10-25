const CACHE_NAME = 'sms-reports-cache-v8';
const LEGACY_CACHE_NAMES = new Set([
  'sms-reports-v3'
]);
const CACHE_PREFIX = 'sms-reports-cache-';
const CACHEABLE_PATHS = new Set(['/', '/index.html', '/manifest.json']);
const NAV_TIMEOUT_MS = 8000;   // slow network: after this the saved copy of the page opens

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// Install: precache the app shell (straight from the network, not an old browser-cached copy).
// The page is always network-first, so a new worker can take over at once.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove only caches owned by this application. Never delete
// unrelated Cache Storage entries that may belong to another app on the origin.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) =>
            key !== CACHE_NAME &&
            (key.startsWith(CACHE_PREFIX) || LEGACY_CACHE_NAMES.has(key))
          )
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Offline answer for a same-origin request: the saved copy (ignoring ?query such as ?autofetch=1);
// for a page open, the saved index.html.
async function fromCache(req) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(req, { ignoreSearch: true }) ||
    (req.mode === 'navigate' ? (await cache.match('./index.html')) || (await cache.match('./')) : null);
  if (hit) return hit;
  return new Response('You are offline and this page is not cached.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// The page (index.html) is saved under both "/" and "/index.html", so whichever address opens the app
// next time finds the newest copy.
async function saveShell(res, path) {
  const cache = await caches.open(CACHE_NAME);
  const keys = (path === '/' || path === '/index.html') ? ['./', './index.html'] : [path];
  await Promise.all(keys.map((k) => cache.put(new Request(new URL(k, self.registration.scope).href), res.clone())));
}

const versionOf = (html) => { const m = /const APP_VERSION = "([^"]+)"/.exec(html || ''); return m ? m[1] : ''; };

// Fetch: only this site's own GET requests are handled here. Microsoft sign-in, Graph (Excel),
// Apps Script, CDN scripts etc. go straight to the network, untouched.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const requestUrl = new URL(req.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isShell = CACHEABLE_PATHS.has(requestUrl.pathname);
  const network = fetch(req);
  // Keep the worker alive until the network copy is SAVED - also when the saved copy was already shown
  // because the network was slow (before, the late copy was never saved, so an old page kept opening).
  if (isShell) {
    event.waitUntil(network.then((res) => {
      if (res && res.status === 200 && res.type === 'basic') return saveShell(res, requestUrl.pathname);
    }).catch(() => {}));
  }

  if (req.mode === 'navigate') {
    // Network first, but do not wait for ever on a weak signal.
    event.respondWith(new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve(fromCache(req)); } }, NAV_TIMEOUT_MS);
      network.then((res) => { if (!done) { done = true; clearTimeout(timer); resolve(res.clone()); } })
        .catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fromCache(req)); } });
    }));
    return;
  }
  event.respondWith(network.then((res) => res.clone()).catch(() => fromCache(req)));
});

// Messages from the page:
//  skipWaiting   - activate a waiting worker now
//  refreshShell  - (sent a little after the app opens) get the newest index.html quietly and save it as the
//                  offline copy; if it is newer than the page on screen, tell the page ("New version" bar).
self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.action === 'skipWaiting') { self.skipWaiting(); return; }
  if (d.action === 'refreshShell') {
    event.waitUntil((async () => {
      try {
        const res = await fetch(new Request(new URL('./', self.registration.scope).href, { cache: 'no-cache' }));   // 304 = no download when unchanged
        if (!res || res.status !== 200) return;
        const html = await res.clone().text();
        if (versionOf(html) === '') return;                 // not our page (error page etc.) - keep the old copy
        await saveShell(res, '/');
        const latest = versionOf(html);
        if (d.version && latest && latest !== d.version && event.source) event.source.postMessage({ type: 'sms-new-version', version: latest });
      } catch (e) { /* offline - try next time */ }
    })());
  }
});
