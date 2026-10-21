import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Box,
  buildLetterheadAnalysisPrompt,
  dropMarksInTextBlocks,
  filterPlacedLogos,
  findInkColor,
  findLogoMarks,
  fontSizeFromInk,
  isScannedHeader,
  LETTERHEAD_MAX_HEADER_HEIGHT,
  LETTERHEAD_RENDER_WIDTH,
  type LetterheadBlock,
  letterheadAnalysisOutputSchema,
  matchBlocksToText,
  measureBlockInk,
  measureLineInk,
  type PdfTextItem,
  toGridDraft,
  toTextLines,
} from "../src/letterhead";

const IMAGE = { width: 1568, height: 609 };

const box = (x: number, y: number, width: number, height: number): Box => ({
  x,
  y,
  width,
  height,
});

const item = (
  text: string,
  x: number,
  y: number,
  width: number,
  options: { height?: number; bold?: boolean | null } = {},
): PdfTextItem => ({
  text,
  box: box(x, y, width, options.height ?? 20),
  bold: options.bold ?? null,
});

const noCrop = () => new Uint8Array([1]);

const unionOf = (...boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
};

// Native text layer: a model line the PDF does not print is dropped.
const match = (
  blocks: LetterheadBlock[],
  textLines: PdfTextItem[],
  dropUnprinted = true,
) => matchBlocksToText(blocks, textLines, { dropUnprinted });

const placed = (...boxes: Box[]) => ({ source: "pdf" as const, boxes });
const marks = (...boxes: Box[]) => ({ source: "pixels" as const, boxes });

// The Truckee Ranger District header at 1568 px: seal left, three bold name
// columns, address right.
const agencyTextLines = [
  item("United States", 211, 120, 142, { bold: true }),
  item("Department of", 211, 145, 140, { bold: true }),
  item("Agriculture", 211, 170, 115, { bold: true }),
  item("Forest", 487, 120, 60, { bold: true }),
  item("Service", 487, 145, 70, { bold: true }),
  item("Tahoe National Forest", 695, 120, 230, { bold: true }),
  item("10811 Stockrest Springs Road", 1087, 120, 290, { bold: false }),
  item("Truckee, CA 96161", 1160, 145, 217, { bold: false }),
];
const agencyBlocks: LetterheadBlock[] = [
  {
    role: "name",
    lines: ["USDA", "United States", "Department of", "Agriculture"],
    box: box(78, 95, 180, 110),
  },
  // Placed over the USDA block by the model (x 210 instead of 487).
  { role: "name", lines: ["Forest", "Service"], box: box(210, 120, 160, 70) },
  {
    role: "name",
    lines: ["Tahoe National Forest"],
    box: box(695, 120, 330, 60),
  },
  {
    role: "contact",
    lines: ["10811 Stockrest Springs Road", "Truckee, CA 96161"],
    box: box(1085, 120, 360, 95),
  },
];
const agencySeal = box(71, 88, 120, 120);

describe("toTextLines", () => {
  it("joins the items of one printed line and keeps columns apart", () => {
    const lines = toTextLines([
      item("Tahoe National Forest", 695, 121, 230),
      item("United", 211, 120, 70),
      item("States", 288, 121, 65),
      item("Forest", 487, 120, 60),
      item("Department of", 211, 145, 140),
    ]);

    assert.deepEqual(
      lines.map(({ text }) => text),
      ["United States", "Forest", "Tahoe National Forest", "Department of"],
    );
    assert.deepEqual(lines[0].box, box(211, 120, 142, 21));
  });

  it("does not add a space the text already carries or inside a word", () => {
    const lines = toTextLines([
      item("United ", 100, 100, 70),
      item("States", 175, 100, 60),
      item("Agri", 300, 140, 40),
      item("culture", 341, 140, 70),
    ]);

    assert.deepEqual(
      lines.map(({ text }) => text),
      ["United States", "Agriculture"],
    );
  });

  it("is bold when every item that says so is, unknown when none says", () => {
    const [mixed, bold, unknown] = toTextLines([
      item("Bold", 100, 100, 40, { bold: true }),
      item("regular", 145, 100, 60, { bold: false }),
      item("All", 100, 140, 30, { bold: true }),
      item("bold", 135, 140, 40, { bold: true }),
      item("Scan", 100, 180, 40),
    ]);
    assert.equal(mixed.bold, false);
    assert.equal(bold.bold, true);
    assert.equal(unknown.bold, null);
  });

  it("drops blank items", () => {
    assert.deepEqual(toTextLines([item("  ", 100, 100, 20)]), []);
  });
});

describe("matchBlocksToText", () => {
  it("moves misplaced blocks onto the text layer, line by line", () => {
    const [usda, forest] = match(agencyBlocks, agencyTextLines);

    assert.deepEqual(usda.box, box(211, 120, 142, 70));
    assert.deepEqual(forest.box, box(487, 120, 70, 45));
  });

  it("drops a line the PDF does not print as text when the rest of its block matches", () => {
    const [usda] = match(agencyBlocks, agencyTextLines);

    // "USDA" is lettering inside the seal: the logo cell shows it.
    assert.deepEqual(
      usda.matched.map(({ text, printed }) => [text, printed?.box.x ?? null]),
      [
        ["United States", 211],
        ["Department of", 211],
        ["Agriculture", 211],
      ],
    );
  });

  it("matches regardless of case and spacing, the nearest copy of a line", () => {
    const [snapped] = match(
      [{ role: "name", lines: ["FOREST"], box: box(800, 300, 60, 20) }],
      [item("Forest", 487, 120, 60), item("Forest  ", 790, 300, 60)],
    );

    assert.deepEqual(snapped.box, box(790, 300, 60, 20));
  });

  it("keeps the model's box without a text layer, with the lines unmatched", () => {
    const [block] = match(
      [
        {
          role: "name",
          lines: ["Scanned Agency", " ", "Division"],
          box: box(100, 100, 300, 40),
        },
      ],
      [],
    );

    assert.deepEqual(block.box, box(100, 100, 300, 40));
    assert.deepEqual(block.matched, [
      { text: "Scanned Agency", printed: null },
      { text: "Division", printed: null },
    ]);
  });
});

