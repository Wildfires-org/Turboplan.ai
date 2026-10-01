import assert from "node:assert";
import { describe, it } from "node:test";

import {
  computeColumnWidths,
  estimateTextWidthEm,
  hasExplicitAlignment,
  parseTableAlignments,
  toVisibleText,
} from "../lib/export/letterhead-layout";

// Real Times-Bold advance widths (em), from PDFKit's AFM metrics.
const TIMES_BOLD_WIDTHS_EM: Record<string, number> = {
  Mitigation: 4.5,
  Restoration: 4.999,
  Redwood: 3.975,
  Granite: 3.333,
  WILDFIRE: 5.167,
  WMW: 2.944,
  "Inc.": 1.639,
  "(555)": 2.166,
  "[INSERT:": 4.275,
  "info@redwood.example": 10.056,
  "1234567890": 5,
};

// One character = one unit keeps the expected widths easy to reason about.
const measureByLength = (text: string) => text.length;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const assertSumsTo = (widths: number[], total: number) => {
  assert.ok(
    Math.abs(sum(widths) - total) < 1e-9,
    `widths ${widths} sum to ${sum(widths)}, not ${total}`,
  );
};

describe("parseTableAlignments", () => {
  it("reads left, center, right and unmarked columns", () => {
    assert.deepStrictEqual(
      parseTableAlignments("| :--- | :---: | ---: | --- |"),
      ["left", "center", "right", null],
    );
  });

  it("accepts compact separators without spaces", () => {
    assert.deepStrictEqual(parseTableAlignments("|:-|-:|:-:|"), [
      "left",
      "right",
      "center",
    ]);
  });

  it("treats a bare separator as unmarked (legacy letterhead)", () => {
    const alignments = parseTableAlignments("|---|---|---|---|");
    assert.deepStrictEqual(alignments, [null, null, null, null]);
    assert.strictEqual(hasExplicitAlignment(alignments), false);
  });

  it("is explicit as soon as one column carries a marker", () => {
    assert.strictEqual(
      hasExplicitAlignment(parseTableAlignments("| --- | ---: |")),
      true,
    );
    assert.strictEqual(hasExplicitAlignment([]), false);
  });
});

describe("toVisibleText", () => {
  it("strips emphasis markers but keeps placeholder text", () => {
    assert.strictEqual(
      toVisibleText("**[INSERT: firm name]** and *Inc.* ***x***"),
      "[INSERT: firm name] and Inc. x",
    );
  });
});

describe("estimateTextWidthEm", () => {
  it("never underestimates Times New Roman Bold", () => {
    for (const [word, actual] of Object.entries(TIMES_BOLD_WIDTHS_EM)) {
      const estimate = estimateTextWidthEm(word);
      assert.ok(
        estimate >= actual,
        `${word}: estimate ${estimate} < actual ${actual}`,
      );
      // ...but stays close enough to not waste the letterhead's width.
      assert.ok(estimate <= actual * 1.4, `${word}: estimate ${estimate}`);
    }
  });
});

describe("computeColumnWidths", () => {
  it("shares spare room in proportion to content when everything fits", () => {
    const widths = computeColumnWidths({
      rows: [["**ab**", "abcdef"]],
      totalWidth: 100,
      measure: measureByLength,
      padding: 2,
      emptyWidth: 5,
    });
    // Natural widths 4 and 8 (text + padding) scaled to fill 100.
    assert.deepStrictEqual(
      widths.map((w) => Math.round(w * 100) / 100),
      [33.33, 66.67],
    );
  });

  it("keeps every column at least as wide as its longest word", () => {
    const rows = [
      [
        "**Redwood Inc.**",
        "Habitat Restoration & Forest Planning",
        "NEPA Support Services Proposal",
        "100 Main Street",
      ],
      ["", "", "", "Eureka, CA 95501"],
    ];
    const widths = computeColumnWidths({
      rows,
      totalWidth: 60,
      measure: measureByLength,
      padding: 1,
      emptyWidth: 3,
    });
    assertSumsTo(widths, 60);
    // "Redwood", "Restoration", "Proposal", "Eureka,"
    const longestWords = [7, 11, 8, 7];
    widths.forEach((width, col) => {
      assert.ok(
        width >= longestWords[col] + 1,
        `column ${col} (${width}) narrower than its longest word`,
      );
    });
  });

  it("lets short columns stay on one line and caps a long placeholder", () => {
    const longPlaceholder =
      "[INSERT: street address — suggested: 10811 Example Springs Road]";
    const widths = computeColumnWidths({
      rows: [["**[INSERT: firm name]**", "Planning", longPlaceholder]],
      totalWidth: 80,
      measure: measureByLength,
      padding: 0,
      emptyWidth: 3,
    });
    assertSumsTo(widths, 80);
    // Both short columns keep their full one-line width...
    assert.ok(widths[0] >= "[INSERT: firm name]".length - 1e-6);
    assert.ok(widths[1] >= "Planning".length - 1e-6);
    // ...and the placeholder only gets the room left over, wrapping inside it.
    assert.ok(widths[2] < longPlaceholder.length);
  });

  it("gives a fully empty column a small width", () => {
    const widths = computeColumnWidths({
      rows: [["Firm", "", "A long address line that wraps"]],
      totalWidth: 20,
      measure: measureByLength,
      padding: 0,
      emptyWidth: 2,
    });
    assert.strictEqual(widths[1], 2);
    assertSumsTo(widths, 20);
  });

  it("scales the minimums down when even the longest words overflow", () => {
    const widths = computeColumnWidths({
      rows: [["abcdefghij", "klmnopqrst"]],
      totalWidth: 10,
      measure: measureByLength,
      padding: 0,
      emptyWidth: 2,
    });
    assert.deepStrictEqual(widths, [5, 5]);
  });

  it("returns the full width for a single column and nothing for none", () => {
    assert.deepStrictEqual(
      computeColumnWidths({
        rows: [["Title"]],
        totalWidth: 50,
        measure: measureByLength,
        padding: 0,
        emptyWidth: 2,
      }),
      [50],
    );
    assert.deepStrictEqual(
      computeColumnWidths({
        rows: [],
        totalWidth: 50,
        measure: measureByLength,
        padding: 0,
        emptyWidth: 2,
      }),
      [],
    );
  });
});
