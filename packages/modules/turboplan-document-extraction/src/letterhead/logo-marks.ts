import { clipBox } from "./boxes";
import { luminanceAt, PAPER_LUMINANCE } from "./pixels";
import type { Box, LetterheadBlock } from "./types";

// Logo mark detection, tuned on 1700 px wide header renders (spike
// 2026-10-15; production renders 1568 px wide and the height threshold scales
// with the width): every second pixel is sampled, anything darker than paper
// is ink, and ink is dilated by 3 samples so a seal's separate strokes join
// into one blob.
const SAMPLE_STEP = 2;
const DILATE_RADIUS = 3;
const REFERENCE_WIDTH = 1700;
// A mark is at least 60 px tall at the reference width (body text is not),
// roughly square and narrower than 40 % of the image (a rule or banner is not).
const MIN_MARK_HEIGHT_AT_REFERENCE = 60;
const MIN_MARK_ASPECT = 0.4;
const MAX_MARK_ASPECT = 2.5;
const MAX_MARK_WIDTH_RATIO = 0.4;

// An image the PDF draws is a logo candidate only when it is bigger than a
// contact-line icon (phone, envelope: 20–30 px at the 1568 px render) on both
// sides, smaller than a quarter of the page (a scanned page is not) and
// narrower than a mark may be (a scan stored as full-width strips, or a whole
// letterhead saved as one banner image, is not).
const MIN_PLACED_LOGO_SIDE = 36;
const MAX_PLACED_LOGO_AREA_RATIO = 0.25;
// Images covering this share of the header make it a scan (one page image or
// page-wide strips); any text layer on it is OCR.
const SCANNED_HEADER_RATIO = 0.6;

// A pixel mark at least this much inside the text blocks is that text (a bold
// multi-line name column passes the mark test), not a logo.
const MARK_IN_TEXT_RATIO = 0.5;

/**
 * Images the PDF itself draws on the page that can be logos: bigger than an
 * icon, smaller than a quarter of the page, narrower than 40 % of its width
 * and wholly inside the header (half a logo is not stored). Boxes are in the
 * pixel space of the rendered page. When none is left (a scanned page image,
 * page-wide strips or banners), the logos must be found in the pixels instead
 * ({@link findLogoMarks}).
 */
export const filterPlacedLogos = (
  imageBoxes: Box[],
  page: { width: number; height: number },
  headerHeight: number,
): Box[] =>
  imageBoxes.filter(
    (box) =>
      box.width > MIN_PLACED_LOGO_SIDE &&
      box.height > MIN_PLACED_LOGO_SIDE &&
      box.width * box.height <
        page.width * page.height * MAX_PLACED_LOGO_AREA_RATIO &&
      box.width < page.width * MAX_MARK_WIDTH_RATIO &&
      box.y + box.height <= headerHeight,
  );

/**
 * Whether the header is a scan: the images the PDF draws cover most of it (a
 * page-sized image, or page-wide strips). A text layer on such a page is OCR:
 * its fonts carry no weight and its text may differ from what the model reads.
 */
export const isScannedHeader = (
  imageBoxes: Box[],
  header: { width: number; height: number },
): boolean => {
  const area = { x: 0, y: 0, width: header.width, height: header.height };
  return (
    coveredArea(area, imageBoxes) >=
    SCANNED_HEADER_RATIO * header.width * header.height
  );
};

/**
 * The part of `area` covered by at least one of `boxes` (overlaps counted
 * once): the clipped boxes' edges cut `area` into cells, and a cell counts
 * when a box covers its centre.
 */
const coveredArea = (area: Box, boxes: Box[]): number => {
  const clipped = boxes
    .map((box) => clipBox(box, area))
    .filter((box): box is Box => box !== null);
  const edges = (axis: "x" | "y"): number[] => {
    const size = axis === "x" ? "width" : "height";
    const all = clipped.flatMap((box) => [box[axis], box[axis] + box[size]]);
    return [...new Set(all)].sort((a, b) => a - b);
  };
  const xs = edges("x");
  const ys = edges("y");

  let covered = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      const isCovered = clipped.some(
        (box) =>
          cx > box.x &&
          cx < box.x + box.width &&
          cy > box.y &&
          cy < box.y + box.height,
      );
      if (isCovered) {
        covered += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      }
    }
  }
  return covered;
};

