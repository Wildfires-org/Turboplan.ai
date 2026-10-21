import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GRID_LINE_SIZES,
  type GridLetterhead,
  type GridLetterheadTextCell,
} from "../src/letterhead-grid";
import {
  GRID_BASE_FONT_RATIO,
  GRID_CELL_GUTTER,
  GRID_LINE_SCALE,
  GRID_PAGE_CONTENT_RATIO,
  type GridSegment,
  gridBaseFontRatio,
  gridCellOffset,
  gridLogoCells,
  gridLogoSize,
  layoutGridLetterhead,
  MAX_GRID_FONT_RATIO,
  MAX_GRID_LOGO_HEIGHT,
  MIN_GRID_FONT_RATIO,
  toPublicGridLetterhead,
} from "../src/letterhead-grid-layout";

const text = (
  x: number,
  width: number,
  label = "Agency",
  align: GridLetterheadTextCell["align"] = "left",
): GridLetterheadTextCell => ({
  kind: "text",
  x,
  width,
  align,
  lines: [{ text: label, bold: true, size: "normal" }],
});

const right = (x: number, width: number) => text(x, width, "Agency", "right");
const center = (x: number, width: number) => text(x, width, "Agency", "center");

const logo = (
  x: number,
  width: number,
  key = "letterheads/project/d/l.png",
) => ({
  kind: "logo" as const,
  x,
  width,
  height: width,
  key,
});

const grid = (cells: GridLetterhead["cells"]): GridLetterhead => ({
  cells,
  color: null,
});

const shape = (segments: Pick<GridSegment, "kind" | "start" | "width">[]) =>
  segments.map((segment) => [
    segment.kind,
    Number(segment.start.toFixed(4)),
    Number(segment.width.toFixed(4)),
  ]);

