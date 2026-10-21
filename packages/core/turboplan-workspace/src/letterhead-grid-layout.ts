// How a grid letterhead is laid out across the content width — the one layout
// the preview, the PDF and the DOCX exporter all draw, so the three agree.
// Client-safe: no server imports.

import type {
  GridLetterhead,
  GridLetterheadCell,
  GridLetterheadLogoCell,
  GridLineSize,
  GridVerticalAlign,
  PublicGridLetterhead,
  PublicGridLetterheadCell,
} from "./letterhead-grid";

// The cells the layout reads: a stored grid's (server) or a public grid's
// (logo `index` instead of its storage key — the preview, DOCX and PDF
// renderers).
type LayoutCell = GridLetterheadCell | PublicGridLetterheadCell;
type LogoOf<C extends LayoutCell> = Extract<C, { kind: "logo" }>;

// Text size of a line relative to the letterhead's base size. The analysis
// picks a line's size by these (thresholds midway between them), so keep it
// in step with `sizeOf` in `@wildfires-org/turboplan-document-extraction`.
export const GRID_LINE_SCALE: Record<GridLineSize, number> = {
  small: 0.85,
  normal: 1,
  large: 1.3,
  xlarge: 1.8,
  xxlarge: 2.6,
};

// The default base text size of a letterhead as a fraction of the content
// width — for a grid without `fontSize` (one stored before the analysis read
// it, or none known): the PDF's 9.5 pt on its 495.28 pt content width. Every
// renderer sizes the base as `gridBaseFontRatio(grid)` × its own content
// width (PDF points; DOCX points from its width in twips; the preview from
// its container's width), so a line wraps at the same words everywhere. A
// line's size is the base × GRID_LINE_SCALE.
export const GRID_BASE_FONT_RATIO = 9.5 / 495.28;

// The PDF's content width over its page width: A4 (595.28 pt) less two
// 50 pt margins. A grid's `fontSize` is a fraction of its reference page's
// width, which maps to the whole output page; the renderers measure against
// the content width, this share of the page.
export const GRID_PAGE_CONTENT_RATIO = 495.28 / 595.28;

// Readable bounds of the base text size, as fractions of the content width
// (6.5 pt and 13 pt in the PDF): a reference's fine print or display type is
// not copied below or above them.
export const MIN_GRID_FONT_RATIO = 6.5 / 495.28;
export const MAX_GRID_FONT_RATIO = 13 / 495.28;

/**
 * A grid's base text size as a fraction of the renderer's content width: as
 * large as the reference printed it — its `fontSize` (a fraction of the
 * reference page's width) over {@link GRID_PAGE_CONTENT_RATIO}, held to
 * [{@link MIN_GRID_FONT_RATIO}, {@link MAX_GRID_FONT_RATIO}] — or
 * {@link GRID_BASE_FONT_RATIO} without a usable `fontSize`. Every renderer
 * sizes its letterhead text from this, never from the constant.
 */
export const gridBaseFontRatio = (grid: { fontSize?: number }): number => {
  const { fontSize } = grid;
  if (fontSize === undefined || !Number.isFinite(fontSize) || fontSize <= 0) {
    return GRID_BASE_FONT_RATIO;
  }
  return Math.min(
    MAX_GRID_FONT_RATIO,
    Math.max(MIN_GRID_FONT_RATIO, fontSize / GRID_PAGE_CONTENT_RATIO),
  );
};

// Space kept between two neighbouring cells, as a fraction of the width,
// taken from their inner edges only (the letterhead still spans the full
// width). Cells further apart than this keep their own edges.
export const GRID_CELL_GUTTER = 0.015;

// The tallest a logo is drawn, as a fraction of the content width: a seal
// stored taller than this (a scan, a crop with a large margin) shrinks,
// aspect kept, so the letterhead never pushes the body far down the page.
export const MAX_GRID_LOGO_HEIGHT = 0.18;

// A cell narrower than this once clipped (see `layoutGridLetterhead`) is float
// noise between two cells, not a column: it is not laid out at all.
const GRID_SLIVER = 1e-4;

