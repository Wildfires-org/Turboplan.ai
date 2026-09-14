import type { Context, Next } from "hono";

import { hmacEmailId } from "@wildfires-org/turboplan-auth/email-identity";
import { getApiEnv } from "@wildfires-org/turboplan-env";

import { ANALYTICS_EVENTS } from "./analytics-events.js";
import { captureEvent } from "./posthog.js";

/**
 * Captures `magic_link_requested` after a successful send. Hono caches the
 * parsed body, so reading it post-handler does not consume the stream.
 */
export const magicLinkAnalyticsMiddleware = async (c: Context, next: Next) => {
  await next();

  if (c.req.method !== "POST" || !c.res.ok) {
    return;
  }

  try {
    const body = await c.req.json<{ to?: string; type?: string }>();
    if (typeof body?.to === "string" && body.to) {
      const distinctId = `email:${await hmacEmailId(body.to, getApiEnv().AUTH_SECRET)}`;
      captureEvent(distinctId, ANALYTICS_EVENTS.MAGIC_LINK_REQUESTED, {
        type: body.type,
      });
    }
  } catch (error) {
    // Skip analytics, never fail the request — but leave a trace so missing
    // telemetry is distinguishable from a healthy request.
    console.error("magic-link analytics capture skipped:", error);
  }
};
