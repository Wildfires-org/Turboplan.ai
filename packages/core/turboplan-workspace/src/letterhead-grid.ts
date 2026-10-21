// A letterhead copied from a reference document: one row of cells, left to
// right — text cells with their printed lines and logo cells — placed in
// fractions of the letterhead's horizontal span, so every renderer (preview,
// PDF, DOCX) lays it out the same way at its own width. The shape is the one
// the research agent stores (`@wildfires-org/turboplan-db`
// `StoredLetterheadGrid`); the schema validates grids that come back from the
// client (the letterhead editor). Client-safe: type-only db import, and the
// upload package's client-safe `/types` entry for the object key check.

import { z } from "zod";

import type {
  StoredLetterheadCell,
  StoredLetterheadGrid,
  StoredLetterheadLine,
} from "@wildfires-org/turboplan-db";
import {
  isSafeObjectKey,
  MAX_OBJECT_KEY_CHARS,
} from "@wildfires-org/turboplan-upload/types";

import {
  type GridDocumentLetterhead,
  LETTERHEAD_COLOR_PATTERN,
  normalizeLetterheadColor,
} from "./letterhead";

// Only APIs present in both zod v3 and v4: the MCP Worker aliases "zod" to
// "zod/v3", and this module loads there too.

export type GridLetterhead = StoredLetterheadGrid;
export type GridLetterheadCell = StoredLetterheadCell;
export type GridLetterheadTextCell = Extract<
  StoredLetterheadCell,
  { kind: "text" }
>;
export type GridLetterheadLogoCell = Extract<
  StoredLetterheadCell,
  { kind: "logo" }
>;
export type GridLetterheadLine = StoredLetterheadLine;

// A line's sizes, smallest to largest (the editor's choices, in order); each
// is the grid's base text size times its `GRID_LINE_SCALE`.
export const GRID_LINE_SIZES = [
  "small",
  "normal",
  "large",
  "xlarge",
  "xxlarge",
] as const;
export type GridLineSize = (typeof GRID_LINE_SIZES)[number];

// Where a cell shorter than its row sits in the row's height, top to bottom
// (the editor's choices). A stored cell carries `valign` only for "middle" or
// "bottom": without one it sits at the top.
export const GRID_VERTICAL_ALIGNS = ["top", "middle", "bottom"] as const;
export type GridVerticalAlign = (typeof GRID_VERTICAL_ALIGNS)[number];

// A grid as it leaves the server (`GET /letterhead`, the exporters' options):
// each logo cell carries its `index` — its position in `gridLogoCells` order,
// the `index` of `GET /letterhead-logo` — instead of its storage key, so the
// client never sees (or fetches) the raw object. See `toPublicGridLetterhead`.
export type PublicGridLetterheadLogoCell = Omit<
  GridLetterheadLogoCell,
  "key"
> & {
  index: number;
};
export type PublicGridLetterheadCell =
  | GridLetterheadTextCell
  | PublicGridLetterheadLogoCell;
export type PublicGridLetterhead = {
  cells: PublicGridLetterheadCell[];
  color: string | null;
  // The reference's base text size as a fraction of its page's width (see
  // `StoredLetterheadGrid`); renderers read it through `gridBaseFontRatio`.
  fontSize?: number;
};

// A stored or a public grid, for helpers that read only its text cells.
type GridText = {
  cells: ReadonlyArray<GridLetterheadTextCell | { kind: "logo" }>;
};

// Bounds for a grid written by a user: enough for any letterhead, small enough
// that a stored row stays small. Two logos cover the agency letterheads with a
// seal on each side; the research agent never stores more.
export const MAX_GRID_CELLS = 8;
export const MAX_GRID_LOGOS = 2;
export const MAX_GRID_LINES_PER_CELL = 12;
export const MAX_GRID_LINE_CHARS = 200;
// A new logo's upload URL as the letterhead editor sends it.
export const MAX_GRID_LOGO_URL_CHARS = 2048;
// A stored logo's object key (R2 and S3 keys are at most 1024 bytes).
export const MAX_GRID_LOGO_KEY_CHARS = MAX_OBJECT_KEY_CHARS;

// The only places a letterhead logo comes from: the research agent's crops of
// a reference's logos, and uploads from the letterhead editor
// (`uploads/<userId>/…`, the editing user's own).
const GRID_LOGO_KEY_PREFIXES = ["letterheads/", "uploads/"] as const;

/**
 * Whether `key` may be stored as a grid logo's object key: a safe object key
 * (`isSafeObjectKey`: at most {@link MAX_GRID_LOGO_KEY_CHARS}, no empty, `.`
 * or `..` segment, no control character, lone surrogate or backslash) under
 * `letterheads/` or `uploads/`. The server reads the key with the bucket's
 * credentials, so nothing else in the bucket may be named.
 */
