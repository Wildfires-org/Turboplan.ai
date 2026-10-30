import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cleanGridLineText,
  GRID_GEOMETRY_EPSILON,
  GRID_LINE_SIZES,
  type GridLetterhead,
  gridLetterheadSchema,
  gridToDocumentLetterhead,
  gridToLines,
  isGridLetterheadConfigured,
  isGridLogoKey,
  MAX_GRID_CELLS,
  MAX_GRID_LINES_PER_CELL,
  MAX_GRID_LOGO_KEY_CHARS,
  MAX_GRID_LOGOS,
  parseLetterheadLogoIndex,
  strictGridLetterheadSchema,
  usableGridLetterhead,
} from "../src/letterhead-grid";

const agency: GridLetterhead = {
  cells: [
    {
      kind: "logo",
      x: 0,
      width: 0.1,
      height: 0.1,
      key: "letterheads/project/doc/logo-0-abc.png",
    },
    {
      kind: "text",
      x: 0.12,
      width: 0.2,
      align: "left",
      lines: [
        { text: "United States", bold: true, size: "normal" },
        { text: "Department of Agriculture", bold: true, size: "normal" },
      ],
    },
    {
      kind: "text",
      x: 0.7,
      width: 0.3,
      align: "right",
      lines: [
        { text: "10811 Stockrest Springs Road", bold: false, size: "small" },
        { text: "Truckee, CA 96161", bold: false, size: "small" },
      ],
    },
  ],
  color: "#1f5f3a",
};

