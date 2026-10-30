import type { ErrorEvent } from "@sentry/nextjs";

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
// The name is tested separately from the `name=` scan to keep matching linear.
const PARAM_NAME_PATTERN = /(?:^|[?&#\s])([^?&#=\s]*)=/g;
const PARAM_VALUE_PATTERN = /[^&#\s]*/y;
const SENSITIVE_PARAM_NAME_PATTERN = new RegExp(
  SENSITIVE_QUERY_PARAMS.join("|"),
  "i",
);

export const redactSensitiveUrl = (url: string): string => {
  let redacted = "";
  let copiedUpTo = 0;
  // A non-sensitive value is still scanned, so a nested `?token=` is caught;
  // pairs inside an already-redacted value are skipped.
  for (const match of url.matchAll(PARAM_NAME_PATTERN)) {
    if (
      match.index < copiedUpTo ||
      !SENSITIVE_PARAM_NAME_PATTERN.test(match[1])
    ) {
      continue;
    }
    const valueStart = match.index + match[0].length;
    PARAM_VALUE_PATTERN.lastIndex = valueStart;
    PARAM_VALUE_PATTERN.test(url);
    redacted += `${url.slice(copiedUpTo, valueStart)}[redacted]`;
    copiedUpTo = PARAM_VALUE_PATTERN.lastIndex;
  }
  return redacted + url.slice(copiedUpTo);
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