describe("layoutGridLetterhead", () => {
  it("tiles the width with cells and the gaps between them", () => {
    const segments = layoutGridLetterhead(
      grid([text(0.7, 0.3), logo(0, 0.1), text(0.15, 0.3)]),
    );

    // The middle column (left-aligned) grows right by half of what lies
    // beyond a gutter before the last one: (0.25 − 0.015) / 2.
    assert.deepEqual(shape(segments), [
      ["cell", 0, 0.1],
      ["gap", 0.1, 0.05],
      ["cell", 0.15, 0.4175],
      ["gap", 0.5675, 0.1325],
      ["cell", 0.7, 0.3],
    ]);
    const total = segments.reduce((sum, { width }) => sum + width, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
  });

  it("clips a cell at the next one's start when they overlap", () => {
    const segments = layoutGridLetterhead(
      grid([text(0, 0.55), text(0.5, 0.5)]),
    );

    assert.deepEqual(shape(segments), [
      ["cell", 0, 0.5],
      ["cell", 0.5, 0.5],
    ]);
  });

  it("keeps a gutter only between cells that touch, never at the outer edges", () => {
    const [first, second] = layoutGridLetterhead(
      grid([text(0, 0.5), text(0.5, 0.5)]),
    );
    assert.ok(first.kind === "cell" && second.kind === "cell");
    assert.equal(first.contentStart, 0);
    assert.ok(
      Math.abs(first.contentWidth - (0.5 - GRID_CELL_GUTTER / 2)) < 1e-9,
    );
    assert.ok(
      Math.abs(second.contentStart - (0.5 + GRID_CELL_GUTTER / 2)) < 1e-9,
    );
    assert.ok(Math.abs(second.contentStart + second.contentWidth - 1) < 1e-9);

    const [lone] = layoutGridLetterhead(grid([text(0, 1)]));
    assert.ok(lone.kind === "cell");
    assert.equal(lone.contentStart, 0);
    assert.equal(lone.contentWidth, 1);
  });

  it("adds a trailing gap when the last cell ends before the right edge", () => {
    // A logo, and text set right (it grows left only), keep their right edge.
    for (const cell of [logo(0, 0.6), right(0, 0.6)]) {
      assert.deepEqual(shape(layoutGridLetterhead(grid([cell]))), [
        ["cell", 0, 0.6],
        ["gap", 0.6, 0.4],
      ]);
    }
  });

  it("drops the first of two cells sharing an x, its space left to the other", () => {
    const segments = layoutGridLetterhead(
      grid([text(0.2, 0.1, "Shadowed"), text(0.2, 0.5, "Kept")]),
    );

    // The kept column, the last one and left-aligned, grows to the edge.
    assert.deepEqual(shape(segments), [
      ["gap", 0, 0.2],
      ["cell", 0.2, 0.8],
    ]);
    const [, kept] = segments;
    assert.ok(kept.kind === "cell" && kept.cell.lines[0].text === "Kept");
  });

  it("clips a cell that covers the next one at that cell's start", () => {
    // The inner cell (a logo: it does not grow) keeps its box; the rest of
    // the outer one is a gap.
    assert.deepEqual(
      shape(layoutGridLetterhead(grid([text(0, 1), logo(0.4, 0.2)]))),
      [
        ["cell", 0, 0.4],
        ["cell", 0.4, 0.2],
        ["gap", 0.6, 0.4],
      ],
    );
  });

  it("drops a sliver, its space joining the neighbouring gap", () => {
    assert.deepEqual(
      shape(
        layoutGridLetterhead(
          grid([right(0, 0.3), text(0.5, 0.00005), text(0.6, 0.4)]),
        ),
      ),
      [
        ["cell", 0, 0.3],
        ["gap", 0.3, 0.3],
        ["cell", 0.6, 0.4],
      ],
    );
  });

  it("drops a sliver of float noise between two cells, which still share a gutter", () => {
    const segments = layoutGridLetterhead(
      grid([text(0, 0.3), text(0.29995, 0.2), text(0.3, 0.3)]),
    );

    // The last column, left-aligned, grows to the right edge.
    assert.deepEqual(
      segments.map(({ kind }) => kind),
      ["cell", "gap", "cell"],
    );
    const [first, , second] = segments;
    assert.ok(first.kind === "cell" && second.kind === "cell");
    const between =
      second.contentStart - (first.contentStart + first.contentWidth);
    assert.ok(Math.abs(between - GRID_CELL_GUTTER) < 1e-9);
  });

  it("clips a cell at the right edge and drops one past it", () => {
    assert.deepEqual(
      shape(layoutGridLetterhead(grid([right(0, 0.5), text(0.8, 0.4)]))),
      [
        ["cell", 0, 0.5],
        ["gap", 0.5, 0.3],
        ["cell", 0.8, 0.2],
      ],
    );
    assert.deepEqual(
      shape(layoutGridLetterhead(grid([right(0, 0.5), text(1, 0.2)]))),
      [
        ["cell", 0, 0.5],
        ["gap", 0.5, 0.5],
      ],
    );
  });

  it("keeps a full gutter between cells closer than one, taking only what is missing", () => {
    const gap = GRID_CELL_GUTTER / 3;
    const [first, space, second] = layoutGridLetterhead(
      grid([text(0, 0.5), text(0.5 + gap, 0.5 - gap)]),
    );
    assert.ok(first.kind === "cell" && second.kind === "cell");
    assert.equal(space.kind, "gap");

    const missing = (GRID_CELL_GUTTER - gap) / 2;
    assert.ok(Math.abs(first.contentWidth - (0.5 - missing)) < 1e-9);
    assert.ok(Math.abs(second.contentStart - (0.5 + gap + missing)) < 1e-9);
    // The space between the two contents is exactly one gutter.
    const between =
      second.contentStart - (first.contentStart + first.contentWidth);
    assert.ok(Math.abs(between - GRID_CELL_GUTTER) < 1e-9);
  });

  it("leaves cells at least a gutter apart untouched", () => {
    const [first, , second] = layoutGridLetterhead(
      grid([text(0, 0.5), text(0.5 + GRID_CELL_GUTTER, 0.3)]),
    );
    assert.ok(first.kind === "cell" && second.kind === "cell");
    assert.equal(first.contentWidth, first.width);
    assert.equal(second.contentStart, second.start);
  });

  it("caps each side's share of the gutter at a quarter of the cell", () => {
    const narrow = 0.02;
    const [, middle] = layoutGridLetterhead(
      grid([text(0, 0.4), text(0.4, narrow), text(0.4 + narrow, 0.3)]),
    );
    assert.ok(middle.kind === "cell");
    assert.ok(Math.abs(middle.contentStart - (0.4 + narrow / 4)) < 1e-9);
    assert.ok(Math.abs(middle.contentWidth - narrow / 2) < 1e-9);
  });
});

describe("layoutGridLetterhead, text growing into free space", () => {
  // What a cell may take of a gap shared with another cell.
  const room = (gap: number) => (gap - GRID_CELL_GUTTER) / 2;
  const near = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

  it("grows a right-aligned cell left: half of what lies beyond a gutter towards a cell, all of it to the edge", () => {
    const [, gap, address] = layoutGridLetterhead(
      grid([logo(0, 0.1), right(0.6, 0.4)]),
    );
    assert.ok(address.kind === "cell" && gap.kind === "gap");
    near(address.start, 0.6 - room(0.5));
    // Its right edge, where its text is anchored, stays; so does its content.
    near(address.start + address.width, 1);
    assert.equal(address.contentStart, address.start);
    assert.equal(address.contentWidth, address.width);
    near(gap.start, 0.1);
    near(gap.width, 0.5 - room(0.5));

    assert.deepEqual(shape(layoutGridLetterhead(grid([right(0.6, 0.4)]))), [
      ["cell", 0, 1],
    ]);
  });

  it("grows a left-aligned cell right, its start kept", () => {
    assert.deepEqual(
      shape(layoutGridLetterhead(grid([text(0, 0.3), logo(0.9, 0.1)]))),
      [
        ["cell", 0, 0.3 + room(0.6)],
        ["gap", 0.3 + room(0.6), 0.6 - room(0.6)],
        ["cell", 0.9, 0.1],
      ],
    );
    assert.deepEqual(shape(layoutGridLetterhead(grid([text(0.2, 0.3)]))), [
      ["gap", 0, 0.2],
      ["cell", 0.2, 0.8],
    ]);
  });

  it("grows a centered cell by the same amount on both sides, the smaller room", () => {
    // Edges on both sides, 0.3 to the left and 0.4 to the right.
    assert.deepEqual(shape(layoutGridLetterhead(grid([center(0.3, 0.3)]))), [
      ["cell", 0, 0.9],
      ["gap", 0.9, 0.1],
    ]);

    // A logo on the left leaves room(0.2) there, less than the edge's 0.3.
    const [, , name, trailing] = layoutGridLetterhead(
      grid([logo(0, 0.1), center(0.3, 0.4)]),
    );
    assert.ok(name.kind === "cell" && trailing.kind === "gap");
    near(name.start, 0.3 - room(0.2));
    near(name.width, 0.4 + 2 * room(0.2));
    // Its centre, where its text is anchored, stays.
    near(name.start + name.width / 2, 0.5);

    // No room on one side: it does not grow at all.
    assert.deepEqual(
      shape(layoutGridLetterhead(grid([logo(0, 0.3), center(0.3, 0.4)]))),
      [
        ["cell", 0, 0.3],
        ["cell", 0.3, 0.4],
        ["gap", 0.7, 0.3],
      ],
    );
  });

  it("never grows a logo", () => {
    assert.deepEqual(shape(layoutGridLetterhead(grid([logo(0.4, 0.2)]))), [
      ["gap", 0, 0.4],
      ["cell", 0.4, 0.2],
      ["gap", 0.6, 0.4],
    ]);
  });

  it("ends two text cells growing towards each other a gutter apart", () => {
    const [name, gap, address] = layoutGridLetterhead(
      grid([text(0, 0.3), right(0.6, 0.4)]),
    );
    assert.ok(
      name.kind === "cell" && gap.kind === "gap" && address.kind === "cell",
    );
    near(name.width, 0.3 + room(0.3));
    near(address.start, 0.6 - room(0.3));
    near(gap.width, GRID_CELL_GUTTER);
    assert.ok(
      name.contentStart + name.contentWidth <= address.contentStart + 1e-12,
    );
  });

  it("takes only space beyond a gutter, so a neighbour's text does not move", () => {
    // A gutter and a half apart: the first column takes a quarter gutter;
    // the second keeps its start and its content.
    const apart = 1.5 * GRID_CELL_GUTTER;
    const [first, , second] = layoutGridLetterhead(
      grid([text(0, 0.3), text(0.3 + apart, 0.3)]),
    );
    assert.ok(first.kind === "cell" && second.kind === "cell");
    near(first.width, 0.3 + GRID_CELL_GUTTER / 4);
    assert.equal(first.contentWidth, first.width);
    assert.equal(second.start, 0.3 + apart);
    assert.equal(second.contentStart, second.start);

    // Closer than a gutter: neither grows towards the other, and the gutter
    // is split as for the stored cells.
    const close = GRID_CELL_GUTTER / 2;
    const [a, , b] = layoutGridLetterhead(
      grid([text(0, 0.3), right(0.3 + close, 0.3)]),
    );
    assert.ok(a.kind === "cell" && b.kind === "cell");
    near(a.width, 0.3);
    near(a.contentWidth, 0.3 - (GRID_CELL_GUTTER - close) / 2);
    near(b.start, 0.3 + close);
    near(b.contentStart, 0.3 + close + (GRID_CELL_GUTTER - close) / 2);
  });

  it("tiles [0, 1] with cells whose contents never overlap, for any mix of cells", () => {
    // A fixed-seed generator: the same grids on every run.
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const alignments = ["left", "center", "right"] as const;
    for (let round = 0; round < 300; round++) {
      const cells = Array.from(
        { length: 1 + Math.floor(random() * 5) },
        (): GridLetterhead["cells"][number] => {
          const x = random() * 0.9;
          const width = 0.005 + random() * 0.4;
          return random() < 0.3
            ? logo(x, width)
            : text(x, width, "Agency", alignments[Math.floor(random() * 3)]);
        },
      );
      const segments = layoutGridLetterhead(grid(cells));

      let position = 0;
      let contentEnd = 0;
      for (const segment of segments) {
        assert.ok(Math.abs(segment.start - position) < 1e-12);
        assert.ok(segment.width > 0);
        position = segment.start + segment.width;
        if (segment.kind === "cell") {
          assert.ok(segment.contentStart >= segment.start - 1e-12);
          assert.ok(
            segment.contentStart + segment.contentWidth <= position + 1e-12,
          );
          assert.ok(segment.contentStart >= contentEnd - 1e-12);
          contentEnd = segment.contentStart + segment.contentWidth;
        }
      }
      near(position, 1);
    }
  });
});

describe("gridLogoSize", () => {
  it("keeps the stored size when it fits and shrinks it, aspect kept, when not", () => {
    const tall = { ...logo(0, 0.1), height: 0.15 };
    assert.deepEqual(gridLogoSize(tall, 0.3), { width: 0.1, height: 0.15 });
    const shrunk = gridLogoSize(tall, 0.05);
    assert.ok(Math.abs(shrunk.width - 0.05) < 1e-9);
    assert.ok(Math.abs(shrunk.height - 0.075) < 1e-9);
  });

  it("caps the height, shrinking the width with it", () => {
    const seal = { ...logo(0, 0.2), height: 0.4 };
    const size = gridLogoSize(seal, 0.3);
    assert.ok(Math.abs(size.height - MAX_GRID_LOGO_HEIGHT) < 1e-9);
    assert.ok(Math.abs(size.width - 0.09) < 1e-9);

    // Whichever bound is tighter wins.
    const narrowed = gridLogoSize(seal, 0.05);
    assert.ok(Math.abs(narrowed.width - 0.05) < 1e-9);
    assert.ok(Math.abs(narrowed.height - 0.1) < 1e-9);
  });
});

describe("GRID_LINE_SCALE", () => {
  it("scales every size, growing from small to xxlarge", () => {
    assert.deepEqual(GRID_LINE_SCALE, {
      small: 0.85,
      normal: 1,
      large: 1.3,
      xlarge: 1.8,
      xxlarge: 2.6,
    });
    const scales = GRID_LINE_SIZES.map((size) => GRID_LINE_SCALE[size]);
    assert.deepEqual(
      scales,
      [...scales].sort((a, b) => a - b),
    );
  });
});

describe("gridCellOffset", () => {
  it("places a shorter cell at the row's top, middle or bottom", () => {
    assert.equal(gridCellOffset(undefined, 20, 100), 0);
    assert.equal(gridCellOffset("top", 20, 100), 0);
    assert.equal(gridCellOffset("middle", 20, 100), 40);
    assert.equal(gridCellOffset("bottom", 20, 100), 80);
  });

  it("never moves a cell as tall as the row, or taller, above its top", () => {
    for (const valign of ["top", "middle", "bottom"] as const) {
      assert.equal(gridCellOffset(valign, 100, 100), 0);
      assert.equal(gridCellOffset(valign, 120, 100), 0);
    }
  });
});

describe("gridBaseFontRatio", () => {
  // The PDF's content width (A4 less two 50 pt margins) and page width.
  const CONTENT_PT = 495.28;
  const PAGE_PT = 595.28;

  it("is the default 9.5 pt of the PDF without a usable fontSize", () => {
    assert.ok(Math.abs(GRID_BASE_FONT_RATIO * CONTENT_PT - 9.5) < 1e-9);
    for (const fontSize of [
      undefined,
      0,
      -0.01,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      assert.equal(gridBaseFontRatio({ fontSize }), GRID_BASE_FONT_RATIO);
    }
    assert.equal(gridBaseFontRatio({}), GRID_BASE_FONT_RATIO);
  });

  it("maps the reference page's width to the output page's, whose content is a share of it", () => {
    assert.ok(Math.abs(GRID_PAGE_CONTENT_RATIO - CONTENT_PT / PAGE_PT) < 1e-12);
    // 10 pt on an A4 reference is 10 pt in the A4 PDF.
    assert.ok(
      Math.abs(
        gridBaseFontRatio({ fontSize: 10 / PAGE_PT }) * CONTENT_PT - 10,
      ) < 1e-9,
    );
    // 7 pt on a US Letter reference (612 pt wide) scales with the page.
    assert.ok(
      Math.abs(
        gridBaseFontRatio({ fontSize: 7 / 612 }) * CONTENT_PT -
          (7 * PAGE_PT) / 612,
      ) < 1e-9,
    );
  });

  it("holds the size to 6.5–13 pt of the PDF", () => {
    assert.ok(Math.abs(MIN_GRID_FONT_RATIO * CONTENT_PT - 6.5) < 1e-9);
    assert.ok(Math.abs(MAX_GRID_FONT_RATIO * CONTENT_PT - 13) < 1e-9);
    // 3 pt and 30 pt on an A4 reference, and the largest stored value.
    assert.equal(
      gridBaseFontRatio({ fontSize: 3 / PAGE_PT }),
      MIN_GRID_FONT_RATIO,
    );
    assert.equal(
      gridBaseFontRatio({ fontSize: 30 / PAGE_PT }),
      MAX_GRID_FONT_RATIO,
    );
    assert.equal(gridBaseFontRatio({ fontSize: 1 }), MAX_GRID_FONT_RATIO);
  });
});

describe("gridLogoCells", () => {
  it("lists the logos left to right", () => {
    const cells = gridLogoCells(
      grid([
        logo(0.9, 0.1, "letterheads/project/d/right.png"),
        text(0.2, 0.5),
        logo(0, 0.1, "letterheads/project/d/left.png"),
      ]),
    );
    assert.deepEqual(
      cells.map(({ key }) => key),
      ["letterheads/project/d/left.png", "letterheads/project/d/right.png"],
    );
  });
});

describe("toPublicGridLetterhead", () => {
  const stored = grid([
    logo(0.9, 0.1, "letterheads/project/d/right.png"),
    text(0.2, 0.5),
    logo(0, 0.1, "letterheads/project/d/left.png"),
  ]);

  it("replaces each logo key by its index left to right, keeping cell order", () => {
    const publicGrid = toPublicGridLetterhead(stored);

    assert.deepEqual(publicGrid, {
      cells: [
        { kind: "logo", x: 0.9, width: 0.1, height: 0.1, index: 1 },
        stored.cells[1],
        { kind: "logo", x: 0, width: 0.1, height: 0.1, index: 0 },
      ],
      color: null,
    });
    assert.equal(JSON.stringify(publicGrid).includes("letterheads/"), false);
    assert.equal(JSON.stringify(publicGrid).includes('"key"'), false);
  });

  it("rebuilds text cells from their known fields only", () => {
    const smuggled = {
      ...text(0.2, 0.5),
      url: "https://f.test/hidden.png",
      key: "letterheads/project/d/hidden.png",
      lines: [
        {
          text: "Agency",
          bold: true,
          size: "normal" as const,
          href: "https://f.test/line.png",
        },
      ],
    };
    const publicGrid = toPublicGridLetterhead(
      grid([smuggled as GridLetterhead["cells"][number]]),
    );

    assert.deepEqual(publicGrid.cells, [text(0.2, 0.5)]);
    assert.notEqual(publicGrid.cells[0], smuggled);
    assert.equal(JSON.stringify(publicGrid).includes("f.test"), false);
    assert.equal(JSON.stringify(publicGrid).includes("letterheads/"), false);
  });

  it("keeps each cell's vertical alignment, and leaves it out when it has none", () => {
    const [right, name, left] = stored.cells;
    const publicGrid = toPublicGridLetterhead({
      ...stored,
      cells: [
        { ...right, valign: "bottom" },
        { ...name, valign: "middle" },
        left,
      ],
    });
    assert.deepEqual(
      publicGrid.cells.map((cell) => ("valign" in cell ? cell.valign : "none")),
      ["bottom", "middle", "none"],
    );
  });

  it("keeps the base text size, and leaves it out when the stored grid has none", () => {
    assert.equal(
      toPublicGridLetterhead({ ...stored, fontSize: 0.0123 }).fontSize,
      0.0123,
    );
    assert.equal("fontSize" in toPublicGridLetterhead(stored), false);
  });

  it("lays out and lists logos like the stored grid", () => {
    const publicGrid = toPublicGridLetterhead(stored);

    assert.deepEqual(
      shape(layoutGridLetterhead(publicGrid)),
      shape(layoutGridLetterhead(stored)),
    );
    assert.deepEqual(
      gridLogoCells(publicGrid).map(({ index }) => index),
      [0, 1],
    );
  });
});
