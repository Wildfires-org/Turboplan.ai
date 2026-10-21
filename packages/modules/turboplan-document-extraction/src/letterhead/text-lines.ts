import { centreOf, unionBox } from "./boxes";
import type { BlockInk } from "./ink-lines";
import type { Box, LetterheadBlock, PdfTextItem } from "./types";

// Items of the PDF's text layer on one row whose gap is under this share of
// the text height belong to one printed line; letterhead columns sit much
// further apart. Rows are told apart by their vertical centres.
const WORD_GAP_RATIO = 0.8;
const ROW_TOLERANCE_RATIO = 0.4;
// A gap wider than this share of the text height between two items is a space
// the text itself does not carry.
const SPACE_GAP_RATIO = 0.1;

// Up to this many consecutive text-layer lines on one row may be one line to
// the model (a phone and fax line the text layer split at a tab gap).
const MAX_JOINED_LINES = 3;

// Comparison key of a line: case, all whitespace (letter-spaced names, gaps
// the text layer splits or keeps) and dash / quote variants are ignored.
const matchKey = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s+/g, "");

const isSameRow = (a: Box, b: Box): boolean =>
  Math.abs(centreOf(a).y - centreOf(b).y) <
  ROW_TOLERANCE_RATIO * Math.max(a.height, b.height);

// Bold when every part that says is; unknown when none says.
const combinedBold = (parts: { bold: boolean | null }[]): boolean | null => {
  const known = parts.flatMap(({ bold }) => (bold === null ? [] : [bold]));
  return known.length === 0 ? null : known.every(Boolean);
};

type OpenLine = { text: string; boxes: Box[]; bold: boolean | null };

const closeLine = ({ text, boxes, bold }: OpenLine): PdfTextItem => ({
  text,
  box: unionBox(boxes),
  bold,
});

/**
 * The printed lines of a PDF's text layer: items on one row (close vertical
 * centres) joined left to right while the gap between them stays under a
 * word gap, so side-by-side letterhead columns stay separate lines. Each
 * line's box covers its items; a line is bold when every item that says is.
 */
export const toTextLines = (items: PdfTextItem[]): PdfTextItem[] => {
  const rows: PdfTextItem[][] = [];
  const sorted = items
    .filter((item) => item.text.trim() !== "" && item.box.height > 0)
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  for (const item of sorted) {
    const row = rows.find((candidate) => isSameRow(candidate[0].box, item.box));
    if (row) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }

  const lines: PdfTextItem[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.box.x - b.box.x);
    let line: OpenLine | null = null;
    for (const item of row) {
      const previous = line?.boxes.at(-1);
      const height = Math.max(item.box.height, previous?.height ?? 0);
      const gap = previous ? item.box.x - (previous.x + previous.width) : 0;
      if (line && gap < WORD_GAP_RATIO * height) {
        const hasSpace = /\s$/.test(line.text) || /^\s/.test(item.text);
        const separator =
          !hasSpace && gap > SPACE_GAP_RATIO * height ? " " : "";
        line.text += separator + item.text;
        line.boxes.push(item.box);
        line.bold = combinedBold([line, item]);
        continue;
      }
      if (line) {
        lines.push(closeLine(line));
      }
      line = { text: item.text, boxes: [item.box], bold: item.bold };
    }
    if (line) {
      lines.push(closeLine(line));
    }
  }
  return lines;
};

/** A block's line with the text-layer line it was printed as, when found. */
export type MatchedLine = { text: string; printed: PdfTextItem | null };

export type MatchedBlock = LetterheadBlock & {
  matched: MatchedLine[];
  // For a block the text layer prints nothing of: its lines read from their
  // ink in the render (`measureBlockInk`: a font size per matched line, the
  // rows the ink spans), when its lines could be measured.
  ink?: BlockInk;
};

/**
 * A text-layer line, or up to {@link MAX_JOINED_LINES} consecutive lines of
 * one row joined left to right, that a model line may be; `parts` are the
 * indexes of the text-layer lines it uses.
 */
type Candidate = { printed: PdfTextItem; parts: number[] };

