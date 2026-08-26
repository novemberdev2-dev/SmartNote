const CACHE_NAME = "smartnote-cache-v4";

const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.json",
  "./SmartNote-icon.png",
  "./Cover1.svg",
  "./Cover2.svg",
  "./Cover3.svg",
  "./Cover4.svg",
  "./Cover5.svg",
  "./Cover6.svg",
  "./Cover7.svg",
  "./Cover8.svg",
  "./Cover9.svg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(networkResponse => {
        // Only cache successful, same-origin responses (skip errors, opaque cross-origin, etc.)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => cached); // if offline and not cached, this will just fail as before
    })
  );
});