describe("gridLetterheadSchema", () => {
  it("accepts a grid as the research agent stores it", () => {
    assert.deepEqual(gridLetterheadSchema.parse(agency), agency);
  });

  it("accepts every line size, smallest to largest, and nothing else", () => {
    assert.deepEqual(GRID_LINE_SIZES, [
      "small",
      "normal",
      "large",
      "xlarge",
      "xxlarge",
    ]);
    const [, text] = agency.cells;
    assert.ok(text.kind === "text");
    const withSize = (size: string) => ({
      ...agency,
      cells: [{ ...text, lines: [{ text: "Agency", bold: true, size }] }],
    });
    for (const size of GRID_LINE_SIZES) {
      assert.equal(
        gridLetterheadSchema.safeParse(withSize(size)).success,
        true,
      );
    }
    for (const size of ["huge", "medium", ""]) {
      assert.equal(
        gridLetterheadSchema.safeParse(withSize(size)).success,
        false,
      );
    }
  });

  it("keeps a cell's vertical alignment, never stores top, and leaves it out when absent", () => {
    const [logo, name, address] = agency.cells;
    const aligned = {
      ...agency,
      cells: [
        { ...logo, valign: "bottom" },
        { ...name, valign: "middle" },
        address,
      ],
    };
    const parsed = gridLetterheadSchema.parse(aligned);
    assert.deepEqual(parsed, aligned);
    assert.equal("valign" in parsed.cells[2], false);

    for (const valign of ["top", "center", null]) {
      for (const cell of [logo, name]) {
        assert.equal(
          gridLetterheadSchema.safeParse({
            ...agency,
            cells: [{ ...cell, valign }],
          }).success,
          false,
          `${cell.kind} ${valign}`,
        );
      }
    }
  });

  it("keeps the base text size, leaves it out when absent, and rejects one not within (0, 1]", () => {
    const sized = { ...agency, fontSize: 0.0123 };
    assert.deepEqual(gridLetterheadSchema.parse(sized), sized);
    assert.deepEqual(gridLetterheadSchema.parse({ ...agency, fontSize: 1 }), {
      ...agency,
      fontSize: 1,
    });
    assert.equal("fontSize" in gridLetterheadSchema.parse(agency), false);

    for (const fontSize of [0, -0.01, 1.5, Number.NaN, "0.01", null]) {
      assert.equal(
        gridLetterheadSchema.safeParse({ ...agency, fontSize }).success,
        false,
        String(fontSize),
      );
    }
  });

  it("trims line text and rejects blank lines, out-of-range fractions and bad colours", () => {
    const parsed = gridLetterheadSchema.parse({
      ...agency,
      cells: [
        {
          kind: "text",
          x: 0,
          width: 1,
          align: "center",
          lines: [{ text: "  Forest Service  ", bold: true, size: "large" }],
        },
      ],
    });
    assert.equal(
      parsed.cells[0].kind === "text" && parsed.cells[0].lines[0].text,
      "Forest Service",
    );

    const blankLine = {
      ...agency,
      cells: [
        {
          kind: "text",
          x: 0,
          width: 1,
          align: "left",
          lines: [{ text: "   ", bold: false, size: "normal" }],
        },
      ],
    };
    assert.equal(gridLetterheadSchema.safeParse(blankLine).success, false);
    assert.equal(
      gridLetterheadSchema.safeParse({
        ...agency,
        cells: [{ ...agency.cells[0], x: 1.2 }],
      }).success,
      false,
    );
    assert.equal(
      gridLetterheadSchema.safeParse({ ...agency, color: "green" }).success,
      false,
    );
  });

  it("rejects an empty grid and one with too many cells", () => {
    assert.equal(
      gridLetterheadSchema.safeParse({ cells: [], color: null }).success,
      false,
    );
    const tooMany = {
      color: null,
      cells: Array.from({ length: MAX_GRID_CELLS + 1 }, () => agency.cells[1]),
    };
    assert.equal(gridLetterheadSchema.safeParse(tooMany).success, false);
  });

  it("rejects more logos than a letterhead has", () => {
    const logo = agency.cells[0];
    const tooManyLogos = {
      color: null,
      cells: [
        ...Array.from({ length: MAX_GRID_LOGOS + 1 }, () => logo),
        agency.cells[1],
      ],
    };
    assert.equal(gridLetterheadSchema.safeParse(tooManyLogos).success, false);
  });

  it("rejects a cell with no width and a logo with no height, but a cell at the left edge is fine", () => {
    const [logo, text] = agency.cells;
    assert.equal(
      gridLetterheadSchema.safeParse({
        ...agency,
        cells: [{ ...text, width: 0 }],
      }).success,
      false,
    );
    assert.equal(
      gridLetterheadSchema.safeParse({
        ...agency,
        cells: [{ ...logo, height: 0 }, text],
      }).success,
      false,
    );
    assert.equal(
      gridLetterheadSchema.safeParse({
        ...agency,
        cells: [{ ...text, x: 0 }],
      }).success,
      true,
    );
  });

  it("rejects a cell of an unknown kind", () => {
    assert.equal(
      gridLetterheadSchema.safeParse({
        ...agency,
        cells: [{ ...agency.cells[1], kind: "seal" }],
      }).success,
      false,
    );
  });

  it("accepts the largest grid the analysis produces: two logos and full text cells", () => {
    const textCells = MAX_GRID_CELLS - MAX_GRID_LOGOS;
    const width = 1 / MAX_GRID_CELLS;
    const cell = (index: number): GridLetterhead["cells"][number] =>
      index === 0 || index === MAX_GRID_CELLS - 1
        ? {
            kind: "logo",
            x: index * width,
            width,
            height: 0.1,
            key: `letterheads/project/doc/logo-${index}-abc.png`,
          }
        : {
            kind: "text",
            x: index * width,
            width,
            align: "center",
            lines: Array.from(
              { length: MAX_GRID_LINES_PER_CELL },
              (_, line) => ({
                text: `Line ${line + 1} of column ${index}`,
                bold: line === 0,
                size: "normal" as const,
              }),
            ),
          };
    const largest: GridLetterhead = {
      cells: Array.from({ length: MAX_GRID_CELLS }, (_, index) => cell(index)),
      color: "#1f5f3a",
    };
    assert.equal(
      largest.cells.filter((c) => c.kind === "text").length,
      textCells,
    );
    assert.deepEqual(gridLetterheadSchema.parse(largest), largest);
    assert.equal(strictGridLetterheadSchema.safeParse(largest).success, true);
  });
});