/**
 * One slice of the letterhead's width, left to right: a cell, or empty space
 * between cells. `start` and `width` are fractions of the content width — a
 * text cell's box grown into the free space on its open side (see
 * `layoutGridLetterhead`); a cell's `contentStart` / `contentWidth` are its
 * box minus the gutters it shares with a neighbouring cell.
 */
export type GridSegment<C extends LayoutCell = GridLetterheadCell> =
  | {
      kind: "cell";
      cell: C;
      start: number;
      width: number;
      contentStart: number;
      contentWidth: number;
    }
  | { kind: "gap"; start: number; width: number };

type CellSlice<C> = { cell: C; start: number; end: number };

// How far a text cell may grow into the space between its edge and `to`
// (`from` < `to`): all of it up to the letterhead's edge; towards another
// cell, half of what lies beyond a gutter, so two cells growing towards each
// other end a gutter apart and a cell never takes space a neighbour's
// gutter needs.
const roomTowards = (from: number, to: number, isEdge: boolean): number =>
  isEdge ? to - from : Math.max(0, to - from - GRID_CELL_GUTTER) / 2;

// The slice of a text cell grown on its open side(s): a left-aligned cell to
// the right, a right-aligned one to the left, a centered one by the same
// amount on both sides (the smaller room). Text that fits stays where its
// alignment anchors it; only a line too long for the stored width gets the
// room. Logos never grow. A side reaching the letterhead's edge ends exactly
// on it.
const grownSlice = <C extends LayoutCell>(
  slice: CellSlice<C>,
  previous: CellSlice<C> | undefined,
  next: CellSlice<C> | undefined,
): CellSlice<C> => {
  const { cell, start, end } = slice;
  if (cell.kind !== "text") {
    return slice;
  }
  const leftRoom = roomTowards(previous?.end ?? 0, start, !previous);
  const rightRoom = roomTowards(end, next?.start ?? 1, !next);
  const leftLimit = previous ? start - leftRoom : 0;
  const rightLimit = next ? end + rightRoom : 1;
  if (cell.align === "left") {
    return { ...slice, end: rightLimit };
  }
  if (cell.align === "right") {
    return { ...slice, start: leftLimit };
  }
  const room = Math.min(leftRoom, rightRoom);
  return {
    ...slice,
    start: leftRoom <= rightRoom ? leftLimit : start - room,
    end: rightRoom <= leftRoom ? rightLimit : end + room,
  };
};

// What each of two neighbouring slices gives up for the gutter between them:
// half of what their gap lacks of GRID_CELL_GUTTER (nothing when they are at
// least a gutter apart, or when there is no neighbour).
const gutterInset = (
  left: CellSlice<unknown> | undefined,
  right: CellSlice<unknown> | undefined,
): number =>
  left && right
    ? Math.max(0, GRID_CELL_GUTTER - (right.start - left.end)) / 2
    : 0;

/**
 * The grid as segments that tile [0, 1] without overlapping: cells in order of
 * `x`, each starting at its `x` and ending at its right edge, where the next
 * one starts, or at 1, whichever comes first; the space between them as gaps.
 * A cell with (almost) nothing left once clipped — under 1e-4 of the width:
 * one sharing the next cell's `x`, one past the right edge — is no segment,
 * its space joins the neighbouring gap. Two cells closer than
 * GRID_CELL_GUTTER keep that gutter between their contents, each giving up
 * half of the missing part (at most a quarter of its own width).
 *
 * A text cell then grows into the empty space on its open side — a
 * left-aligned one to the right, a right-aligned one to the left, a centered
 * one equally on both — up to the letterhead's edge, or towards another cell
 * by half of what lies beyond a gutter, so a line that fit the reference's
 * type does not wrap in the renderer's wider one. Text that fits stays where
 * its alignment puts it; logos never grow; the gaps shrink to what is left.
 * A cell grows only where it has no gutter to keep, so the gutters are those
 * of the cells as stored. A table-based renderer (DOCX) gets one column per
 * segment; the others position each segment at its `start`.
 */