describe("matchBlocksToText, reading the text layer loosely", () => {
  it("matches a letter-spaced name and dash or quote variants", () => {
    const [block] = match(
      [
        {
          role: "name",
          lines: [
            "UNITED STATES",
            "Region 5 – Pacific Southwest",
            "Chief's Office",
          ],
          box: box(100, 100, 400, 80),
        },
      ],
      [
        item("U N I T E D  S T A T E S", 100, 100, 300),
        item("Region 5 - Pacific Southwest", 100, 125, 300),
        item("Chief\u2019s Office", 100, 150, 200),
      ],
    );
    assert.deepEqual(
      block.matched.map(({ printed }) => printed !== null),
      [true, true, true],
    );
  });

  it("matches one model line printed as several text-layer lines of one row", () => {
    const [block] = match(
      [
        {
          role: "contact",
          lines: [
            "10811 Stockrest Springs Road",
            "Phone: 530-587-3558 Fax: 530-587-0000",
          ],
          box: box(1000, 100, 400, 60),
        },
      ],
      [
        item("10811 Stockrest Springs Road", 1087, 120, 290),
        item("Phone: 530-587-3558", 1087, 145, 150),
        item("Fax: 530-587-0000", 1270, 145, 120),
      ],
    );
    assert.deepEqual(
      block.matched.map(({ text }) => text),
      ["10811 Stockrest Springs Road", "Phone: 530-587-3558 Fax: 530-587-0000"],
    );
    assert.deepEqual(block.matched[1].printed?.box, box(1087, 145, 303, 20));
  });

  it("lets a printed line be claimed once, by the nearest model line", () => {
    const [near, far] = match(
      [
        {
          role: "name",
          lines: ["Forest Service"],
          box: box(480, 115, 150, 30),
        },
        {
          role: "name",
          lines: ["Forest Service", "Region 5"],
          box: box(900, 115, 150, 60),
        },
      ],
      [item("Forest Service", 487, 120, 140), item("Region 5", 905, 145, 80)],
    );
    assert.equal(near.matched[0].printed?.box.x, 487);
    assert.deepEqual(
      far.matched.map(({ text }) => text),
      ["Region 5"],
    );
  });

  it("keeps every line of an OCR layer, whose text reads differently", () => {
    const [block] = match(
      [
        {
          role: "contact",
          lines: ["1300 N. Third Street", "Sacramento, CA 95814"],
          box: box(600, 200, 360, 50),
        },
      ],
      [item("1300 N. Thlrd Street", 600, 200, 360)],
      false,
    );
    assert.deepEqual(
      block.matched.map(({ text }) => text),
      ["1300 N. Third Street", "Sacramento, CA 95814"],
    );
  });
});

