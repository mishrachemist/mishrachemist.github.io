// SMS Reports service worker.
// Page (index.html) and manifest: NETWORK FIRST - with internet the newest
// uploaded version always opens straight away; the saved copy is used only
// when there is no internet (or the network is very slow).
// Icons and other same-site files: saved copy first, refreshed in the background.
// Live data (Excel / Graph API, Microsoft sign-in, CDN scripts) is never touched.
const CACHE_NAME = "sms-reports-v2";
const PRECACHE_URLS = ["./", "./index.html", "./manifest.json"];
const NETWORK_TIMEOUT_MS = 8000;   // after this, fall back to the saved copy

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

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await Promise.race([
      fetch(req, { cache: "no-store" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS))
    ]);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const saved = await cache.match(req, { ignoreSearch: true }) ||
                  await cache.match("./index.html");
    if (saved) return saved;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const saved = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => saved);
  return saved || fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Graph, sign-in, CDN: straight to the network
  event.respondWith(isPageRequest(req, url) ? networkFirst(req) : cacheFirst(req));
});
