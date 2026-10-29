import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveEmailInput } from "../src/components/user-selector/email-input";
import type { SearchableUser } from "../src/hooks/use-user-search";

const makeUser = (id: string, email: string): SearchableUser => ({
  id,
  email,
  firstName: null,
  lastName: null,
  avatarUrl: null,
});

const alex = makeUser("u-alex", "alex.chen@example.test");
const manual = makeUser("u-manual", "pw-manual-1@example.test");
const enterTest = makeUser("u-enter", "Enter-Test-2@Example.test");

describe("resolveEmailInput", () => {
  it("returns null for non-email input so fuzzy search applies", () => {
    assert.equal(resolveEmailInput("alex", [alex], new Set()), null);
    assert.equal(resolveEmailInput("alex@example", [alex], new Set()), null);
    assert.equal(resolveEmailInput("", [alex], new Set()), null);
  });

  it("matches only the exact email, trimmed and case-insensitive", () => {
    assert.deepEqual(
      resolveEmailInput(
        "  enter-test-2@example.TEST ",
        [alex, manual, enterTest],
        new Set(),
      ),
      { status: "match", user: enterTest },
    );
  });

  it("never picks fuzzy or stale results for a typed email", () => {
    assert.deepEqual(
      resolveEmailInput("enter-test-2@example.test", [alex, manual], new Set()),
      { status: "new" },
    );
  });

  it("reports a taken email even when results contain fuzzy matches", () => {
    assert.deepEqual(
      resolveEmailInput(
        "Enter-Test-2@example.test",
        [alex, manual],
        new Set(["enter-test-2@example.test"]),
      ),
      { status: "taken" },
    );
  });

  it("reports a taken email over its own exact match", () => {
    assert.deepEqual(
      resolveEmailInput(
        "enter-test-2@example.test",
        [enterTest],
        new Set(["enter-test-2@example.test"]),
      ),
      { status: "taken" },
    );
  });
});