describe("toGridDraft", () => {
  it("lays an agency letter out as a seal and four text cells", () => {
    const blocks = match(agencyBlocks, agencyTextLines);
    const grid = toGridDraft(
      blocks,
      placed(agencySeal),
      IMAGE,
      noCrop,
      "#1f5f3a",
    );

    assert.ok(grid);
    assert.equal(grid.color, "#1f5f3a");
    assert.deepEqual(
      grid.cells.map((cell) => cell.kind),
      ["logo", "text", "text", "text", "text"],
    );
    const [logo, usda, forest, tahoe, address] = grid.cells;
    if (
      logo.kind !== "logo" ||
      usda.kind !== "text" ||
      address.kind !== "text"
    ) {
      assert.fail("unexpected cell kinds");
    }
    // The span runs from the seal's padded left edge (71 − 3.6) to the
    // address's right edge (1377): 1309.6 px.
    const span = 1309.6;
    assert.ok(Math.abs(logo.x) < 1e-6);
    assert.ok(Math.abs(logo.width - 127.2 / span) < 1e-6);
    assert.ok(Math.abs(logo.height - 127.2 / span) < 1e-6);
    assert.ok(Math.abs(usda.x - (211 - 67.4) / span) < 1e-6);
    assert.ok(Math.abs(usda.width - 142 / span) < 1e-6);
    assert.ok(Math.abs(address.x + address.width - 1) < 1e-6);
    assert.deepEqual(
      usda.lines.map(({ text, bold }) => [text, bold]),
      [
        ["United States", true],
        ["Department of", true],
        ["Agriculture", true],
      ],
    );
    assert.equal(usda.align, "left");
    assert.equal(forest.kind === "text" && forest.align, "left");
    assert.equal(tahoe.kind === "text" && tahoe.align, "left");
    assert.equal(address.align, "right");
    assert.deepEqual(
      address.lines.map(({ bold }) => bold),
      [false, false],
    );
  });

  it("sizes lines against the median text height", () => {
    const textLines = [
      item("BUREAU OF LAND MANAGEMENT", 480, 120, 600, { height: 40 }),
      item("California State Office", 560, 170, 440, { height: 20 }),
      item("1300 N. Third Street", 600, 200, 360, { height: 20 }),
      item("www.blm.gov", 700, 230, 160, { height: 14 }),
    ];
    const blocks = match(
      [
        {
          role: "name",
          lines: ["BUREAU OF LAND MANAGEMENT", "California State Office"],
          box: box(480, 120, 600, 70),
        },
        {
          role: "contact",
          lines: ["1300 N. Third Street", "www.blm.gov"],
          box: box(600, 200, 360, 50),
        },
      ],
      textLines,
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);

    assert.ok(grid);
    const [cell] = grid.cells;
    assert.equal(cell.kind, "text");
    if (cell.kind !== "text") {
      return;
    }
    // 40 px is twice the median of 20: xlarge.
    assert.deepEqual(
      cell.lines.map(({ size }) => size),
      ["xlarge", "normal", "normal", "small"],
    );
    assert.equal(cell.align, "center");
  });

  it("buckets a line's height against the median into five sizes", () => {
    const heights = [
      16, 20, 20, 20, 20, 20, 20, 20, 24.8, 25, 30.8, 31, 43.8, 44,
    ];
    const names = heights.map((_, index) => `Line ${index}`);
    const textLines = heights.map((height, index) =>
      item(names[index], index < 7 ? 100 : 900, 20 + (index % 7) * 60, 300, {
        height,
      }),
    );
    const grid = toGridDraft(
      match(
        [
          {
            role: "contact",
            lines: names.slice(0, 7),
            box: box(100, 20, 300, 420),
          },
          {
            role: "contact",
            lines: names.slice(7),
            box: box(900, 20, 300, 420),
          },
        ],
        textLines,
      ),
      placed(),
      IMAGE,
      noCrop,
      null,
    );

    // The median is 20 px: 0.8 and below small, from 1.25 large, from 1.55
    // xlarge, from 2.2 xxlarge.
    assert.deepEqual(
      grid?.cells.map((cell) =>
        cell.kind === "text" ? cell.lines.map(({ size }) => size) : [],
      ),
      [
        ["small", "normal", "normal", "normal", "normal", "normal", "normal"],
        ["normal", "normal", "large", "large", "xlarge", "xlarge", "xxlarge"],
      ],
    );
  });

  it("reads the base text size from the printed heights, as a fraction of the page's width", () => {
    const blocks = match(
      [
        {
          role: "name",
          lines: ["BUREAU OF LAND MANAGEMENT"],
          box: box(480, 120, 600, 40),
        },
        {
          role: "contact",
          lines: ["1300 N. Third Street", "www.blm.gov"],
          box: box(600, 170, 360, 50),
        },
      ],
      [
        item("BUREAU OF LAND MANAGEMENT", 480, 120, 600, { height: 40 }),
        item("1300 N. Third Street", 600, 170, 360, { height: 18 }),
        item("www.blm.gov", 700, 200, 160, { height: 22 }),
      ],
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);

    // The median of 40, 18 and 22 px on a 1568 px wide page, 5 digits kept.
    assert.equal(grid?.fontSize, 0.014031);
    assert.ok(Math.abs((grid?.fontSize ?? 0) - 22 / IMAGE.width) < 1e-6);
  });

  it("estimates the heights of a block nothing of which is printed from the model's box", () => {
    // No text layer (a scan, or lettering drawn as an image). A box around
    // n lines of height h is ((n − 1) × 1.2 + 1) × h tall.
    const blocks = match(
      [
        { role: "name", lines: ["Agency"], box: box(100, 100, 400, 60) },
        {
          role: "contact",
          lines: ["1 Main St", "Town, ST 00000", "(555) 555-0100"],
          box: box(100, 170, 400, 3.4 * 20),
        },
        {
          role: "contact",
          lines: ["www.agency.gov", "info@agency.gov"],
          box: box(1100, 100, 300, 2.2 * 12),
        },
      ],
      [],
      false,
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);

    assert.ok(grid);
    assert.deepEqual(
      grid.cells.map((cell) =>
        cell.kind === "text" ? cell.lines.map(({ size }) => size) : [],
      ),
      [
        ["xxlarge", "normal", "normal", "normal"],
        ["small", "small"],
      ],
    );
    // Heights 60, 20, 20, 20, 12, 12: their median is 20 px.
    assert.ok(Math.abs((grid.fontSize ?? 0) - 20 / IMAGE.width) < 1e-6);
  });

  it("takes the sizes read from a block's ink over the box estimate", () => {
    const [name, address] = match(
      [
        { role: "name", lines: ["Agency"], box: box(100, 100, 400, 60) },
        {
          role: "contact",
          lines: ["BUILDING 27", "MISSOULA, MT"],
          box: box(1000, 100, 400, 60),
        },
      ],
      [],
    );
    // The box would say 60 px for the name; its ink says 30.
    const grid = toGridDraft(
      [
        { ...name, ink: { fontSizes: [30], top: 100, bottom: 130 } },
        { ...address, ink: { fontSizes: [10, 10], top: 105, bottom: 130 } },
      ],
      placed(),
      IMAGE,
      noCrop,
      null,
    );
    assert.ok(grid);
    assert.deepEqual(
      grid.cells.map((cell) =>
        cell.kind === "text" ? cell.lines.map(({ size }) => size) : [],
      ),
      [["xxlarge"], ["normal", "normal"]],
    );
    assert.ok(Math.abs((grid.fontSize ?? 0) - 10 / IMAGE.width) < 1e-6);

    // One per line, or the box estimate: 60 and 60 / 2.2.
    const mismatched = toGridDraft(
      [
        { ...name, ink: { fontSizes: [30, 30], top: 100, bottom: 130 } },
        { ...address, ink: { fontSizes: [10], top: 105, bottom: 130 } },
      ],
      placed(),
      IMAGE,
      noCrop,
      null,
    );
    assert.ok(
      Math.abs((mismatched?.fontSize ?? 0) - 60 / 2.2 / IMAGE.width) < 1e-6,
    );
  });

  it("keeps a printed block's text-layer heights over any read from its ink", () => {
    const [block] = match(
      [{ role: "name", lines: ["Agency"], box: box(100, 100, 400, 40) }],
      [item("Agency", 100, 100, 400, { height: 40 })],
    );
    const grid = toGridDraft(
      [{ ...block, ink: { fontSizes: [10], top: 100, bottom: 110 } }],
      placed(),
      IMAGE,
      noCrop,
      null,
    );
    assert.ok(Math.abs((grid?.fontSize ?? 0) - 40 / IMAGE.width) < 1e-6);
  });

  it("gives no height to a line an OCR layer does not print in a block it partly prints", () => {
    const blocks = match(
      [
        {
          role: "name",
          lines: ["BUREAU OF LAND MANAGEMENT", "Seal lettering"],
          box: box(480, 120, 600, 70),
        },
        {
          role: "contact",
          lines: ["1300 N. Third Street"],
          box: box(600, 200, 360, 20),
        },
      ],
      [
        item("BUREAU OF LAND MANAGEMENT", 480, 120, 600, { height: 40 }),
        item("1300 N. Third Street", 600, 200, 360, { height: 20 }),
      ],
      false,
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);

    assert.ok(grid);
    const [cell] = grid.cells;
    assert.equal(cell.kind, "text");
    if (cell.kind !== "text") {
      return;
    }
    assert.deepEqual(
      cell.lines.map(({ text, size }) => [text, size]),
      [
        ["BUREAU OF LAND MANAGEMENT", "large"],
        ["Seal lettering", "normal"],
        ["1300 N. Third Street", "small"],
      ],
    );
    // The median of the two printed heights only: 30 px.
    assert.ok(Math.abs((grid.fontSize ?? 0) - 30 / IMAGE.width) < 1e-6);
  });

  it("leaves the base text size out when no line has a height", () => {
    // A degenerate model box: wide enough to place, no height to estimate.
    const blocks = match(
      [{ role: "name", lines: ["Agency"], box: box(300, 100, 400, 0) }],
      [],
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);

    assert.ok(grid);
    assert.equal("fontSize" in grid, false);
    assert.deepEqual(
      grid.cells.map((cell) => cell.kind === "text" && cell.lines[0].size),
      ["normal"],
    );
  });

  it("aligns a cell shorter than the row the way it sits in the header", () => {
    // A seal 127 px tall (padded crop: rows 84.4–211.6) beside one line of
    // text at its top, one at its middle and one at its bottom.
    const blocks = match(
      [
        { role: "name", lines: ["Top"], box: box(300, 90, 200, 20) },
        { role: "name", lines: ["Middle"], box: box(600, 138, 200, 20) },
        { role: "name", lines: ["Bottom"], box: box(900, 188, 200, 20) },
      ],
      [
        item("Top", 300, 90, 200),
        item("Middle", 600, 138, 200),
        item("Bottom", 900, 188, 200),
      ],
    );
    const grid = toGridDraft(blocks, placed(agencySeal), IMAGE, noCrop, null);

    assert.ok(grid);
    // The seal is the row: it has no alignment of its own.
    assert.deepEqual(
      grid.cells.map((cell) => [cell.kind, "valign" in cell, cell.valign]),
      [
        ["logo", false, undefined],
        ["text", false, undefined],
        ["text", true, "middle"],
        ["text", true, "bottom"],
      ],
    );
  });

  it("leaves out the alignment of cells (nearly) as tall as the row", () => {
    const blocks = match(
      [
        {
          role: "name",
          lines: ["United States", "Department of", "Agriculture"],
          box: box(211, 92, 200, 110),
        },
      ],
      [
        item("United States", 211, 92, 142, { height: 36 }),
        item("Department of", 211, 130, 140, { height: 36 }),
        item("Agriculture", 211, 168, 115, { height: 36 }),
      ],
    );
    // Text rows 92–204 against the seal's 84.4–211.6: 88 % of the row.
    const grid = toGridDraft(blocks, placed(agencySeal), IMAGE, noCrop, null);
    assert.ok(grid);
    assert.ok(grid.cells.every((cell) => !("valign" in cell)));
  });

  it("aligns an image letterhead's columns by their ink, not the model's loose boxes", () => {
    // The NFF header: a tree mark (rows 92–272), a two-line wordmark (ink
    // rows 139–232) and a four-line address (ink rows 147–238), none of it
    // printed. The model's boxes start higher, as if top-aligned.
    const [wordmark, address] = match(
      [
        {
          role: "name",
          lines: ["National Forest", "Foundation"],
          box: box(330, 95, 390, 140),
        },
        {
          role: "contact",
          lines: [
            "BUILDING 27, SUITE 3, FORT MISSOULA ROAD",
            "MISSOULA, MONTANA 59804",
            "TEL 406.542.2805",
            "NATIONALFORESTS.ORG",
          ],
          box: box(1075, 95, 390, 145),
        },
      ],
      [],
    );
    const grid = toGridDraft(
      [
        {
          ...wordmark,
          ink: { fontSizes: [58.3, 59.7], top: 139, bottom: 233 },
        },
        {
          ...address,
          ink: { fontSizes: [18.6, 17.1, 21.4, 17.1], top: 147, bottom: 238 },
        },
      ],
      marks(box(184, 95, 135, 177)),
      IMAGE,
      noCrop,
      "#0e4c65",
    );

    assert.ok(grid);
    assert.deepEqual(
      grid.cells.map((cell) => [cell.kind, cell.valign]),
      [
        ["logo", undefined],
        ["text", "middle"],
        ["text", "middle"],
      ],
    );
    assert.ok(!("valign" in grid.cells[0]));
    // The wordmark is three times the address.
    assert.deepEqual(
      grid.cells.flatMap((cell) =>
        cell.kind === "text" ? cell.lines.map(({ size }) => size) : [],
      ),
      ["xxlarge", "xxlarge", "normal", "normal", "normal", "normal"],
    );
  });

  it("draws a wordmark into the logo it is set beside, as one crop", () => {
    // The NFF lockup: a tree mark and the name in custom type right of it,
    // the address typeset at the right edge.
    const crops: Box[] = [];
    const cropLogo = (crop: Box) => {
      crops.push(crop);
      return new Uint8Array([1]);
    };
    const tree = box(184, 95, 135, 177);
    const blocks = match(
      [
        {
          role: "name",
          lines: ["National Forest", "Foundation"],
          wordmark: true,
          box: box(333, 135, 385, 100),
        },
        {
          role: "contact",
          lines: ["BUILDING 27", "MISSOULA, MONTANA 59804"],
          box: box(1075, 140, 390, 50),
        },
      ],
      [],
    );
    const grid = toGridDraft(blocks, marks(tree), IMAGE, cropLogo, null);

    assert.ok(grid);
    assert.deepEqual(
      grid.cells.map((cell) => [cell.kind, cell.valign]),
      [
        ["logo", undefined],
        ["text", "middle"],
      ],
    );
    // One crop: the tree and the lettering together, padded by 3 % of the
    // union's longer side (534 px wide).
    const union = unionOf(tree, box(333, 135, 385, 100));
    const padding = 0.03 * union.width;
    assert.equal(crops.length, 1);
    assert.ok(Math.abs(crops[0].x - (union.x - padding)) < 1e-6);
    assert.ok(Math.abs(crops[0].width - (union.width + 2 * padding)) < 1e-6);
    // The wordmark's lines are no text and count for no size; the address
    // after the logo is set right, as at the end of several columns.
    const [, address] = grid.cells;
    assert.ok(address.kind === "text");
    assert.equal(address.align, "right");
    assert.deepEqual(
      address.lines.map(({ text }) => text),
      ["BUILDING 27", "MISSOULA, MONTANA 59804"],
    );
  });

  it("takes the letterhead's sizes from its text, not from a wordmark", () => {
    const [wordmark, address] = match(
      [
        {
          role: "name",
          lines: ["National Forest"],
          wordmark: true,
          box: box(333, 135, 385, 60),
        },
        {
          role: "contact",
          lines: ["BUILDING 27", "MISSOULA"],
          box: box(1075, 140, 390, 50),
        },
      ],
      [],
    );
    const grid = toGridDraft(
      [
        { ...wordmark, ink: { fontSizes: [60], top: 135, bottom: 178 } },
        { ...address, ink: { fontSizes: [18, 22], top: 147, bottom: 186 } },
      ],
      placed(),
      IMAGE,
      noCrop,
      null,
    );
    // The median of 18 and 22 alone.
    assert.ok(Math.abs((grid?.fontSize ?? 0) - 20 / IMAGE.width) < 1e-6);
    assert.deepEqual(
      grid?.cells.map((cell) =>
        cell.kind === "text" ? cell.lines.map(({ size }) => size) : "logo",
      ),
      ["logo", ["normal", "normal"]],
    );
  });

  it("joins the lettering's own pixel mark to its wordmark, then the logo beside it", () => {
    // A scan: the tree and a mark of the lettering itself.
    const tree = box(184, 95, 135, 177);
    const letteringMark = box(340, 140, 370, 90);
    const blocks = match(
      [
        {
          role: "name",
          lines: ["National Forest", "Foundation"],
          wordmark: true,
          box: box(333, 135, 385, 100),
        },
        { role: "contact", lines: ["1 Main St"], box: box(1075, 140, 390, 25) },
      ],
      [],
    );
    const grid = toGridDraft(
      blocks,
      marks(tree, letteringMark),
      IMAGE,
      noCrop,
      null,
    );
    assert.deepEqual(
      grid?.cells.map((cell) => cell.kind),
      ["logo", "text"],
    );
  });

  it("makes a wordmark with no logo next to it a logo of its own", () => {
    const blocks = match(
      [
        {
          role: "name",
          lines: ["Acme"],
          wordmark: true,
          box: box(100, 100, 300, 60),
        },
        // The same name read as a second block below the first.
        {
          role: "name",
          lines: ["Foundation"],
          wordmark: true,
          box: box(120, 165, 260, 40),
        },
        { role: "contact", lines: ["1 Main St"], box: box(1100, 120, 300, 25) },
      ],
      [],
    );
    // A seal far to the right of the wordmark: not set with it.
    const seal = box(800, 90, 120, 120);
    const grid = toGridDraft(blocks, placed(seal), IMAGE, noCrop, null);
    assert.ok(grid);
    assert.deepEqual(
      grid.cells.map((cell) => [cell.kind, Math.round(cell.x * 1000)]),
      [
        ["logo", 0],
        ["logo", Math.round(((800 - 3.6 - 91) / (1400 - 91)) * 1000)],
        ["text", Math.round(((1100 - 91) / (1400 - 91)) * 1000)],
      ],
    );
  });

  it("counts a lockup as one logo, and keeps a letterhead of a lockup alone", () => {
    const blocks = match(
      [
        {
          role: "name",
          lines: ["Acme"],
          wordmark: true,
          box: box(330, 120, 300, 60),
        },
      ],
      [],
    );
    // A mark beside the name, and two seals far apart: the lockup is the
    // largest, the bigger seal comes second, the third is one too many.
    const grid = toGridDraft(
      blocks,
      placed(
        box(200, 100, 110, 100),
        box(900, 100, 90, 90),
        box(1300, 100, 60, 60),
      ),
      IMAGE,
      noCrop,
      null,
    );
    assert.ok(grid);
    assert.deepEqual(
      grid.cells.map((cell) => [cell.kind, cell.width]),
      [
        ["logo", grid.cells[0].width],
        ["logo", grid.cells[1].width],
      ],
    );
    assert.ok(!("fontSize" in grid));
    // The lockup spans the mark and the name; a lone logo still is no
    // letterhead.
    assert.ok(grid.cells[0].width > grid.cells[1].width * 2);
    assert.equal(
      toGridDraft([], placed(box(200, 100, 110, 100)), IMAGE, noCrop, null),
      null,
    );
  });

  it("takes bold from the font and, without one, from the block's role", () => {
    const blocks = match(
      [
        { role: "name", lines: ["Agency"], box: box(100, 100, 200, 30) },
        { role: "contact", lines: ["1 Main St"], box: box(100, 140, 200, 30) },
        { role: "name", lines: ["Thin Name"], box: box(400, 100, 200, 30) },
        // Printed, but the PDF does not say the font's weight.
        { role: "name", lines: ["Office"], box: box(700, 100, 200, 30) },
      ],
      [
        item("Thin Name", 400, 100, 200, { bold: false }),
        item("Office", 700, 100, 200, { bold: null }),
      ],
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);

    assert.ok(grid);
    assert.deepEqual(
      grid.cells.flatMap((cell) =>
        cell.kind === "text" ? cell.lines.map(({ bold }) => bold) : [],
      ),
      [true, false, false, true],
    );
  });

  it("centers a lone cell near the middle of the image, even with one line", () => {
    const blocks = match(
      [
        {
          role: "name",
          lines: ["Centered Agency"],
          box: box(584, 100, 400, 40),
        },
      ],
      [],
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);
    assert.equal(
      grid?.cells[0].kind === "text" && grid.cells[0].align,
      "center",
    );
  });

  it("keeps the two largest logos, in reading order, and crops them padded", () => {
    const crops: Box[] = [];
    const cropLogo = (crop: Box) => {
      crops.push(crop);
      return new Uint8Array([crops.length]);
    };
    const blocks = match(
      [{ role: "name", lines: ["Agency"], box: box(500, 120, 500, 40) }],
      [item("Agency", 500, 120, 500)],
    );
    const left = box(122, 130, 184, 184);
    const right = box(1282, 142, 178, 154);
    const stray = box(700, 400, 70, 70);
    const grid = toGridDraft(
      blocks,
      placed(stray, right, left),
      IMAGE,
      cropLogo,
      null,
    );

    assert.ok(grid);
    assert.deepEqual(
      grid.cells.map((cell) => cell.kind),
      ["logo", "text", "logo"],
    );
    // The left seal is 184 px square: padded by 3 % (5.52 px) on every side.
    const [crop] = crops;
    assert.ok(Math.abs(crop.x - (122 - 5.52)) < 1e-6);
    assert.ok(Math.abs(crop.y - (130 - 5.52)) < 1e-6);
    assert.ok(Math.abs(crop.width - (184 + 11.04)) < 1e-6);
    assert.ok(Math.abs(crop.height - (184 + 11.04)) < 1e-6);
    assert.deepEqual(
      grid.cells[0].kind === "logo" && [...grid.cells[0].png],
      [1],
    );
  });

  it("drops a logo whose width lies mostly over a text column, keeps one beside it", () => {
    const blocks = match(
      [{ role: "name", lines: ["Agency"], box: box(500, 120, 500, 80) }],
      [item("Agency", 500, 120, 500, { height: 80 })],
    );
    // A watermark seal behind the name, and a seal just left of it that the
    // crop padding makes touch the text.
    const behind = box(600, 110, 100, 100);
    const beside = box(390, 110, 108, 100);
    const grid = toGridDraft(
      blocks,
      placed(behind, beside),
      IMAGE,
      noCrop,
      null,
    );

    assert.deepEqual(
      grid?.cells.map((cell) => [cell.kind, cell.kind === "logo" && cell.x]),
      [
        ["logo", 0],
        ["text", false],
      ],
    );
  });

  it("leaves out a logo that cannot be cropped", () => {
    const blocks = match(
      [{ role: "name", lines: ["Agency"], box: box(500, 120, 500, 40) }],
      [item("Agency", 500, 120, 500)],
    );
    const grid = toGridDraft(
      blocks,
      placed(box(100, 100, 120, 120)),
      IMAGE,
      () => null,
      null,
    );
    assert.deepEqual(
      grid?.cells.map((cell) => cell.kind),
      ["text"],
    );
    // The span is the text alone.
    assert.equal(grid?.cells[0].x, 0);
    assert.equal(grid?.cells[0].width, 1);
  });

  it("is null without a text column: no blocks, blank blocks, or a lone logo", () => {
    assert.equal(toGridDraft([], placed(), IMAGE, noCrop, null), null);
    const blank = match(
      [{ role: "name", lines: [" "], box: box(100, 100, 200, 30) }],
      [],
    );
    assert.equal(toGridDraft(blank, placed(), IMAGE, noCrop, null), null);
    assert.equal(
      toGridDraft([], placed(box(100, 100, 120, 120)), IMAGE, noCrop, null),
      null,
    );
  });

  it("drops a seal stacked above a centered name, which one row cannot draw", () => {
    const blocks = match(
      [
        {
          role: "name",
          lines: ["STATE OF CALIFORNIA"],
          box: box(584, 260, 400, 40),
        },
      ],
      [item("STATE OF CALIFORNIA", 584, 260, 400, { height: 40 })],
    );
    const grid = toGridDraft(
      blocks,
      placed(box(724, 100, 120, 120)),
      IMAGE,
      noCrop,
      null,
    );
    assert.deepEqual(
      grid?.cells.map((cell) => cell.kind),
      ["text"],
    );
  });

  it("judges a placed image against printed text only, a scan mark against the model's blocks too", () => {
    // The model's loose box (no text layer match) covers the seal it read.
    const blocks = match(
      [
        {
          role: "name",
          lines: ["United States Department of Agriculture"],
          box: box(60, 80, 400, 170),
        },
      ],
      [],
    );
    const seal = box(72, 92, 144, 144);
    assert.deepEqual(
      toGridDraft(blocks, placed(seal), IMAGE, noCrop, null)?.cells.map(
        (cell) => cell.kind,
      ),
      ["text", "logo"],
    );
    assert.deepEqual(
      toGridDraft(blocks, marks(seal), IMAGE, noCrop, null)?.cells.map(
        (cell) => cell.kind,
      ),
      ["text"],
    );
  });

  it("promotes the next logo when a larger one cannot be cropped", () => {
    const blocks = match(
      [{ role: "name", lines: ["Agency"], box: box(500, 120, 500, 40) }],
      [item("Agency", 500, 120, 500)],
    );
    const big = box(100, 100, 150, 150);
    const left = box(300, 100, 120, 120);
    const right = box(1100, 100, 100, 100);
    const grid = toGridDraft(
      blocks,
      placed(big, left, right),
      IMAGE,
      (crop) => (crop.width > 150 ? null : new Uint8Array([1])),
      null,
    );
    assert.equal(grid?.cells.filter((cell) => cell.kind === "logo").length, 2);
  });

  it("stays within the editor's bounds: cells, lines, characters, logo height", () => {
    const columns = Array.from({ length: 10 }, (_, index) => ({
      role: "name" as const,
      lines: Array.from(
        { length: 14 },
        (_, line) =>
          `Column ${index} line ${line} ${"x".repeat(line === 0 ? 250 : 0)}`,
      ),
      box: box(20 + index * 150, 100, 100 + index, 300),
    }));
    const grid = toGridDraft(
      match(columns, []),
      placed(box(10, 10, 4, 4)),
      IMAGE,
      noCrop,
      null,
    );
    assert.ok(grid);
    assert.ok(grid.cells.length <= 8);
    for (const cell of grid.cells) {
      if (cell.kind === "text") {
        assert.ok(cell.lines.length <= 12);
        assert.ok(cell.lines.every(({ text }) => text.length <= 200));
      }
    }
    // The widest columns are kept, in reading order.
    const xs = grid.cells.map((cell) => cell.x);
    assert.deepEqual(
      xs,
      [...xs].sort((a, b) => a - b),
    );

    // A seal taller than a narrow name is wide is scaled to fit.
    const narrow = match(
      [{ role: "name", lines: ["DOI"], box: box(300, 100, 60, 40) }],
      [item("DOI", 300, 100, 60)],
    );
    const tall = toGridDraft(
      narrow,
      placed(box(200, 50, 90, 220)),
      IMAGE,
      noCrop,
      null,
    );
    const logo = tall?.cells.find((cell) => cell.kind === "logo");
    assert.ok(logo && logo.kind === "logo");
    assert.ok(logo.height <= 1 && logo.width <= 1);
    assert.ok(Math.abs(logo.width / logo.height - 103.2 / 233.2) < 1e-6);
  });

  it("sets a lone column right after a logo, left before one or alone", () => {
    const blocks = match(
      [{ role: "contact", lines: ["1 Main St"], box: box(1100, 120, 300, 25) }],
      [],
    );
    const alignOf = (logoBoxes: Box[]) =>
      toGridDraft(
        blocks,
        placed(...logoBoxes),
        IMAGE,
        noCrop,
        null,
      )?.cells.find((cell) => cell.kind === "text");
    const after = alignOf([box(100, 100, 120, 120)]);
    const before = alignOf([box(1450, 100, 100, 100)]);
    const alone = alignOf([]);
    assert.equal(after?.kind === "text" && after.align, "right");
    assert.equal(before?.kind === "text" && before.align, "left");
    assert.equal(alone?.kind === "text" && alone.align, "left");
  });

  it("right-aligns a one-line address column at the right edge", () => {
    const blocks = match(
      [
        { role: "name", lines: ["Agency"], box: box(100, 100, 300, 30) },
        {
          role: "contact",
          lines: ["www.agency.gov"],
          box: box(1200, 100, 200, 20),
        },
      ],
      [item("Agency", 100, 100, 300), item("www.agency.gov", 1200, 100, 200)],
    );
    const grid = toGridDraft(blocks, placed(), IMAGE, noCrop, null);
    assert.deepEqual(
      grid?.cells.map((cell) => cell.kind === "text" && cell.align),
      ["left", "right"],
    );
  });

  it("keeps side-by-side columns of a scan apart despite loose model boxes", () => {
    const blocks = match(
      [
        { role: "name", lines: ["United States"], box: box(200, 100, 200, 60) },
        // Overlaps the first by 15 px, far less than a quarter of either.
        {
          role: "name",
          lines: ["Forest Service"],
          box: box(385, 100, 200, 60),
        },
      ],
      [],
    );
    assert.equal(
      toGridDraft(blocks, placed(), IMAGE, noCrop, null)?.cells.length,
      2,
    );
  });

  it("is null when the letterhead has no width (a degenerate model box)", () => {
    const blocks = match(
      [{ role: "name", lines: ["Agency"], box: box(300, 100, 0, 30) }],
      [],
    );
    assert.equal(toGridDraft(blocks, placed(), IMAGE, noCrop, null), null);
  });
});