export const layoutGridLetterhead = <C extends LayoutCell>(grid: {
  cells: readonly C[];
}): GridSegment<C>[] => {
  const cells = [...grid.cells].sort((a, b) => a.x - b.x);
  const slices: CellSlice<C>[] = [];
  cells.forEach((cell, index) => {
    const start = Math.max(cell.x, slices.at(-1)?.end ?? 0);
    const next = cells[index + 1];
    const end = Math.min(cell.x + cell.width, next ? next.x : 1, 1);
    if (end - start > GRID_SLIVER) {
      slices.push({ cell, start, end });
    }
  });

  const segments: GridSegment<C>[] = [];
  let position = 0;
  slices.forEach((slice, index) => {
    const previous = slices[index - 1];
    const next = slices[index + 1];
    // Gutters from the stored boxes: a side with one to keep does not grow.
    const storedWidth = slice.end - slice.start;
    const left = Math.min(gutterInset(previous, slice), storedWidth / 4);
    const right = Math.min(gutterInset(slice, next), storedWidth / 4);
    const { cell, start, end } = grownSlice(slice, previous, next);
    if (start > position) {
      segments.push({ kind: "gap", start: position, width: start - position });
    }
    const width = end - start;
    segments.push({
      kind: "cell",
      cell,
      start,
      width,
      contentStart: start + left,
      contentWidth: width - left - right,
    });
    position = end;
  });
  if (position < 1) {
    segments.push({ kind: "gap", start: position, width: 1 - position });
  }
  return segments;
};

/**
 * A logo's drawn size, as fractions of the content width: its stored size,
 * shrunk (aspect kept) when its segment is narrower than the logo or it is
 * taller than MAX_GRID_LOGO_HEIGHT.
 */
export const gridLogoSize = (
  cell: Pick<GridLetterheadLogoCell, "width" | "height">,
  contentWidth: number,
): { width: number; height: number } => {
  const scale = Math.min(
    1,
    contentWidth / cell.width,
    MAX_GRID_LOGO_HEIGHT / cell.height,
  );
  return { width: cell.width * scale, height: cell.height * scale };
};

/**
 * How far below the row's top a cell `cellHeight` tall is drawn in a row
 * `rowHeight` tall (any one unit): 0 at the top (no `valign`), half the
 * difference in the middle, all of it at the bottom; never negative.
 */
export const gridCellOffset = (
  valign: GridVerticalAlign | undefined,
  cellHeight: number,
  rowHeight: number,
): number => {
  const free = Math.max(0, rowHeight - cellHeight);
  if (valign === "middle") {
    return free / 2;
  }
  return valign === "bottom" ? free : 0;
};

/** The logo cells of a grid, left to right (their order is their `index`). */
export const gridLogoCells = <C extends LayoutCell>(grid: {
  cells: readonly C[];
}): LogoOf<C>[] =>
  [...grid.cells]
    .sort((a, b) => a.x - b.x)
    .filter((cell): cell is LogoOf<C> => cell.kind === "logo");

/**
 * A stored grid as the client may see it: every logo cell's storage key
 * replaced by its `index` in {@link gridLogoCells} order (what
 * `GET /letterhead-logo?index=` serves, and the slot of its bytes in
 * `logos`). Cells keep their order. The one boundary that strips storage
 * keys, so every cell is rebuilt field by field: nothing the stored object
 * carries beyond the known fields can pass through.
 */
export const toPublicGridLetterhead = (
  grid: GridLetterhead,
): PublicGridLetterhead => {
  const logos = gridLogoCells(grid);
  return {
    cells: grid.cells.map(
      (cell): PublicGridLetterheadCell =>
        cell.kind === "logo"
          ? {
              kind: "logo",
              x: cell.x,
              width: cell.width,
              height: cell.height,
              ...(cell.valign ? { valign: cell.valign } : {}),
              index: logos.indexOf(cell),
            }
          : {
              kind: "text",
              x: cell.x,
              width: cell.width,
              align: cell.align,
              ...(cell.valign ? { valign: cell.valign } : {}),
              lines: cell.lines.map(({ text, bold, size }) => ({
                text,
                bold,
                size,
              })),
            },
    ),
    color: grid.color,
    ...(grid.fontSize !== undefined ? { fontSize: grid.fontSize } : {}),
  };
};