const toCandidates = (textLines: PdfTextItem[]): Map<string, Candidate[]> => {
  const rows: number[][] = [];
  textLines.forEach((line, index) => {
    const row = rows.find((candidate) =>
      isSameRow(textLines[candidate[0]].box, line.box),
    );
    if (row) {
      row.push(index);
    } else {
      rows.push([index]);
    }
  });

  const byKey = new Map<string, Candidate[]>();
  for (const row of rows) {
    row.sort((a, b) => textLines[a].box.x - textLines[b].box.x);
    for (let start = 0; start < row.length; start++) {
      const end = Math.min(row.length, start + MAX_JOINED_LINES);
      for (let stop = start + 1; stop <= end; stop++) {
        const parts = row.slice(start, stop);
        const lines = parts.map((index) => textLines[index]);
        const printed = {
          text: lines.map(({ text }) => text).join(" "),
          box: unionBox(lines.map(({ box }) => box)),
          bold: combinedBold(lines),
        };
        const key = matchKey(printed.text);
        byKey.set(key, [...(byKey.get(key) ?? []), { printed, parts }]);
      }
    }
  }
  return byKey;
};

/**
 * The model's blocks matched line by line to the PDF's own text. A model line
 * matches the text-layer line that reads the same (case, whitespace and
 * dash/quote variants aside), or a run of consecutive lines of one row; each
 * text-layer line is claimed once, by the nearest model line. The model reads
 * the text well but places it loosely — enough to merge two side-by-side
 * columns — while the text layer is exact, so a block with any match takes
 * the union of its matched lines as its box.
 *
 * With `dropUnprinted` (a native text layer, not OCR over a scan) a block
 * with matches keeps only those lines: its line the PDF does not print as
 * text is lettering inside a logo (the seal's "USDA"), which the logo cell
 * already shows. Without it (an OCR layer, whose text differs from the
 * model's reading) every line is kept. A block with no match at all keeps
 * the model's box and its lines, unmatched.
 */
export const matchBlocksToText = (
  blocks: LetterheadBlock[],
  textLines: PdfTextItem[],
  { dropUnprinted }: { dropUnprinted: boolean },
): MatchedBlock[] => {
  const candidatesByKey = toCandidates(textLines);
  const blockLines = blocks.map((block) =>
    block.lines.map((line) => line.trim()).filter((line) => line !== ""),
  );

  // Every (model line, candidate) pair, nearest first; each model line and
  // each text-layer line is used once.
  const pairs = blocks.flatMap((block, blockIndex) => {
    const centre = centreOf(block.box);
    return blockLines[blockIndex].flatMap((text, lineIndex) =>
      (candidatesByKey.get(matchKey(text)) ?? []).map((candidate) => {
        const other = centreOf(candidate.printed.box);
        return {
          blockIndex,
          lineIndex,
          candidate,
          distance: Math.hypot(other.x - centre.x, other.y - centre.y),
        };
      }),
    );
  });
  pairs.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.candidate.parts.length - b.candidate.parts.length,
  );
  const printedFor = new Map<string, PdfTextItem>();
  const usedParts = new Set<number>();
  for (const { blockIndex, lineIndex, candidate } of pairs) {
    const lineKey = `${blockIndex}:${lineIndex}`;
    if (
      printedFor.has(lineKey) ||
      candidate.parts.some((part) => usedParts.has(part))
    ) {
      continue;
    }
    printedFor.set(lineKey, candidate.printed);
    for (const part of candidate.parts) {
      usedParts.add(part);
    }
  }

  return blocks.map((block, blockIndex) => {
    const matched = blockLines[blockIndex].map(
      (text, lineIndex): MatchedLine => ({
        text,
        printed: printedFor.get(`${blockIndex}:${lineIndex}`) ?? null,
      }),
    );
    const printedBoxes = matched.flatMap(({ printed }) =>
      printed ? [printed.box] : [],
    );
    if (printedBoxes.length === 0) {
      return { ...block, matched };
    }
    return {
      ...block,
      box: unionBox(printedBoxes),
      matched: dropUnprinted
        ? matched.filter(({ printed }) => printed !== null)
        : matched,
    };
  });
};
