const CACHE_NAME = "scriptorium-v6";
const PRECACHE = [
  "./",
  "index.html",
  "login.html",
  "registar.html",
  "admin.html",
  "css/styles.css",
  "js/app.js",
  "js/supabase.js",
  "js/admin.js",
  "manifest.json",
  "assets/logo.png",
  "assets/logo.svg",
  "assets/Scriptorium.jpg",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js",
  "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We wrap it in a try-catch or map to handle individual failures if any external URL is down
      return Promise.allSettled(
        PRECACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`Precache failed for: ${url}`, err);
          });
        }),
      );
    }),
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

// Network-first with cache fallback for navigation requests (HTML)
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
          if (res && res.status === 200) {
            try {
              const parsed = new URL(req.url);
              if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                const copy = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
              }
            } catch (e) {
              // ignore non-HTTP schemes (e.g., chrome-extension://)
              console.warn("Skipping cache for non-HTTP request", req.url, e);
            }
          }
          return res;
        })
        .catch(() => {
          // Try to match the exact page request first, fallback to root/index.html
          return caches.match(req).then((cachedResponse) => {
            return (
              cachedResponse || caches.match("index.html") || caches.match("./")
            );
          });
        }),
    );
    return;
  }

  // For other requests: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          // only cache successful GET responses and HTTP(s) schemes
          if (req.method === "GET" && res && res.status === 200) {
            try {
              const parsed = new URL(req.url);
              if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                const resClone = res.clone();
                caches
                  .open(CACHE_NAME)
                  .then((cache) => cache.put(req, resClone));
              }
            } catch (e) {
              console.warn("Skipping cache for non-HTTP request", req.url, e);
            }
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
