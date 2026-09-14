// Sentry bootstrap — runs before app code, so it reads process.env directly
// (same as next.config.ts) instead of going through turboplan-env.
import * as Sentry from "@sentry/nextjs";

export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
};

// Captures all server-side request errors (RSC, route handlers, server
// actions) — the single server-side error hook, no per-route code needed.
export const onRequestError = Sentry.captureRequestError;
