// The grid letterhead editor's form model (`components/grid-letterhead-editor.tsx`):
// a document's copy as form values, back to the edit the API takes
// (`PUT /api/documents/:documentId/letterhead/own`) and to the preview, and
// the geometry of adding / removing a column. Pure, so it is unit-tested.

import type { FieldPath } from "react-hook-form";
import { z } from "zod";

import {
  cleanGridLineText,
  GRID_LINE_SIZES,
  GRID_VERTICAL_ALIGNS,
  type GridLetterheadEdit,
  type GridLetterheadEditCell,
  type GridLetterheadLine,
  type GridLetterheadTextCell,
  type GridVerticalAlign,
  gridToLines,
  MAX_GRID_CELLS,
  MAX_GRID_LINE_CHARS,
  MAX_GRID_LINES_PER_CELL,
  normalizeLetterheadColor,
  type PublicGridDocumentLetterhead,
  type PublicGridLetterhead,
  type PublicGridLetterheadCell,
} from "@wildfires-org/turboplan-workspace/types";

// Every column carries its vertical alignment, "top" included (the grid
// stores none for it): where it sits in the row's height when another column
// is taller.
export type GridLetterheadFormTextCell = Omit<
  GridLetterheadTextCell,
  "valign"
> & {
  valign: GridVerticalAlign;
};
export type GridLetterheadFormLogoCell = {
  kind: "logo";
  x: number;
  width: number;
  height: number;
  valign: GridVerticalAlign;
  // The saved copy's logo (its `index` in the public grid), until replaced.
  index: number | null;
  // A logo uploaded in the editor (replaces the saved one).
  url: string | null;
};
export type GridLetterheadFormCell =
  | GridLetterheadFormTextCell
  | GridLetterheadFormLogoCell;
export type GridLetterheadFormValues = {
  // Left to right.
  cells: GridLetterheadFormCell[];
  // "#rrggbb", or "" for none.
  color: string;
  // The grid's base text size as read from its reference (`fontSize`), null
  // when it has none. Not editable: only the preview reads it, so it draws
  // the text at the size the exports will; a save keeps the stored one.
  fontSize: number | null;
};
// A saved logo as the editor loads it (`useLetterheadLogoState`).
export type GridLetterheadSavedLogo = {
  src: string | null;
  isLoading: boolean;
};

const formLineSchema = z.object({
  text: z
    .string()
    .refine(
      (text) => cleanGridLineText(text) !== "",
      "Enter the line's text, or remove the line",
    )
    .refine(
      (text) => cleanGridLineText(text).length <= MAX_GRID_LINE_CHARS,
      `At most ${MAX_GRID_LINE_CHARS} characters`,
    ),
  bold: z.boolean(),
  size: z.enum(GRID_LINE_SIZES),
});

const formTextCellSchema = z.object({
  kind: z.literal("text"),
  x: z.number(),
  width: z.number(),
  align: z.enum(["left", "center", "right"]),
  valign: z.enum(GRID_VERTICAL_ALIGNS),
  lines: z
    .array(formLineSchema)
    .min(1, "Add a line, or remove the column")
    .max(MAX_GRID_LINES_PER_CELL, `At most ${MAX_GRID_LINES_PER_CELL} lines`),
});

const formLogoCellSchema = z
  .object({
    kind: z.literal("logo"),
    x: z.number(),
    width: z.number(),
    height: z.number(),
    valign: z.enum(GRID_VERTICAL_ALIGNS),
    index: z.number().int().nullable(),
    url: z.string().nullable(),
  })
  // A logo column always holds a logo: the saved one or an upload (never
  // sent without one — the edit would lose the column).
  .refine((cell) => cell.index !== null || cell.url !== null, {
    message: "Upload a logo, or remove the column",
    path: ["url"],
  });

