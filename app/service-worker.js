const CACHE_NAME = "scriptorium-v2";
const PRECACHE = [
  "/app/index.html",
  "/app/login.html",
  "/app/css/styles.css",
  "/app/js/app.js",
  "/app/js/supabase.js",
  "/app/manifest.json",
  "/app/assets/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        }),
      ),
    ),
  );
  self.clients.claim();
});

// Network-first for navigation requests (HTML)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    req.mode === "navigate" ||
    (req.method === "GET" && req.headers.get("accept")?.includes("text/html"))
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // update cache
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put("/app/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/app/index.html")),
    );
    return;
  }

  // For other requests: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          // only cache successful GET responses
          if (req.method === "GET" && res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => null);
      return cached || networkFetch;
    }),
  );
});

// Listen for skip waiting message from the page
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
