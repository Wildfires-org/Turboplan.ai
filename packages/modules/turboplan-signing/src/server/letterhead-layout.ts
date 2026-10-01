// Layout helpers for the letterhead — the first markdown table of a generated
// document. The model lays the letterhead out to mirror the reference document
// and encodes per-column alignment in the table's separator row (`:---` left,
// `:---:` center, `---:` right). Column widths come from the content, so a long
// firm name is never squeezed into a narrow fixed column.
//
// Mirrors apps/turboplan/lib/export/letterhead-layout.ts (the DOCX export, where
// this logic is unit-tested); duplicated because this package can't import app
// code. Keep the two in sync.

export type ColumnAlignment = "left" | "center" | "right" | null;

// Reads the per-column alignment markers of a GFM separator row
// ("| :--- | :---: | ---: | --- |"); an unmarked column is `null`.
export const parseTableAlignments = (separatorRow: string): ColumnAlignment[] =>
  separatorRow
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => {
      const marker = cell.trim();
      const isLeft = marker.startsWith(":");
      const isRight = marker.endsWith(":");
      if (isLeft && isRight) {
        return "center";
      }
      if (isRight) {
        return "right";
      }
      return isLeft ? "left" : null;
    });

// Any marker means the layout was chosen explicitly. A bare `---` separator is
// a legacy letterhead (stored before markers existed) that keeps the fixed
// agency defaults: bold identity columns, right-aligned address column.
export const hasExplicitAlignment = (alignments: ColumnAlignment[]): boolean =>
  alignments.some((alignment) => alignment !== null);

const EMPHASIS_REGEX = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5/g;

// The text a reader sees in a cell: emphasis markers removed. Placeholders
// count as their bracketed text — their "|| note" is stripped before the row is
// split into cells.
const toVisibleText = (cell: string): string =>
  cell.replace(
    EMPHASIS_REGEX,
    (_match, _a, boldItalic, _b, bold, _c, italic) =>
      boldItalic ?? bold ?? italic,
  );

type ColumnWidthOptions = {
  rows: string[][];
  // Total width to distribute across the columns.
  totalWidth: number;
  // Single-line width of a run of text, in the same unit as totalWidth.
  measure: (text: string) => number;
  // Horizontal cell padding added to every non-empty column.
  padding: number;
  // Width of a column with no content at all.
  emptyWidth: number;
};

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

// Sizes the columns to their content, like an auto-layout HTML table. Each
// column has a minimum (its longest word, so names never break mid-word) and a
// natural width (its longest cell on one line):
// - everything fits on one line → spare room is shared in proportion to the
//   natural widths;
// - otherwise every column gets the same "level" clamped to its own
//   [minimum, natural] range. Short columns stay on one line, while a long one
//   (e.g. a suggested-value placeholder) can only take the room left over and
//   never squeezes another column below its longest word;
// - if even the longest words don't fit, the minimums are scaled down.
// The widths always add up to totalWidth.
export const computeColumnWidths = ({
  rows,
  totalWidth,
  measure,
  padding,
  emptyWidth,
}: ColumnWidthOptions): number[] => {
  const colCount = rows[0]?.length ?? 0;
  const columns = Array.from({ length: colCount }, (_, col) => {
    const texts = rows
      .map((row) => toVisibleText(row[col] ?? "").trim())
      .filter((text) => text !== "");
    if (texts.length === 0) {
      return { min: emptyWidth, natural: emptyWidth };
    }
    const words = texts.flatMap((text) => text.split(/\s+/));
    return {
      min: Math.max(...words.map(measure)) + padding,
      natural: Math.max(...texts.map(measure)) + padding,
    };
  });

  const totalMin = sum(columns.map(({ min }) => min));
  const totalNatural = sum(columns.map(({ natural }) => natural));

  if (totalNatural <= totalWidth) {
    return columns.map(({ natural }) => (natural / totalNatural) * totalWidth);
  }
  if (totalMin >= totalWidth) {
    return columns.map(({ min }) => (min / totalMin) * totalWidth);
  }

  const widthsAt = (level: number) =>
    columns.map(({ min, natural }) => Math.min(natural, Math.max(min, level)));
  // The total grows monotonically with the level: binary-search the level at
  // which the columns fill totalWidth.
  let low = 0;
  let high = totalWidth;
  for (let step = 0; step < 50; step++) {
    const level = (low + high) / 2;
    if (sum(widthsAt(level)) > totalWidth) {
      high = level;
    } else {
      low = level;
    }
  }
  const widths = widthsAt(low);
  // Hand the search's sub-unit residue to the last column so the sum is exact.
  widths[colCount - 1] += totalWidth - sum(widths);
  return widths;
};
