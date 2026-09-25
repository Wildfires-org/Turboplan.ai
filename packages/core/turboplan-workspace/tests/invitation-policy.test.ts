import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideAutoSignup,
  InvitationEmailMismatchError,
  isInvitationEmailMatch,
} from "../src/server/invitations/policy";

describe("isInvitationEmailMatch", () => {
  it("matches the invited address exactly", () => {
    assert.equal(
      isInvitationEmailMatch("invitee@example.test", "invitee@example.test"),
      true,
    );
  });

  it("ignores case and surrounding whitespace", () => {
    assert.equal(
      isInvitationEmailMatch("  Invitee@Example.TEST ", "invitee@example.test"),
      true,
    );
    assert.equal(
      isInvitationEmailMatch("invitee@example.test", " INVITEE@example.test"),
      true,
    );
  });

  it("rejects a different account", () => {
    assert.equal(
      isInvitationEmailMatch("attacker@example.test", "invitee@example.test"),
      false,
    );
  });

  it("rejects look-alike addresses", () => {
    assert.equal(
      isInvitationEmailMatch(
        "invitee@example.test.evil",
        "invitee@example.test",
      ),
      false,
    );
    assert.equal(
      isInvitationEmailMatch("xinvitee@example.test", "invitee@example.test"),
      false,
    );
  });

  it("rejects a missing user email", () => {
    assert.equal(isInvitationEmailMatch(null, "invitee@example.test"), false);
    assert.equal(
      isInvitationEmailMatch(undefined, "invitee@example.test"),
      false,
    );
    assert.equal(isInvitationEmailMatch("", "invitee@example.test"), false);
  });
});

describe("decideAutoSignup", () => {
  it("creates and signs in only when no account exists", () => {
    assert.equal(decideAutoSignup(null), "create_and_sign_in");
    assert.equal(decideAutoSignup(undefined), "create_and_sign_in");
  });

  it("never signs in an existing account from an invite link", () => {
    assert.equal(decideAutoSignup({ id: "user-1" }), "login_required");
  });
});

describe("InvitationEmailMismatchError", () => {
  it("is identifiable by type and does not leak the invited email", () => {
    const error = new InvitationEmailMismatchError();
    assert.ok(error instanceof Error);
    assert.equal(error.name, "InvitationEmailMismatchError");
    assert.doesNotMatch(error.message, /@/);
  });
});
