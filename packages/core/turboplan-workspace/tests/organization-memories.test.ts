import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeOrganizationMemoryContent } from "../src/server/organizations/memories";

describe("normalizeOrganizationMemoryContent", () => {
  it("trims the note and each line's trailing whitespace", () => {
    assert.equal(
      normalizeOrganizationMemoryContent("  \n Prefers metric units.  \n"),
      "Prefers metric units.",
    );
    assert.equal(
      normalizeOrganizationMemoryContent("Line one \t\nLine two"),
      "Line one\nLine two",
    );
  });

  it("keeps line breaks but collapses runs of blank lines into one", () => {
    assert.equal(
      normalizeOrganizationMemoryContent("One\r\n\r\n  \n\t\nTwo\nThree"),
      "One\n\nTwo\nThree",
    );
  });

  it("returns an empty string for whitespace-only content", () => {
    assert.equal(normalizeOrganizationMemoryContent(" \n\t\r\n "), "");
  });
});
