import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://buspulse-493407.firebaseapp.com/__/auth/:path*",
      },
    ];
  },

  async headers() {
    return [
      {
        // Dynamic versioned service worker — must never be cached by the browser
        // or a CDN. The browser must fetch it fresh on every page load to detect
        // new deploys automatically.
        source: "/api/sw",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Legacy static SW — also prevent CDN caching so existing users migrate
        // off it and onto /api/sw on their next visit.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: !process.env.CI,

  // Upload source maps only when SENTRY_AUTH_TOKEN is set
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Org and project (set via SENTRY_ORG / SENTRY_PROJECT env vars too)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Disable the Sentry telemetry
  telemetry: false,

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  webpack: {
    // Auto-instrument Server Components and Route Handlers
    autoInstrumentServerFunctions: true,
    // Remove Sentry logger statements from the bundle
    treeshake: { removeDebugLogging: true },
  },
});
