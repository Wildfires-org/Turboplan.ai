import assert from "node:assert";
import { describe, it } from "node:test";
import { Hono } from "hono";

import { extractClientIp } from "../src/server/rate-limit";

/**
 * Core limiter/IP-trust behaviour is tested once, in
 * `@wildfires-org/turboplan-utils` (`tests/rate-limit.test.ts`). This file
 * covers only what the Hono adapter adds: that header lookup through a real
 * Hono request reaches the shared extractor intact.
 */

const ipForHeaders = async (
  headers: Record<string, string>,
): Promise<string> => {
  const app = new Hono();
  let extracted = "";

  app.get("/", (c) => {
    extracted = extractClientIp(c);
    return c.text("ok");
  });

  await app.request("/", { headers });
  return extracted;
};

describe("extractClientIp (Hono adapter)", () => {
  it("reads the forwarding headers off a real Hono request", async () => {
    const ip = await ipForHeaders({
      "x-forwarded-for": "2.2.2.2, 4.4.4.4",
      "x-real-ip": "3.3.3.3",
    });

    assert.strictEqual(ip, "2.2.2.2");
  });

  it("reads headers case-insensitively", async () => {
    assert.strictEqual(
      await ipForHeaders({ "X-Real-IP": "3.3.3.3" }),
      "3.3.3.3",
    );
  });

  it("returns 'unknown' when no client IP header is present", async () => {
    assert.strictEqual(await ipForHeaders({}), "unknown");
  });
});
