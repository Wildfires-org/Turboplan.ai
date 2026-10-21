// A grid letterhead as the letterhead editor sends it back: text cells as
// stored, logo cells either kept — by their `index` in the public grid the
// editor was given (it never sees storage keys) — or replaced by a logo the
// user just uploaded (`url`, the upload's URL); any cell may say "top" as its
// vertical alignment, which is stored as none. `applyGridLetterheadEdit`
// turns it into the stored grid, where every logo is an object key.
// Client-safe: the editor uses the types and the server the schema and the
// mapping; the ownership check (upload URL → key) is passed in.

import { z } from "zod";

import { normalizeLetterheadColor } from "./letterhead";
import {
  cleanGridLineText,
  GRID_LINE_SIZES,
  GRID_VERTICAL_ALIGNS,
  type GridLetterhead,
  type GridLetterheadCell,
  type GridLetterheadTextCell,
  type GridVerticalAlign,
  isGridLetterheadConfigured,
  isGridLogoKey,
  MAX_GRID_CELLS,
  MAX_GRID_LINE_CHARS,
  MAX_GRID_LINES_PER_CELL,
  MAX_GRID_LOGO_URL_CHARS,
  strictGridLetterheadSchema,
} from "./letterhead-grid";
import { gridLogoCells } from "./letterhead-grid-layout";

// Only APIs present in both zod v3 and v4 (the MCP Worker aliases "zod" to
// "zod/v3", and `./types` loads there too).

type LogoBox = {
  kind: "logo";
  x: number;
  width: number;
  height: number;
  valign?: GridVerticalAlign;
};

// A text cell as stored, its vertical alignment any of GRID_VERTICAL_ALIGNS.
export type GridLetterheadEditTextCell = Omit<
  GridLetterheadTextCell,
  "valign"
> & { valign?: GridVerticalAlign };

// The stored copy's logo at `index` (`gridLogoCells` order), kept.
export type GridLetterheadEditKeptLogoCell = LogoBox & { index: number };
// A logo the user uploaded in the editor, by its upload URL.
export type GridLetterheadEditNewLogoCell = LogoBox & { url: string };

// The answer (409) to an edit of a letterhead that changed since the editor
// read it: a document's copy (`PUT /api/documents/:documentId/letterhead/own`)
// or an office/organization default (`PUT …/letterhead-grid`).
export const LETTERHEAD_EDIT_CONFLICT_ERROR =
  "The letterhead was changed meanwhile — reopen the editor";
export type GridLetterheadEditCell =
  | GridLetterheadEditTextCell
  | GridLetterheadEditKeptLogoCell
  | GridLetterheadEditNewLogoCell;
export type GridLetterheadEdit = {
  cells: GridLetterheadEditCell[];
  color: string | null;
};

// A line's raw text may carry characters cleaning drops (invisible ones,
// runs of whitespace), so it is bounded loosely here; the cleaned text is
// held to MAX_GRID_LINE_CHARS by the strict grid schema.
const MAX_EDIT_LINE_INPUT_CHARS = MAX_GRID_LINE_CHARS * 4;

const editLineSchema = z.object({
  text: z.string().max(MAX_EDIT_LINE_INPUT_CHARS),
  bold: z.boolean(),
  size: z.enum(GRID_LINE_SIZES),
});

const editValignSchema = z.enum(GRID_VERTICAL_ALIGNS).optional();

const editTextCellSchema = z.object({
  kind: z.literal("text"),
  x: z.number(),
  width: z.number(),
  align: z.enum(["left", "center", "right"]),
  valign: editValignSchema,
  lines: z.array(editLineSchema).max(MAX_GRID_LINES_PER_CELL),
});

const logoBoxShape = {
  kind: z.literal("logo"),
  x: z.number(),
  width: z.number(),
  height: z.number(),
  valign: editValignSchema,
};

// Strict, so a logo cell carrying both an index and a URL is refused rather
// than read as one of them.
const editKeptLogoCellSchema = z
  .object({ ...logoBoxShape, index: z.number().int().min(0) })
  .strict();
const editNewLogoCellSchema = z
  .object({
    ...logoBoxShape,
    url: z.string().min(1).max(MAX_GRID_LOGO_URL_CHARS),
  })
  .strict();

/**
 * The shape of an edited grid as the editor sends it. Geometry, line text,
 * the colour and the logo count are checked once the grid is mapped to its
 * stored form (`applyGridLetterheadEdit` → `strictGridLetterheadSchema`), so
 * every rule lives in one place.
 */
export const gridLetterheadEditSchema = z.object({
  cells: z
    .array(
      z.union([
        editTextCellSchema,
        editKeptLogoCellSchema,
        editNewLogoCellSchema,
      ]),
    )
    .max(MAX_GRID_CELLS),
  color: z.string().max(32).nullable(),
});

