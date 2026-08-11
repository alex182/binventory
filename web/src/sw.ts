/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;

// Bump this on any change so activate() purges stale caches from earlier
// versions of this file.
const CACHE_NAME = "binventory-shell-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first, falling back to cache only when the network is
// unavailable. index.html references content-hashed JS/CSS filenames that
// change on every deploy, so a cache-first strategy would eventually serve
// an HTML shell pointing at bundle files that no longer exist on the
// server (a stale hash = a 404 = a blank page). Network-first keeps
// online users always on the current build while still giving offline
// visitors whatever was last successfully fetched.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fallback = await caches.match("/index.html");
        return fallback ?? new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
});