describe("letterheadAnalysisOutputSchema", () => {
  it("parses a full answer, dropping parts it does not use", () => {
    const blocks = [
      { role: "name", lines: ["Forest Service"], box: box(1, 2, 3, 4) },
    ];
    assert.deepEqual(
      letterheadAnalysisOutputSchema.parse({
        hasLetterhead: true,
        blocks,
        logos: [box(5, 6, 7, 8)],
      }),
      // A block that does not say is no wordmark.
      { hasLetterhead: true, blocks: [{ ...blocks[0], wordmark: false }] },
    );
  });

  it("reads whether a block is a wordmark, a missing or unreadable answer as no", () => {
    const parsed = letterheadAnalysisOutputSchema.parse({
      hasLetterhead: true,
      blocks: [
        { role: "name", lines: ["NFF"], wordmark: true, box: box(1, 2, 3, 4) },
        { role: "name", lines: ["A"], wordmark: "yes", box: box(1, 2, 3, 4) },
        { role: "name", lines: ["B"], box: box(1, 2, 3, 4) },
      ],
    });
    assert.deepEqual(
      parsed.blocks.map(({ wordmark }) => wordmark),
      [true, false, false],
    );
  });

  it("falls back to no blocks when the model left them out or nulled them", () => {
    assert.deepEqual(
      letterheadAnalysisOutputSchema.parse({ hasLetterhead: false }),
      { hasLetterhead: false, blocks: [] },
    );
    assert.deepEqual(
      letterheadAnalysisOutputSchema.parse({
        hasLetterhead: false,
        blocks: null,
      }),
      { hasLetterhead: false, blocks: [] },
    );
  });

  it("reads an unknown block role as contact", () => {
    const parsed = letterheadAnalysisOutputSchema.parse({
      hasLetterhead: true,
      blocks: [{ role: "address", lines: ["1 Main St"], box: box(1, 2, 3, 4) }],
    });
    assert.equal(parsed.blocks[0]?.role, "contact");
  });

  it("rejects a box with a negative size", () => {
    assert.equal(
      letterheadAnalysisOutputSchema.safeParse({
        hasLetterhead: true,
        blocks: [{ role: "name", lines: ["A"], box: box(10, 10, -5, 20) }],
      }).success,
      false,
    );
  });

  it("rejects an answer without hasLetterhead", () => {
    assert.equal(
      letterheadAnalysisOutputSchema.safeParse({ blocks: [] }).success,
      false,
    );
  });
});

