import { clipBox } from "./boxes";
import { luminanceAt, PAPER_LUMINANCE } from "./pixels";
import type { Box } from "./types";

// Reading the size of a letterhead's lines from its pixels, for text the PDF
// does not print (a scan, or lettering drawn as an image): each line's ink
// height in the render, turned into a font size by what its text draws. The
// visible glyphs set the size, not the line pitch: a line set in small caps
// is drawn as large as its small caps look, not as its font's em.

// A pixel row with at least this many ink pixels inside the box has ink: a
// single speck of a scan does not, a descender or a comma's tail does.
const MIN_ROW_INK_PX = 2;

// The model's box is loose but can clip a line's top or a descender: rows are
// read this share of a line's slot (box height ÷ lines) beyond its top and
// bottom. A band lying wholly in that margin belongs to a neighbouring block
// and is left out; one running on to the margin's edge cannot be measured.
const BOX_PADDING_RATIO = 0.25;

// A line's band taller than this share of its slot is two lines touching (or
// not text at all), one shorter than MIN_LINE_INK_PX is noise.
const MAX_BAND_SLOT_RATIO = 1.5;
const MIN_LINE_INK_PX = 2;

// A row with at least this share of the ink of its line's densest row is part
// of the line's body. A line without lowercase letters is measured over its
// body only, so its few taller initials (small caps), comma tails and accents
// do not count; a mixed-case line without descending letters loses its comma
// tails below the body. The rows above stay: its ascenders are sparse.
const BODY_ROW_SHARE = 0.5;

// What a line's measured ink spans, in ems of its font: a line without
// lowercase letters (capitals, digits — and small caps, which the model
// transcribes as capitals) its cap height; a mixed-case line with a
// descending letter (g j p q y) ascender to descender; any other mixed-case
// line ascender to baseline.
const CAP_HEIGHT_EM = 0.7;
const DESCENDER_SPAN_EM = 0.92;
const ASCENDER_SPAN_EM = 0.72;

type LineKind = "caps" | "descending" | "ascending";

const lineKindOf = (text: string): LineKind => {
  if (!/\p{Ll}/u.test(text)) {
    return "caps";
  }
  return /[gjpqy]/.test(text) ? "descending" : "ascending";
};

// A run of ink rows: [start, end) in image rows.
type Band = { start: number; end: number };

// The runs of rows that have ink, top to bottom.
const findBands = (counts: number[], firstRow: number): Band[] => {
  const bands: Band[] = [];
  counts.forEach((count, index) => {
    if (count < MIN_ROW_INK_PX) {
      return;
    }
    const row = firstRow + index;
    const last = bands.at(-1);
    if (last && last.end === row) {
      last.end = row + 1;
    } else {
      bands.push({ start: row, end: row + 1 });
    }
  });
  return bands;
};

// The bands merged, closest pair first, until there are `count`: a dot or an
// accent apart from its line joins it.
const mergeBands = (bands: Band[], count: number): Band[] => {
  const merged = [...bands];
  while (merged.length > count) {
    let closest = 0;
    for (let index = 1; index < merged.length - 1; index++) {
      const gap = merged[index + 1].start - merged[index].end;
      if (gap < merged[closest + 1].start - merged[closest].end) {
        closest = index;
      }
    }
    merged.splice(closest, 2, {
      start: merged[closest].start,
      end: merged[closest + 1].end,
    });
  }
  return merged;
};

// The height of a line's ink: its whole band, less the sparse rows its text's
// kind leaves out (see BODY_ROW_SHARE).
const inkHeightOf = (
  band: Band,
  counts: number[],
  firstRow: number,
  kind: LineKind,
): number => {
  if (kind === "descending") {
    return band.end - band.start;
  }
  const rows = counts.slice(band.start - firstRow, band.end - firstRow);
  const threshold = BODY_ROW_SHARE * Math.max(...rows);
  const top =
    kind === "caps" ? rows.findIndex((count) => count >= threshold) : 0;
  const bottom = rows.findLastIndex((count) => count >= threshold);
  return bottom - top + 1;
};

