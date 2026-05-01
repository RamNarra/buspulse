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
