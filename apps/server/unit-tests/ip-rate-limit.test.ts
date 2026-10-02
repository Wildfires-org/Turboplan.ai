import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";

import { createIpRateLimitMiddleware } from "../src/utils/ip-rate-limit.js";

const BINDING = "TEST_RATE_LIMITER";

// Mirrors how publicRoutes.ts guards the anonymous landing presign.
const createApp = () => {
  const app = new Hono();
  app.use(
    "/api/public/uploads/*",
    createIpRateLimitMiddleware({
      binding: BINDING,
      windowMs: 60_000,
      maxRequests: 2,
    }),
  );
  app.post("/api/public/uploads/presign", (c) => c.json({ ok: true }));
  app.post("/api/public/other", (c) => c.json({ ok: true }));
  return app;
};

const post = (
  app: Hono,
  path: string,
  env?: Record<string, unknown>,
  ip = "203.0.113.7",
) =>
  app.request(
    path,
    { method: "POST", headers: { "x-forwarded-for": ip } },
    env,
  );

describe("createIpRateLimitMiddleware", () => {
  it("answers 429 from the in-memory limiter when no binding is bound", async () => {
    const app = createApp();
    const path = "/api/public/uploads/presign";

    assert.equal((await post(app, path)).status, 200);
    assert.equal((await post(app, path)).status, 200);

    const limited = await post(app, path);
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), {
      error: "Rate limit exceeded. Please try again later.",
    });

    // Buckets are per IP, and routes outside the prefix are not limited.
    assert.equal(
      (await post(app, path, undefined, "198.51.100.1")).status,
      200,
    );
    assert.equal((await post(app, "/api/public/other")).status, 200);
  });

  it("defers to the Workers rate-limit binding, keyed by client IP", async () => {
    const app = createApp();
    const keys: string[] = [];
    let success = true;
    const env = {
      [BINDING]: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success };
        },
      },
    };
    const path = "/api/public/uploads/presign";

    // Past the in-memory limit of 2: only the binding decides.
    for (let i = 0; i < 3; i++) {
      assert.equal((await post(app, path, env)).status, 200);
    }

    success = false;
    assert.equal((await post(app, path, env)).status, 429);
    assert.deepEqual(keys, Array(4).fill("203.0.113.7"));
  });

  it("falls back to the in-memory limiter when the binding throws", async (t) => {
    const logged = t.mock.method(console, "error", () => {});
    const app = createApp();
    const env = {
      [BINDING]: {
        limit: async () => {
          throw new Error("binding unavailable");
        },
      },
    };
    const path = "/api/public/uploads/presign";

    assert.equal((await post(app, path, env)).status, 200);
    assert.equal((await post(app, path, env)).status, 200);
    assert.equal((await post(app, path, env)).status, 429);
    assert.equal(logged.mock.callCount(), 3);
  });

  it("ignores an env entry that is not a rate-limit binding", async () => {
    const app = createApp();
    const env = { [BINDING]: "not-a-binding" };
    const path = "/api/public/uploads/presign";

    assert.equal((await post(app, path, env)).status, 200);
    assert.equal((await post(app, path, env)).status, 200);
    assert.equal((await post(app, path, env)).status, 429);
  });
});
