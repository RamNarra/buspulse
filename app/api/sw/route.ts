/**
 * Dynamic Service Worker endpoint.
 *
 * Why dynamic (not static public/sw.js)?
 * The browser only detects a SW update when the SW file BYTES change. A static
 * file never changes between deploys. This API route injects the Vercel
 * deployment ID into the cache-name constant on every deploy, so the browser
 * always sees a byte-changed file and triggers the update cycle automatically.
 *
 * Cache-Control: no-store ensures the browser always fetches this file fresh.
 * Service-Worker-Allowed: / grants the SW a root scope (wider than /api/).
 */

import { NextResponse } from "next/server";

// Vercel injects VERCEL_DEPLOYMENT_ID on every deploy.
// In local dev we use a timestamp that changes each server restart.
const DEPLOY_ID =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  `dev-${Date.now()}`;

const SW_CONTENT = /* javascript */ `
// BusPulse Service Worker — auto-versioned on every deploy.
// Deploy ID: ${DEPLOY_ID}

const DEPLOY_ID = ${JSON.stringify(DEPLOY_ID)};
const SHELL_CACHE   = \`buspulse-shell-\${DEPLOY_ID}\`;
const RUNTIME_CACHE = \`buspulse-runtime-\${DEPLOY_ID}\`;
const NETWORK_TIMEOUT_MS = 5000;

const SHELL_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
];

// Never cache Firebase requests — SDK manages its own persistence.
const BYPASS_PATTERNS = [
  /firebaseio\\.com/,
  /googleapis\\.com\\/identitytoolkit/,
  /securetoken\\.googleapis\\.com/,
  /\\.firebase\\.com/,
  /\\/api\\/sw/,           // Never cache this versioning endpoint itself
];

// ─── Install ──────────────────────────────────────────────────────────────────
// skipWaiting() means: activate immediately, don't wait for old SW to finish.
// Combined with clients.claim() below, every open tab gets the new version
// within seconds of a new deployment — no manual refresh needed.

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  // Activate immediately — do not wait for existing SW to lose all clients.
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
// Purge ALL caches from previous deploy IDs, then claim all open tabs.

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Message ──────────────────────────────────────────────────────────────────
// Belt-and-suspenders: also respond to explicit SKIP_WAITING from the client.

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ─── Fetch: tiered strategy ───────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Bypass Firebase / OAuth / SW endpoints
  if (BYPASS_PATTERNS.some((p) => p.test(url.hostname + url.pathname))) return;

  // Shell: stale-while-revalidate
  if (SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // API + bus pages: network-first with 5s timeout, then cached
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/bus/")) {
    event.respondWith(networkFirstWithTimeout(request, RUNTIME_CACHE));
    return;
  }
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await fetchPromise);
}

async function networkFirstWithTimeout(request, cacheName) {
  const cache = await caches.open(cacheName);

  const networkPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });

  try {
    return await networkPromise;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shellCache = await caches.open(SHELL_CACHE);
      return (await shellCache.match("/")) ?? new Response("Offline", { status: 503 });
    }
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
`;

export function GET() {
  return new NextResponse(SW_CONTENT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Must never be cached — browser must always fetch fresh to detect updates.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      // Allow this SW (served from /api/sw) to control the entire origin.
      "Service-Worker-Allowed": "/",
    },
  });
}
