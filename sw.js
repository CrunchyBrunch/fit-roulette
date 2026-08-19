const CACHE_NAME = "fit-roulette-v1.5.4";
const ASSET_VERSION = "1.5.4";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./context-engine.js",
  "./smart-closet.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_ASSETS.map((asset) => {
        const canonicalUrl = new URL(asset, self.location.href);
        const updateUrl = new URL(canonicalUrl);
        updateUrl.searchParams.set("v", ASSET_VERSION);
        return fetch(updateUrl, { cache: "reload" }).then((response) => {
          if (!response.ok) throw new Error(`Could not cache ${asset}: ${response.status}`);
          return Promise.all([
            cache.put(canonicalUrl, response.clone()),
            cache.put(updateUrl, response)
          ]);
        });
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("fit-roulette-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin
    || url.searchParams.has("latitude") || url.searchParams.has("longitude")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
