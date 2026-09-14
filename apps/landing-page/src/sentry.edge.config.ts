import * as Sentry from "@sentry/nextjs";

import { getSentryEnv } from "@wildfires-org/turboplan-env";

import { scrubSentryEvent } from "./sentry-scrub";

const SENTRY_ENV = getSentryEnv();

// No-ops when the DSN is unset — Sentry is optional.
Sentry.init({
  dsn: SENTRY_ENV.SENTRY_DSN,
  environment: SENTRY_ENV.ENVIRONMENT,
  release: SENTRY_ENV.RELEASE,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  initialScope: { tags: { service: "landing" } },
  beforeSend: scrubSentryEvent,
});
