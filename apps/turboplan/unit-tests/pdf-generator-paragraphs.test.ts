import assert from "node:assert";
import { describe, it } from "node:test";

import {
  classifyParagraph,
  collectParagraph,
  generatePdfFromMarkdown,
  isBoldOnlyText,
  isFollowedByAlignedLine,
  parseRuns,
} from "@wildfires-org/turboplan-signing/pdf";

const LETTER = `{right}**File Code:** 1950

{right}**Date:** October 8, 2026

Dear Interested Party:

Body paragraph with **inline bold** text.

**Purpose and Need**

Body.

[INSERT: project contact name and title]
Descanso Ranger District
3348 Alpine Boulevard
Alpine, CA 91901

Sincerely,

MARIA DELGADO
District Ranger`;

describe("collectParagraph", () => {
  const lines = LETTER.split("\n");

  it("keeps single-newline lines (address block) in one paragraph", () => {
    const start = lines.indexOf("[INSERT: project contact name and title]");
    const paragraph = collectParagraph(lines, start);
    assert.deepStrictEqual(paragraph.lines, [
      "[INSERT: project contact name and title]",
      "Descanso Ranger District",
      "3348 Alpine Boulevard",
      "Alpine, CA 91901",
    ]);
    assert.strictEqual(lines[paragraph.next], "");
  });

  it("keeps the signature block together", () => {
    const paragraph = collectParagraph(lines, lines.indexOf("MARIA DELGADO"));
    assert.deepStrictEqual(paragraph.lines, [
      "MARIA DELGADO",
      "District Ranger",
    ]);
    assert.strictEqual(paragraph.next, lines.length);
  });

  it("stops at a block start (list, heading, table, aligned line)", () => {
    for (const blockLine of [
      "- item",
      "1. item",
      "## Heading",
      "| a | b |",
      "{right}text",
      "---",
    ]) {
      const paragraph = collectParagraph(["Intro", blockLine], 0);
      assert.deepStrictEqual(paragraph.lines, ["Intro"], blockLine);
      assert.strictEqual(paragraph.next, 1);
    }
  });
});

describe("classifyParagraph", () => {
  it("treats a single bold span as a section heading", () => {
    assert.strictEqual(
      classifyParagraph(["**Purpose and Need**"]),
      "section-heading",
    );
    assert.strictEqual(classifyParagraph(["__Purpose__"]), "section-heading");
    assert.strictEqual(
      classifyParagraph(["***Bold Italic***"]),
      "section-heading",
    );
  });

  it("keeps partially bold lines as body", () => {
    assert.strictEqual(
      classifyParagraph(["Body with **inline bold** text."]),
      "body",
    );
    assert.strictEqual(classifyParagraph(["**Phone**: 555"]), "body");
    assert.strictEqual(classifyParagraph(["**A** and **B**"]), "body");
    assert.strictEqual(classifyParagraph(["*Italic only*"]), "body");
  });

  it("only classifies single-line paragraphs as headings", () => {
    assert.strictEqual(classifyParagraph(["**Heading**", "Body"]), "body");
  });

  it("recognizes complimentary closes case-insensitively", () => {
    for (const text of [
      "Sincerely,",
      "sincerely,",
      "Sincerely yours,",
      "RESPECTFULLY,",
      "Respectfully",
    ]) {
      assert.strictEqual(classifyParagraph([text]), "closing", text);
    }
    assert.strictEqual(classifyParagraph(["Sincerely, Erin"]), "body");
    assert.strictEqual(
      classifyParagraph(["Sincerely,", "MARIA DELGADO"]),
      "body",
    );
  });
});

describe("isBoldOnlyText", () => {
  it("ignores surrounding whitespace", () => {
    assert.strictEqual(isBoldOnlyText("  **Heading**  "), true);
  });
});

describe("parseRuns", () => {
  it("keeps inline bold and italic for body text", () => {
    assert.deepStrictEqual(parseRuns("a **b** *c*"), [
      { text: "a ", bold: false, italic: false },
      { text: "b", bold: true, italic: false },
      { text: " ", bold: false, italic: false },
      { text: "c", bold: false, italic: true },
    ]);
  });
});

describe("isFollowedByAlignedLine", () => {
  it("joins aligned lines separated by blank lines into one tight run", () => {
    const lines = LETTER.split("\n");
    assert.strictEqual(isFollowedByAlignedLine(lines, 0), true);
    assert.strictEqual(isFollowedByAlignedLine(lines, 2), false);
  });
});

describe("generatePdfFromMarkdown", () => {
  it("renders the letter dialect to a PDF", async () => {
    const bytes = await generatePdfFromMarkdown(LETTER, "Letter");
    assert.strictEqual(
      Buffer.from(bytes.slice(0, 5)).toString("latin1"),
      "%PDF-",
    );
  });
});
