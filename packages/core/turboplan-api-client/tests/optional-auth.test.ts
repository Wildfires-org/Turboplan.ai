import assert from "node:assert";
import { before, describe, it } from "node:test";
import { Hono } from "hono";

import { createToken, createUploadToken } from "../src/jwt";
import { optionalAuthMiddleware } from "../src/server";

const USER = { id: "user-1", userRole: "citizen" };

const app = new Hono();
app.get("/whoami", optionalAuthMiddleware, (c) => {
  return c.json({ userId: c.get("user")?.userId ?? null });
});

const whoami = async (init: { query?: string; token?: string } = {}) => {
  const res = await app.request(`/whoami${init.query ?? ""}`, {
    headers: init.token ? { authorization: `Bearer ${init.token}` } : {},
  });
  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as { userId: string | null };
  return body.userId;
};

describe("optionalAuthMiddleware", () => {
  before(() => {
    process.env.JWT_SIGNING_SECRET = "test-jwt-secret-0123456789abcdef";
  });

  it("continues anonymously without a token", async () => {
    assert.strictEqual(await whoami(), null);
  });

  it("sets the user for a general token in the Authorization header", async () => {
    const token = await createToken(USER);
    assert.strictEqual(await whoami({ token }), USER.id);
  });

  it("ignores an upload token in the Authorization header", async () => {
    const token = await createUploadToken(USER);
    assert.strictEqual(await whoami({ token }), null);
  });

  it("ignores tokens passed via the query string", async () => {
    const general = await createToken(USER);
    const upload = await createUploadToken(USER);
    assert.strictEqual(await whoami({ query: `?token=${general}` }), null);
    assert.strictEqual(await whoami({ query: `?token=${upload}` }), null);
  });

  it("continues anonymously for an invalid token", async () => {
    assert.strictEqual(await whoami({ token: "not-a-jwt" }), null);
  });
});
