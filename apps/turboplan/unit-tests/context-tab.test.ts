import assert from "node:assert";
import { describe, it } from "node:test";

import {
  getContextTabStorageKey,
  getContextTabs,
  getTabIndexForKey,
  pickContextTab,
} from "../lib/context-tab";

describe("getContextTabs", () => {
  it("shows both, project first, when the organization context is readable", () => {
    assert.deepStrictEqual(
      getContextTabs({ canReadOrganizationContext: true }),
      ["project", "organization"],
    );
  });

  it("shows only the project otherwise", () => {
    assert.deepStrictEqual(
      getContextTabs({ canReadOrganizationContext: false }),
      ["project"],
    );
  });
});

describe("pickContextTab", () => {
  it("keeps the remembered tab while it is shown", () => {
    assert.strictEqual(
      pickContextTab(["project", "organization"], "organization"),
      "organization",
    );
    assert.strictEqual(
      pickContextTab(["project", "organization"], "project"),
      "project",
    );
  });

  it("falls back to the first tab when the remembered one is gone", () => {
    assert.strictEqual(pickContextTab(["project"], "organization"), "project");
  });

  it("ignores a stored value that is not a tab", () => {
    assert.strictEqual(
      pickContextTab(["project", "organization"], "office"),
      "project",
    );
    assert.strictEqual(
      pickContextTab(["project", "organization"], null),
      "project",
    );
    assert.strictEqual(
      pickContextTab(["project", "organization"], undefined),
      "project",
    );
  });
});

describe("getContextTabStorageKey", () => {
  it("is per user", () => {
    assert.notStrictEqual(
      getContextTabStorageKey("user-a"),
      getContextTabStorageKey("user-b"),
    );
  });
});

describe("getTabIndexForKey", () => {
  it("moves with the arrow keys and wraps around", () => {
    assert.strictEqual(getTabIndexForKey("ArrowRight", 0, 2), 1);
    assert.strictEqual(getTabIndexForKey("ArrowRight", 1, 2), 0);
    assert.strictEqual(getTabIndexForKey("ArrowLeft", 0, 2), 1);
    assert.strictEqual(getTabIndexForKey("ArrowLeft", 1, 2), 0);
  });

  it("jumps to the ends with Home and End", () => {
    assert.strictEqual(getTabIndexForKey("Home", 2, 3), 0);
    assert.strictEqual(getTabIndexForKey("End", 0, 3), 2);
  });

  it("ignores other keys and empty lists", () => {
    assert.strictEqual(getTabIndexForKey("Enter", 0, 2), null);
    assert.strictEqual(getTabIndexForKey("ArrowDown", 0, 2), null);
    assert.strictEqual(getTabIndexForKey("ArrowRight", 0, 0), null);
  });
});
