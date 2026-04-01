const CACHE_NAME = "wine-cellar-v1";

// Next.js static assets to cache aggressively
const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname === "/icon.svg" ||
  url.pathname === "/manifest.webmanifest";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Skip non-http(s) requests and cross-origin API calls (Supabase)
  if (!url.protocol.startsWith("http")) return;

  if (isStaticAsset(url)) {
    // Cache-first for static assets
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
  } else {
    // Network-first for everything else; fall back to cache when offline
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache HTML pages for offline fallback
          if (
            res.ok &&
            res.headers.get("content-type")?.includes("text/html")
          ) {
            // clone() must be called before the response body is consumed
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
