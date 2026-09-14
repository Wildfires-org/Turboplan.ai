// Browser-side Sentry init. The env package references NEXT_PUBLIC_ vars
// statically so Next.js inlines them at build time. No-ops when the DSN is
// unset.
import * as Sentry from "@sentry/nextjs";

import { getSentryEnv } from "@wildfires-org/turboplan-env";

import { scrubSentryEvent } from "./sentry-scrub";

const SENTRY_ENV = getSentryEnv();

Sentry.init({
  dsn: SENTRY_ENV.NEXT_PUBLIC_SENTRY_DSN,
  environment: SENTRY_ENV.ENVIRONMENT,
  release: SENTRY_ENV.RELEASE,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  initialScope: { tags: { service: "web" } },
  beforeSend: scrubSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