describe("buildLetterheadAnalysisPrompt", () => {
  it("states the image size and asks for the text blocks", () => {
    const prompt = buildLetterheadAnalysisPrompt({ width: 1568, height: 609 });
    assert.match(prompt, /1568x609 pixels/);
    assert.match(prompt, /"hasLetterhead"/);
    assert.match(prompt, /"blocks"/);
    assert.match(prompt, /"wordmark": boolean/);
  });
});

describe("header render size", () => {
  it("stays under the image size Claude reads without downscaling", () => {
    // Long edge at most 1568 px, and under ~1,600 image tokens (w * h / 750).
    assert.ok(LETTERHEAD_MAX_HEADER_HEIGHT <= LETTERHEAD_RENDER_WIDTH);
    assert.ok(
      (LETTERHEAD_RENDER_WIDTH * LETTERHEAD_MAX_HEADER_HEIGHT) / 750 < 1600,
    );
  });

  it("fits the top 30 % of a Letter and an A4 page uncut", () => {
    const letter = Math.round(LETTERHEAD_RENDER_WIDTH * (11 / 8.5) * 0.3);
    const a4 = Math.round(LETTERHEAD_RENDER_WIDTH * (297 / 210) * 0.3);
    assert.ok(letter <= LETTERHEAD_MAX_HEADER_HEIGHT);
    assert.ok(a4 <= LETTERHEAD_MAX_HEADER_HEIGHT);
  });
});