// What the user can get wrong; the geometry only changes through the helpers
// below, which keep it valid (the server checks it again).
export const gridLetterheadFormSchema = z.object({
  cells: z
    .array(
      z.discriminatedUnion("kind", [formTextCellSchema, formLogoCellSchema]),
    )
    .min(1, "Add at least one column")
    .max(MAX_GRID_CELLS, `At most ${MAX_GRID_CELLS} columns`),
  color: z
    .string()
    .regex(/^(#[0-9a-fA-F]{6})?$/, "Use a hex colour like #1f5f3a, or none"),
  // Not the user's to get wrong (no field shows it), so never refused here.
  fontSize: z.number().nullable(),
});

const copyLines = (lines: readonly GridLetterheadLine[]) =>
  lines.map(({ text, bold, size }) => ({ text, bold, size }));

const cleanLines = (lines: readonly GridLetterheadLine[]) =>
  lines.flatMap(({ text, bold, size }) => {
    const cleaned = cleanGridLineText(text);
    return cleaned ? [{ text: cleaned, bold, size }] : [];
  });

// A column's vertical alignment as the preview and the edit carry it: none
// for "top" (the default), as the grid stores it.
const storedValign = (
  valign: GridVerticalAlign,
): Pick<GridLetterheadTextCell, "valign"> =>
  valign === "top" ? {} : { valign };

// A text cell rebuilt field by field (nothing else the form carries passes).
const textCellWith = (
  cell: GridLetterheadFormTextCell,
  lines: GridLetterheadLine[],
): GridLetterheadTextCell => ({
  kind: "text",
  x: cell.x,
  width: cell.width,
  align: cell.align,
  ...storedValign(cell.valign),
  lines,
});

/** A document's copy (as `GET /letterhead` sends it) as form values. */
export const gridToFormValues = (
  grid: PublicGridLetterhead,
): GridLetterheadFormValues => ({
  cells: [...grid.cells]
    .sort((a, b) => a.x - b.x)
    .map(
      (cell): GridLetterheadFormCell =>
        cell.kind === "logo"
          ? {
              kind: "logo",
              x: cell.x,
              width: cell.width,
              height: cell.height,
              valign: cell.valign ?? "top",
              index: cell.index,
              url: null,
            }
          : {
              kind: "text",
              x: cell.x,
              width: cell.width,
              align: cell.align,
              valign: cell.valign ?? "top",
              lines: copyLines(cell.lines),
            },
    ),
  color: grid.color ?? "",
  fontSize: grid.fontSize ?? null,
});

/**
 * Form values as the edit the API takes: lines cleaned (empty ones left
 * out), a saved logo by its `index`, a replaced one by its upload `url`, ""
 * colour as none, a column's vertical alignment only when it is not "top".
 * Never the base text size: the server keeps the stored one.
 */
export const formValuesToEdit = (
  values: GridLetterheadFormValues,
): GridLetterheadEdit => ({
  cells: values.cells.flatMap((cell): GridLetterheadEditCell[] => {
    if (cell.kind === "text") {
      return [textCellWith(cell, cleanLines(cell.lines))];
    }
    const box = {
      kind: "logo" as const,
      x: cell.x,
      width: cell.width,
      height: cell.height,
      ...storedValign(cell.valign),
    };
    if (cell.url !== null) {
      return [{ ...box, url: cell.url }];
    }
    return cell.index !== null ? [{ ...box, index: cell.index }] : [];
  }),
  color: normalizeLetterheadColor(values.color),
});

/**
 * Form values as the letterhead `LetterheadBand` previews, with the logo of
 * each logo cell by the preview's own `index` (`logoSrcs`): an upload's URL,
 * else the saved logo at its index in `savedLogos` — and whether that saved
 * logo is still loading (`logoLoading`), so the preview keeps its box. A
 * column's vertical alignment is carried as stored (none for "top"), and the
 * grid keeps the base text size the form carries (none when it is null), so
 * the preview draws as the exports will.
 */
export const formValuesToPreview = (
  values: GridLetterheadFormValues,
  savedLogos: readonly GridLetterheadSavedLogo[],
): {
  letterhead: PublicGridDocumentLetterhead;
  logoSrcs: (string | null)[];
  logoLoading: boolean[];
} => {
  const logoSrcs: (string | null)[] = [];
  const logoLoading: boolean[] = [];
  const cells = values.cells.map((cell): PublicGridLetterheadCell => {
    if (cell.kind === "text") {
      return textCellWith(cell, cleanLines(cell.lines));
    }
    const index = logoSrcs.length;
    const saved = cell.index === null ? undefined : savedLogos[cell.index];
    logoSrcs.push(cell.url ?? saved?.src ?? null);
    logoLoading.push(cell.url === null && !!saved?.isLoading);
    return {
      kind: "logo",
      x: cell.x,
      width: cell.width,
      height: cell.height,
      ...storedValign(cell.valign),
      index,
    };
  });
  const color = normalizeLetterheadColor(values.color);
  const grid: PublicGridLetterhead = {
    cells,
    color,
    ...(values.fontSize !== null ? { fontSize: values.fontSize } : {}),
  };
  return {
    letterhead: { layout: "grid", grid, ...gridToLines(grid), color },
    logoSrcs,
    logoLoading,
  };
};

/**
 * Where the logo column with field id `id` is now (`fields`: the field
 * array's items, `cells`: the form's cells, both left to right), or null once
 * it is gone. An upload looks its column up when it ends, not when it
 * started: columns may have been added or removed meanwhile.
 */
export const logoColumnIndex = (
  fields: readonly { id: string }[],
  cells: readonly GridLetterheadFormCell[],
  id: string,
): number | null => {
  const index = fields.findIndex((field) => field.id === id);
  return index >= 0 && cells[index]?.kind === "logo" ? index : null;
};

/**
 * A refused save's `field` (a path in the edit, e.g. "cells.1.url": its
 * indexes are the form's, as `formValuesToEdit` keeps every cell and line of
 * valid form values) as a form error, when the form has that path; the
 * message without its "Column 2, line 1: " prefix, as the error shows under
 * that field. Null when the form has no such path.
 */
export const formErrorFromServer = (
  field: string,
  message: string,
  values: GridLetterheadFormValues,
): { path: FieldPath<GridLetterheadFormValues>; message: string } | null => {
  let value: unknown = values;
  for (const segment of field.split(".")) {
    if (
      value === null ||
      typeof value !== "object" ||
      !Object.hasOwn(value, segment)
    ) {
      return null;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  const detail = message.replace(/^[^:]+: /, "");
  return {
    path: field as FieldPath<GridLetterheadFormValues>,
    message: detail.charAt(0).toUpperCase() + detail.slice(1),
  };
};

// A new column takes the free space at the right end when there is at least
// this much of it; otherwise it takes the right half of the widest text
// column.
export const MIN_NEW_CELL_WIDTH = 0.15;

// A new text column: one empty line, left-aligned, at the top of the row.
export const newTextCell = (
  x: number,
  width: number,
): GridLetterheadFormTextCell => ({
  kind: "text",
  x,
  width,
  align: "left",
  valign: "top",
  lines: [{ text: "", bold: false, size: "normal" }],
});

// A cell at a new width; a logo keeps its aspect (its height follows).
const resized = <C extends GridLetterheadFormCell>(
  cell: C,
  width: number,
): C =>
  cell.kind === "logo"
    ? { ...cell, width, height: (cell.height * width) / cell.width }
    : { ...cell, width };

/**
 * The cells with a new, empty text column, and where it went: the free space
 * after the last column when there is enough of it (at least
 * {@link MIN_NEW_CELL_WIDTH}), else the right half of the widest text column
 * (of the widest logo, keeping its aspect, only when there is no text
 * column), right after it. Cells stay left to right and never overlap.
 */
export const withTextCellAdded = (
  cells: readonly GridLetterheadFormCell[],
): { cells: GridLetterheadFormCell[]; index: number } => {
  const last = cells.at(-1);
  if (!last) {
    return { cells: [newTextCell(0, 1)], index: 0 };
  }

  const end = Math.max(...cells.map((cell) => cell.x + cell.width));
  if (1 - end >= MIN_NEW_CELL_WIDTH) {
    return {
      cells: [...cells, newTextCell(end, 1 - end)],
      index: cells.length,
    };
  }

  // A logo is halved only when there is no text column to split.
  const textIndexes = cells.flatMap((cell, index) =>
    cell.kind === "text" ? [index] : [],
  );
  const candidates =
    textIndexes.length > 0 ? textIndexes : cells.map((_, index) => index);
  const widest = candidates.reduce((best, index) =>
    cells[index].width > cells[best].width ? index : best,
  );
  const split = cells[widest];
  const half = split.width / 2;
  const start = split.x + half;
  // The last column also takes what is left of the width after it.
  const width = widest === cells.length - 1 ? Math.max(1 - start, half) : half;
  return {
    cells: [
      ...cells.slice(0, widest),
      resized(split, half),
      newTextCell(start, width),
      ...cells.slice(widest + 1),
    ],
    index: widest + 1,
  };
};

/**
 * The cells without the one at `index`. Its space goes to its neighbouring
 * text columns — split between them at its middle when both are text, all of
 * it to the one that is — and stays empty next to logos (a logo is never
 * stretched).
 */
export const withCellRemoved = (
  cells: readonly GridLetterheadFormCell[],
  index: number,
): GridLetterheadFormCell[] => {
  const removed = cells[index];
  if (!removed) {
    return [...cells];
  }

  const left = cells[index - 1];
  const right = cells[index + 1];
  const start = removed.x;
  const end = removed.x + removed.width;
  const leftEnd =
    left?.kind === "text"
      ? right?.kind === "text"
        ? (start + end) / 2
        : end
      : null;
  const rightStart =
    right?.kind === "text"
      ? left?.kind === "text"
        ? (start + end) / 2
        : start
      : null;

  return cells.flatMap((cell, position): GridLetterheadFormCell[] => {
    if (position === index) {
      return [];
    }
    if (position === index - 1 && leftEnd !== null) {
      return [{ ...cell, width: leftEnd - cell.x }];
    }
    if (position === index + 1 && rightStart !== null) {
      return [
        { ...cell, x: rightStart, width: cell.x + cell.width - rightStart },
      ];
    }
    return [cell];
  });
};

/**
 * A logo cell holding a logo the user just uploaded: its `url`, no saved
 * index, and — when the image's height / width is known — a height of that
 * aspect at the cell's width (the exporters draw a logo at its cell's
 * aspect), shrunk to fit when it would be taller than the letterhead's span.
 */
export const withUploadedLogo = (
  cell: GridLetterheadFormLogoCell,
  url: string,
  heightPerWidth: number | null,
): GridLetterheadFormLogoCell => {
  const replaced = { ...cell, url, index: null };
  if (
    !heightPerWidth ||
    !Number.isFinite(heightPerWidth) ||
    heightPerWidth <= 0
  ) {
    return replaced;
  }
  const height = cell.width * heightPerWidth;
  return height <= 1
    ? { ...replaced, height }
    : { ...replaced, width: cell.width / height, height: 1 };
};