export const isGridLogoKey = (key: string): boolean =>
  isSafeObjectKey(key) &&
  GRID_LOGO_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));

/**
 * The `index` query parameter of a letterhead logo endpoint (`GET
 * /api/documents/letterhead-logo`, `GET …/letterhead-grid/logo`): a grid's
 * logo cell (0-based, its `index` in the public grid); absent → 0. Anything
 * but a plain non-negative integer below MAX_GRID_LOGOS (no grid has more
 * logo cells) is null — a 400, answered before any permission check.
 */
export const parseLetterheadLogoIndex = (
  raw: string | undefined,
): number | null => {
  if (raw === undefined) {
    return 0;
  }
  if (!/^\d{1,2}$/.test(raw)) {
    return null;
  }
  const index = Number(raw);
  return index < MAX_GRID_LOGOS ? index : null;
};

// A position may sit on the left edge; an extent must be visible.
const positionSchema = z.number().min(0).max(1);
const extentSchema = z.number().positive().max(1);

// "top" is the default, never stored (see GRID_VERTICAL_ALIGNS).
const storedValignSchema = z.enum(["middle", "bottom"]).optional();

const gridLineSchema = z.object({
  text: z.string().trim().min(1).max(MAX_GRID_LINE_CHARS),
  bold: z.boolean(),
  size: z.enum(GRID_LINE_SIZES),
});

const gridTextCellSchema = z.object({
  kind: z.literal("text"),
  x: positionSchema,
  width: extentSchema,
  align: z.enum(["left", "center", "right"]),
  valign: storedValignSchema,
  lines: z.array(gridLineSchema).min(1).max(MAX_GRID_LINES_PER_CELL),
});

// The key is checked here (the server reads it with the bucket's
// credentials); whose upload a new logo is, by the endpoint that saves it.
const gridLogoCellSchema = z.object({
  kind: z.literal("logo"),
  x: positionSchema,
  width: extentSchema,
  height: extentSchema,
  valign: storedValignSchema,
  key: z
    .string()
    .min(1)
    .max(MAX_GRID_LOGO_KEY_CHARS)
    .refine(isGridLogoKey, "Not a letterhead logo key"),
});

// The shape of a grid. Lenient about geometry on purpose: an analysed
// reference may place cells that overlap (text columns a few pixels apart, a
// logo partly over a text column) — `usableGridLetterhead` clips those, and a
// grid written by a user is checked with `strictGridLetterheadSchema`.
export const gridLetterheadSchema = z.object({
  cells: z
    .array(
      z.discriminatedUnion("kind", [gridTextCellSchema, gridLogoCellSchema]),
    )
    .min(1)
    .max(MAX_GRID_CELLS)
    .refine(
      (cells) =>
        cells.filter((cell) => cell.kind === "logo").length <= MAX_GRID_LOGOS,
      `At most ${MAX_GRID_LOGOS} logos`,
    ),
  color: z.string().regex(LETTERHEAD_COLOR_PATTERN).nullable(),
  fontSize: z.number().positive().max(1).optional(),
});

// Overlap between two cells, and overhang past the right edge, that a grid
// written by a user may keep: float noise of fractions, not a layout.
export const GRID_GEOMETRY_EPSILON = 1e-3;

type CellExtent = { x: number; width: number };

// Whether cells, sorted by `x`, overlap by at most ε and each ends by 1 + ε.
const isTidyGrid = (cells: readonly CellExtent[]): boolean => {
  const sorted = [...cells].sort((a, b) => a.x - b.x);
  return sorted.every((cell, index) => {
    const end = cell.x + cell.width;
    const next = sorted[index + 1];
    return (
      end <= 1 + GRID_GEOMETRY_EPSILON &&
      (!next || end - next.x <= GRID_GEOMETRY_EPSILON)
    );
  });
};

/**
 * A grid as a user may write it (the letterhead editor, saving a grid as
 * the office/organization default): `gridLetterheadSchema` plus
 * cells that, sorted by `x`, do not overlap and stay within the width (up to
 * {@link GRID_GEOMETRY_EPSILON}). Every grid `usableGridLetterhead` returns
 * passes it.
 */
export const strictGridLetterheadSchema = gridLetterheadSchema.refine(
  (grid) => isTidyGrid(grid.cells),
  {
    message: "Letterhead cells must not overlap or extend past the right edge",
    path: ["cells"],
  },
);

// Compile-time guard: the schema validates exactly `GridLetterhead` (the
// stored shape), so a change to either fails to typecheck until both agree.
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type AssertTrue<T extends true> = T;
type _GridSchemaMatchesGridLetterhead = AssertTrue<
  MutuallyAssignable<z.infer<typeof gridLetterheadSchema>, GridLetterhead>