/**
 * Pixel marks ({@link findLogoMarks}) minus those that are really text: a
 * mark at least half of whose area lies inside the model's text block boxes
 * is dropped. The blocks count together, so a blob that runs from a name
 * block into the contact block below it (a scan's stacked header lines) goes
 * too. Only for marks found in the pixels — images the PDF draws are logos
 * whatever text the model reads around them. Block boxes must be in the
 * marks' pixel space (the render is sized so the model does not downscale
 * it).
 */
export const dropMarksInTextBlocks = (
  marks: Box[],
  blocks: Pick<LetterheadBlock, "box">[],
): Box[] => {
  const boxes = blocks.map(({ box }) => box);
  return marks.filter(
    (mark) =>
      coveredArea(mark, boxes) < mark.width * mark.height * MARK_IN_TEXT_RATIO,
  );
};

/**
 * Logo-like ink blobs in an opaque RGBA header image (white paper): connected
 * components of dilated ink, kept when tall enough (60 px at 1700 px wide,
 * scaled with `width`), roughly square and narrower than 40 % of the image.
 * Text lines and rules fail the height or aspect test. Pure JS, no canvas.
 */
export const findLogoMarks = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): Box[] => {
  const cols = Math.ceil(width / SAMPLE_STEP);
  const rows = Math.ceil(height / SAMPLE_STEP);

  const ink = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = (j * SAMPLE_STEP * width + i * SAMPLE_STEP) * 4;
      if (luminanceAt(rgba, p) < PAPER_LUMINANCE) {
        ink[j * cols + i] = 1;
      }
    }
  }

  const dilated = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!ink[j * cols + i]) {
        continue;
      }
      const j0 = Math.max(0, j - DILATE_RADIUS);
      const j1 = Math.min(rows - 1, j + DILATE_RADIUS);
      const i0 = Math.max(0, i - DILATE_RADIUS);
      const i1 = Math.min(cols - 1, i + DILATE_RADIUS);
      for (let b = j0; b <= j1; b++) {
        dilated.fill(1, b * cols + i0, b * cols + i1 + 1);
      }
    }
  }

  const minHeight = (MIN_MARK_HEIGHT_AT_REFERENCE / REFERENCE_WIDTH) * width;
  const seen = new Uint8Array(cols * rows);
  const stack: number[] = [];
  const marks: Box[] = [];
  const visit = (cell: number) => {
    if (dilated[cell] && !seen[cell]) {
      seen[cell] = 1;
      stack.push(cell);
    }
  };

  for (let start = 0; start < cols * rows; start++) {
    if (seen[start]) {
      continue;
    }
    visit(start);
    let minI = cols;
    let minJ = rows;
    let maxI = -1;
    let maxJ = -1;

    while (stack.length > 0) {
      const cell = stack.pop() as number;
      const i = cell % cols;
      const j = (cell - i) / cols;
      // The box covers the ink only, not the dilation around it.
      if (ink[cell]) {
        minI = Math.min(minI, i);
        maxI = Math.max(maxI, i);
        minJ = Math.min(minJ, j);
        maxJ = Math.max(maxJ, j);
      }
      if (i + 1 < cols) {
        visit(cell + 1);
      }
      if (i > 0) {
        visit(cell - 1);
      }
      if (j + 1 < rows) {
        visit(cell + cols);
      }
      if (j > 0) {
        visit(cell - cols);
      }
    }
    // Not part of a blob (no ink near this cell).
    if (maxI < 0) {
      continue;
    }

    const x = minI * SAMPLE_STEP;
    const y = minJ * SAMPLE_STEP;
    const box = {
      x,
      y,
      width: Math.min(width - x, (maxI - minI + 1) * SAMPLE_STEP),
      height: Math.min(height - y, (maxJ - minJ + 1) * SAMPLE_STEP),
    };
    const aspect = box.width / box.height;
    if (
      box.height >= minHeight &&
      aspect > MIN_MARK_ASPECT &&
      aspect < MAX_MARK_ASPECT &&
      box.width < width * MAX_MARK_WIDTH_RATIO
    ) {
      marks.push(box);
    }
  }

  return marks;
};
