import assert from "node:assert";
import { describe, it } from "node:test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  type GridLetterheadOption,
  generatePdfFromMarkdown,
} from "@wildfires-org/turboplan-signing/pdf";
import {
  GRID_BASE_FONT_RATIO,
  layoutGridLetterhead,
  type PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

// A4 with the generator's 50pt margins.
const MARGIN = 50;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = 595.28 - 2 * MARGIN;
const TOLERANCE = 0.5;
// The grid's base size: its fraction of the content width (9.5pt here).
const BASE_SIZE = GRID_BASE_FONT_RATIO * CONTENT_WIDTH;
// Gap above and below the rule, and its width (points).
const RULE_GAP = 6;
const RULE_WIDTH = 0.75;
// Times-Roman's ascender (em): a line's baseline sits this far below its top.
const TIMES_ASCENDER = 0.683;
// The height PDFKit gives a Times-Roman line (em): ascender 683 − descender
// −217 + line gap 216, per thousand.
const TIMES_LINE_HEIGHT = 1.116;

// 1×1 PNG.
const PNG = {
  data: new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
      "base64",
    ),
  ),
  contentType: "image/png",
};

// Body paragraphs are drawn word by word: the body starts with this run.
const BODY_FIRST_WORD = "Dear";
const BODY = `Dear Interested Party:

Body paragraph.

| Unit | Acres |
| --- | --- |
| A | 120 |`;

const line = (text: string, bold: boolean, size = "normal" as const) => ({
  text,
  bold,
  size,
});

const AGENCY: PublicGridLetterhead = {
  color: "#1f5f3a",
  cells: [
    { kind: "logo", x: 0, width: 0.09, height: 0.09, index: 0 },
    {
      kind: "text",
      x: 0.1,
      width: 0.16,
      align: "left",
      lines: [
        line("United States", true),
        line("Department of", true),
        line("Agriculture", true),
      ],
    },
    {
      kind: "text",
      x: 0.27,
      width: 0.1,
      align: "left",
      lines: [line("Forest", true), line("Service", true)],
    },
    {
      kind: "text",
      x: 0.38,
      width: 0.22,
      align: "left",
      lines: [line("Tahoe National Forest", true)],
    },
    {
      kind: "text",
      x: 0.7,
      width: 0.3,
      align: "right",
      lines: [
        line("631 Coyote Street", false),
        line("Nevada City, CA 95959", false),
        line("530-265-4531", false),
      ],
    },
  ],
};

const LONG_WORD = "Supercalifragilisticexpialidocious";

const AGENCY_LINES = [
  "United States",
  "Department of",
  "Agriculture",
  "Forest",
  "Service",
  "Tahoe National Forest",
  "631 Coyote Street",
  "Nevada City, CA 95959",
  "530-265-4531",
];

// What page 1 draws, in drawing order, in top-left page coordinates (points).
type DrawnText = {
  text: string;
  color: string;
  x: number;
  width: number;
  // Baseline, from the top of the page.
  baseline: number;
  size: number;
};
type DrawnImage = { x: number; top: number; width: number; height: number };
// A stroked straight line, in top-left page coordinates (points).
type DrawnStroke = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};

type Glyph = { unicode: string; width: number } | number;

const toHex = (rgb: ArrayLike<number>) =>
  `#${Array.from(rgb, (value) => value.toString(16).padStart(2, "0")).join("")}`;

type DrawnPage = {
  texts: DrawnText[];
  images: DrawnImage[];
  strokes: DrawnStroke[];
  pageCount: number;
};