>;

// Invisible or XML-invalid characters a PDF's text layer can carry: format
// characters (bidi overrides, zero-width spaces and joiners, soft hyphens),
// lone surrogates and the noncharacters U+FFFE / U+FFFF (either one makes a
// DOCX's document.xml unreadable).
const INVISIBLE_CHARS = /[\p{Cf}\p{Cs}\uFFFE\uFFFF]/gu;

/**
 * A grid line's text as every renderer and prompt uses it: the text comes
 * from a reference PDF, so invisible and XML-invalid characters are dropped
 * and whitespace and control characters collapse to single spaces (a newline
 * would break a table cell, a DOCX run or a prompt section); "" for a line
 * with nothing left, which callers skip.
 */
export const cleanGridLineText = (text: string): string =>
  text
    .replace(INVISIBLE_CHARS, "")
    .replace(/[\s\p{Cc}]+/gu, " ")
    .trim();

// Whether a grid has anything to draw: at least one line of text or a logo.
export const isGridLetterheadConfigured = (grid: GridLetterhead): boolean =>
  grid.cells.some(
    (cell) =>
      cell.kind === "logo" ||
      cell.lines.some((line) => cleanGridLineText(line.text)),
  );

/**
 * A grid's cells clipped so that, sorted by `x`, each ends where the next one
 * begins and none passes the right edge — what `layoutGridLetterhead` draws
 * anyway — so the grid passes `strictGridLetterheadSchema`. Cells keep their
 * stored order; a clipped logo keeps its aspect (its height shrinks with its
 * width); a cell with no width left is dropped. A grid that needs no clipping
 * is returned as it is.
 */
const clipGridCells = (grid: GridLetterhead): GridLetterhead => {
  const sorted = [...grid.cells].sort((a, b) => a.x - b.x);
  const widths = new Map(
    sorted.map((cell, index) => {
      // `x` is at most 1 (schema), so the next cell's start is the limit.
      const limit = sorted[index + 1]?.x ?? 1;
      const width = cell.x + cell.width > limit ? limit - cell.x : cell.width;
      return [cell, width] as const;
    }),
  );
  if (grid.cells.every((cell) => widths.get(cell) === cell.width)) {
    return grid;
  }

  const cells = grid.cells.flatMap((cell): GridLetterheadCell[] => {
    const width = widths.get(cell) ?? 0;
    if (width <= 0) {
      return [];
    }
    if (width === cell.width) {
      return [cell];
    }
    return [
      cell.kind === "logo"
        ? { ...cell, width, height: (cell.height * width) / cell.width }
        : { ...cell, width },
    ];
  });
  return { ...grid, cells };
};

// A stored grid (jsonb: a reference's analysis, a document's copy, an
// office/org default) as one that can render — valid, its overlapping cells
// clipped (see `clipGridCells`) and with something to draw — or null.
// Anything else is ignored, never an error.
export const usableGridLetterhead = (value: unknown): GridLetterhead | null => {
  const parsed = gridLetterheadSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const grid = clipGridCells(parsed.data);
  return grid.cells.length > 0 && isGridLetterheadConfigured(grid)
    ? grid
    : null;
};

// The derived line lists keep at most as many lines as an extracted legacy
// letterhead (`apps/server` letterhead-extract): enough for any identity and
// contact block, few enough for a label, a prompt or the fallback table.
const MAX_GRID_NAME_LINES = 5;
const MAX_GRID_CONTACT_LINES = 6;

// The grid's text as the two line lists the rest of the app knows: bold lines
// are the identity (agency, department, office — `nameLines`), regular lines
// the address and contact (`contactLines`), each in reading order and capped
// (see above). Feeds the generator's author identity, the picker label, the
// chat prompt. The grid itself is not touched.
export const gridToLines = (
  grid: GridText,
): { nameLines: string[]; contactLines: string[] } => {
  const lines = grid.cells.flatMap((cell) =>
    cell.kind === "text" ? cell.lines : [],
  );
  const textOf = (bold: boolean, max: number) =>
    lines
      .flatMap((line) => {
        const text = cleanGridLineText(line.text);
        return line.bold === bold && text ? [text] : [];
      })
      .slice(0, max);
  return {
    nameLines: textOf(true, MAX_GRID_NAME_LINES),
    contactLines: textOf(false, MAX_GRID_CONTACT_LINES),
  };
};

// A (validated) grid as the letterhead a document renders with: its derived
// lines and its colour, normalized like every other letterhead's.
export const gridToDocumentLetterhead = (
  grid: GridLetterhead,
): GridDocumentLetterhead => {
  const color = normalizeLetterheadColor(grid.color);
  return {
    layout: "grid",
    grid: { ...grid, color },
    ...gridToLines(grid),
    color,
  };
};
