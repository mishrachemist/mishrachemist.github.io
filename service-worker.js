// SMS Reports service worker.
// Page (index.html) and manifest: the saved copy opens INSTANTLY; at the same
// time the newest version is downloaded in the background. If it is different
// from the saved one, it is saved and the open page is told, which shows a
// small "New version - Update" button (one tap = reload, again instant).
// No internet: the saved copy keeps working.
// Live data (Excel / Graph API, Microsoft sign-in, CDN scripts) is never touched.
const CACHE_NAME = "sms-reports-v3";
const PRECACHE_URLS = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: "reload" }))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPageRequest(req, url) {
  return req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("manifest.json");
}

// "Same file?" - GitHub Pages sends ETag / Last-Modified / Content-Length.
function sameVersion(a, b) {
  if (!a || !b) return false;
  const h = (r, k) => r.headers.get(k) || "";
  if (h(a, "etag") && h(b, "etag")) return h(a, "etag") === h(b, "etag");
  return h(a, "last-modified") === h(b, "last-modified") && h(a, "content-length") === h(b, "content-length");
}

async function refreshInBackground(req, cachedRes, isNavigate) {
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    if (!fresh || fresh.status !== 200) return;
    const cache = await caches.open(CACHE_NAME);
    if (sameVersion(cachedRes, fresh)) return;
    await cache.put(req, fresh.clone());
    if (isNavigate) await cache.put("./index.html", fresh.clone());
    if (cachedRes && isNavigate) {
      const all = await self.clients.matchAll({ type: "window" });
      all.forEach((c) => c.postMessage({ type: "sms-new-version" }));
    }
  } catch (e) { /* offline - keep the saved copy */ }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Graph, sign-in, CDN: straight to the network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const page = isPageRequest(req, url);
    const cached = await cache.match(req, { ignoreSearch: page }) ||
                   (req.mode === "navigate" ? await cache.match("./index.html") : null);
    const update = refreshInBackground(req, cached, req.mode === "navigate");
    event.waitUntil(update);
    if (cached) return cached;                   // instant
    const net = await fetch(req).catch(() => null);
    if (net) return net;
    return new Response("Offline", { status: 503 });
  })());
});
