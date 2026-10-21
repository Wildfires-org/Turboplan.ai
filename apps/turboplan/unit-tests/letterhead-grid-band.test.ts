import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GRID_CELL_GUTTER,
  layoutGridLetterhead,
  type PublicGridLetterheadCell,
} from "@wildfires-org/turboplan-workspace/types";

import { layoutGridBand } from "../lib/letterhead-grid-band";

const text = (
  x: number,
  width: number,
  align: "left" | "center" | "right" = "left",
): PublicGridLetterheadCell => ({
  kind: "text",
  x,
  width,
  align,
  lines: [{ text: "Agency", bold: true, size: "normal" }],
});

const logo = (
  x: number,
  width: number,
  height: number,
  index = 0,
): PublicGridLetterheadCell => ({ kind: "logo", x, width, height, index });

// The `fr` of every column, as percentages of the letterhead's width.
const tracksOf = (columns: string) =>
  columns.split(" ").map((track) => {
    const match = /^minmax\(0,([\d.]+)fr\)$/.exec(track);
    assert.ok(match, `unexpected track ${track}`);
    return Number(match[1]);
  });

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const close = (actual: number, expected: number, message?: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-3,
    `${message ?? ""} ${actual} ≠ ${expected}`,
  );

// The agency letter of the plan: a logo, three bold cells side by side and
// an address at the right edge.
const AGENCY = [
  logo(0, 0.09, 0.09),
  text(0.1, 0.16),
  text(0.26, 0.1),
  text(0.36, 0.2),
  text(0.72, 0.28, "right"),
];

describe("layoutGridBand", () => {
  it("places every cell's content box at its start, with its width", () => {
    const segments = layoutGridLetterhead({ cells: AGENCY });
    const { columns, cells } = layoutGridBand({ cells: AGENCY });
    const tracks = tracksOf(columns);

    close(sum(tracks), 100, "the columns span the full width");
    const cellSegments = segments.filter((segment) => segment.kind === "cell");
    assert.equal(cells.length, cellSegments.length);
    cells.forEach((cell, index) => {
      const segment = cellSegments[index];
      assert.equal(cell.cell, segment.cell);
      close(tracks[cell.column - 1], segment.contentWidth * 100, "width");
      close(
        sum(tracks.slice(0, cell.column - 1)),
        segment.contentStart * 100,
        "start",
      );
    });
  });

  it("splits the gutter between two touching cells into empty columns", () => {
    const { columns, cells } = layoutGridBand({
      cells: [text(0, 0.5), text(0.5, 0.5)],
    });
    const half = (GRID_CELL_GUTTER / 2) * 100;

    assert.deepEqual(
      tracksOf(columns),
      [50 - half, half, half, 50 - half].map((value) =>
        Number(value.toFixed(4)),
      ),
    );
    assert.deepEqual(
      cells.map((cell) => cell.column),
      [1, 4],
    );
  });

  it("keeps no gutter at the outer edges or beside a gap", () => {
    // A left-aligned cell grows only to the right, here already the edge:
    // the gap beside it stays as stored.
    const { columns, cells } = layoutGridBand({
      cells: [text(0.5, 0.5), logo(0, 0.1, 0.05)],
    });

    assert.deepEqual(tracksOf(columns), [10, 40, 50]);
    assert.deepEqual(
      cells.map((cell) => [cell.kind, cell.column]),
      [
        ["logo", 1],
        ["text", 3],
      ],
    );
  });

  it("grows a text cell on its open side, a gutter short of its neighbour", () => {
    // Right-aligned: it grows left into the 0.4 gap by half of what lies
    // beyond a gutter (the logo never grows), and keeps its right edge.
    const grown = (0.4 - GRID_CELL_GUTTER) / 2;
    const { columns, cells } = layoutGridBand({
      cells: [logo(0, 0.1, 0.05), text(0.5, 0.3, "right")],
    });
    const tracks = tracksOf(columns);

    assert.equal(tracks.length, 4);
    [10, (0.4 - grown) * 100, (0.3 + grown) * 100, 20].forEach(
      (expected, index) => close(tracks[index], expected, `track ${index}`),
    );
    assert.deepEqual(
      cells.map((cell) => cell.column),
      [1, 3],
    );

    // Two cells growing towards each other end a gutter apart.
    const half = (0.2 - GRID_CELL_GUTTER) / 2;
    const facing = tracksOf(
      layoutGridBand({ cells: [text(0, 0.4), text(0.6, 0.4, "right")] })
        .columns,
    );
    assert.equal(facing.length, 3);
    [(0.4 + half) * 100, GRID_CELL_GUTTER * 100, (0.4 + half) * 100].forEach(
      (expected, index) => close(facing[index], expected, `track ${index}`),
    );
  });

  it("grows a centered cell by the same amount on both sides, taking an edge gap whole", () => {
    // 0.2 of room on the left (to the edge, all of it), 0.4 on the right:
    // it grows by 0.2 on each side.
    const { columns } = layoutGridBand({
      cells: [text(0.2, 0.4, "center")],
    });

    assert.deepEqual(tracksOf(columns), [80, 20]);
  });

  it("draws a logo across its column with the logo's proportions", () => {
    const { columns, cells } = layoutGridBand({
      cells: [logo(0.2, 0.2, 0.1, 1)],
    });
    const [logoCell] = cells;

    assert.deepEqual(tracksOf(columns), [20, 20, 60]);
    assert.ok(logoCell?.kind === "logo");
    assert.equal(logoCell.cell.index, 1);
    assert.equal(logoCell.column, 2);
    assert.equal(logoCell.width, "100%");
    close(logoCell.aspectRatio, 2);
  });

  it("collapses whitespace in a line and leaves out empty lines", () => {
    const { cells } = layoutGridBand({
      cells: [
        {
          kind: "text",
          x: 0,
          width: 1,
          align: "center",
          lines: [
            { text: "  County\tof\n Example ", bold: true, size: "large" },
            { text: " \u0007 ", bold: false, size: "small" },
            { text: "Auburn, CA", bold: false, size: "small" },
          ],
        },
      ],
    });
    const [textCell] = cells;

    assert.ok(textCell?.kind === "text");
    assert.deepEqual(textCell.lines, [
      { text: "County of Example", bold: true, size: "large" },
      { text: "Auburn, CA", bold: false, size: "small" },
    ]);
  });

  it("shrinks a logo clipped by its neighbour, keeping its proportions", () => {
    // The text cell starts inside the logo's box: the logo's segment ends
    // there, minus half a gutter.
    const { columns, cells } = layoutGridBand({
      cells: [logo(0, 0.12, 0.06), text(0.1, 0.3)],
    });
    const [logoCell] = cells;

    assert.ok(logoCell?.kind === "logo");
    assert.equal(logoCell.column, 1);
    close(tracksOf(columns)[0], (0.1 - GRID_CELL_GUTTER / 2) * 100);
    assert.equal(logoCell.width, "100%");
    close(logoCell.aspectRatio, 2);
  });
});
