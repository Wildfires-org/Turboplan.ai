// How the document preview (`LetterheadBand`) places a grid letterhead: the
// segments of `layoutGridLetterhead` — the layout the PDF and DOCX exporters
// draw too — as the columns of one CSS grid row. Every cell's content box gets
// its own column (the gutters it shares with a neighbour and the gaps between
// cells are empty columns), so a cell sits at `contentStart` with width
// `contentWidth` of the letterhead's width, whatever its text.

import {
  cleanGridLineText,
  type GridLetterheadLine,
  gridLogoSize,
  layoutGridLetterhead,
  type PublicGridLetterheadCell,
  type PublicGridLetterheadLogoCell,
} from "@wildfires-org/turboplan-workspace/types";

type GridTextCell = Extract<PublicGridLetterheadCell, { kind: "text" }>;

export type GridBandCell =
  | {
      kind: "text";
      cell: GridTextCell;
      column: number;
      // The lines to draw: their text with whitespace and control characters
      // collapsed to single spaces, empty ones left out (as the exporters do).
      lines: GridLetterheadLine[];
    }
  | {
      kind: "logo";
      cell: PublicGridLetterheadLogoCell;
      column: number;
      // The logo's drawn width (`gridLogoSize`) as a CSS percentage of its
      // column, and its width / height (its height follows the width).
      width: string;
      aspectRatio: number;
    };

export type GridBand = {
  // `grid-template-columns`: every column as `minmax(0, <fr>)`, so the
  // columns keep the fractions' proportions exactly — however the floats sum,
  // and however long a word in a cell is.
  columns: string;
  // Left to right; `column` is the cell's 1-based CSS grid column.
  cells: GridBandCell[];
};

// Gutters narrower than this (float noise) get no column of their own.
const MIN_TRACK = 1e-6;

const toPercent = (value: number) => Number((value * 100).toFixed(4));

const toTrack = (fraction: number) => `minmax(0,${toPercent(fraction)}fr)`;

const drawnLines = (lines: readonly GridLetterheadLine[]) =>
  lines.flatMap((line) => {
    const text = cleanGridLineText(line.text);
    return text ? [{ ...line, text }] : [];
  });

// `fontSize` is the grid's base text size: the layout widens a column for a
// line set at it that would not fit (see `layoutGridLetterhead`).
export const layoutGridBand = (grid: {
  cells: readonly PublicGridLetterheadCell[];
  fontSize?: number;
}): GridBand => {
  const tracks: number[] = [];
  const cells: GridBandCell[] = [];

  layoutGridLetterhead(grid).forEach((segment) => {
    if (segment.kind === "gap") {
      tracks.push(segment.width);
      return;
    }

    const leading = segment.contentStart - segment.start;
    const trailing =
      segment.start +
      segment.width -
      (segment.contentStart + segment.contentWidth);
    if (leading > MIN_TRACK) {
      tracks.push(leading);
    }
    tracks.push(segment.contentWidth);
    const column = tracks.length;
    if (trailing > MIN_TRACK) {
      tracks.push(trailing);
    }

    const { cell } = segment;
    if (cell.kind === "text") {
      cells.push({ kind: "text", cell, column, lines: drawnLines(cell.lines) });
      return;
    }
    const size = gridLogoSize(cell, segment.contentWidth);
    cells.push({
      kind: "logo",
      cell,
      column,
      width: `${toPercent(size.width / segment.contentWidth)}%`,
      aspectRatio: size.width / size.height,
    });
  });

  return { columns: tracks.map(toTrack).join(" "), cells };
};
