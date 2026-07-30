const CACHE_NAME = "bsori-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/api/")) return;

  const isStaticAsset =
    requestUrl.pathname.startsWith("/assets/") ||
    requestUrl.pathname.startsWith("/_next/") ||
    /\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/i.test(requestUrl.pathname);

  if (!isStaticAsset && event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (isStaticAsset) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => response || caches.match("/"))),
  );
});
