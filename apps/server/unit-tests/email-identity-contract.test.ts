import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { hmacEmailId } from "@wildfires-org/turboplan-auth/email-identity";

/**
 * Contract test for the keyed email identity shared by the API server
 * (magic_link_requested distinct id) and the web app (login-time alias).
 * Both import the same hmacEmailId, so drift between services is impossible
 * by construction — this test pins the algorithm itself with known-answer
 * vectors so an accidental change to normalization, key handling, or hex
 * encoding fails the build.
 */
describe("hmacEmailId contract", () => {
  const SECRET = "contract-test-secret";

  const nodeReference = (email: string, secret: string): string => {
    return createHmac("sha256", secret)
      .update(email.toLowerCase().trim())
      .digest("hex");
  };

  it("matches the pinned known-answer vector", async () => {
    assert.equal(
      await hmacEmailId("user@example.com", SECRET),
      "4e43b9ece08fbfd834069befd03c0e067ba8e63e5f01fc7b07e21fdb099e2e6d",
    );
  });

  it("normalizes case and whitespace before hashing", async () => {
    assert.equal(
      await hmacEmailId("  User@Example.COM  ", SECRET),
      await hmacEmailId("user@example.com", SECRET),
    );
  });

  it("agrees with an independent node:crypto implementation", async () => {
    const samples = [
      "user@example.com",
      "Planner+tag@Agency.example.org",
      "  padded@example.net ",
    ];
    for (const email of samples) {
      assert.equal(
        await hmacEmailId(email, SECRET),
        nodeReference(email, SECRET),
      );
    }
  });

  it("different secrets yield different ids (keyed, not bare hash)", async () => {
    assert.notEqual(
      await hmacEmailId("user@example.com", SECRET),
      await hmacEmailId("user@example.com", "other-secret"),
    );
  });
});
