import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldCloseOnEscape } from "../lib/artifact-panel-escape";

describe("shouldCloseOnEscape", () => {
  it("closes the panel on an Escape nothing else handled", () => {
    assert.equal(
      shouldCloseOnEscape({ key: "Escape", defaultPrevented: false }),
      true,
    );
  });

  it("leaves the panel open for an Escape a dialog or menu handled", () => {
    // Radix prevents the default of every Escape it handles, also when the
    // dialog unmounts on close.
    assert.equal(
      shouldCloseOnEscape({ key: "Escape", defaultPrevented: true }),
      false,
    );
  });

  it("ignores every other key", () => {
    for (const key of ["Enter", "Esc", "escape", "a"]) {
      assert.equal(
        shouldCloseOnEscape({ key, defaultPrevented: false }),
        false,
      );
    }
  });
});