// Compile-time guard: the schema parses exactly `GridLetterheadEdit`.
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type AssertTrue<T extends true> = T;
type _EditSchemaMatchesGridLetterheadEdit = AssertTrue<
  MutuallyAssignable<
    z.infer<typeof gridLetterheadEditSchema>,
    GridLetterheadEdit
  >
>;

export type GridLetterheadEditResult =
  | { ok: true; grid: GridLetterhead }
  // `field`: the path of the offending value in the edit ("cells.1.lines.0.text").
  | { ok: false; field: string; message: string };

// A cell's vertical alignment as stored: "top" (the default) as none.
const storedValign = (
  valign: GridVerticalAlign | undefined,
): Pick<GridLetterheadTextCell, "valign"> =>
  valign === "middle" || valign === "bottom" ? { valign } : {};

const invalid = (field: string, message: string): GridLetterheadEditResult => ({
  ok: false,
  field,
  message,
});

// "cells.1.lines.0.text" → "Column 2, line 1".
const describeField = (path: readonly PropertyKey[]): string => {
  const [root, cellIndex, part, lineIndex] = path;
  if (root === "color") {
    return "Colour";
  }
  if (typeof cellIndex !== "number") {
    return "Letterhead";
  }
  const column = `Column ${cellIndex + 1}`;
  return part === "lines" && typeof lineIndex === "number"
    ? `${column}, line ${lineIndex + 1}`
    : column;
};

/**
 * An edited grid as the stored grid it replaces `stored` with: a kept logo's
 * key from `stored` (its `index` in `gridLogoCells(stored)` order, the order
 * the editor was given), a new logo's key from `ownedLogoKey` — the object
 * key of the upload URL when it is an upload of the editing user, null for
 * anything else (never just any object in storage) — every line cleaned with
 * `cleanGridLineText` and empty ones dropped, and then the whole grid held
 * to `strictGridLetterheadSchema` (no overlapping cells, within the width,
 * the MAX_GRID_* caps, logo keys) with something to show. Cells are rebuilt
 * field by field, so nothing else the edit carries is stored; a cell's
 * vertical alignment is stored only when it is "middle" or "bottom". The base
 * text size is not the editor's to change: the grid keeps `stored.fontSize`
 * (read from the reference), whatever the edit carries.
 */
export const applyGridLetterheadEdit = (
  edit: GridLetterheadEdit,
  stored: GridLetterhead,
  ownedLogoKey: (url: string) => string | null,
): GridLetterheadEditResult => {
  const storedLogos = gridLogoCells(stored);
  const cells: GridLetterheadCell[] = [];

  for (const [index, cell] of edit.cells.entries()) {
    if (cell.kind === "text") {
      cells.push({
        kind: "text",
        x: cell.x,
        width: cell.width,
        align: cell.align,
        ...storedValign(cell.valign),
        lines: cell.lines.flatMap(({ text, bold, size }) => {
          const cleaned = cleanGridLineText(text);
          return cleaned ? [{ text: cleaned, bold, size }] : [];
        }),
      });
      continue;
    }

    const box = {
      kind: "logo" as const,
      x: cell.x,
      width: cell.width,
      height: cell.height,
      ...storedValign(cell.valign),
    };
    if ("url" in cell) {
      // Checked against the key rules here, so a refusal names the `url`
      // the editor sent rather than a stored `key` it never saw.
      const key = ownedLogoKey(cell.url);
      if (!key || !isGridLogoKey(key)) {
        return invalid(
          `cells.${index}.url`,
          `Column ${index + 1}: upload the logo again`,
        );
      }
      cells.push({ ...box, key });
      continue;
    }

    const kept = storedLogos[cell.index];
    if (!kept) {
      return invalid(
        `cells.${index}.index`,
        `Column ${index + 1}: this logo no longer exists`,
      );
    }
    cells.push({ ...box, key: kept.key });
  }

  const parsed = strictGridLetterheadSchema.safeParse({
    cells,
    color: edit.color,
  });
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const path = issue?.path ?? [];
    return invalid(
      path.map(String).join("."),
      `${describeField(path)}: ${issue?.message ?? "invalid"}`,
    );
  }
  if (!isGridLetterheadConfigured(parsed.data)) {
    return invalid("cells", "Letterhead: add some text or a logo");
  }

  return {
    ok: true,
    grid: {
      cells: parsed.data.cells,
      color: normalizeLetterheadColor(parsed.data.color),
      ...(stored.fontSize !== undefined ? { fontSize: stored.fontSize } : {}),
    },
  };
};
