import assert from "node:assert";
import { describe, it } from "node:test";
import { inflateRawSync } from "node:zlib";

import { estimateTextWidthEm } from "../lib/export/letterhead-layout";
import { generateDocxFromMarkdown } from "../lib/export/markdown-to-docx";

// A4 content width in twips (11906 − 2×1440 margins).
const CONTENT_WIDTH_TWIPS = 9026;
// The letterhead font is 10.5pt, i.e. 210 twips per em.
const HEADER_EM_TWIPS = 210;

// Reads one file out of the .docx zip. docx (JSZip) writes sizes into every
// local file header, so walking the headers is enough.
const readZipEntry = (zip: Buffer, name: string): string => {
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const entryName = zip.toString(
      "utf8",
      offset + 30,
      offset + 30 + nameLength,
    );
    const dataStart = offset + 30 + nameLength + extraLength;
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    if (entryName === name) {
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    offset = dataStart + compressedSize;
  }
  throw new Error(`${name} not found in docx`);
};

const renderDocumentXml = async (markdown: string): Promise<string> => {
  const blob = await generateDocxFromMarkdown(markdown, "Test");
  const zip = Buffer.from(await blob.arrayBuffer());
  return readZipEntry(zip, "word/document.xml");
};

const firstTable = (xml: string): string => {
  const table = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0];
  assert.ok(table, "no table in document");
  return table;
};

const cellsOf = (tableXml: string): string[] =>
  tableXml.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];

const gridWidths = (tableXml: string): number[] =>
  [...tableXml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));

const alignmentOf = (paragraphXml: string): string | undefined =>
  paragraphXml.match(/<w:jc w:val="(\w+)"\/>/)?.[1];

// The run (<w:r>) that carries the given text.
const runWithText = (xml: string, text: string): string => {
  const escaped = text.replace(/&/g, "&amp;");
  const run = xml
    .match(/<w:r>[\s\S]*?<\/w:r>/g)
    ?.find((candidate) => candidate.includes(`>${escaped}</w:t>`));
  assert.ok(run, `no run with text "${text}"`);
  return run;
};

const isBold = (runXml: string): boolean => runXml.includes("<w:b/>");

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const BUG_REPORT_LETTERHEAD = [
  "| **Redwood Inc.** | Habitat Restoration & Forest Planning | NEPA Support Services Proposal | 100 Main Street |",
  "|---|---|---|---|",
  "| | | | Eureka, CA 95501 |",
].join("\n");

describe("DOCX letterhead — explicit layout (separator markers)", () => {
  const markdown = [
    "| **[INSERT: firm name]** | [INSERT: street address] |",
    "|:---|---:|",
    "| | Eureka, CA 95501 |",
  ].join("\n");

  it("aligns each column from its marker", async () => {
    const cells = cellsOf(firstTable(await renderDocumentXml(markdown)));
    assert.strictEqual(alignmentOf(cells[0]), "left");
    assert.strictEqual(alignmentOf(cells[1]), "right");
    assert.strictEqual(alignmentOf(cells[3]), "right");
  });

  it("bolds only what the markdown marks bold, including a bold placeholder", async () => {
    const table = firstTable(await renderDocumentXml(markdown));
    assert.ok(isBold(runWithText(table, "[INSERT: firm name]")));
    assert.ok(!isBold(runWithText(table, "[INSERT: street address]")));
    assert.ok(!isBold(runWithText(table, "Eureka, CA 95501")));
    assert.ok(!table.includes("*"), "emphasis markers leaked into the table");
  });

  it("spans the content width with content-sized columns", async () => {
    const widths = gridWidths(firstTable(await renderDocumentXml(markdown)));
    assert.strictEqual(widths.length, 2);
    assert.strictEqual(sum(widths), CONTENT_WIDTH_TWIPS);
  });
});

describe("DOCX letterhead — legacy layout (bare separator)", () => {
  it("keeps bold identity columns and a right-aligned address column", async () => {
    const cells = cellsOf(
      firstTable(await renderDocumentXml(BUG_REPORT_LETTERHEAD)),
    );
    assert.ok(
      isBold(runWithText(cells[1], "Habitat Restoration & Forest Planning")),
    );
    assert.ok(isBold(runWithText(cells[2], "NEPA Support Services Proposal")));
    assert.ok(!isBold(runWithText(cells[3], "100 Main Street")));
    assert.strictEqual(alignmentOf(cells[3]), "right");
    assert.strictEqual(alignmentOf(cells[1]), undefined);
  });

  it("sizes columns from content instead of the fixed agency split", async () => {
    const widths = gridWidths(
      firstTable(await renderDocumentXml(BUG_REPORT_LETTERHEAD)),
    );
    assert.strictEqual(sum(widths), CONTENT_WIDTH_TWIPS);
    assert.notDeepStrictEqual(widths, [2060, 1215, 2620, 3465]);
    // The firm name stays on one line...
    assert.ok(
      widths[0] >= estimateTextWidthEm("Redwood Inc.") * HEADER_EM_TWIPS,
      `firm column too narrow: ${widths}`,
    );
    // ...and the tagline (several lines in the old 1215-twip column) gets at least
    // half its one-line width.
    assert.ok(
      widths[1] >=
        (estimateTextWidthEm("Habitat Restoration & Forest Planning") *
          HEADER_EM_TWIPS) /
          2,
      `tagline column too narrow: ${widths}`,
    );
  });
});

describe("DOCX aligned paragraphs and body text", () => {
  it("centers {center} lines, keeping their bold, and splits inline markers", async () => {
    const xml = await renderDocumentXml(
      `${BUG_REPORT_LETTERHEAD}\n\nIntro {center}**Proposal Title**\n\n{right}**Date:** today`,
    );
    const paragraphs = xml.match(/<w:p>[\s\S]*?<\/w:p>/g) ?? [];
    const title = paragraphs.find((p) => p.includes(">Proposal Title<"));
    assert.ok(title, "title paragraph missing");
    assert.strictEqual(alignmentOf(title), "center");
    assert.ok(isBold(runWithText(title, "Proposal Title")));
    assert.ok(!title.includes("Intro"), "inline {center} was not split");
    assert.ok(!xml.includes("{center}"), "literal {center} marker leaked");

    const date = paragraphs.find((p) => p.includes(">Date:<"));
    assert.ok(date, "date paragraph missing");
    assert.strictEqual(alignmentOf(date), "right");
  });

  it("keeps body placeholders unbolded without leaking asterisks", async () => {
    const xml = await renderDocumentXml(
      `${BUG_REPORT_LETTERHEAD}\n\nPlease confirm **[INSERT: contact name]** today.`,
    );
    const body = xml.slice(xml.indexOf("</w:tbl>"));
    assert.ok(!isBold(runWithText(body, "[INSERT: contact name]")));
    assert.ok(!body.includes("*"), "emphasis markers leaked into the body");
  });

  it("honors alignment markers in body tables", async () => {
    const xml = await renderDocumentXml(
      `${BUG_REPORT_LETTERHEAD}\n\n| Item | Cost |\n| --- | ---: |\n| Survey | $100 |`,
    );
    const bodyTable = xml.slice(xml.indexOf("</w:tbl>") + 1);
    const cells = cellsOf(firstTable(bodyTable));
    assert.strictEqual(alignmentOf(cells[1]), "right");
    assert.strictEqual(alignmentOf(cells[2]), undefined);
    assert.strictEqual(alignmentOf(cells[3]), "right");
  });
});
