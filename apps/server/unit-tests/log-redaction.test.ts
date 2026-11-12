import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";

import {
  REDACTED,
  redactHeaders,
  requestLogBindings,
  responseLogBindings,
} from "../src/utils/log-redaction.js";

describe("redactHeaders", () => {
  it("redacts credentials, cookies, secrets and signatures, keeping the rest", () => {
    assert.deepEqual(
      redactHeaders({
        authorization: "Bearer abc",
        cookie: "session=abc",
        "x-api-key": "key",
        "x-internal-secret": "secret",
        "x-auth-token": "token",
        "x-documenso-secret": "secret",
        "stripe-signature": "sig",
        "content-type": "application/json",
        "user-agent": "test",
      }),
      {
        authorization: REDACTED,
        cookie: REDACTED,
        "x-api-key": REDACTED,
        "x-internal-secret": REDACTED,
        "x-auth-token": REDACTED,
        "x-documenso-secret": REDACTED,
        "stripe-signature": REDACTED,
        "content-type": "application/json",
        "user-agent": "test",
      },
    );
  });

  it("reads a Headers object, matching names in any case", () => {
    const headers = new Headers({
      "Set-Cookie": "session=abc",
      Authorization: "Bearer abc",
      "Content-Type": "text/plain",
    });
    assert.deepEqual(redactHeaders(headers), {
      authorization: REDACTED,
      "content-type": "text/plain",
      "set-cookie": REDACTED,
    });
  });
});

// A Worker bundle gets pino's browser build, which writes through console and
// ignores pino's `redact` option: drive the logger with that build here.
describe("request log on pino's browser build", () => {
  const require = createRequire(import.meta.url);
  const browserPino = require("pino/browser.js");
  const methods = ["log", "info", "warn", "error", "debug", "trace"] as const;
  const originals = new Map<string, (...args: unknown[]) => void>();
  let written: string[] = [];

  beforeEach(() => {
    written = [];
    for (const method of methods) {
      originals.set(method, console[method]);
      console[method] = (...args: unknown[]) => {
        written.push(JSON.stringify(args));
      };
    }
  });

  afterEach(() => {
    for (const method of methods) {
      const original = originals.get(method);
      if (original) {
        console[method] = original;
      }
    }
  });

  it("never writes a bearer token, cookie or API key", async () => {
    const app = new Hono();
    app.use(
      pinoLogger({
        pino: browserPino(),
        http: {
          onReqBindings: requestLogBindings,
          onResBindings: responseLogBindings,
        },
      }),
    );
    app.get("/api/projects", (c) => {
      c.header("set-cookie", "session=response-cookie-value");
      return c.json({ ok: true });
    });

    const res = await app.request("/api/projects?page=2", {
      headers: {
        authorization: "Bearer request-token-value",
        cookie: "session=request-cookie-value",
        "x-api-key": "request-api-key-value",
        "user-agent": "log-redaction-test",
      },
    });
    assert.equal(res.status, 200);

    const log = written.join("\n");
    assert.match(log, /\/api\/projects/);
    assert.match(log, /log-redaction-test/);
    assert.match(log, /\[REDACTED\]/);
    for (const secret of [
      "request-token-value",
      "request-cookie-value",
      "request-api-key-value",
      "response-cookie-value",
    ]) {
      assert.ok(!log.includes(secret), `${secret} reached the log`);
    }
  });
});
