/**
 * Next.js Instrumentation hook — loaded once per server process start.
 * Initialises both Sentry (server) and OpenTelemetry via @vercel/otel.
 *
 * Docs:
 *  - https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *  - https://vercel.com/docs/observability/otel-overview
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // OpenTelemetry — Vercel-managed trace exporter
    // Exports to Vercel Observability (or Cloud Trace if OTEL_EXPORTER_OTLP_ENDPOINT is set)
    const { registerOTel } = await import("@vercel/otel");
    registerOTel({
      serviceName: "buspulse",
    });

    // Sentry server SDK
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
