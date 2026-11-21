const CACHE_NAME = 'sms-reports-cache-v9';
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

// The app's code is in parts: index.html loads js/*.js and css/*.css as "<file>?v=<content hash>".
// A part's address never changes its content, so a saved part is used as it is (no network).
const partsOf = (html) => [...new Set([...(html || '').matchAll(/(?:src|href)="((?:js|css)\/[\w.-]+\.(?:js|css)\?v=[0-9a-f]+)"/g)].map((m) => m[1]))];
const isPart = (url) => /^\/(js|css)\//.test(url.pathname) && /[?&]v=/.test(url.search);
// Save every part a page needs (only the missing ones are downloaded). true = all saved.
async function cacheParts(cache, html) {
  const parts = partsOf(html).map((p) => new URL(p, self.registration.scope).href);
  const res = await Promise.all(parts.map(async (u) => {
    if (await cache.match(u)) return true;
    try { const r = await fetch(new Request(u, { cache: 'no-cache' })); if (r && r.status === 200) { await cache.put(u, r); return true; } } catch (e) {}
    return false;
  }));
  return res.every(Boolean);
}
// Remove saved parts that the saved page no longer uses (old ?v= copies).
async function pruneParts(cache, html) {
  const keep = new Set(partsOf(html).map((p) => new URL(p, self.registration.scope).href));
  for (const req of await cache.keys()) { const u = new URL(req.url); if (isPart(u) && !keep.has(u.href)) await cache.delete(req); }
}

// Install: precache the app shell and all its parts (straight from the network, not an old browser-cached copy).
// The page is always network-first, so a new worker can take over at once.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const res = await fetch(new Request('./index.html', { cache: 'reload' }));
    const html = await res.clone().text();
    await cacheParts(cache, html);
    await saveShell(res, '/');
    await cache.add(new Request('./manifest.json', { cache: 'reload' })).catch(() => {});
    await self.skipWaiting();
  })());
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

  // Pictures moved out of the page (img/…, name = content hash) and libraries (vendor/<name-version>/…): a file never changes, saved copy first
  if (requestUrl.pathname.startsWith('/img/') || requestUrl.pathname.startsWith('/vendor/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') event.waitUntil(cache.put(req, res.clone()));
      return res;
    })().catch(() => fromCache(req)));
    return;
  }

  // App code parts (js/…, css/… with ?v=hash): the saved copy, else the network (then saved)
  if (isPart(requestUrl)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') event.waitUntil(cache.put(req, res.clone()));
      return res;
    })().catch(() => fromCache(req)));
    return;
  }

  // Data files taken out of the page (data/…, e.g. the SOP / WI list): the saved copy at once, refreshed in the background
  if (requestUrl.pathname.startsWith('/data/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then((res) => { if (res && res.status === 200 && res.type === 'basic') { const c = res.clone(); event.waitUntil(cache.put(req, c)); } return res; });
      if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    })().catch(() => fromCache(req)));
    return;
  }

  const isShell = CACHEABLE_PATHS.has(requestUrl.pathname);
  const network = fetch(req);
  // Keep the worker alive until the network copy is SAVED - also when the saved copy was already shown
  // because the network was slow (before, the late copy was never saved, so an old page kept opening).
  if (isShell) {
    event.waitUntil(network.then(async (res) => {
      if (!(res && res.status === 200 && res.type === 'basic')) return;
      const copy = res.clone(); const html = await copy.text();
      if (versionOf(html) === '') return;
      const cache = await caches.open(CACHE_NAME);
      if (await cacheParts(cache, html)) await saveShell(res, requestUrl.pathname);   // a page is saved only with all its parts
    }).catch(() => {}));
  }

  if (req.mode === 'navigate' && isShell) {
    // The app page is ~6 MB: open the saved copy at once (no waiting for the download on every open/refresh).
    // The network copy above is still fetched and saved in the background (304 when unchanged), and the page's
    // "refreshShell" message shows the "New version available - tap to update" bar when it is newer.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || (await cache.match('./'));
      if (hit) return hit;
      try { return (await network).clone(); } catch (e) { return fromCache(req); }
    })());
    return;
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
        const cache = await caches.open(CACHE_NAME);
        if (!(await cacheParts(cache, html))) return;      // parts not all downloaded: keep the old page (it still has its own parts)
        await saveShell(res, '/');
        await pruneParts(cache, html);
        const latest = versionOf(html);
        if (d.version && latest && latest !== d.version && event.source) event.source.postMessage({ type: 'sms-new-version', version: latest });
      } catch (e) { /* offline - try next time */ }
    })());
  }
});

// ---- notification from the cloud WhatsApp sync ----
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Moltrix', {
    body: d.body || '', tag: d.tag || 'moltrix-sync', renotify: true,
    icon: 'icons/icon-192.png', data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if (c.url.startsWith(self.registration.scope)) { try { await c.focus(); return; } catch (e) {} } }
    await clients.openWindow(url);
  })());
});
