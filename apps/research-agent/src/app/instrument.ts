/**
 * Sentry init — must be imported before anything else in server.ts so the SDK
 * instruments modules as they load. The default integrations also register
 * process-level uncaught-exception and unhandled-rejection handlers.
 * No-ops when SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/node";

import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

const env = getResearchAgentEnv();

const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
];

// PII scrub: the agent API key travels in request headers — never send it.
const scrubSentryEvent = <T extends Sentry.ErrorEvent>(event: T): T => {
  if (event.request) {
    // Request bodies can carry tokens — never send them.
    event.request.data = undefined;
  }
  const headers = event.request?.headers;
  if (headers) {
    for (const header of Object.keys(headers)) {
      if (SENSITIVE_HEADERS.includes(header.toLowerCase())) {
        delete headers[header];
      }
    }
  }
  return event;
};

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.AGENT_LOCAL ? "development" : "production",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    initialScope: { tags: { service: "research-agent" } },
    beforeSend: scrubSentryEvent,
  });
}