// Opaque white RGBA image with rectangles painted on it in a colour.
const paint = (
  width: number,
  height: number,
  rects: Box[],
  [r, g, b]: [number, number, number] = [0, 0, 0],
) => {
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const p = (y * width + x) * 4;
        rgba[p] = r;
        rgba[p + 1] = g;
        rgba[p + 2] = b;
      }
    }
  }
  return rgba;
};

describe("findInkColor", () => {
  it("reads the colour of coloured text", () => {
    const rgba = paint(400, 100, [box(20, 20, 300, 30)], [31, 95, 58]);
    assert.equal(
      findInkColor(rgba, 400, 100, [box(0, 0, 400, 100)]),
      "#1f5f3a",
    );
  });

  it("reads the printed ink, not its paler anti-aliased edges", () => {
    // Solid strokes with a wider halo of the same hue blended toward white.
    const rgba = paint(400, 100, [box(20, 20, 300, 40)], [100, 160, 120]);
    const core = paint(400, 100, [box(20, 30, 300, 20)], [31, 95, 58]);
    for (let i = 0; i < rgba.length; i++) {
      if (core[i] !== 255) {
        rgba[i] = core[i];
      }
    }
    assert.equal(
      findInkColor(rgba, 400, 100, [box(0, 0, 400, 100)]),
      "#1f5f3a",
    );
  });

  it("is null for black text and for a blank box", () => {
    const black = paint(400, 100, [box(20, 20, 300, 30)]);
    assert.equal(findInkColor(black, 400, 100, [box(0, 0, 400, 100)]), null);
    assert.equal(findInkColor(black, 400, 100, [box(0, 60, 400, 40)]), null);
  });

  it("ignores a stray coloured rule under black text", () => {
    const rgba = paint(400, 100, [box(20, 20, 300, 30)]);
    const rule = paint(400, 100, [box(0, 90, 400, 1)], [200, 0, 0]);
    for (let i = 0; i < rgba.length; i++) {
      if (rule[i] !== 255) {
        rgba[i] = rule[i];
      }
    }
    assert.equal(findInkColor(rgba, 400, 100, [box(0, 0, 400, 100)]), null);
  });

  it("only looks inside the boxes", () => {
    const rgba = paint(400, 100, [box(20, 20, 100, 30)], [0, 0, 200]);
    assert.equal(findInkColor(rgba, 400, 100, [box(200, 0, 200, 100)]), null);
  });
});

