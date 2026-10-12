
/*
  #FrankMyMP #FrankMyChoice
  Basic PWA Service Worker
*/

const CACHE_NAME = "frank-news-static-v1";

const STATIC_FILES = [
  "/",
  "/index.html",
  "/post.html",
  "/css/style.css",
  "/js/home.js",
  "/js/post.js",
  "/js/ui.js",
  "/js/firebase.js",
  "/js/config.js",
  "/js/install.js",
  "/manifest.webmanifest",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        STATIC_FILES.map(path =>
          cache.add(path)
        )
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Do not intercept admin or API requests.

  if (
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Network-first for HTML, so news pages
  // remain as fresh as possible.

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(
            CACHE_NAME
          );

          return (
            await cache.match("/") ||
            new Response(
              "You are offline. Reconnect to view the latest news.",
              {
                headers: {
                  "Content-Type":
                    "text/plain; charset=utf-8"
                }
              }
            )
          );
        }
      })()
    );

    return;
  }

  // Use cache for static assets.

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      return fetch(request);
    })()
  );
});
