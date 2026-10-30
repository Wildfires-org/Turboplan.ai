import { centreOf, clipBox, unionBox } from "./boxes";
import type { MatchedBlock, MatchedLine } from "./text-lines";
import type {
  Box,
  LetterheadAlignment,
  LetterheadGridDraft,
  LetterheadLine,
  LetterheadLineSize,
  LetterheadLogoCrop,
  LetterheadTextCell,
  LetterheadVerticalAlignment,
} from "./types";

// A block starting more than this many pixels left of the previous column's
// right edge overlaps it horizontally and stacks in that column. Blocks only
// the model placed (no text layer) are placed loosely, so for them the
// overlap must also be a real share of the narrower one.
const COLUMN_OVERLAP_PX = 10;
const LOOSE_COLUMN_OVERLAP_RATIO = 0.25;

// A line's height over the letterhead's median text height picks its size:
// up to SMALL small, under LARGE normal, under XLARGE large, under XXLARGE
// xlarge, else xxlarge. The upper thresholds sit midway between the sizes'
// scales (`GRID_LINE_SCALE` in the workspace: 1.3, 1.8, 2.6), so a wordmark
// three times the address's size is drawn near that.
const SMALL_LINE_RATIO = 0.8;
const LARGE_LINE_RATIO = 1.25;
const XLARGE_LINE_RATIO = 1.55;
const XXLARGE_LINE_RATIO = 2.2;

// A tight box around a block of n lines spans n − 1 line pitches plus one
// line's glyphs, in units of the text height: how a block nothing of which is
// printed (a scan, lettering drawn as an image) gives its lines a height when
// its ink could not be measured line by line.
const LINE_PITCH = 1.2;
const GLYPH_EXTENT = 1;

// Significant digits the stored base text size keeps.
const FONT_SIZE_PRECISION = 5;

// A cell at least this share of the row's height tall fills the row: it has
// no vertical alignment of its own (it sits at the top).
const FULL_ROW_RATIO = 0.85;

// Lines whose left edges (right edges, centres) stay within this share of the
// cell's width of each other are aligned that way.
const ALIGNMENT_TOLERANCE_RATIO = 0.08;
// A lone text cell whose centre sits this close to the image's centre is a
// centered header (one line gives no edges to compare).
const CENTERED_CELL_TOLERANCE_RATIO = 0.05;

// Bounds of a stored grid — the letterhead editor validates grids against
// the same ones: keep in sync with `MAX_GRID_*` in
// `@wildfires-org/turboplan-workspace` (letterhead-grid.ts). Left and right
// logos are common on agency letterheads; a third mark is noise.
const MAX_CELLS = 8;
const MAX_LOGOS = 2;
const MAX_LINES_PER_CELL = 12;
const MAX_LINE_CHARS = 200;

// Padding kept around a logo crop, as a share of its longer side.
const LOGO_CROP_PADDING_RATIO = 0.03;
// A logo at least this much of whose width lies over a text column is drawn
// behind, above or below that text (a watermark, a seal stacked over a
// centered name): one row of cells cannot place it, so it is left out.
const LOGO_OVER_TEXT_RATIO = 0.5;

// A wordmark is set with a logo as one lockup when it sits beside it (or
// above or below it) at most this share of the logo's own width (height)
// away, overlapping at least this share of the smaller one's height (width).
const LOCKUP_MAX_GAP_RATIO = 1;
const LOCKUP_MIN_OVERLAP_RATIO = 0.5;
// A logo box at least this share of whose area lies inside a wordmark is that
// lettering itself (a scan's pixel mark of it), not a logo beside it.
const LOGO_IN_WORDMARK_RATIO = 0.5;

/** A PNG of a box of the header image; null when it cannot be cropped. */
export type LogoCropper = (box: Box) => Uint8Array | null;

/**
 * Where the logo boxes came from: "pdf" — images the PDF places (exact);
 * "pixels" — ink blobs in a rendered scan.
 */
export type LogoBoxes = { source: "pdf" | "pixels"; boxes: Box[] };

const hasPrintedLines = (block: MatchedBlock): boolean =>
  block.matched.some(({ printed }) => printed !== null);

