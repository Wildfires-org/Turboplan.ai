import assert from "node:assert";
import { describe, it } from "node:test";

import { documentSchema as schema } from "../lib/editor/config";
import { buildContentFromDocument } from "../lib/editor/markdown-serializer";
import { parseTableAlignments } from "../lib/export/letterhead-layout";

const strong = schema.mark("strong");

const cell = (text: string, align: string | null, isBold = false) =>
  schema.node(
    "table_cell",
    { align },
    text ? [schema.text(text, isBold ? [strong] : [])] : [],
  );

const letterhead = (alignments: Array<string | null>) =>
  schema.node("table", null, [
    schema.node("table_row", null, [
      cell("[INSERT: firm name]", alignments[0], true),
      cell("100 Main Street", alignments[1]),
    ]),
    schema.node("table_row", null, [
      cell("", alignments[0]),
      cell("Eureka, CA 95501", alignments[1]),
    ]),
  ]);

const serialize = (...blocks: ReturnType<typeof schema.node>[]) =>
  buildContentFromDocument(schema.node("doc", null, blocks));

const separatorOf = (markdown: string): string => {
  const line = markdown.split("\n")[1];
  assert.ok(line?.startsWith("|"), `no separator row in:\n${markdown}`);
  return line;
};

describe("editor markdown serializer", () => {
  it("keeps the letterhead's alignment markers through an edit", () => {
    const markdown = serialize(letterhead(["left", "right"]));
    assert.deepStrictEqual(parseTableAlignments(separatorOf(markdown)), [
      "left",
      "right",
    ]);
  });

  it("writes a center marker and a bare separator for unaligned columns", () => {
    const markdown = serialize(letterhead(["center", null]));
    assert.deepStrictEqual(parseTableAlignments(separatorOf(markdown)), [
      "center",
      null,
    ]);
  });

  it("keeps a legacy letterhead unmarked", () => {
    const markdown = serialize(letterhead([null, null]));
    assert.match(separatorOf(markdown), /^\|-+\|-+\|$/);
  });

  it("keeps bold cell text as real markdown emphasis", () => {
    const markdown = serialize(letterhead(["left", "right"]));
    const firstRow = markdown.split("\n")[0];
    assert.ok(
      firstRow.includes("**\\[INSERT: firm name\\]**"),
      `bold markers were escaped: ${firstRow}`,
    );
  });

  it("escapes literal emphasis characters typed into a cell", () => {
    const markdown = serialize(
      schema.node("table", null, [
        schema.node("table_row", null, [cell("5 * 3", null)]),
      ]),
    );
    assert.ok(markdown.includes("5 \\* 3"), markdown);
  });

  it("serializes centered paragraphs with the {center} prefix", () => {
    const markdown = serialize(
      schema.node("center_aligned", null, [
        schema.text("Proposal for "),
        schema.text("Wildfire Planning", [strong]),
      ]),
      schema.node("right_aligned", null, [schema.text("Date: today")]),
    );
    assert.strictEqual(
      markdown,
      "{center}Proposal for **Wildfire Planning**\n\n{right}Date: today",
    );
  });
});
