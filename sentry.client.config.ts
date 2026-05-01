// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Performance monitoring: capture 10% of transactions in production, 100% in dev
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session Replay: 1% of all sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    // Suppress Sentry debug output in production
    debug: false,

    // Integrations
    integrations: [
      Sentry.replayIntegration({
        // Mask all text content and user input to protect privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Do not send events from localhost
    beforeSend(event) {
      if (
        typeof window !== "undefined" &&
        window.location.hostname === "localhost"
      ) {
        return null;
      }
      return event;
    },
  });
}
