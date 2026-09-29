import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";

import { requireSessionAuth } from "../src/middleware/session-only.js";
import {
  PAT_DEFAULT_LIFETIME_DAYS,
  PAT_MAX_LIFETIME_DAYS,
  resolvePatExpiry,
} from "../src/utils/pat-expiry.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-01-01T00:00:00.000Z");
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * DAY_MS).toISOString();

describe("resolvePatExpiry", () => {
  it("defaults an omitted expiry to the default lifetime", () => {
    for (const requested of [undefined, null, ""]) {
      const result = resolvePatExpiry(requested, NOW);
      assert.ok(result.ok);
      assert.equal(
        result.expiresAt.toISOString(),
        daysFromNow(PAT_DEFAULT_LIFETIME_DAYS),
      );
    }
  });

  it("accepts a future date within the maximum lifetime", () => {
    const requested = daysFromNow(30);
    const result = resolvePatExpiry(requested, NOW);
    assert.ok(result.ok);
    assert.equal(result.expiresAt.toISOString(), requested);
  });

  it("accepts exactly the maximum and a one-year pick in a leap year", () => {
    assert.ok(resolvePatExpiry(daysFromNow(PAT_MAX_LIFETIME_DAYS), NOW).ok);
    assert.ok(resolvePatExpiry(daysFromNow(366), NOW).ok);
  });

  it("rejects an expiry beyond the maximum lifetime", () => {
    const result = resolvePatExpiry(daysFromNow(400), NOW);
    assert.equal(result.ok, false);
  });

  it("rejects past, present, invalid and non-string expiries", () => {
    for (const requested of [
      daysFromNow(-1),
      NOW.toISOString(),
      "not-a-date",
      1234567890,
      {},
    ]) {
      assert.equal(resolvePatExpiry(requested, NOW).ok, false);
    }
  });
});

describe("requireSessionAuth", () => {
  const run = async (authMethod?: "pat" | "session") => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      if (authMethod) {
        c.set("authMethod", authMethod);
      }
      await next();
    });
    app.use("*", requireSessionAuth);
    app.get("/x", (c) => c.json({ ok: true }));
    return app.request("/x");
  };

  it("rejects PAT-authenticated requests with 403", async () => {
    const res = await run("pat");
    assert.equal(res.status, 403);
  });

  it("lets session-authenticated requests through", async () => {
    assert.equal((await run("session")).status, 200);
    assert.equal((await run()).status, 200);
  });
});
