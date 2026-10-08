import assert from "node:assert";
import { describe, it } from "node:test";
import { inflateRawSync } from "node:zlib";

import { estimateTextWidthEm } from "../lib/export/letterhead-layout";
import { generateDocxFromMarkdown } from "../lib/export/markdown-to-docx";

// A4 content width in twips (11906 − 2×1440 margins).
const CONTENT_WIDTH_TWIPS = 9026;
// The letterhead font is 9.5pt, i.e. 190 twips per em.
const HEADER_EM_TWIPS = 190;
// The body font is 11pt, i.e. 220 twips per em.
const BODY_EM_TWIPS = 220;

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

// Border edge → style ("single", "none") for every border element in the XML.
// Cell margins share the edge names but carry w:type, not w:val.
const borderStyles = (xml: string): [string, string][] =>
  [
    ...xml.matchAll(
      /<w:(top|left|bottom|right|insideH|insideV) w:val="(\w+)"/g,
    ),
  ].map((m) => [m[1], m[2]]);

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
    assert.strictEqual(cells.length, 2);
    const addressLines = cells[1].match(/<w:p>[\s\S]*?<\/w:p>/g) ?? [];
    assert.strictEqual(addressLines.length, 2);
    for (const line of addressLines) {
      assert.strictEqual(alignmentOf(line), "right");
    }
  });

  it("stacks each column's lines in one row so they stay tight", async () => {
    const table = firstTable(await renderDocumentXml(markdown));
    assert.strictEqual(table.match(/<w:tr>/g)?.length, 1);
    const address = cellsOf(table)[1];
    assert.ok(address.includes(">[INSERT: street address]</w:t>"));
    assert.ok(address.includes(">Eureka, CA 95501</w:t>"));
    assert.ok(!table.includes("w:vMerge"), "merged cells");
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

  it("keeps inline bold in body text without leaking asterisks", async () => {
    const xml = await renderDocumentXml(
      `${BUG_REPORT_LETTERHEAD}\n\nPlease confirm **[INSERT: contact name]** by **Friday**.`,
    );
    const body = xml.slice(xml.indexOf("</w:tbl>"));
    assert.ok(isBold(runWithText(body, "[INSERT: contact name]")));
    assert.ok(isBold(runWithText(body, "Friday")));
    assert.ok(!isBold(runWithText(body, "Please confirm ")));
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

describe("DOCX body tables", () => {
  const SCHEDULE_ROWS = [
    ["Phase", "Key Deliverables", "Estimated Completion"],
    ["Phase 1 — Kickoff", "Kickoff meeting, work plan", "January 2027"],
    [
      "Phase 2 — Field Surveys",
      "Biological and cultural resource surveys",
      "April 2027",
    ],
    ["Phase 3 — Final Report", "Draft and final NEPA documents", "June 2027"],
  ];
  const scheduleTable = [
    `| ${SCHEDULE_ROWS[0].join(" | ")} |`,
    "|---|---|---|",
    ...SCHEDULE_ROWS.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");

  const renderBodyTable = async (): Promise<string> => {
    const xml = await renderDocumentXml(
      `${BUG_REPORT_LETTERHEAD}\n\n${scheduleTable}`,
    );
    return firstTable(xml.slice(xml.indexOf("</w:tbl>") + 1));
  };

  it("sizes columns from content instead of docx's 100-twip default", async () => {
    const widths = gridWidths(await renderBodyTable());
    assert.strictEqual(widths.length, 3);
    assert.strictEqual(sum(widths), CONTENT_WIDTH_TWIPS);
    assert.ok(!widths.includes(100), `default 100-twip column: ${widths}`);
    // No word breaks mid-way: every column fits its longest word at 12pt.
    widths.forEach((width, col) => {
      const longestWord = Math.max(
        ...SCHEDULE_ROWS.flatMap((row) => row[col].split(/\s+/)).map(
          (word) => estimateTextWidthEm(word) * BODY_EM_TWIPS,
        ),
      );
      assert.ok(
        width >= longestWord,
        `column ${col} narrower than its longest word: ${widths}`,
      );
    });
  });

  it("uses a fixed layout so renderers honor the grid", async () => {
    assert.ok(
      (await renderBodyTable()).includes('<w:tblLayout w:type="fixed"/>'),
    );
  });

  it("draws a visible 0.5pt grid that the cells inherit", async () => {
    const table = await renderBodyTable();
    const tableBorders = table.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/);
    assert.ok(tableBorders, "no table borders");
    assert.deepStrictEqual(
      borderStyles(tableBorders[0]).sort(),
      ["bottom", "insideH", "insideV", "left", "right", "top"].map((edge) => [
        edge,
        "single",
      ]),
    );
    assert.ok(tableBorders[0].includes('w:sz="4"'), "grid is not 0.5pt");
    // Cell-level borders would override the table grid.
    for (const cell of cellsOf(table)) {
      assert.ok(!cell.includes("<w:tcBorders>"), "cell overrides the grid");
      assert.ok(!cell.includes('w:val="none"'), "cell hides a border");
    }
  });

  it("draws only the rule (its bottom border) on the letterhead table", async () => {
    const letterhead = firstTable(
      await renderDocumentXml(`${BUG_REPORT_LETTERHEAD}\n\n${scheduleTable}`),
    );
    const styles = borderStyles(letterhead);
    assert.ok(styles.length > 0, "letterhead borders not set");
    assert.deepStrictEqual(
      styles.filter(([, style]) => style !== "none"),
      [["bottom", "single"]],
    );
  });

  it("bolds the header row and leaves data rows regular", async () => {
    const table = await renderBodyTable();
    for (const header of SCHEDULE_ROWS[0]) {
      assert.ok(isBold(runWithText(table, header)), `"${header}" not bold`);
    }
    assert.ok(!isBold(runWithText(table, "Phase 1 — Kickoff")));
    assert.ok(!isBold(runWithText(table, "January 2027")));
  });

  it("exports a row with more cells than the header row", async () => {
    const xml = await renderDocumentXml(
      `${BUG_REPORT_LETTERHEAD}\n\n| Item | Cost |\n|---|---|\n| Survey | $100 | extra |`,
    );
    assert.ok(xml.includes(">extra</w:t>"), "surplus cell missing");
  });
});

describe("DOCX banner letterhead and brand color", () => {
  // A 1×1 PNG; the exporter only needs bytes plus the intrinsic size below.
  const PNG_BYTES = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  const banner = {
    data: PNG_BYTES,
    type: "png" as const,
    width: 2400,
    height: 400,
  };
  // Content width in px at 96 dpi (9026 twips / 15).
  const CONTENT_WIDTH_PX = 601;
  const EMU_PER_PX = 9525;

  const renderWith = async (
    markdown: string,
    placement: "banner" | "inline",
    color?: string,
  ): Promise<string> => {
    const blob = await generateDocxFromMarkdown(
      markdown,
      "Test",
      banner,
      undefined,
      placement,
      color,
    );
    return readZipEntry(
      Buffer.from(await blob.arrayBuffer()),
      "word/document.xml",
    );
  };

  it("draws the banner full content width, keeping its aspect, then a colored rule", async () => {
    const xml = await renderWith("Dear reader,", "banner", "#1f5f3a");
    const extent = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
    assert.ok(extent, "no banner image");
    assert.strictEqual(Number(extent[1]), CONTENT_WIDTH_PX * EMU_PER_PX);
    assert.strictEqual(
      Number(extent[2]),
      Math.round(CONTENT_WIDTH_PX / 6) * EMU_PER_PX,
    );
    // The image sits in a 1×1 table whose bottom border is the rule.
    const table = firstTable(xml);
    assert.ok(table.includes("<wp:inline"), "banner not in its table");
    assert.strictEqual(cellsOf(table).length, 1);
    assert.match(table, /<w:bottom w:val="single" w:color="1F5F3A"/);
  });

  it("treats the first table as body content under a banner", async () => {
    const xml = await renderWith(
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
      "banner",
    );
    // Body tables carry the visible grid; the letterhead would be borderless.
    assert.ok(
      borderStyles(firstTable(xml)).some(([, style]) => style === "single"),
    );
  });

  it("colors the letterhead's bold runs and its rule, not the body", async () => {
    const xml = await renderWith(
      "| **Forest Service** | 3348 Alpine Blvd |\n| :--- | ---: |\n\nBody **text**",
      "inline",
      "#1e3a8a",
    );
    assert.match(
      runWithText(xml, "Forest Service"),
      /<w:color w:val="1E3A8A"\/>/,
    );
    assert.doesNotMatch(runWithText(xml, "3348 Alpine Blvd"), /<w:color /);
    assert.doesNotMatch(runWithText(xml, "text"), /<w:color /);
    assert.match(xml, /<w:bottom w:val="single" w:color="1E3A8A"/);
  });
});

describe("DOCX portability (Word, Pages, Google Docs, LibreOffice)", () => {
  // A 1×1 PNG; the exporter only needs bytes plus the intrinsic size below.
  const logo = {
    data: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
    type: "png" as const,
    width: 220,
    height: 280,
  };
  const LETTERHEAD =
    "| **Forest Service** | 3348 Alpine Blvd |\n| :--- | ---: |\n| | Alpine, CA 91901 |";

  const render = async (
    markdown: string,
    placement?: "margin" | "inline" | "above" | "banner",
    color?: string,
  ) => {
    const blob = await generateDocxFromMarkdown(
      markdown,
      "Test",
      placement ? logo : undefined,
      undefined,
      placement,
      color,
    );
    const zip = Buffer.from(await blob.arrayBuffer());
    return {
      document: readZipEntry(zip, "word/document.xml"),
      styles: readZipEntry(zip, "word/styles.xml"),
    };
  };

  const paragraphs = (xml: string): string[] =>
    xml.match(/<w:p>[\s\S]*?<\/w:p>/g) ?? [];
  const paragraphWith = (xml: string, text: string): string => {
    const found = paragraphs(xml).find((p) => p.includes(`>${text}</w:t>`));
    assert.ok(found, `no paragraph with "${text}"`);
    return found;
  };
  const spacingOf = (paragraphXml: string) => {
    const spacing = paragraphXml.match(/<w:spacing [^>]*\/>/)?.[0] ?? "";
    const attr = (name: string) =>
      spacing.match(new RegExp(`w:${name}="(\\d+)"`))?.[1];
    return { before: attr("before"), after: attr("after"), line: attr("line") };
  };

  for (const placement of ["margin", "inline", "above", "banner"] as const) {
    it(`draws the ${placement} logo as an inline image, never anchored`, async () => {
      const { document } = await render(`${LETTERHEAD}\n\nBody`, placement);
      assert.ok(document.includes("<wp:inline"), "logo missing");
      assert.ok(!document.includes("<wp:anchor"), "floating image");
      assert.ok(!document.includes("<w:pBdr>"), "paragraph-border rule");
    });
  }

  for (const [placement, logoWidthPx] of [
    ["margin", 57],
    ["inline", 68],
  ] as const) {
    it(`puts the ${placement} logo in its own first letterhead column`, async () => {
      const { document } = await render(`${LETTERHEAD}\n\nBody`, placement);
      const table = firstTable(document);
      const widths = gridWidths(table);
      assert.strictEqual(widths.length, 3);
      assert.strictEqual(widths[0], logoWidthPx * 15 + 180);
      assert.strictEqual(sum(widths), CONTENT_WIDTH_TWIPS);
      const logoCell = cellsOf(table)[0];
      assert.ok(logoCell.includes("<wp:inline"), "logo not in first cell");
      assert.strictEqual(table.match(/<w:tr>/g)?.length, 1);
      assert.ok(logoCell.includes('<w:vAlign w:val="top"/>'));
      assert.ok(!cellsOf(table)[1].includes("<w:drawing>"));
    });
  }

  it("draws the rule under the letterhead as its table's colored bottom border", async () => {
    const { document } = await render(
      `${LETTERHEAD}\n\nBody`,
      "inline",
      "#1e3a8a",
    );
    const tableBorders = firstTable(document).match(
      /<w:tblBorders>[\s\S]*?<\/w:tblBorders>/,
    )?.[0];
    assert.ok(tableBorders, "no table borders");
    assert.match(tableBorders, /<w:bottom w:val="single" w:color="1E3A8A"/);
  });

  it("marks a default paragraph style so Pages keeps direct formatting", async () => {
    const { styles } = await render("Body");
    assert.match(
      styles,
      /<w:style w:type="paragraph" w:default="1" w:styleId="Normal">/,
    );
    assert.match(styles, /<w:style w:type="table" w:default="1"/);
    assert.match(styles, /<w:sz w:val="22"\/>/);
    assert.match(styles, /w:after="160"/);
    assert.match(styles, /w:line="276"/);
  });

  it("gives body paragraphs 1.15 lines, 8pt after and no indents", async () => {
    const { document } = await render("First paragraph.\n\nSecond one.");
    const first = paragraphWith(document, "First paragraph.");
    assert.deepStrictEqual(spacingOf(first), {
      before: "0",
      after: "160",
      line: "276",
    });
    assert.strictEqual(alignmentOf(first), "left");
    assert.match(first, /<w:ind w:left="0" w:right="0" w:firstLine="0"\/>/);
    assert.ok(!first.includes("w:hanging"));
  });

  it("turns single newlines into line breaks within one paragraph", async () => {
    const { document } = await render(
      "Sincerely,\n\nMARIA DELGADO\nDistrict Ranger",
    );
    const signature = paragraphWith(document, "MARIA DELGADO");
    assert.ok(signature.includes(">District Ranger</w:t>"));
    assert.strictEqual(signature.match(/<w:br\/>/g)?.length, 1);
  });

  it("treats a bold-only paragraph as a section heading", async () => {
    const { document } = await render(
      "**Purpose and Need**\n\nText with **some** bold.",
    );
    const heading = paragraphWith(document, "Purpose and Need");
    assert.ok(isBold(runWithText(heading, "Purpose and Need")));
    assert.ok(heading.includes("<w:keepNext/>"));
    assert.deepStrictEqual(spacingOf(heading), {
      before: "240",
      after: "80",
      line: "276",
    });
    const body = paragraphWith(document, "Text with ");
    assert.ok(!body.includes("<w:keepNext/>"), "mixed bold is not a heading");
  });

  it("bolds markdown headings at their level's size", async () => {
    const { document } = await render("## Proposed Treatments");
    const heading = paragraphWith(document, "Proposed Treatments");
    assert.ok(heading.includes('<w:pStyle w:val="Heading2"/>'));
    const run = runWithText(heading, "Proposed Treatments");
    assert.ok(isBold(run));
    assert.match(run, /<w:sz w:val="30"\/>/);
    assert.ok(heading.includes("<w:keepNext/>"));
  });

  it("leaves 36pt after a complimentary close", async () => {
    for (const close of ["Sincerely,", "Respectfully", "sincerely yours,"]) {
      const { document } = await render(`${close}\n\nMARIA DELGADO`);
      assert.strictEqual(
        spacingOf(paragraphWith(document, close)).after,
        "720",
      );
    }
  });

  it("right-aligns consecutive {right} lines, spacing only after the last", async () => {
    const { document } = await render(
      "{right}**File Code:** 1950\n\n{right}**Date:** August 7, 2026\n\nDear reader,",
    );
    const fileCode = paragraphWith(document, "File Code:");
    const date = paragraphWith(document, "Date:");
    assert.strictEqual(alignmentOf(fileCode), "right");
    assert.strictEqual(alignmentOf(date), "right");
    assert.strictEqual(spacingOf(fileCode).after, "0");
    assert.strictEqual(spacingOf(date).after, "160");
  });
});
