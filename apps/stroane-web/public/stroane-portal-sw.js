/* global caches, fetch, self, Response, URL */

const CACHE_NAME = "stroane-portal-shell-v1";
const APP_SHELL_PATHS = ["/", "/index.html", "/admin", "/login", "/icons.svg"];

const isApiRequest = (url) => url.pathname.startsWith("/api/");

const isStaticAssetRequest = (request, url) =>
  url.origin === self.location.origin &&
  !isApiRequest(url) &&
  (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/icons.svg" ||
    ["script", "style", "image", "font"].includes(request.destination)
  );

const cacheShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL_PATHS.map((path) => cache.add(path)));
};

const putIfUsable = async (request, response) => {
  if (!response || !response.ok) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
};

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => putIfUsable(request, response))
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(request)) ||
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            new Response("Stroane portal is offline and the app shell has not been cached yet.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        })
    );
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => putIfUsable(request, response));
      })
    );
  }
});