// Blocks overlapping horizontally, left to right; each column's blocks top to
// bottom.
const groupColumns = (blocks: MatchedBlock[]): MatchedBlock[][] => {
  const columns: { left: number; right: number; blocks: MatchedBlock[] }[] = [];
  for (const block of [...blocks].sort((a, b) => a.box.x - b.box.x)) {
    const right = block.box.x + block.box.width;
    const last = columns.at(-1);
    const overlap = last ? last.right - block.box.x : 0;
    const minOverlap = hasPrintedLines(block)
      ? COLUMN_OVERLAP_PX
      : Math.max(
          COLUMN_OVERLAP_PX,
          LOOSE_COLUMN_OVERLAP_RATIO *
            Math.min(block.box.width, last ? last.right - last.left : 0),
        );
    if (last && overlap > minOverlap) {
      last.right = Math.max(last.right, right);
      last.blocks.push(block);
    } else {
      columns.push({ left: block.box.x, right, blocks: [block] });
    }
  }
  return columns.map((column) =>
    column.blocks.sort((a, b) => a.box.y - b.box.y),
  );
};

const median = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

// A positive, finite height, or none.
const usableHeight = (height: number): number | null =>
  Number.isFinite(height) && height > 0 ? height : null;

/**
 * The text height of each of a block's lines, in pixels: a printed line's
 * text-layer height (its font size). A block the text layer prints nothing of
 * — a scan, or lettering drawn as an image — has the sizes read from its ink
 * (`ink`, one per line) when its lines could be measured; otherwise only the
 * model's box, so its lines share an estimate from that box's height. A line
 * of a block with printed lines that is not printed itself has none.
 */
const lineHeightsOf = (block: MatchedBlock): (number | null)[] => {
  if (hasPrintedLines(block)) {
    return block.matched.map(({ printed }) => printed?.box.height ?? null);
  }
  if (block.ink?.fontSizes.length === block.matched.length) {
    return block.ink.fontSizes.map(usableHeight);
  }
  const pitches = (block.matched.length - 1) * LINE_PITCH + GLYPH_EXTENT;
  const height = usableHeight(block.box.height / pitches);
  return block.matched.map(() => height);
};

const sizeOf = (
  height: number | null,
  medianHeight: number | null,
): LetterheadLineSize => {
  if (height === null || medianHeight === null) {
    return "normal";
  }
  const ratio = height / medianHeight;
  if (ratio <= SMALL_LINE_RATIO) {
    return "small";
  }
  if (ratio < LARGE_LINE_RATIO) {
    return "normal";
  }
  if (ratio < XLARGE_LINE_RATIO) {
    return "large";
  }
  return ratio < XXLARGE_LINE_RATIO ? "xlarge" : "xxlarge";
};

// Image rows, [top, bottom).
type Rows = { top: number; bottom: number };

const rowsOfBox = (box: Box): Rows => ({
  top: box.y,
  bottom: box.y + box.height,
});

// The rows a block's text spans: its printed lines' (its box once matched to
// the text layer), else the rows its ink spans, else the model's box.
const rowsOfBlock = (block: MatchedBlock): Rows =>
  block.ink && !hasPrintedLines(block)
    ? { top: block.ink.top, bottom: block.ink.bottom }
    : rowsOfBox(block.box);

const unionRows = (rows: Rows[]): Rows => ({
  top: Math.min(...rows.map(({ top }) => top)),
  bottom: Math.max(...rows.map(({ bottom }) => bottom)),
});

// The gap between two spans (0 when they overlap), and their overlap (0 when
// they are apart).
const gapBetween = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) => Math.max(0, Math.max(aStart, bStart) - Math.min(aEnd, bEnd));
const overlapOf = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) => Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

// How far a wordmark sits from a logo it is set beside, above or below as
// one lockup (see LOCKUP_MAX_GAP_RATIO); null when it is not.
const lockupGap = (logo: Box, wordmark: Box): number | null => {
  const xs = [
    logo.x,
    logo.x + logo.width,
    wordmark.x,
    wordmark.x + wordmark.width,
  ] as const;
  const ys = [
    logo.y,
    logo.y + logo.height,
    wordmark.y,
    wordmark.y + wordmark.height,
  ] as const;
  const gapX = gapBetween(...xs);
  const gapY = gapBetween(...ys);
  if (
    gapX <= LOCKUP_MAX_GAP_RATIO * logo.width &&
    overlapOf(...ys) >=
      LOCKUP_MIN_OVERLAP_RATIO * Math.min(logo.height, wordmark.height)
  ) {
    return gapX;
  }
  if (
    gapY <= LOCKUP_MAX_GAP_RATIO * logo.height &&
    overlapOf(...xs) >=
      LOCKUP_MIN_OVERLAP_RATIO * Math.min(logo.width, wordmark.width)
  ) {
    return gapY;
  }
  return null;
};

