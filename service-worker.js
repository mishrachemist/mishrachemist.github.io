const CACHE_NAME = 'sms-reports-cache-v7';
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

// Fetch: only this site's own GET requests are handled here. Microsoft sign-in, Graph (Excel),
// Apps Script, CDN scripts etc. go straight to the network, untouched.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const requestUrl = new URL(req.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isShell = CACHEABLE_PATHS.has(requestUrl.pathname);
  const network = fetch(req).then((networkRes) => {
    // Cache only the known app shell (never reports, spreadsheets or other business data).
    if (isShell && networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
      const key = new Request(requestUrl.origin + requestUrl.pathname);   // without ?query
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(key, networkRes.clone())).catch(() => {}));
    }
    return networkRes;
  });

  if (req.mode === 'navigate') {
    // Network first, but do not wait for ever on a weak signal.
    event.respondWith(new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve(fromCache(req)); } }, NAV_TIMEOUT_MS);
      network.then((res) => { if (!done) { done = true; clearTimeout(timer); resolve(res); } })
        .catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fromCache(req)); } });
    }));
    return;
  }
  event.respondWith(network.catch(() => fromCache(req)));
});

// Allow the app to request immediate activation of a waiting worker.
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
