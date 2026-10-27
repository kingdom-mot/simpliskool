/*
 * Simpliskool offline helper.
 * Keeps a copy of the teacher pages and the app's code so the register opens
 * without network. Pages are always fetched fresh when online; the copy is only
 * used when the network fails. Nothing else is cached.
 */
const PAGES = "sk-pages-v2";
const ASSETS = "sk-assets-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isTeacherPage(url, request) {
  return request.mode === "navigate" && url.origin === self.location.origin && url.pathname.startsWith("/teacher");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // App code and fonts: these files never change once built, so the saved copy is fine.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Teacher pages: network first, saved copy when offline.
  if (isTeacherPage(url, request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          return (
            (await cache.match(request)) ||
            (await cache.match(url.pathname, { ignoreSearch: true })) ||
            new Response(
              '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;padding:24px;color:#263449"><h1 style="color:#173B70">You\'re offline</h1><p>Open this page once while you have network, and it will work offline next time.</p></body>',
              { headers: { "content-type": "text/html; charset=utf-8" } },
            )
          );
        }),
    );
  }
});

// The page asks us to keep a copy of itself and the code it already loaded
// (that first load happened before this helper was running).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "keep") return;
  const same = (u) => {
    try {
      return new URL(u, self.location.origin).origin === self.location.origin;
    } catch {
      return false;
    }
  };
  const pages = (data.pages || []).filter((u) => same(u) && new URL(u, self.location.origin).pathname.startsWith("/teacher"));
  const assets = (data.assets || []).filter((u) => same(u) && new URL(u, self.location.origin).pathname.startsWith("/_next/static/"));
  event.waitUntil(
    Promise.all([
      caches.open(PAGES).then((cache) =>
        Promise.all(pages.map((u) => fetch(u, { credentials: "include" }).then((res) => (res.ok && !res.redirected ? cache.put(u, res) : null)).catch(() => null))),
      ),
      caches.open(ASSETS).then(async (cache) => {
        for (const u of assets) {
          if (!(await cache.match(u))) await cache.add(u).catch(() => null);
        }
      }),
    ]),
  );
});