describe("measureLineInk", () => {
  const W = 400;
  const H = 200;
  const measure = (rects: Box[], area: Box, lines: string[]) =>
    measureLineInk(paint(W, H, rects), W, H, area, lines);

  it("measures each line's band of ink rows, top to bottom", () => {
    assert.deepEqual(
      measure(
        [box(20, 25, 300, 15), box(20, 55, 200, 12), box(20, 85, 250, 15)],
        box(10, 20, 320, 100),
        ["AGENCY", "Office", "123 MAIN ST"],
      ),
      [15, 12, 15],
    );
  });

  it("joins a dot apart from its line to that line", () => {
    // The dots of "minimum" three rows above its body.
    assert.deepEqual(
      measure(
        [box(40, 20, 4, 3), box(90, 20, 4, 3), box(20, 26, 300, 12)].concat(
          box(20, 55, 300, 12),
        ),
        box(10, 20, 320, 50),
        ["minimum", "Second Line"],
      ),
      [18, 12],
    );
  });

  it("counts a caps line's body only, a descending line's whole band", () => {
    // Two taller initials (small caps), a body, and comma tails below it.
    const line = [box(20, 20, 6, 4), box(120, 20, 6, 4), box(20, 24, 300, 12)];
    const tails = [box(100, 36, 2, 3), box(200, 36, 2, 3)];
    const rects = [...line, ...tails];
    const area = box(10, 20, 320, 20);
    assert.deepEqual(measure(rects, area, ["BUILDING 27, SUITE 3"]), [12]);
    assert.deepEqual(measure(rects, area, ["Highway, Project"]), [19]);
    // Mixed case without descending letters: the tails hang below the body.
    assert.deepEqual(measure(rects, area, ["Missoula, Montana"]), [16]);
  });

  it("is null when lines touch: fewer bands than lines", () => {
    assert.equal(
      measure([box(20, 25, 300, 30)], box(10, 20, 320, 40), [
        "United States",
        "Forest Service",
      ]),
      null,
    );
  });

  it("is null for a band too tall for one line, or one running past what is read", () => {
    // A 30-row band in a two-line block 40 rows tall: 1.5 slots is 30.
    assert.equal(
      measure(
        [box(20, 25, 300, 31), box(20, 60, 300, 4)],
        box(10, 22, 320, 40),
        ["Agency", "Office"],
      ),
      null,
    );
    // Ink on to the padded edge: the line goes on beyond the box.
    assert.equal(
      measure([box(20, 5, 300, 40)], box(10, 20, 320, 20), ["Agency"]),
      null,
    );
  });

  it("leaves out a neighbouring block's line in the padding", () => {
    // The line above ends two rows above the box, inside its padding.
    assert.deepEqual(
      measure(
        [box(20, 40, 300, 8), box(20, 54, 300, 14)],
        box(10, 50, 320, 25),
        ["Agency"],
      ),
      [14],
    );
  });

  it("reads a box clipped to the image, and refuses a line the image cuts", () => {
    assert.deepEqual(
      measure([box(310, 160, 80, 15)], box(300, 150, 200, 80), ["Agency"]),
      [15],
    );
    assert.equal(
      measure([box(310, 185, 80, 15)], box(300, 150, 200, 80), ["Agency"]),
      null,
    );
    assert.equal(measure([], box(500, 500, 10, 10), ["Agency"]), null);
  });
});

