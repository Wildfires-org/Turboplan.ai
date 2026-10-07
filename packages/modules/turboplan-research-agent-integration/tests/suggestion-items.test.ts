import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  acceptSuggestion,
  type GeneratedSuggestion,
  MAX_SUGGESTIONS,
} from "../src/server/bootstrapper/suggestion-items";
import type { SuggestionItem } from "../src/types";

const generated = (
  overrides: Partial<GeneratedSuggestion> = {},
): GeneratedSuggestion => ({
  label: "Draft the NOD",
  content: "Draft the Notice of Determination for Ridge Fuel Break.",
  emoji: "📝",
  ...overrides,
});

/** Feed items through the rule in order, as the stream loop does. */
const acceptAll = (items: GeneratedSuggestion[]): SuggestionItem[] => {
  const accepted: SuggestionItem[] = [];
  for (const item of items) {
    const chip = acceptSuggestion(item, accepted);
    if (chip) {
      accepted.push(chip);
    }
  }
  return accepted;
};

describe("acceptSuggestion", () => {
  it("trims every field", () => {
    assert.deepEqual(
      acceptSuggestion(
        generated({
          label: "  Draft the NOD ",
          content: "\nDraft it.  ",
          emoji: " 📝 ",
        }),
        [],
      ),
      { label: "Draft the NOD", content: "Draft it.", emoji: "📝" },
    );
  });

  it("drops a chip with an empty label or content", () => {
    assert.equal(acceptSuggestion(generated({ label: "   " }), []), null);
    assert.equal(acceptSuggestion(generated({ content: "" }), []), null);
  });

  it("keeps a chip whose emoji is empty", () => {
    assert.equal(acceptSuggestion(generated({ emoji: " " }), [])?.emoji, "");
  });

  it("drops a label already accepted, ignoring case and padding", () => {
    const accepted = acceptAll([generated({ label: "Draft the NOD" })]);
    assert.equal(
      acceptSuggestion(generated({ label: " draft THE nod " }), accepted),
      null,
    );
  });

  it("stops accepting once the set is full", () => {
    const items = Array.from({ length: MAX_SUGGESTIONS + 2 }, (_, index) =>
      generated({ label: `Step ${index + 1}` }),
    );
    const accepted = acceptAll(items);
    assert.equal(accepted.length, MAX_SUGGESTIONS);
    assert.equal(
      acceptSuggestion(generated({ label: "One more" }), accepted),
      null,
    );
  });

  it("keeps model order and skips rejected chips without a gap", () => {
    const accepted = acceptAll([
      generated({ label: "First" }),
      generated({ label: "" }),
      generated({ label: "first" }),
      generated({ label: "Second" }),
    ]);
    assert.deepEqual(
      accepted.map((chip) => chip.label),
      ["First", "Second"],
    );
  });
});
