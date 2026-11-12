import type { Context } from "hono";

/**
 * Header names whose values never reach the request log: credentials,
 * cookies, internal and webhook secrets, and signatures.
 */
const SENSITIVE_HEADER_NAME =
  /authorization|cookie|secret|token|api-key|apikey|signature|jwt|password/i;

export const REDACTED = "[REDACTED]";

/** Copies headers for logging, with every sensitive value replaced. */
export const redactHeaders = (
  headers: Headers | Record<string, string>,
): Record<string, string> => {
  const redacted: Record<string, string> = {};
  const add = (value: string, name: string) => {
    redacted[name] = SENSITIVE_HEADER_NAME.test(name) ? REDACTED : value;
  };
  if (headers instanceof Headers) {
    headers.forEach(add);
  } else {
    for (const [name, value] of Object.entries(headers)) {
      add(value, name);
    }
  }
  return redacted;
};

/*
 * hono-pino request and response bindings with the headers redacted before
 * pino sees them. Pino's own `redact` option only works in its Node build:
 * a Worker bundle gets pino's browser build, which ignores `redact`, so
 * bearer tokens reached the Worker logs verbatim.
 */

export const requestLogBindings = (c: Context) => ({
  req: {
    url: c.req.path,
    method: c.req.method,
    headers: redactHeaders(c.req.header()),
  },
});

export const responseLogBindings = (c: Context) => ({
  res: {
    status: c.res.status,
    headers: redactHeaders(c.res.headers),
  },
});
