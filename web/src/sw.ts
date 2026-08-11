/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;

// This service worker is retired. Earlier versions cached the app shell
// (index.html + content-hashed JS/CSS) and, on some mobile browsers, kept
// serving that stale shell across deploys — a stale hash is a 404, so the
// app failed to load at all. Rather than keep chasing service-worker
// update-timing edge cases, main.tsx no longer registers a new one, and
// this version's only job is to clean up any installation left over from
// before: clear every cache, unregister itself, and force-reload any page
// it still controls so it comes back with no service worker at all.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    })(),
  );
});