const areaInside = (box: Box, container: Box): number => {
  const inside = clipBox(box, container);
  return inside ? inside.width * inside.height : 0;
};

// Boxes overlapping horizontally merged into one, left to right.
const mergeOverlapping = (boxes: Box[]): Box[] =>
  [...boxes]
    .sort((a, b) => a.x - b.x)
    .reduce<Box[]>((merged, box) => {
      const last = merged.at(-1);
      if (last && box.x < last.x + last.width) {
        merged[merged.length - 1] = unionBox([last, box]);
      } else {
        merged.push(box);
      }
      return merged;
    }, []);

// A logo to crop: a logo box, a lockup (a logo and its wordmark as one box)
// or a wordmark on its own.
type LogoCandidate = { box: Box; hasWordmark: boolean };

/**
 * The logos to crop, the wordmarks drawn into them: a logo box lying mostly
 * inside a wordmark is that lettering (a scan's mark of it) and joins it;
 * each wordmark then joins the nearest logo it is set beside, above or below
 * (see `lockupGap`), the two cropped as one. A wordmark with no logo next to
 * it is a logo of its own; wordmarks overlapping horizontally (one name the
 * model read as several blocks) are one.
 */
const toLogoCandidates = (
  logoBoxes: Box[],
  wordmarks: Box[],
): LogoCandidate[] => {
  const absorbed = new Set<Box>();
  const lettering = wordmarks.map((wordmark) => {
    const inside = logoBoxes.filter(
      (logo) =>
        !absorbed.has(logo) &&
        areaInside(logo, wordmark) >=
          LOGO_IN_WORDMARK_RATIO * logo.width * logo.height,
    );
    for (const logo of inside) {
      absorbed.add(logo);
    }
    return unionBox([wordmark, ...inside]);
  });

  const logos = logoBoxes.filter((logo) => !absorbed.has(logo));
  const lockups = logos.map((logo) => [logo]);
  const lone: Box[] = [];
  for (const wordmark of lettering) {
    const [nearest] = logos
      .flatMap((logo, index) => {
        const gap = lockupGap(logo, wordmark);
        return gap === null ? [] : [{ index, gap }];
      })
      .sort((a, b) => a.gap - b.gap);
    if (nearest) {
      lockups[nearest.index].push(wordmark);
    } else {
      lone.push(wordmark);
    }
  }
  return [
    ...lockups.map((boxes) => ({
      box: unionBox(boxes),
      hasWordmark: boxes.length > 1,
    })),
    ...mergeOverlapping(lone).map((box) => ({ box, hasWordmark: true })),
  ];
};

// A wordmark block's box, its rows narrowed to its ink when that was read.
const wordmarkBox = (block: MatchedBlock): Box => {
  const { top, bottom } = rowsOfBlock(block);
  return {
    x: block.box.x,
    width: block.box.width,
    y: top,
    height: bottom - top,
  };
};

/**
 * Where a cell sits in the row (`row`: every cell's rows together): nowhere
 * in particular — the top, left out — when it is (nearly) as tall as the
 * row; otherwise whichever of its gap to the row's top, its gap to the row's
 * bottom and its centre's offset from the row's centre is smallest, the top
 * winning a tie, then the middle.
 */
const valignOf = (
  cell: Rows,
  row: Rows,
): { valign?: LetterheadVerticalAlignment } => {
  const rowHeight = row.bottom - row.top;
  if (
    !(rowHeight > 0) ||
    cell.bottom - cell.top >= FULL_ROW_RATIO * rowHeight
  ) {
    return {};
  }
  const topGap = cell.top - row.top;
  const bottomGap = row.bottom - cell.bottom;
  const centreOffset = Math.abs(topGap - bottomGap) / 2;
  if (topGap <= Math.min(bottomGap, centreOffset)) {
    return {};
  }
  return { valign: centreOffset <= bottomGap ? "middle" : "bottom" };
};

// Bold from the font when the PDF names it; a scan's name lines (agency,
// department) are bold on nearly every letterhead, its contact lines not.
const boldOf = (line: MatchedLine, role: MatchedBlock["role"]): boolean =>
  line.printed?.bold ?? role === "name";

const spread = (values: number[]): number =>
  Math.max(...values) - Math.min(...values);