describe("gridToLines", () => {
  it("splits bold lines (identity) from regular lines (contact), in reading order", () => {
    assert.deepEqual(gridToLines(agency), {
      nameLines: ["United States", "Department of Agriculture"],
      contactLines: ["10811 Stockrest Springs Road", "Truckee, CA 96161"],
    });
  });

  it("puts each line on one line and drops blank ones", () => {
    assert.deepEqual(
      gridToLines({
        cells: [
          {
            kind: "text",
            x: 0,
            width: 1,
            align: "left",
            lines: [
              {
                text: "Bureau of\nLand  Management",
                bold: true,
                size: "large",
              },
              { text: " \t ", bold: false, size: "small" },
              { text: "1 Main St\r\nSuite 2", bold: false, size: "small" },
            ],
          },
        ],
        color: null,
      }),
      {
        nameLines: ["Bureau of Land Management"],
        contactLines: ["1 Main St Suite 2"],
      },
    );
  });

  it("is empty for a logo-only grid", () => {
    assert.deepEqual(gridToLines({ cells: [agency.cells[0]], color: null }), {
      nameLines: [],
      contactLines: [],
    });
  });

  it("turns control characters into spaces", () => {
    assert.deepEqual(
      gridToLines({
        cells: [
          {
            kind: "text",
            x: 0,
            width: 1,
            align: "left",
            lines: [
              { text: "Bureau\u0000of\u0007Land", bold: true, size: "large" },
              { text: "\u001b[2J1 Main St\u007f", bold: false, size: "small" },
            ],
          },
        ],
        color: null,
      }),
      { nameLines: ["Bureau of Land"], contactLines: ["[2J1 Main St"] },
    );
  });

  it("keeps the first 5 name lines and 6 contact lines, leaving the grid as it is", () => {
    const line = (text: string, bold: boolean) => ({
      text,
      bold,
      size: "normal" as const,
    });
    const crowded: GridLetterhead = {
      cells: [
        {
          kind: "text",
          x: 0,
          width: 0.5,
          align: "left",
          lines: Array.from({ length: 7 }, (_, i) => line(`Name ${i}`, true)),
        },
        {
          kind: "text",
          x: 0.5,
          width: 0.5,
          align: "right",
          lines: Array.from({ length: 8 }, (_, i) =>
            line(`Contact ${i}`, false),
          ),
        },
      ],
      color: null,
    };
    const snapshot = structuredClone(crowded);

    assert.deepEqual(gridToLines(crowded), {
      nameLines: ["Name 0", "Name 1", "Name 2", "Name 3", "Name 4"],
      contactLines: [
        "Contact 0",
        "Contact 1",
        "Contact 2",
        "Contact 3",
        "Contact 4",
        "Contact 5",
      ],
    });
    assert.deepEqual(crowded, snapshot);
  });
});

