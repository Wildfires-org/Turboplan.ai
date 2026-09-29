import assert from "node:assert";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  authorizeLoginTicket,
  createLoginTicket,
  LOGIN_TICKET_TTL_SECONDS,
  verifyLoginTicket,
} from "../src/config/login-ticket";

const SECRET = "test-auth-secret-0123456789abcdef";
const USER = { id: "user-1", email: "mcp-test@turboplan.test" };

const findUser = async (userId: string) => {
  return userId === USER.id ? { ...USER, emailVerified: null } : null;
};

const encode = (payload: object) => {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

// Signs a payload exactly like the real implementation, so tests can build
// well-signed tickets with arbitrary claims.
const signWithRealKey = (payload: object, secret = SECRET) => {
  const key = createHmac("sha256", secret)
    .update("turboplan-auth:login-ticket:v1")
    .digest();
  const encoded = encode(payload);
  const signature = createHmac("sha256", key)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
};

const validClaims = (overrides: object = {}) => {
  const iat = Math.floor(Date.now() / 1000);
  return {
    sub: USER.id,
    purpose: "magic-link-login",
    jti: "jti-1",
    iat,
    exp: iat + LOGIN_TICKET_TTL_SECONDS,
    ...overrides,
  };
};

describe("verifyLoginTicket", () => {
  it("accepts a freshly minted ticket", () => {
    const ticket = createLoginTicket(USER.id, SECRET);
    assert.strictEqual(verifyLoginTicket(ticket, SECRET), USER.id);
  });

  it("gives every ticket a unique jti", () => {
    const first = createLoginTicket(USER.id, SECRET);
    const second = createLoginTicket(USER.id, SECRET);
    assert.notStrictEqual(first, second);
  });

  it("rejects a ticket signed with a different secret", () => {
    const ticket = createLoginTicket(USER.id, "some-other-secret");
    assert.strictEqual(verifyLoginTicket(ticket, SECRET), null);
  });

  it("rejects a ticket signed with the raw AUTH_SECRET instead of the derived key", () => {
    const encoded = encode(validClaims());
    const signature = createHmac("sha256", SECRET)
      .update(encoded)
      .digest("base64url");
    assert.strictEqual(
      verifyLoginTicket(`${encoded}.${signature}`, SECRET),
      null,
    );
  });

  it("rejects a ticket whose payload was swapped to another user", () => {
    const ticket = createLoginTicket(USER.id, SECRET);
    const [, signature] = ticket.split(".");
    const forged = `${encode(validClaims({ sub: "victim" }))}.${signature}`;
    assert.strictEqual(verifyLoginTicket(forged, SECRET), null);
  });

  it("rejects an unsigned ticket", () => {
    assert.strictEqual(verifyLoginTicket(encode(validClaims()), SECRET), null);
    assert.strictEqual(
      verifyLoginTicket(`${encode(validClaims())}.`, SECRET),
      null,
    );
  });

  it("rejects an expired ticket", () => {
    const mintedAt = Date.now();
    const ticket = createLoginTicket(USER.id, SECRET, mintedAt);
    const justAfterExpiry = mintedAt + LOGIN_TICKET_TTL_SECONDS * 1000 + 1000;
    assert.strictEqual(
      verifyLoginTicket(ticket, SECRET, justAfterExpiry),
      null,
    );
  });

  it("rejects a well-signed ticket with the wrong purpose", () => {
    const ticket = signWithRealKey(validClaims({ purpose: "password-reset" }));
    assert.strictEqual(verifyLoginTicket(ticket, SECRET), null);
  });

  it("rejects a well-signed ticket with missing claims", () => {
    const ticket = signWithRealKey({
      sub: USER.id,
      purpose: "magic-link-login",
    });
    assert.strictEqual(verifyLoginTicket(ticket, SECRET), null);
  });

  it("rejects malformed input without throwing", () => {
    for (const input of [
      undefined,
      null,
      42,
      "",
      "a.b.c",
      "!!!.???",
      USER.id,
    ]) {
      assert.strictEqual(verifyLoginTicket(input, SECRET), null);
    }
  });

  it("rejects everything when the secret is empty", () => {
    const ticket = createLoginTicket(USER.id, SECRET);
    assert.strictEqual(verifyLoginTicket(ticket, ""), null);
  });
});

describe("authorizeLoginTicket", () => {
  it("rejects a bare userId (the original vulnerability)", async () => {
    assert.strictEqual(
      await authorizeLoginTicket({ userId: USER.id }, SECRET, findUser),
      null,
    );
  });

  it("rejects a userId passed as the ticket", async () => {
    assert.strictEqual(
      await authorizeLoginTicket({ ticket: USER.id }, SECRET, findUser),
      null,
    );
  });

  it("rejects missing credentials", async () => {
    assert.strictEqual(
      await authorizeLoginTicket(undefined, SECRET, findUser),
      null,
    );
  });

  it("rejects a forged ticket", async () => {
    const ticket = createLoginTicket(USER.id, "attacker-secret");
    assert.strictEqual(
      await authorizeLoginTicket({ ticket }, SECRET, findUser),
      null,
    );
  });

  it("rejects a valid ticket for a user that no longer exists", async () => {
    const ticket = createLoginTicket("deleted-user", SECRET);
    assert.strictEqual(
      await authorizeLoginTicket({ ticket }, SECRET, findUser),
      null,
    );
  });

  it("returns only id and email for a valid ticket", async () => {
    const ticket = createLoginTicket(USER.id, SECRET);
    assert.deepStrictEqual(
      await authorizeLoginTicket({ ticket }, SECRET, findUser),
      USER,
    );
  });
});
