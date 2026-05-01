/**
 * BusPulse Service Worker — LEGACY (static) build.
 *
 * This file is kept only so that browsers that already have it registered can
 * cleanly migrate to the versioned /api/sw endpoint. On activate it notifies
 * all open clients to re-register, then unregisters itself.
 *
 * New registrations use /api/sw (see components/ServiceWorkerRegistrar.tsx).
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purge all caches from the old static SW.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // Take control so we can post the message to all clients.
      await self.clients.claim();
      // Tell every open tab to re-register against /api/sw.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "SW_LEGACY_UNREGISTER" });
      }
      // Unregister this SW — the client will then register /api/sw.
      await self.registration.unregister();
    })()
  );
});