describe("cleanGridLineText", () => {
  it("collapses whitespace and control characters, and is empty when nothing is left", () => {
    assert.equal(
      cleanGridLineText("  Forest\n\tService\u0007 "),
      "Forest Service",
    );
    assert.equal(cleanGridLineText("\u0000 \n"), "");
  });

  it("drops format characters: bidi overrides, zero-width characters, soft hyphens", () => {
    assert.equal(
      cleanGridLineText(
        "\u202eBureau\u202c of\u200b Land\u00ad Man\u200dage\ufeffment\u2066",
      ),
      "Bureau of Land Management",
    );
    assert.equal(cleanGridLineText("\u200b\u200e\u2060"), "");
  });

  it("drops lone surrogates and U+FFFE / U+FFFF, keeping paired ones", () => {
    assert.equal(
      cleanGridLineText("Forest\ud800 Service\udfff\ufffe\uffff 🌲"),
      "Forest Service 🌲",
    );
    // Valid XML 1.0 text after cleaning (DOCX document.xml).
    const xmlInvalid =
      /[^\t\n\r\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u;
    assert.equal(
      xmlInvalid.test(cleanGridLineText("a\uffff\u0001\ud83cb\ufffe")),
      false,
    );
  });

  it("counts a line of invisible characters as no text", () => {
    assert.equal(
      isGridLetterheadConfigured({
        cells: [
          {
            kind: "text",
            x: 0,
            width: 1,
            align: "left",
            lines: [{ text: "\u200b\u202e", bold: true, size: "normal" }],
          },
        ],
        color: null,
      }),
      false,
    );
  });
});

describe("isGridLetterheadConfigured", () => {
  it("needs a logo or a line of text", () => {
    assert.equal(isGridLetterheadConfigured(agency), true);
    assert.equal(
      isGridLetterheadConfigured({ cells: [agency.cells[0]], color: null }),
      true,
    );
    assert.equal(
      isGridLetterheadConfigured({
        cells: [{ kind: "text", x: 0, width: 1, align: "left", lines: [] }],
        color: null,
      }),
      false,
    );
  });

  it("does not count whitespace-only lines as text", () => {
    assert.equal(
      isGridLetterheadConfigured({
        cells: [
          {
            kind: "text",
            x: 0,
            width: 1,
            align: "left",
            lines: [{ text: "   ", bold: false, size: "normal" }],
          },
        ],
        color: null,
      }),
      false,
    );
  });
});

describe("gridToDocumentLetterhead", () => {
  it("keeps the grid's base text size", () => {
    const letterhead = gridToDocumentLetterhead({ ...agency, fontSize: 0.02 });
    assert.equal(letterhead.grid.fontSize, 0.02);
  });

  it("carries the grid with its derived lines and normalized colour", () => {
    const letterhead = gridToDocumentLetterhead({
      ...agency,
      color: "#1F5F3A",
    });
    assert.deepEqual(letterhead, {
      layout: "grid",
      grid: agency,
      nameLines: ["United States", "Department of Agriculture"],
      contactLines: ["10811 Stockrest Springs Road", "Truckee, CA 96161"],
      color: "#1f5f3a",
    });
  });
});

// What the research agent can store (`toGridDraft`, document-extraction):
// fractions of a ~1568 px span; text columns stacked when they overlap by
// more than 10 px, so two columns may overlap by up to 10 px; a logo kept
// when less than half its width lies over a text column.
const SPAN_PX = 1568;
const px = (value: number) => value / SPAN_PX;
const analysed: GridLetterhead = {
  cells: [
    {
      kind: "logo",
      x: 0,
      width: px(200),
      height: px(180),
      key: "letterheads/project/doc/logo-0-abc.png",
    },
    {
      kind: "text",
      // 90 px over the logo: less than half of its 200.
      x: px(110),
      width: px(700),
      align: "left",
      lines: [{ text: "Bureau of Land Management", bold: true, size: "large" }],
    },
    {
      kind: "text",
      // 10 px over the previous column.
      x: px(800),
      width: px(768),
      align: "right",
      lines: [{ text: "1 Main St", bold: false, size: "small" }],
    },
  ],
  color: null,
};

describe("strictGridLetterheadSchema", () => {
  it("accepts a tidy grid", () => {
    assert.equal(strictGridLetterheadSchema.safeParse(agency).success, true);
  });

  it("tolerates float noise of the fractions", () => {
    const [, text] = agency.cells;
    const noisy = {
      ...agency,
      cells: [
        { ...text, x: 0, width: 0.5 + GRID_GEOMETRY_EPSILON / 2 },
        { ...text, x: 0.5, width: 0.5 + GRID_GEOMETRY_EPSILON / 2 },
      ],
    };
    assert.equal(strictGridLetterheadSchema.safeParse(noisy).success, true);
  });

  it("rejects overlapping cells and cells past the right edge, in any stored order", () => {
    const [, text] = agency.cells;
    for (const cells of [
      [
        { ...text, x: 0.4, width: 0.3 },
        { ...text, x: 0, width: 0.5 },
      ],
      [{ ...text, x: 0.8, width: 0.3 }],
    ]) {
      const result = strictGridLetterheadSchema.safeParse({ ...agency, cells });
      assert.equal(result.success, false);
      assert.deepEqual(result.error?.issues[0]?.path, ["cells"]);
    }
  });

  it("rejects what the analysis can store, which the lenient schema accepts", () => {
    assert.equal(gridLetterheadSchema.safeParse(analysed).success, true);
    assert.equal(strictGridLetterheadSchema.safeParse(analysed).success, false);
  });
});

describe("usableGridLetterhead", () => {
  it("returns a valid grid with something to draw", () => {
    assert.deepEqual(usableGridLetterhead(agency), agency);
  });

  it("keeps the cells' vertical alignment, also when it clips them", () => {
    const [logo, name] = analysed.cells;
    const usable = usableGridLetterhead({
      ...analysed,
      cells: [
        { ...logo, valign: "middle" },
        { ...name, valign: "bottom" },
      ],
    });
    assert.deepEqual(
      usable?.cells.map((cell) => cell.valign),
      ["middle", "bottom"],
    );
  });

  it("keeps the base text size, also when it clips the cells", () => {
    assert.equal(
      usableGridLetterhead({ ...agency, fontSize: 0.0123 })?.fontSize,
      0.0123,
    );
    assert.equal(
      usableGridLetterhead({ ...analysed, fontSize: 0.0123 })?.fontSize,
      0.0123,
    );
    // A bad one makes the grid as unusable as any other bad field.
    assert.equal(usableGridLetterhead({ ...agency, fontSize: 2 }), null);
  });

  it("keeps an analysed grid usable, its overlaps clipped so it passes the strict schema", () => {
    const usable = usableGridLetterhead(analysed);
    assert.ok(usable);
    assert.equal(strictGridLetterheadSchema.safeParse(usable).success, true);

    const [logo, name, address] = usable.cells;
    // The logo ends where the name starts, shrunk with its aspect kept.
    assert.ok(logo.kind === "logo");
    assert.ok(Math.abs(logo.width - px(110)) < 1e-12);
    assert.ok(Math.abs(logo.height / logo.width - 180 / 200) < 1e-12);
    // The name column ends where the address starts; the last is unchanged.
    assert.ok(Math.abs(name.x + name.width - px(800)) < 1e-12);
    assert.deepEqual(address, analysed.cells[2]);
  });

  it("drops a cell left with no width, keeping the others in their stored order", () => {
    const [logo, text] = agency.cells;
    const usable = usableGridLetterhead({
      ...agency,
      cells: [
        { ...text, x: 0.5, width: 0.5 },
        { ...logo, x: 0.2 },
        { ...text, x: 0.2, width: 0.2 },
      ],
    });

    assert.deepEqual(
      usable?.cells.map(({ kind, x }) => [kind, x]),
      [
        ["text", 0.5],
        ["text", 0.2],
      ],
    );
  });

  it("clips a cell past the right edge", () => {
    const [, text] = agency.cells;
    const usable = usableGridLetterhead({
      ...agency,
      cells: [{ ...text, x: 0.7, width: 0.6 }],
    });

    assert.ok(Math.abs((usable?.cells[0].width ?? 0) - 0.3) < 1e-12);
  });

  it("is null for missing, malformed or blank grids", () => {
    for (const value of [
      null,
      undefined,
      "grid",
      { cells: [], color: null },
      { ...agency, color: "green" },
      {
        cells: [{ kind: "text", x: 0, width: 1, align: "left", lines: [] }],
        color: null,
      },
    ]) {
      assert.equal(usableGridLetterhead(value), null);
    }
  });
});

describe("logo keys", () => {
  const USER_ID = "3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
  const withLogoKey = (key: unknown): unknown => ({
    ...agency,
    cells: [{ ...agency.cells[0], key }, ...agency.cells.slice(1)],
  });

  it("accepts a reference crop's key and an editor upload's key", () => {
    for (const key of [
      "letterheads/project/6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8e/logo-0-0123456789abcdef.png",
      "letterheads/organization/doc/logo-1-abc.png",
      `uploads/${USER_ID}/1700000000000-0f8fad5b-d9cb-469f-a165-70867728950e-seal (1).png`,
      `uploads/${USER_ID}/${"a".repeat(MAX_GRID_LOGO_KEY_CHARS - 50)}`,
    ]) {
      assert.equal(isGridLogoKey(key), true, key);
      assert.equal(
        gridLetterheadSchema.safeParse(withLogoKey(key)).success,
        true,
        key,
      );
    }
  });

  it("refuses traversal, a leading slash, other prefixes and crafted keys", () => {
    for (const key of [
      "",
      "/letterheads/project/doc/logo-0.png",
      "letterheads/../uploads/other/logo.png",
      "letterheads/project/../../org-logos/x.png",
      `uploads/${USER_ID}/..`,
      "uploads/./x.png",
      "letterheads//doc/logo.png",
      "letterheads/",
      "uploads",
      "letterheads/project/doc/",
      "org-logos/0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e.png",
      "landing-uploads/1730000000000-x.pdf",
      "mcp/project/doc.pdf",
      "Letterheads/project/doc/logo.png",
      "https://files.example.test/letterheads/project/doc/logo-0.png",
      "letterheads\\project\\logo.png",
      "letterheads/project/doc/logo\u0000.png",
      "letterheads/project/doc/logo\n.png",
      "letterheads/project/doc/logo\u007f.png",
      "letterheads/project/doc/logo\u0085.png",
      "letterheads/project/doc/logo\ud800.png",
      `uploads/${USER_ID}/${"a".repeat(MAX_GRID_LOGO_KEY_CHARS)}`,
    ]) {
      assert.equal(isGridLogoKey(key), false, JSON.stringify(key));
      assert.equal(
        gridLetterheadSchema.safeParse(withLogoKey(key)).success,
        false,
        JSON.stringify(key),
      );
    }
  });

  it("refuses a logo cell that still carries a URL instead of a key", () => {
    const { key: _key, ...box } = agency.cells[0] as { key: string };
    assert.equal(
      gridLetterheadSchema.safeParse({
        ...agency,
        cells: [
          {
            ...box,
            url: "https://files.example.test/letterheads/doc/logo.png",
          },
          ...agency.cells.slice(1),
        ],
      }).success,
      false,
    );
    assert.equal(
      usableGridLetterhead({
        cells: [{ ...box, url: "https://files.example.test/logo.png" }],
        color: null,
      }),
      null,
    );
  });
});

describe("parseLetterheadLogoIndex", () => {
  it("defaults to the first logo when absent", () => {
    assert.equal(parseLetterheadLogoIndex(undefined), 0);
  });

  it("accepts the index of every logo a grid can have", () => {
    for (let index = 0; index < MAX_GRID_LOGOS; index++) {
      assert.equal(parseLetterheadLogoIndex(String(index)), index);
    }
  });

  it("rejects an index past the last logo a grid can have", () => {
    for (const raw of [String(MAX_GRID_LOGOS), "12", "99"]) {
      assert.equal(parseLetterheadLogoIndex(raw), null, raw);
    }
  });

  it("rejects anything else", () => {
    for (const raw of [
      "",
      "-1",
      "1.5",
      "1e1",
      " 1",
      "one",
      "0x1",
      "123",
      "001",
      "1.0",
    ]) {
      assert.equal(parseLetterheadLogoIndex(raw), null, raw);
    }
  });
});
