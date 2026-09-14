import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import {
  createApiKeyAuthMiddleware,
  createOriginGuardMiddleware,
} from "../../src/http/middlewares";
import {
  validateContext,
  validateResumeBody,
  validateRunBody,
} from "../../src/http/validation";

describe("validation contracts", () => {
  it("rejects empty run prompt", () => {
    const result = validateRunBody({ prompt: "   " });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("prompt is required");
  });

  it("accepts run with valid targetApiUrl override", () => {
    const result = validateRunBody({
      prompt: "do work",
      targetApiUrl: "https://tenant.example.com",
      webhookSecret: "s",
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      prompt: "do work",
      targetApiUrl: "https://tenant.example.com",
    });
  });

  it.each([
    ["http on a public host", "http://tenant.example.com"],
    ["embedded credentials", "https://user:pw@tenant.example.com"],
    ["private IPv4", "https://10.0.0.5"],
    ["link-local metadata IP", "http://169.254.169.254"],
    ["private IPv6", "https://[fd00::1]"],
    ["IPv4-mapped private IPv6", "https://[::ffff:10.0.0.1]"],
    ["NAT64 private IPv6", "https://[64:ff9b::a00:1]"],
    ["CGNAT", "https://100.64.0.1"],
    ["multicast", "https://224.0.0.1"],
    ["reserved 240/4", "https://240.0.0.1"],
    ["benchmarking", "https://198.18.0.1"],
    ["Fly private DNS suffix", "https://app.internal"],
    ["mDNS suffix", "https://printer.local"],
    ["trailing-dot private suffix", "https://app.internal."],
  ])("rejects targetApiUrl with %s", (_label, targetApiUrl) => {
    const result = validateRunBody({
      prompt: "do work",
      targetApiUrl,
      webhookSecret: "s",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("targetApiUrl");
  });

  it("returns a validation error (not a throw) for a malformed targetApiUrl", () => {
    const result = validateRunBody({
      prompt: "do work",
      targetApiUrl: "not a url",
      webhookSecret: "s",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("targetApiUrl");
  });

  it("accepts public hosts over https", () => {
    for (const targetApiUrl of [
      "https://example.com",
      "https://93.184.216.34",
      "https://[2606:4700::1111]",
    ]) {
      const result = validateRunBody({
        prompt: "do work",
        targetApiUrl,
        webhookSecret: "s",
      });
      expect(result.ok, targetApiUrl).toBe(true);
    }
  });

  it("accepts plain http targetApiUrl on loopback for local dev", () => {
    const result = validateRunBody({
      prompt: "do work",
      targetApiUrl: "http://localhost:3001",
      webhookSecret: "s",
    });

    expect(result.ok).toBe(true);
  });

  // F9 — the loopback allowance above is a local-dev affordance only. Any
  // deployed APP_ENV must reject it, https included (F4).
  it.each([
    "http://localhost:3001",
    "https://localhost:3001",
    "https://127.0.0.1",
    "https://[::1]",
    // RFC 6761 makes every *.localhost name resolve to loopback.
    "https://sub.localhost",
  ])("rejects loopback targetApiUrl %s in a deployed env", (targetApiUrl) => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = "production";
    try {
      const result = validateRunBody({
        prompt: "do work",
        targetApiUrl,
        webhookSecret: "s",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("targetApiUrl");
    } finally {
      if (previous === undefined) {
        delete process.env.APP_ENV;
      } else {
        process.env.APP_ENV = previous;
      }
    }
  });

  // F16 — WHATWG canonicalises this to [::a00:1] (no 0xffff marker), which
  // slipped past the old IPv4-mapped-only check.
  it("rejects IPv4-compatible IPv6 targetApiUrl", () => {
    const result = validateRunBody({
      prompt: "do work",
      targetApiUrl: "https://[::10.0.0.1]",
      webhookSecret: "s",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("targetApiUrl");
  });

  it("applies the same targetApiUrl guard on resume", () => {
    const result = validateResumeBody({
      targetApiUrl: "https://192.168.1.10",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects resume body with unknown keys", () => {
    const result = validateResumeBody({ runId: "x" });
    expect(result.ok).toBe(false);
  });

  it("rejects empty context", () => {
    const result = validateContext({ context: "" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("context is required");
  });
});

describe("auth and origin middleware contracts", () => {
  const app = new Hono();
  app.use("/api/*", createOriginGuardMiddleware(["https://*.example.com"]));
  app.use("/api/*", createApiKeyAuthMiddleware("secret"));
  app.options("/api/*", (c) => c.newResponse(null, { status: 204 }));
  app.post("/api/protected", (c) => c.json({ ok: true }));

  it("rejects non-allowed origin", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/protected", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example.net",
          "x-api-key": "secret",
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("rejects missing api key", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/protected", {
        method: "POST",
        headers: {
          Origin: "https://ui.example.com",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("accepts allowed origin and valid api key", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/protected", {
        method: "POST",
        headers: {
          Origin: "https://ui.example.com",
          "x-api-key": "secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("OPTIONS request returns 200/204 without API key", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/protected", {
        method: "OPTIONS",
        headers: {
          Origin: "https://ui.example.com",
        },
      }),
    );

    expect([200, 204]).toContain(response.status);
  });
});
