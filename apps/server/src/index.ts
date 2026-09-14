import { Hono } from "hono";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import { createApiRouter } from "./router.js";

const app = new Hono();
const ENV = getApiEnv();

// Sentry for the Bun dev entry. Dynamic import so this module stays loadable
// under Node (local.ts imports index.ts and inits @sentry/node instead —
// double-init is prevented by the Bun-global guard). No-ops without a DSN.
if (
  typeof (globalThis as { Bun?: unknown }).Bun !== "undefined" &&
  ENV.SENTRY_DSN
) {
  const Sentry = await import("@sentry/bun");
  const { scrubSentryEvent } = await import("./utils/sentry.js");
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    initialScope: { tags: { service: "api" } },
    beforeSend: scrubSentryEvent,
  });
}

// Initialize router with feature flags and error handling
try {
  const apiRouter = await createApiRouter();
  app.route("/", apiRouter);
} catch (error) {
  console.error("Fatal error: Failed to initialize API router:", error);
  // Fatal error - server cannot start properly
  process.exit(1);
}

export default {
  fetch: app.fetch,
  port: ENV.PORT || 3001,
};