describe("fontSizeFromInk", () => {
  it("reads caps and digits (small caps too) by their cap height", () => {
    assert.ok(
      Math.abs(fontSizeFromInk(14, "BUILDING 27, SUITE 3") - 20) < 1e-9,
    );
    assert.ok(Math.abs(fontSizeFromInk(14, "406.542.2805") - 20) < 1e-9);
  });

  it("reads mixed case by ascender to descender, or to the baseline", () => {
    assert.ok(Math.abs(fontSizeFromInk(18.4, "Highway 101") - 20) < 1e-9);
    assert.ok(Math.abs(fontSizeFromInk(14.4, "National Forest") - 20) < 1e-9);
  });

  it("is what measureBlockInk gives per line, with the rows the ink spans", () => {
    const rgba = paint(400, 200, [box(20, 25, 300, 14), box(20, 55, 300, 18)]);
    const ink = measureBlockInk(rgba, 400, 200, box(10, 20, 320, 60), [
      "AGENCY",
      "Highway Project",
    ]);
    assert.ok(ink);
    assert.ok(Math.abs(ink.fontSizes[0] - 20) < 1e-9);
    assert.ok(Math.abs(ink.fontSizes[1] - 18 / 0.92) < 1e-9);
    assert.deepEqual([ink.top, ink.bottom], [25, 73]);
    assert.equal(
      measureBlockInk(rgba, 400, 200, box(10, 20, 320, 60), [
        "One",
        "Two",
        "Three",
      ]),
      null,
    );
  });
});

describe("findLogoMarks", () => {
  it("finds a logo and ignores a text-like bar and a rule", () => {
    const logo = box(100, 100, 120, 120);
    const textLine = box(700, 150, 600, 30);
    const rule = box(100, 450, 1500, 4);
    const rgba = paint(1700, 500, [logo, textLine, rule]);
    assert.deepEqual(findLogoMarks(rgba, 1700, 500), [logo]);
  });

  it("joins a mark's separate strokes into one box", () => {
    const rgba = paint(1700, 400, [
      box(100, 100, 20, 100),
      box(126, 100, 20, 100),
    ]);
    assert.deepEqual(findLogoMarks(rgba, 1700, 400), [box(100, 100, 46, 100)]);
  });

  it("scales the minimum mark height with the image width", () => {
    const small = box(50, 50, 40, 40);
    assert.deepEqual(findLogoMarks(paint(850, 250, [small]), 850, 250), [
      small,
    ]);
    assert.deepEqual(findLogoMarks(paint(1700, 250, [small]), 1700, 250), []);
  });

  it("ignores a mark wider than 40 % of the image", () => {
    const rgba = paint(1700, 600, [box(100, 100, 800, 400)]);
    assert.deepEqual(findLogoMarks(rgba, 1700, 600), []);
  });

  it("finds nothing on a blank page", () => {
    assert.deepEqual(findLogoMarks(paint(400, 200, []), 400, 200), []);
  });
});

describe("filterPlacedLogos", () => {
  const page = { width: 1568, height: 2029 };

  it("keeps a logo and drops a scanned page image", () => {
    const logo = box(71, 88, 120, 120);
    const scan = box(0, 0, 1568, 2029);
    assert.deepEqual(filterPlacedLogos([logo, scan], page, 609), [logo]);
  });

  it("drops a scan stored as page-wide strips", () => {
    const strips = [0, 1, 2, 3].map((index) => box(0, index * 203, 1568, 203));
    assert.deepEqual(filterPlacedLogos(strips, page, 609), []);
  });

  it("drops a whole letterhead saved as one banner image", () => {
    assert.deepEqual(
      filterPlacedLogos([box(60, 40, 1450, 200)], page, 609),
      [],
    );
  });

  it("drops spacers and bullets", () => {
    assert.deepEqual(
      filterPlacedLogos([box(40, 40, 8, 8), box(40, 80, 400, 2)], page, 609),
      [],
    );
  });

  it("drops contact-line icons and a logo cut off by the header's edge", () => {
    const icon = box(1100, 150, 26, 26);
    const cutOff = box(100, 560, 120, 120);
    assert.deepEqual(filterPlacedLogos([icon, cutOff], page, 609), []);
  });
});

describe("isScannedHeader", () => {
  const header = { width: 1568, height: 609 };

  it("is a scan when images cover most of the header", () => {
    assert.equal(isScannedHeader([box(0, 0, 1568, 2029)], header), true);
    const strips = [0, 1, 2].map((index) => box(0, index * 203, 1568, 203));
    assert.equal(isScannedHeader(strips, header), true);
  });

  it("is not a scan with a logo or no images", () => {
    assert.equal(isScannedHeader([box(71, 88, 120, 120)], header), false);
    assert.equal(isScannedHeader([], header), false);
  });
});

describe("dropMarksInTextBlocks", () => {
  // Agency letter at 1568 px: seal left, three bold name columns, address.
  const seal = box(71, 88, 120, 120);
  const nameColumn = box(232, 92, 205, 66);
  const blocks = [
    { box: box(225, 86, 215, 76) },
    { box: box(515, 86, 190, 52) },
    { box: box(790, 86, 260, 52) },
    { box: box(1190, 86, 310, 96) },
  ];

  it("drops a bold multi-line name column found as a mark", () => {
    assert.deepEqual(dropMarksInTextBlocks([seal, nameColumn], blocks), [seal]);
  });

  it("keeps a seal right next to text", () => {
    const touching = [{ box: box(195, 92, 260, 80) }];
    assert.deepEqual(dropMarksInTextBlocks([seal], touching), [seal]);
  });

  it("keeps a mark a generous text box only clips", () => {
    // 40 % of the seal lies inside the block.
    const clipping = [{ box: box(143, 60, 300, 200) }];
    assert.deepEqual(dropMarksInTextBlocks([seal], clipping), [seal]);
  });

  it("drops a mark half inside a block", () => {
    const halfCovering = [{ box: box(131, 60, 300, 200) }];
    assert.deepEqual(dropMarksInTextBlocks([seal], halfCovering), []);
  });

  it("drops a scan blob that runs through stacked name and contact blocks", () => {
    // BLM scan at 1568 px: the centred header lines merge into one blob
    // (43 % inside the name block, 35 % inside the contact block below it).
    const leftSeal = box(122, 130, 184, 184);
    const rightSeal = box(1282, 142, 178, 154);
    const headerLines = box(548, 146, 494, 240);
    const stacked = [
      { box: box(422, 130, 745, 120) },
      { box: box(422, 250, 745, 85) },
    ];
    assert.deepEqual(
      dropMarksInTextBlocks([leftSeal, rightSeal, headerLines], stacked),
      [leftSeal, rightSeal],
    );
  });

  it("counts overlapping blocks once", () => {
    // Two blocks over the same 30 % of the seal: still only 30 % covered.
    const overlapping = [
      { box: box(155, 60, 100, 200) },
      { box: box(155, 80, 100, 180) },
    ];
    assert.deepEqual(dropMarksInTextBlocks([seal], overlapping), [seal]);
  });

  it("keeps every mark when the model read no blocks", () => {
    assert.deepEqual(dropMarksInTextBlocks([seal, nameColumn], []), [
      seal,
      nameColumn,
    ]);
  });
});
