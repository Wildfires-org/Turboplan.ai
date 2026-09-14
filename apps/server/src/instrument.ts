/**
 * Sentry init for the Node entry point (local.ts). Must be imported before
 * anything else so the SDK instruments modules as they load. The default
 * integrations also register process-level uncaught-exception and
 * unhandled-rejection handlers. No-ops when SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/node";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import { scrubSentryEvent } from "./utils/sentry.js";

const ENV = getApiEnv();

if (ENV.SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    initialScope: { tags: { service: "api" } },
    beforeSend: scrubSentryEvent,
  });
}