// A line's ink: the image rows its band spans ([top, bottom)) and its
// measured height (see `inkHeightOf`).
type LineInk = { top: number; bottom: number; height: number };

// The ink of each of a block's lines, top to bottom (see `measureLineInk`).
const readLineInk = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  box: Box,
  lines: string[],
): LineInk[] | null => {
  if (lines.length === 0) {
    return null;
  }
  const slot = box.height / lines.length;
  const padding = BOX_PADDING_RATIO * slot;
  const read = clipBox(
    {
      x: box.x,
      y: box.y - padding,
      width: box.width,
      height: box.height + 2 * padding,
    },
    { x: 0, y: 0, width, height },
  );
  if (!read) {
    return null;
  }
  const x0 = Math.floor(read.x);
  const x1 = Math.ceil(read.x + read.width);
  const y0 = Math.floor(read.y);
  const y1 = Math.ceil(read.y + read.height);

  const counts: number[] = [];
  for (let y = y0; y < y1; y++) {
    let count = 0;
    for (let x = x0; x < x1; x++) {
      if (luminanceAt(rgba, (y * width + x) * 4) < PAPER_LUMINANCE) {
        count++;
      }
    }
    counts.push(count);
  }

  const inBox = findBands(counts, y0).filter(
    (band) => band.end > box.y && band.start < box.y + box.height,
  );
  if (inBox.length < lines.length) {
    return null;
  }
  const bands = mergeBands(inBox, lines.length);
  const isMeasurable = bands.every(
    (band) =>
      band.start > y0 &&
      band.end < y1 &&
      band.end - band.start <= MAX_BAND_SLOT_RATIO * slot,
  );
  if (!isMeasurable) {
    return null;
  }
  const ink = bands.map((band, index) => ({
    top: band.start,
    bottom: band.end,
    height: inkHeightOf(band, counts, y0, lineKindOf(lines[index])),
  }));
  return ink.every((line) => line.height >= MIN_LINE_INK_PX) ? ink : null;
};

/**
 * The ink height of each of a block's lines, in pixels, top to bottom: the
 * rows of `box` (padded, clipped to the image) that hold ink, in runs — one
 * per line once the closest runs are joined (a dot, an accent). A line
 * without lowercase letters counts its body rows only, a mixed-case line
 * without descending letters leaves out what hangs below its body (see
 * BODY_ROW_SHARE). Null when the lines cannot be told apart: fewer runs than
 * `lines` (lines touching), a run too tall or too short for one line, or one
 * cut by the edge of what is read.
 */
export const measureLineInk = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  box: Box,
  lines: string[],
): number[] | null =>
  readLineInk(rgba, width, height, box, lines)?.map((line) => line.height) ??
  null;

/**
 * The font size (pixels) a line of `text` whose ink is `inkHeight` pixels tall
 * is drawn at, by the span its kind of text covers (see CAP_HEIGHT_EM).
 */
export const fontSizeFromInk = (inkHeight: number, text: string): number => {
  const kind = lineKindOf(text);
  const span =
    kind === "caps"
      ? CAP_HEIGHT_EM
      : kind === "descending"
        ? DESCENDER_SPAN_EM
        : ASCENDER_SPAN_EM;
  return inkHeight / span;
};

/**
 * A block's lines as read from their ink in the render: each line's font size
 * in pixels, top to bottom (`measureLineInk`, then `fontSizeFromInk`), and
 * the image rows its ink spans, [top, bottom) — tighter than the model's box.
 */
export type BlockInk = { fontSizes: number[]; top: number; bottom: number };

/** The ink of a block's lines (see `BlockInk`); null when not measurable. */
export const measureBlockInk = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  box: Box,
  lines: string[],
): BlockInk | null => {
  const ink = readLineInk(rgba, width, height, box, lines);
  const last = ink?.at(-1);
  if (!ink || !last) {
    return null;
  }
  return {
    fontSizes: ink.map((line, index) =>
      fontSizeFromInk(line.height, lines[index]),
    ),
    top: ink[0].top,
    bottom: last.bottom,
  };
};