const readPage = async (
  bytes: Uint8Array,
  pageNumber = 1,
): Promise<DrawnPage> => {
  // pdf.js takes over (detaches) the buffer it is given: read a copy.
  const pdf = await getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  try {
    const page = await pdf.getPage(pageNumber);
    const pageHeight = page.view[3];
    const { fnArray, argsArray } = await page.getOperatorList();
    const texts: DrawnText[] = [];
    const images: DrawnImage[] = [];
    const strokes: DrawnStroke[] = [];
    let color = "#000000";
    let strokeColor = "#000000";
    let lineWidth = 1;
    let size = 0;
    let textMatrix = [1, 0, 0, 1, 0, 0];
    let transform = [1, 0, 0, 1, 0, 0];
    fnArray.forEach((fn, index) => {
      const args = argsArray[index];
      if (fn === OPS.setFillRGBColor) {
        color = toHex(args);
      } else if (fn === OPS.setStrokeRGBColor) {
        strokeColor = toHex(args);
      } else if (fn === OPS.setLineWidth) {
        lineWidth = args[0];
      } else if (fn === OPS.constructPath) {
        // PDFKit draws in a flipped space, so path coordinates are already
        // top-left based. A rule is one moveTo + lineTo.
        const [ops, coords] = args as [number[], number[]];
        if (
          ops.length === 2 &&
          ops[0] === OPS.moveTo &&
          ops[1] === OPS.lineTo
        ) {
          const [x1, y1, x2, y2] = coords;
          strokes.push({
            x1,
            y1,
            x2,
            y2,
            color: strokeColor,
            width: lineWidth,
          });
        }
      } else if (fn === OPS.setFont) {
        size = args[1];
      } else if (fn === OPS.setTextMatrix) {
        textMatrix = args;
      } else if (fn === OPS.transform) {
        transform = args;
      } else if (fn === OPS.showText) {
        const glyphs: Glyph[] = args[0];
        // Glyph advances minus TJ kerning adjustments, in thousandths of an em.
        const advance = glyphs.reduce<number>(
          (sum, glyph) =>
            typeof glyph === "number" ? sum - glyph : sum + glyph.width,
          0,
        );
        texts.push({
          text: glyphs
            .map((glyph) => (typeof glyph === "number" ? "" : glyph.unicode))
            .join(""),
          color,
          x: textMatrix[4],
          width: (advance * size) / 1000,
          baseline: pageHeight - textMatrix[5],
          size,
        });
      } else if (fn === OPS.paintImageXObject) {
        // PDFKit draws an image as `w 0 0 -h x y+h cm` in its flipped space.
        images.push({
          x: transform[4],
          top: transform[5] + transform[3],
          width: transform[0],
          height: -transform[3],
        });
      }
    });
    return { texts, images, strokes, pageCount: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
};

const generate = (
  gridLetterhead: GridLetterheadOption,
  extra: Parameters<typeof generatePdfFromMarkdown>[2] = {},
  body = BODY,
) => generatePdfFromMarkdown(body, "Letter", { ...extra, gridLetterhead });

const render = async (
  gridLetterhead: GridLetterheadOption,
  extra: Parameters<typeof generatePdfFromMarkdown>[2] = {},
) => readPage(await generate(gridLetterhead, extra));

// The rule under the letterhead: the first stroke on page 1, full width.
const ruleOf = (strokes: DrawnStroke[]): DrawnStroke => {
  const [rule] = strokes;
  assert.ok(rule, "a rule is drawn");
  assertClose(rule.x1, MARGIN, "rule start");
  assertClose(rule.x2, MARGIN + CONTENT_WIDTH, "rule end");
  assertClose(rule.y1, rule.y2, "rule is horizontal");
  return rule;
};

// The runs drawn before the body: the letterhead.
const letterheadOf = (texts: DrawnText[]): DrawnText[] =>
  texts.slice(
    0,
    texts.findIndex((entry) => entry.text === BODY_FIRST_WORD),
  );

const textOf = (texts: DrawnText[], text: string): DrawnText => {
  const found = texts.find((entry) => entry.text === text);
  assert.ok(found, `"${text}" is drawn`);
  return found;
};

const assertClose = (actual: number, expected: number, message?: string) =>
  assert.ok(
    Math.abs(actual - expected) <= TOLERANCE,
    `${message ?? "value"}: ${actual} ≈ ${expected}`,
  );

describe("generatePdfFromMarkdown with a grid letterhead", () => {
  it("draws every cell's lines first, cell by cell, then the body", async () => {
    const { texts } = await render({ grid: AGENCY, logos: [PNG] });
    assert.deepStrictEqual(
      texts.slice(0, AGENCY_LINES.length).map((entry) => entry.text),
      AGENCY_LINES,
    );
    assert.strictEqual(texts[AGENCY_LINES.length].text, BODY_FIRST_WORD);
  });

  it("top-aligns the cells in one row", async () => {
    const { texts, images } = await render({ grid: AGENCY, logos: [PNG] });
    const firstLines = [
      "United States",
      "Forest",
      "Tahoe National Forest",
      "631 Coyote Street",
    ].map((text) => textOf(texts, text).baseline);
    for (const baseline of firstLines) {
      assertClose(baseline, firstLines[0], "first-line baseline");
    }
    assert.strictEqual(images.length, 1);
    assertClose(images[0].top, MARGIN, "logo top");
  });

  it("places, aligns and wraps each text cell inside its content box", async () => {
    const grid: PublicGridLetterhead = {
      ...AGENCY,
      cells: [
        ...AGENCY.cells.slice(1),
        {
          kind: "text",
          x: 0.62,
          width: 0.06,
          align: "center",
          lines: [line(LONG_WORD, true)],
        },
      ],
    };
    const texts = letterheadOf((await render({ grid, logos: [] })).texts);

    for (const segment of layoutGridLetterhead(grid)) {
      if (segment.kind === "gap" || segment.cell.kind !== "text") {
        continue;
      }
      const { cell } = segment;
      const left = MARGIN + segment.contentStart * CONTENT_WIDTH;
      const right = left + segment.contentWidth * CONTENT_WIDTH;
      // A cell's runs: its lines, or the pieces of the word too long for it.
      const drawn = texts.filter((entry) =>
        cell.lines.some(
          (cellLine) =>
            cellLine.text === entry.text ||
            (cellLine.text === LONG_WORD && LONG_WORD.includes(entry.text)),
        ),
      );
      assert.ok(drawn.length >= cell.lines.length);
      for (const entry of drawn) {
        assert.ok(
          entry.x >= left - TOLERANCE,
          `"${entry.text}" starts in its box`,
        );
        assert.ok(
          entry.x + entry.width <= right + TOLERANCE,
          `"${entry.text}" ends in its box`,
        );
        if (cell.align === "left") {
          assertClose(entry.x, left, `"${entry.text}" left edge`);
        } else if (cell.align === "right") {
          assertClose(
            entry.x + entry.width,
            right,
            `"${entry.text}" right edge`,
          );
        }
      }
    }

    // A word wider than its box breaks between characters.
    const parts = texts.filter((entry) => LONG_WORD.includes(entry.text));
    assert.ok(parts.length > 1);
    assert.strictEqual(parts.map((entry) => entry.text).join(""), LONG_WORD);
  });

  it("scales lines by their size", async () => {
    const grid: PublicGridLetterhead = {
      color: null,
      cells: [
        {
          kind: "text",
          x: 0,
          width: 1,
          align: "center",
          lines: [
            { text: "Huge", bold: true, size: "xxlarge" },
            { text: "Bigger", bold: true, size: "xlarge" },
            { text: "Large", bold: true, size: "large" },
            { text: "Normal", bold: true, size: "normal" },
            { text: "Small", bold: false, size: "small" },
          ],
        },
      ],
    };
    const { texts } = await render({ grid, logos: [] });
    // The base is the shared fraction of the content width: 9.5pt on A4.
    assertClose(BASE_SIZE, 9.5);
    assertClose(textOf(texts, "Huge").size, BASE_SIZE * 2.6);
    assertClose(textOf(texts, "Bigger").size, BASE_SIZE * 1.8);
    assertClose(textOf(texts, "Large").size, BASE_SIZE * 1.3);
    assertClose(textOf(texts, "Normal").size, BASE_SIZE);
    assertClose(textOf(texts, "Small").size, BASE_SIZE * 0.85);
  });

  it("sizes the text from the grid's base text size, held to 6.5–13 pt", async () => {
    const sizesFor = async (fontSize?: number) => {
      const grid: PublicGridLetterhead = {
        color: null,
        cells: [
          {
            kind: "text",
            x: 0,
            width: 1,
            align: "center",
            lines: [
              { text: "Large", bold: true, size: "large" },
              { text: "Normal", bold: true, size: "normal" },
            ],
          },
        ],
        ...(fontSize === undefined ? {} : { fontSize }),
      };
      const { texts } = await render({ grid, logos: [] });
      return {
        large: textOf(texts, "Large").size,
        normal: textOf(texts, "Normal").size,
      };
    };
    const assertSize = (actual: number, expected: number) =>
      assert.ok(Math.abs(actual - expected) < 0.01, `${actual} ≈ ${expected}`);
    const A4_WIDTH = 595.28;

    // 11 pt on an A4 reference is 11 pt here; lines scale from it.
    const a4 = await sizesFor(11 / A4_WIDTH);
    assertSize(a4.normal, 11);
    assertSize(a4.large, 11 * 1.3);
    // 7 pt on a US Letter reference: the same share of this page's width.
    assertSize((await sizesFor(7 / 612)).normal, (7 * A4_WIDTH) / 612);
    // Fine print and display type are held to readable bounds.
    assertSize((await sizesFor(3 / A4_WIDTH)).normal, 6.5);
    assertSize((await sizesFor(30 / A4_WIDTH)).normal, 13);
    // Without one, the default.
    assertSize((await sizesFor()).normal, 9.5);
  });

  it("places a cell shorter than the row at its top, middle or bottom", async () => {
    const grid: PublicGridLetterhead = {
      color: null,
      cells: [
        { kind: "logo", x: 0, width: 0.1, height: 0.1, index: 0 },
        {
          kind: "text",
          x: 0.2,
          width: 0.25,
          align: "left",
          lines: [line("Top", false)],
        },
        {
          kind: "text",
          x: 0.5,
          width: 0.2,
          align: "left",
          valign: "middle",
          lines: [line("Middle", false)],
        },
        {
          kind: "text",
          x: 0.75,
          width: 0.25,
          align: "right",
          valign: "bottom",
          lines: [line("Bottom", false)],
        },
      ],
    };
    const { texts, images, strokes } = await render({ grid, logos: [PNG] });

    // The logo is the tallest cell: the row, from the top margin.
    const [logo] = images;
    assertClose(logo.top, MARGIN, "logo top");
    const rowHeight = 0.1 * CONTENT_WIDTH;
    assertClose(logo.height, rowHeight, "logo height");
    const cellHeight = TIMES_LINE_HEIGHT * BASE_SIZE;
    const baselineAt = (offset: number) =>
      MARGIN + offset + TIMES_ASCENDER * BASE_SIZE;
    assertClose(textOf(texts, "Top").baseline, baselineAt(0), "top");
    assertClose(
      textOf(texts, "Middle").baseline,
      baselineAt((rowHeight - cellHeight) / 2),
      "middle",
    );
    assertClose(
      textOf(texts, "Bottom").baseline,
      baselineAt(rowHeight - cellHeight),
      "bottom",
    );
    // The rule stays under the row.
    assertClose(ruleOf(strokes).y1, MARGIN + rowHeight + RULE_GAP, "rule");
  });

  it("places a logo shorter than the text beside it by its alignment", async () => {
    const lines = Array.from({ length: 8 }, (_, index) =>
      line(`Line ${index + 1}`, false),
    );
    const logoTop = async (valign?: "middle" | "bottom") => {
      const grid: PublicGridLetterhead = {
        color: null,
        cells: [
          {
            kind: "logo",
            x: 0,
            width: 0.06,
            height: 0.06,
            index: 0,
            ...(valign ? { valign } : {}),
          },
          { kind: "text", x: 0.1, width: 0.5, align: "left", lines },
        ],
      };
      const [logo] = (await readPage(await generate({ grid, logos: [PNG] })))
        .images;
      return logo.top;
    };
    const rowHeight = 8 * TIMES_LINE_HEIGHT * BASE_SIZE;
    const logoHeight = 0.06 * CONTENT_WIDTH;
    assertClose(await logoTop(), MARGIN, "top");
    assertClose(
      await logoTop("middle"),
      MARGIN + (rowHeight - logoHeight) / 2,
      "middle",
    );
    assertClose(
      await logoTop("bottom"),
      MARGIN + rowHeight - logoHeight,
      "bottom",
    );
  });

  it("draws bold lines in the grid colour, regular lines and body tables in black", async () => {
    const { texts } = await render(
      { grid: AGENCY, logos: [PNG] },
      // The grid's own colour wins over the caller's accent.
      { accentColor: "#ff0000" },
    );
    for (const text of AGENCY_LINES.slice(0, 6)) {
      assert.strictEqual(textOf(texts, text).color, "#1f5f3a", text);
    }
    for (const text of AGENCY_LINES.slice(6)) {
      assert.strictEqual(textOf(texts, text).color, "#000000", text);
    }
    // The content's first table is a body table, not a letterhead.
    assert.strictEqual(textOf(texts, "Unit").color, "#000000");

    const plain = await render({
      grid: { ...AGENCY, color: null },
      logos: [PNG],
    });
    assert.strictEqual(textOf(plain.texts, "United States").color, "#000000");
  });

  it("draws each logo cell at its size, top-left in its box", async () => {
    const grid: PublicGridLetterhead = {
      color: null,
      cells: [
        { kind: "logo", x: 0, width: 0.1, height: 0.1, index: 0 },
        {
          kind: "text",
          x: 0.14,
          width: 0.72,
          align: "center",
          lines: [line("Department of Forestry and Fire Protection", true)],
        },
        { kind: "logo", x: 0.9, width: 0.1, height: 0.05, index: 1 },
      ],
    };
    // A grid with logo cells draws only its own logos, never a margin logo.
    const { images } = await render({ grid, logos: [PNG, PNG] }, { logo: PNG });
    assert.strictEqual(images.length, 2);
    const [left, right] = images;
    assertClose(left.x, MARGIN);
    assertClose(left.top, MARGIN);
    assertClose(left.width, 0.1 * CONTENT_WIDTH);
    assertClose(left.height, 0.1 * CONTENT_WIDTH);
    assertClose(right.x, MARGIN + 0.9 * CONTENT_WIDTH);
    assertClose(right.top, MARGIN);
    // A 1×1 image fits a 2:1 box at its height, left-aligned.
    assertClose(right.height, 0.05 * CONTENT_WIDTH);
  });

  it("skips a logo that fails to embed or did not load", async (t) => {
    const logged = t.mock.method(console, "error", () => {});
    const grid: PublicGridLetterhead = {
      ...AGENCY,
      cells: [
        ...AGENCY.cells,
        { kind: "logo", x: 0.62, width: 0.06, height: 0.06, index: 1 },
      ],
    };
    const { texts, images } = await render({
      grid,
      logos: [{ data: new Uint8Array([1, 2, 3, 4]), contentType: "image/png" }],
    });
    assert.strictEqual(images.length, 0);
    assert.strictEqual(logged.mock.callCount(), 1);
    assert.deepStrictEqual(
      texts.slice(0, AGENCY_LINES.length).map((entry) => entry.text),
      AGENCY_LINES,
    );
  });

  it("starts the body below the letterhead", async () => {
    const { texts, images } = await render({ grid: AGENCY, logos: [PNG] });
    const letterheadBottom = Math.max(
      images[0].top + images[0].height,
      ...AGENCY_LINES.map((text) => textOf(texts, text).baseline),
    );
    const body = textOf(texts, BODY_FIRST_WORD);
    assert.ok(
      body.baseline - body.size > letterheadBottom,
      `body (${body.baseline}) below the letterhead (${letterheadBottom})`,
    );
  });

  it("keeps the office/org logo in the margin for a grid without logo cells", async () => {
    const grid: PublicGridLetterhead = {
      ...AGENCY,
      cells: AGENCY.cells.filter((cell) => cell.kind === "text"),
    };
    const { images } = await render(
      { grid, logos: [] },
      { logo: PNG, logoPlacement: "margin" },
    );
    assert.strictEqual(images.length, 1);
    assert.ok(images[0].x + images[0].width <= MARGIN);
    assertClose(images[0].top, MARGIN);
  });

  it("draws the rule in the grid's colour 6pt below the row, the body 6pt below it", async () => {
    const { texts, images, strokes } = await render({
      grid: AGENCY,
      logos: [PNG],
    });
    const rule = ruleOf(strokes);
    // The logo (0.09 of the width) is the tallest cell.
    const [logo] = images;
    assertClose(rule.y1, logo.top + logo.height + RULE_GAP, "rule y");
    assert.strictEqual(rule.color, "#1f5f3a");
    assertClose(rule.width, RULE_WIDTH, "rule width");
    const body = textOf(texts, BODY_FIRST_WORD);
    assertClose(
      body.baseline,
      rule.y1 + RULE_GAP + TIMES_ASCENDER * body.size,
      "body baseline",
    );

    const plain = await render({
      grid: { ...AGENCY, color: null },
      logos: [PNG],
    });
    assert.strictEqual(ruleOf(plain.strokes).color, "#000000");
  });

  it("adds no height for a logo that did not load", async () => {
    const text: PublicGridLetterhead["cells"][number] = {
      kind: "text",
      x: 0.3,
      width: 0.7,
      align: "left",
      lines: [line("Tahoe National Forest", true)],
    };
    // A logo far taller than the one line of text.
    const tallLogo: PublicGridLetterhead["cells"][number] = {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.15,
      index: 0,
    };
    const textOnly = await render({
      grid: { color: null, cells: [text] },
      logos: [],
    });
    const missing = await render({
      grid: { color: null, cells: [tallLogo, text] },
      logos: [null],
    });
    const drawn = await render({
      grid: { color: null, cells: [tallLogo, text] },
      logos: [PNG],
    });
    assert.strictEqual(missing.images.length, 0);
    assertClose(
      ruleOf(missing.strokes).y1,
      ruleOf(textOnly.strokes).y1,
      "rule without the logo",
    );
    assertClose(
      ruleOf(drawn.strokes).y1,
      MARGIN + 0.15 * CONTENT_WIDTH + RULE_GAP,
      "rule below a drawn logo",
    );
  });

  it("fits a logo into its box with its aspect kept", async () => {
    // A 2×1 image in a square box: full width, half height, top-left.
    const wide = {
      data: new Uint8Array(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGNgYGD4D8IABgMB/8+HxnAAAAAASUVORK5CYII=",
          "base64",
        ),
      ),
      contentType: "image/png",
    };
    const { images, strokes } = await render({
      grid: {
        color: null,
        cells: [{ kind: "logo", x: 0, width: 0.1, height: 0.1, index: 0 }],
      },
      logos: [wide],
    });
    assert.strictEqual(images.length, 1);
    assertClose(images[0].x, MARGIN);
    assertClose(images[0].top, MARGIN);
    assertClose(images[0].width, 0.1 * CONTENT_WIDTH);
    assertClose(images[0].height, 0.05 * CONTENT_WIDTH);
    // The row is as tall as the drawn image, not its box.
    assertClose(ruleOf(strokes).y1, MARGIN + 0.05 * CONTENT_WIDTH + RULE_GAP);
  });

  it("numbers page 2 of a letter with a grid letterhead", async () => {
    const longBody = Array(60)
      .fill("Another paragraph of a long letter.")
      .join("\n\n");
    const bytes = await generate({ grid: AGENCY, logos: [PNG] }, {}, longBody);
    const first = await readPage(bytes, 1);
    assert.ok(first.pageCount >= 2, "the letter runs onto page 2");
    // Page 1 carries no number; page 2 its number in the top margin, at the
    // right edge.
    assert.ok(!first.texts.some((entry) => entry.text === "1"));
    const second = await readPage(bytes, 2);
    const number = textOf(second.texts, "2");
    assert.ok(number.baseline < MARGIN, "in the top margin");
    assertClose(number.x + number.width, MARGIN + CONTENT_WIDTH, "right edge");
    // The letterhead is drawn on page 1 only.
    assert.ok(!second.texts.some((entry) => entry.text === "United States"));
    assert.strictEqual(second.images.length, 0);
  });

  it("keeps a letterhead taller than the page on page 1", async (t) => {
    const warned = t.mock.method(console, "warn", () => {});
    const sentence = "Forest Service District Office ".repeat(6).trim();
    const grid: PublicGridLetterhead = {
      color: "#1f5f3a",
      cells: [
        {
          // Set right at the left edge: it has no free space to grow into,
          // so it stays a narrow column every word wraps in.
          kind: "text",
          x: 0,
          width: 0.06,
          align: "right",
          lines: Array.from({ length: 12 }, () => line(sentence, true)),
        },
      ],
    };
    const bytes = await generate({ grid, logos: [] });
    const first = await readPage(bytes, 1);
    const pageBottom = PAGE_HEIGHT - MARGIN;
    const letterhead = first.texts.filter((entry) => entry.color === "#1f5f3a");
    assert.ok(letterhead.length > 0);
    for (const entry of letterhead) {
      assert.ok(
        entry.baseline <= pageBottom,
        `"${entry.text}" (${entry.baseline}) above the bottom margin`,
      );
    }
    const rule = ruleOf(first.strokes);
    assert.ok(rule.y1 <= pageBottom, `rule (${rule.y1}) on page 1`);
    assert.ok(
      rule.y1 > letterhead.at(-1)!.baseline,
      "the rule stays below the text",
    );
    assert.strictEqual(warned.mock.callCount(), 1);
    // No room is left on page 1: the body starts on page 2.
    assert.ok(!first.texts.some((entry) => entry.text === BODY_FIRST_WORD));
    const second = await readPage(bytes, 2);
    assert.ok(second.texts.some((entry) => entry.text === BODY_FIRST_WORD));
  });
});
