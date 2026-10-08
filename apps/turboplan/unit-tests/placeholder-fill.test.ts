import assert from "node:assert";
import { describe, it } from "node:test";

import {
  collectPlaceholders,
  fillPlaceholder,
  fillPlaceholders,
  splitSuggestedValue,
} from "../lib/placeholder-fill";

describe("splitSuggestedValue", () => {
  it("splits the em-dash suggested form", () => {
    assert.deepStrictEqual(
      splitSuggestedValue("comment email — suggested: a@example.gov"),
      { label: "comment email", suggested: "a@example.gov" },
    );
  });

  it("keeps a plain description whole", () => {
    assert.deepStrictEqual(splitSuggestedValue("office phone number"), {
      label: "office phone number",
      suggested: "",
    });
  });

  it("keeps hyphenated words in the label", () => {
    assert.deepStrictEqual(splitSuggestedValue("e-mail address"), {
      label: "e-mail address",
      suggested: "",
    });
  });
});

describe("collectPlaceholders", () => {
  it("groups identical tokens in document order with counts", () => {
    const content = [
      "| [INSERT: file code] | Date |",
      "| --- | --- |",
      "Signed by [INSERT: signing official — suggested: Jane Doe || verify the name].",
      "File code again: [INSERT: file code]",
    ].join("\n");

    assert.deepStrictEqual(collectPlaceholders(content), [
      {
        token: "[INSERT: file code]",
        label: "file code",
        suggested: "",
        note: "",
        count: 2,
      },
      {
        token:
          "[INSERT: signing official — suggested: Jane Doe || verify the name]",
        label: "signing official",
        suggested: "Jane Doe",
        note: "verify the name",
        count: 1,
      },
    ]);
  });

  it("returns nothing for a document without placeholders", () => {
    assert.deepStrictEqual(collectPlaceholders("Plain text [1]."), []);
  });
});

describe("fillPlaceholder", () => {
  it("replaces every occurrence of the exact token", () => {
    const content = "A [INSERT: x] and [INSERT: x] but [INSERT: y].";
    assert.strictEqual(
      fillPlaceholder(content, "[INSERT: x]", "1900"),
      "A 1900 and 1900 but [INSERT: y].",
    );
  });

  it("skips empty values", () => {
    assert.strictEqual(
      fillPlaceholder("[INSERT: x]", "[INSERT: x]", "   "),
      "[INSERT: x]",
    );
  });

  it("escapes pipes only inside table rows", () => {
    const content = "| [INSERT: x] | b |\nText [INSERT: x]";
    assert.strictEqual(
      fillPlaceholder(content, "[INSERT: x]", "a | b"),
      "| a \\| b | b |\nText a | b",
    );
  });

  it("applies several fills in one pass", () => {
    assert.strictEqual(
      fillPlaceholders("[INSERT: a] [INSERT: b]", [
        { token: "[INSERT: a]", value: "1" },
        { token: "[INSERT: b]", value: "" },
      ]),
      "1 [INSERT: b]",
    );
  });
});
