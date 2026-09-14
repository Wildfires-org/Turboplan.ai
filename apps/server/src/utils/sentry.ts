import type { ErrorEvent } from "@sentry/core";
import { captureException, getClient, withScope } from "@sentry/core";
import type { Context } from "hono";

const SENSITIVE_QUERY_PARAMS = [
  "token",
  "code",
  "key",
  "secret",
  "signature",
  "email",
];
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
];

// Matches the sensitive word anywhere in the param name so presigned-URL
// params (e.g. X-Amz-Signature, X-Amz-Security-Token) are caught too.
const SENSITIVE_PARAM_PATTERN = new RegExp(
  `(^|[?&#])([^&#=]*(?:${SENSITIVE_QUERY_PARAMS.join("|")})[^&#=]*)=[^&#\\s]*`,
  "gi",
);

export const redactSensitiveUrl = (url: string): string => {
  return url.replace(SENSITIVE_PARAM_PATTERN, "$1$2=[redacted]");
};

/**
 * PII scrub applied via `beforeSend` in every Sentry init: strips auth/cookie
 * headers and redacts sensitive query params (magic-link tokens!) from request
 * URLs and breadcrumbs.
 */
export const scrubSentryEvent = <T extends ErrorEvent>(event: T): T => {
  if (event.request) {
    event.request.cookies = undefined;
    // Request bodies can carry magic-link URLs/tokens — never send them.
    event.request.data = undefined;
    const headers = event.request.headers;
    if (headers) {
      for (const header of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.includes(header.toLowerCase())) {
          delete headers[header];
        }
      }
    }
    if (event.request.url) {
      event.request.url = redactSensitiveUrl(event.request.url);
    }
    if (event.request.query_string) {
      event.request.query_string = redactSensitiveUrl(
        String(event.request.query_string),
      );
    }
  }
  // Exception/message strings can embed URLs (e.g. failed fetch messages).
  if (event.exception?.values) {
    for (const exc of event.exception.values) {
      if (typeof exc.value === "string") {
        exc.value = redactSensitiveUrl(exc.value);
      }
    }
  }
  if (typeof event.message === "string") {
    event.message = redactSensitiveUrl(event.message);
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (!crumb.data) {
        continue;
      }
      // `url` on http crumbs; `from`/`to` on SPA navigation crumbs — all
      // carry full paths with query strings.
      for (const field of ["url", "from", "to"] as const) {
        const value = crumb.data[field];
        if (typeof value === "string") {
          crumb.data[field] = redactSensitiveUrl(value);
        }
      }
    }
  }
  return event;
};

/**
 * Captures an exception in Sentry with request context.
 * Built on runtime-agnostic `@sentry/core` APIs so it works under whichever
 * entry point initialized the SDK (`@sentry/node` in local.ts,
 * `@sentry/cloudflare` in worker.ts) and no-ops when none did
 * (SENTRY_DSN unset, or Bun dev via index.ts).
 */
export const captureSentryException = (error: Error, c?: Context) => {
  if (!getClient()) {
    return;
  }

  withScope((scope) => {
    if (c) {
      const userId = c.get("user")?.userId;
      if (userId) {
        scope.setUser({ id: userId });
      }
      scope.setContext("request", {
        path: c.req.path,
        method: c.req.method,
        // Redact — custom contexts bypass the beforeSend request scrubbing
        url: redactSensitiveUrl(c.req.url),
      });
    }
    captureException(error);
  });
};
