import { createMiddleware } from "hono/factory";

import { db } from "@wildfires-org/turboplan-db/db-client";
import { webhookRequestLog } from "@wildfires-org/turboplan-db/schemas";

const SOURCE_REGEX = /\/api\/webhooks\/research-agent\/(\w+)/;

/**
 * Upper bound on the serialized size of a request/response body we persist.
 * Bodies larger than this are replaced with a truncated preview so a single
 * oversized (or hostile) payload cannot bloat `webhook_request_log`.
 */
const MAX_LOGGED_BODY_BYTES = 64 * 1024;

const extractSource = (path: string): string => {
  const match = path.match(SOURCE_REGEX);
  return match?.[1] ?? "unknown";
};

const extractRunId = (body: Record<string, unknown> | null): string | null => {
  if (!body) {
    return null;
  }
  const runId = body.runId ?? body.run_id;
  return typeof runId === "string" ? runId : null;
};

/**
 * Truncates `value` to at most `maxBytes` UTF-8 bytes.
 *
 * Only the first `maxBytes` CHARACTERS are encoded: every JS char is at least
 * one UTF-8 byte, so that prefix is guaranteed to contain the first `maxBytes`
 * bytes. This keeps the work proportional to the cap rather than to the (up to
 * multi-megabyte) payload.
 */
const truncateToBytes = (value: string, maxBytes: number): string => {
  const bytes = new TextEncoder().encode(value.slice(0, maxBytes));
  if (bytes.length <= maxBytes) {
    return value.slice(0, maxBytes);
  }

  // Walk back off any UTF-8 continuation byte (0b10xxxxxx) so the slice never
  // ends mid-character.
  let end = maxBytes;
  while (end > 0 && ((bytes[end] ?? 0) & 0b1100_0000) === 0b1000_0000) {
    end -= 1;
  }
  return new TextDecoder().decode(bytes.subarray(0, end));
};

type CappedBody = {
  /** Parsed object, or null when absent, non-JSON, or over the cap. */
  parsed: Record<string, unknown> | null;
  /** Value persisted to `webhook_request_log.request_body`/`response_body`. */
  logged: unknown;
};

/**
 * Derives both the parsed body and the value we persist from the raw text that
 * was already read off the wire.
 *
 * Every step is bounded by MAX_LOGGED_BODY_BYTES: an oversized payload is
 * neither parsed nor re-serialized, we only slice the string we already hold.
 * Parsing or `JSON.stringify`-ing it first would make the logger's CPU cost
 * scale with the attacker-controlled payload size — exactly what the cap is
 * meant to prevent. The parsed object is used for nothing but logging (the
 * route handler parses the request itself), so skipping it above the cap costs
 * only the `runId` column on absurdly large payloads.
 */
const capBody = (raw: string | null): CappedBody => {
  if (!raw) {
    return { parsed: null, logged: null };
  }

  const byteLength = Buffer.byteLength(raw, "utf8");
  if (byteLength > MAX_LOGGED_BODY_BYTES) {
    return {
      parsed: null,
      logged: {
        truncated: true,
        originalBytes: byteLength,
        preview: `${truncateToBytes(raw, MAX_LOGGED_BODY_BYTES)}[truncated]`,
      },
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return { parsed: null, logged: parsed ?? null };
    }
    return { parsed: parsed as Record<string, unknown>, logged: parsed };
  } catch {
    return { parsed: null, logged: null };
  }
};

const SENSITIVE_HEADERS = new Set([
  "x-api-key",
  "x-webhook-secret",
  "authorization",
  "cookie",
]);

const redactValue = (value: string): string => {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
};

const extractHeaders = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase())
      ? redactValue(value)
      : value;
  });
  return result;
};

/** Reads a body as raw text without consuming it for the real consumer. */
const readRawBody = async (
  source: Request | Response,
): Promise<string | null> => {
  try {
    return await source.clone().text();
  } catch {
    return null;
  }
};

/**
 * Persists one row per webhook request to `webhook_request_log`.
 *
 * MUST be registered AFTER the per-run `x-webhook-secret` middleware of the
 * router it belongs to. Mounting it ahead of authentication lets an anonymous
 * caller drive an unbounded number of DB inserts (and body parses) with no
 * credential at all.
 */
export const webhookLoggerMiddleware = createMiddleware(async (c, next) => {
  const startTime = Date.now();
  const path = c.req.path;
  const method = c.req.method;
  const source = extractSource(path);

  // A request body can only be read once — reading it here would leave it empty
  // for the actual route handler. We clone the request first so both can read it.
  // Webhooks are always POST, so we skip body parsing for any other method.
  const requestBody =
    method === "POST"
      ? capBody(await readRawBody(c.req.raw))
      : { parsed: null, logged: null };
  const runId = extractRunId(requestBody.parsed);
  const requestHeaders = extractHeaders(c.req.raw.headers);

  await next();

  const durationMs = Date.now() - startTime;
  const responseStatus = c.res.status;
  const responseBody = capBody(await readRawBody(c.res));

  db.insert(webhookRequestLog)
    .values({
      source,
      path,
      method,
      requestBody: requestBody.logged,
      requestHeaders,
      responseBody: responseBody.logged,
      responseStatus,
      runId,
      durationMs,
    })
    .then(() => {})
    .catch((error) => {
      console.error("[webhook-logger] Failed to insert log:", error);
    });
});