/**
 * How a cell's lines are set: by whichever of their left edges, right edges
 * or centres vary least, when that variation is small against the cell's
 * width. Without printed boxes for two or more lines there is nothing to
 * compare: a lone cell near the image's centre is centered, the last text
 * column after other text or a logo (the address block at the right edge)
 * right-aligned, anything else left-aligned.
 */
const alignmentOf = (
  cell: Box,
  printed: Box[],
  position: { isLone: boolean; isLast: boolean },
  imageWidth: number,
): LetterheadAlignment => {
  if (printed.length >= 2) {
    const tolerance = ALIGNMENT_TOLERANCE_RATIO * cell.width;
    const candidates: [LetterheadAlignment, number][] = [
      ["left", spread(printed.map((box) => box.x))],
      ["right", spread(printed.map((box) => box.x + box.width))],
      ["center", spread(printed.map((box) => centreOf(box).x))],
    ];
    const [best] = candidates.sort((a, b) => a[1] - b[1]);
    if (best[1] <= tolerance) {
      return best[0];
    }
    return "left";
  }
  if (
    position.isLone &&
    Math.abs(centreOf(cell).x - imageWidth / 2) <=
      CENTERED_CELL_TOLERANCE_RATIO * imageWidth
  ) {
    return "center";
  }
  return position.isLast ? "right" : "left";
};

const toLines = (
  column: MatchedBlock[],
  medianHeight: number | null,
): LetterheadLine[] =>
  column
    .flatMap((block) => {
      const heights = lineHeightsOf(block);
      return block.matched.map((line, index) => ({
        text: line.text.slice(0, MAX_LINE_CHARS).trim(),
        bold: boldOf(line, block.role),
        size: sizeOf(heights[index], medianHeight),
      }));
    })
    .slice(0, MAX_LINES_PER_CELL);

// The logo's box with a little padding, clipped to the image; null when
// nothing of it lies inside the image.
const padLogoBox = (box: Box, image: Box): Box | null => {
  const padding = LOGO_CROP_PADDING_RATIO * Math.max(box.width, box.height);
  return clipBox(
    {
      x: box.x - padding,
      y: box.y - padding,
      width: box.width + 2 * padding,
      height: box.height + 2 * padding,
    },
    image,
  );
};

const isOverText = (logo: Box, textBoxes: Box[]): boolean =>
  textBoxes.some((text) => {
    const overlap =
      Math.min(logo.x + logo.width, text.x + text.width) -
      Math.max(logo.x, text.x);
    return overlap >= LOGO_OVER_TEXT_RATIO * logo.width;
  });

// The letterhead's base text size as a fraction of the page's width, when it
// is a usable one (the stored grid's bounds: above 0, at most 1).
const fontSizeOf = (
  medianHeight: number | null,
  pageWidth: number,
): { fontSize?: number } => {
  if (medianHeight === null) {
    return {};
  }
  const fontSize = Number(
    (medianHeight / pageWidth).toPrecision(FONT_SIZE_PRECISION),
  );
  return Number.isFinite(fontSize) && fontSize > 0 && fontSize <= 1
    ? { fontSize }
    : {};
};

// A logo's size in fractions of the span; one taller than the span is wide
// (a tall seal beside a narrow name) is scaled down to fit, keeping its
// aspect, so every fraction stays within 0–1.
const logoFractions = (crop: Box, spanWidth: number) => {
  const scale = Math.min(1, spanWidth / crop.height);
  return {
    width: (crop.width * scale) / spanWidth,
    height: (crop.height * scale) / spanWidth,
  };
};

/**
 * The letterhead grid of a header: one cell per text column (blocks
 * overlapping horizontally stack in one column) and one per logo, left to
 * right, positioned in fractions of the span from the first cell's left edge
 * to the last cell's right edge. Lines carry bold from the text layer where
 * there is one, and a size relative to the letterhead's median text height:
 * a printed line's height is its text-layer height, a block nothing of which
 * is printed has the heights read from its ink, else estimated from the
 * model's box (see `lineHeightsOf`). That median, as a fraction of the page's
 * width (`image` is the full width of the page), is the grid's `fontSize` —
 * left out when no line has a height. A cell shorter than the row is aligned
 * in it the way it sits in the header (see `valignOf`; text by its printed
 * lines, else its ink, else the model's box; a logo by its crop).
 *
 * Logos: a wordmark block (lettering of the logo) is no text column but is
 * drawn into the logo it is set with, or is a logo of its own (see
 * `toLogoCandidates`); its lines count for no size. Then the largest first,
 * none whose width lies mostly over a text column (one row cannot draw it
 * there), at most two that `cropLogo` could crop in the pixel space of
 * `image` — a lockup counts once. A placed PDF image is exact, so it is only
 * compared with text the PDF prints; a scan's pixel marks are compared with
 * the model's blocks too. The grid stays within the editor's bounds (cells,
 * lines, characters). Null without a text column or a wordmark: a letterhead
 * is its sender's name (as text, or drawn in its logo) and address, and a
 * lone logo is more likely a page the model misread than a letterhead.
 */
