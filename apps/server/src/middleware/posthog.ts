import type { Context, Next } from "hono";
import { PostHog } from "posthog-node";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import { redactSensitiveUrl } from "../utils/sentry.js";
import type {
  AnalyticsEvent,
  AnalyticsEventProperties,
} from "./analytics-events.js";

const ENV = getApiEnv();

// Singleton PostHog client instance
let posthogClient: PostHog | null = null;

/**
 * Returns the PostHog client instance.
 * Returns null if POSTHOG_API_KEY is not configured.
 */
export const getPostHogClient = (): PostHog | null => {
  if (!ENV.POSTHOG_API_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(ENV.POSTHOG_API_KEY, {
      host: "https://us.i.posthog.com",
      enableExceptionAutocapture: true,
    });
  }

  return posthogClient;
};

/**
 * Middleware that flushes PostHog events after each request.
 * This ensures events are sent even for short-lived serverless functions.
 */
export const posthogMiddleware = async (c: Context, next: Next) => {
  await next();

  const client = getPostHogClient();
  if (client) {
    await client.flush();
  }
};

/**
 * Captures a product analytics event. Fire-and-forget — never throws, no-ops
 * when POSTHOG_API_KEY is unset. Delivery is guaranteed by the flush
 * middleware, which is registered before every route group.
 */
export const captureEvent = (
  distinctId: string,
  event: AnalyticsEvent,
  properties?: AnalyticsEventProperties,
) => {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        service: "api",
        environment: ENV.NODE_ENV,
        ...properties,
      },
    });
  } catch (error) {
    console.error("PostHog captureEvent failed:", error);
  }
};

/**
 * Captures an exception in PostHog without request context.
 * Used for background / fire-and-forget error reporting (e.g. timeline recorder).
 */
export const capturePosthogError = (error: Error) => {
  const client = getPostHogClient();
  if (!client) return;

  client.captureException(error, "system", {
    environment: ENV.NODE_ENV,
  });
};

/**
 * Captures an exception in PostHog with request context.
 * Should be called from error handlers.
 */
export const capturePosthogException = async (
  error: Error,
  c: Context,
  distinctId?: string,
) => {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  // Use provided distinctId, or try to get from user context, or fallback to "anonymous"
  const userId = distinctId || c.get("user")?.userId || "anonymous";

  client.captureException(error, userId, {
    environment: ENV.NODE_ENV,
    path: c.req.path,
    method: c.req.method,
    // Redact sensitive query params (upload/magic-link tokens) before they
    // reach PostHog — a 500 on an authenticated URL must not exfiltrate creds.
    url: redactSensitiveUrl(c.req.url),
  });

  await client.flush();
};
