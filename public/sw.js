/**
 * BusPulse Service Worker — offline cache for last-known bus state.
 *
 * Strategy:
 *  - App shell (/_next/static/**, /manifest.json, /): stale-while-revalidate
 *  - /api/eta/**  and /bus/**: network-first with 5s timeout, then cached copy
 *  - Firebase RTDB & Auth requests pass through (no caching — must stay live)
 *
 * Fires only in production (NEXT_PUBLIC_SW_ENABLED=true).
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `buspulse-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `buspulse-runtime-${CACHE_VERSION}`;
const NETWORK_TIMEOUT_MS = 5000;

const SHELL_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
];

// Never cache Firebase requests — they use WebSocket / long-poll and the SDK
// manages its own persistence.
const BYPASS_PATTERNS = [
  /firebaseio\.com/,
  /googleapis\.com\/identitytoolkit/,
  /securetoken\.googleapis\.com/,
  /\.firebase\.com/,
];

// ─── Install: pre-cache shell ────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: purge old caches ───────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: tiered strategy ───────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Bypass Firebase / OAuth endpoints
  if (BYPASS_PATTERNS.some((p) => p.test(url.hostname + url.pathname))) return;

  // Shell assets: stale-while-revalidate
  if (SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // API + bus pages: network-first with timeout, fall back to cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/bus/")) {
    event.respondWith(networkFirstWithTimeout(request, RUNTIME_CACHE));
    return;
  }
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => undefined);
  return cached ?? (await fetchPromise);
}

async function networkFirstWithTimeout(request, cacheName) {
  const cache = await caches.open(cacheName);

  const networkPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS);
    fetch(request).then((response) => {
      clearTimeout(timer);
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      resolve(response);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  try {
    return await networkPromise;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return a minimal offline response for navigation requests
    if (request.mode === "navigate") {
      const shellCache = await caches.open(SHELL_CACHE);
      return await shellCache.match("/") ?? new Response("Offline", { status: 503 });
    }
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