export const toGridDraft = (
  blocks: MatchedBlock[],
  logos: LogoBoxes,
  image: { width: number; height: number },
  cropLogo: LogoCropper,
  color: string | null,
): LetterheadGridDraft | null => {
  const lettered = blocks.filter((block) => block.matched.length > 0);
  const candidates = toLogoCandidates(
    logos.boxes,
    lettered.filter((block) => block.wordmark).map(wordmarkBox),
  );
  const allColumns = groupColumns(lettered.filter((block) => !block.wordmark));
  const logoCount = Math.min(MAX_LOGOS, candidates.length);
  // The widest columns when there are more than fit, kept in reading order.
  const columns = allColumns
    .map((column) => ({
      column,
      box: unionBox(column.map((block) => block.box)),
    }))
    .filter(({ box }) => box.width > 0)
    .sort((a, b) => b.box.width - a.box.width)
    .slice(0, MAX_CELLS - logoCount)
    .sort((a, b) => a.box.x - b.box.x);

  const textBoxesForLogos = columns.flatMap(({ column, box }) => {
    if (logos.source === "pixels") {
      return [box];
    }
    const printed = column.flatMap((block) =>
      block.matched.flatMap(({ printed }) => (printed ? [printed.box] : [])),
    );
    return printed.length > 0 ? [unionBox(printed)] : [];
  });
  const imageBox = { x: 0, y: 0, width: image.width, height: image.height };
  const croppedLogos = [...candidates]
    .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)
    .filter(({ box }) => !isOverText(box, textBoxesForLogos))
    .flatMap(({ box, hasWordmark }) => {
      const crop = padLogoBox(box, imageBox);
      const png = crop ? cropLogo(crop) : null;
      return crop && png ? [{ crop, png, hasWordmark }] : [];
    })
    .slice(0, MAX_LOGOS);
  if (
    columns.length === 0 &&
    !croppedLogos.some(({ hasWordmark }) => hasWordmark)
  ) {
    return null;
  }

  const span = unionBox([
    ...columns.map(({ box }) => box),
    ...croppedLogos.map(({ crop }) => crop),
  ]);
  if (!(span.width > 0)) {
    return null;
  }
  const fraction = (value: number) => value / span.width;

  const heights = columns.flatMap(({ column }) =>
    column.flatMap((block) =>
      lineHeightsOf(block).filter(
        (height): height is number => height !== null,
      ),
    ),
  );
  const medianHeight = median(heights);

  const columnRows = columns.map(({ column }) =>
    unionRows(column.map(rowsOfBlock)),
  );
  const row = unionRows([
    ...columnRows,
    ...croppedLogos.map(({ crop }) => rowsOfBox(crop)),
  ]);

  const textCells = columns.map(
    ({ column, box }, index): LetterheadTextCell => {
      const printed = column.flatMap((block) =>
        block.matched.flatMap(({ printed }) => (printed ? [printed.box] : [])),
      );
      const position = {
        isLone: columns.length === 1,
        // The last text column, after other text or a logo.
        isLast:
          index === columns.length - 1 &&
          (index > 0 || croppedLogos.some(({ crop }) => crop.x < box.x)),
      };
      return {
        kind: "text",
        x: fraction(box.x - span.x),
        width: fraction(box.width),
        align: alignmentOf(box, printed, position, image.width),
        ...valignOf(columnRows[index], row),
        lines: toLines(column, medianHeight),
      };
    },
  );
  const logoCells = croppedLogos.map(
    ({ crop, png }): LetterheadLogoCrop => ({
      kind: "logo",
      x: fraction(crop.x - span.x),
      ...logoFractions(crop, span.width),
      ...valignOf(rowsOfBox(crop), row),
      png,
    }),
  );

  return {
    cells: [...textCells, ...logoCells].sort((a, b) => a.x - b.x),
    color,
    ...fontSizeOf(medianHeight, image.width),
  };
};
