// Pure helpers for "Import from document" in the letterhead editor: the crop
// math on the rendered first page and the shape of the extract API. The
// browser-only rendering lives in letterhead-import-canvas.ts.

import {
  type LetterheadLayout,
  normalizeLetterheadColor,
} from "@wildfires-org/turboplan-workspace/types";

// Box in fractions (0..1) of an image's width/height.
export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageSize = { width: number; height: number };

export type ExtractImageMimeType = "image/png" | "image/jpeg";

// POST /api/documents/letterhead/extract response.
export type LetterheadExtractResult = {
  layout: Exclude<LetterheadLayout, "banner">;
  nameLines: string[];
  contactLines: string[];
  color: string | null;
  // Fractions of the SENT header image.
  logoBox: NormalizedBox | null;
  headerBottom: number;
};

// What the editor applies to its form. A missing logoUrl keeps the current one.
export type LetterheadImportValues = {
  layout: LetterheadLayout;
  lines?: string;
  contact?: string;
  color: string;
  logoUrl?: string;
};

export const LETTERHEAD_EXTRACT_ENDPOINT = "/api/documents/letterhead/extract";

// Page 1 is rendered about this wide (≈2× a US Letter page at 96 dpi).
export const IMPORT_RENDER_WIDTH = 1700;
// The top of the page that is sent to the API as the header region.
export const HEADER_REGION_RATIO = 0.3;
// Padding around the detected logo, as a fraction of its larger side.
export const LOGO_PADDING = 0.04;
// Extra room below the detected header bottom for the banner crop.
export const BANNER_PADDING = 0.02;
// Longest edge of the image sent to the API; bigger only costs more.
export const MAX_EXTRACT_EDGE = 1568;
// Channel value above which a pixel counts as paper when trimming a crop.
export const PAPER_THRESHOLD = 245;
// The API rejects images above this many decoded bytes.
export const MAX_EXTRACT_BYTES = 4 * 1024 * 1024;

export const IMPORT_ACCEPT = "application/pdf,image/png,image/jpeg";

export const isSupportedImportType = (mimeType: string): boolean =>
  mimeType === "application/pdf" ||
  mimeType === "image/png" ||
  mimeType === "image/jpeg";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// Scale that renders a page of `pageWidth` CSS px at `targetWidth` px.
export const getRenderScale = (
  pageWidth: number,
  targetWidth: number = IMPORT_RENDER_WIDTH,
): number => (pageWidth > 0 ? targetWidth / pageWidth : 1);

// Integer pixel rect clamped to the image, at least 1×1.
const toClampedRect = (
  left: number,
  top: number,
  right: number,
  bottom: number,
  size: ImageSize,
): PixelRect => {
  const x = Math.floor(clamp01(left) * size.width);
  const y = Math.floor(clamp01(top) * size.height);
  const x2 = Math.ceil(clamp01(right) * size.width);
  const y2 = Math.ceil(clamp01(bottom) * size.height);
  return {
    x: Math.min(x, size.width - 1),
    y: Math.min(y, size.height - 1),
    width: Math.max(1, x2 - x),
    height: Math.max(1, y2 - y),
  };
};

// The top `ratio` of the page: what the extract API reads.
export const getHeaderRegionRect = (
  size: ImageSize,
  ratio: number = HEADER_REGION_RATIO,
): PixelRect => toClampedRect(0, 0, 1, ratio, size);

// A normalized box → pixels, grown by `padding` × its larger side (in pixels,
// so the margin is even on all four sides) and clamped to the image.
export const getPaddedBoxRect = (
  box: NormalizedBox,
  size: ImageSize,
  padding: number = LOGO_PADDING,
): PixelRect => {
  const padPx =
    Math.max(box.width * size.width, box.height * size.height) * padding;
  const padX = size.width > 0 ? padPx / size.width : 0;
  const padY = size.height > 0 ? padPx / size.height : 0;
  return toClampedRect(
    box.x - padX,
    box.y - padY,
    box.x + box.width + padX,
    box.y + box.height + padY,
    size,
  );
};

// Full-width strip from the top of the header image to `headerBottom` (plus
// padding): the organization's own letterhead as a banner image.
export const getBannerRect = (
  headerBottom: number,
  size: ImageSize,
  padding: number = BANNER_PADDING,
): PixelRect => {
  const bottom = headerBottom > 0 ? headerBottom + padding : 1;
  return toClampedRect(0, 0, 1, bottom, size);
};

// Size that fits `size` within `maxEdge` on its longest side (never upscales).
export const fitWithin = (
  size: ImageSize,
  maxEdge: number = MAX_EXTRACT_EDGE,
): ImageSize => {
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height, 1));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
};

// Bounding box of the non-paper pixels in RGBA `data` (transparent or
// near-white pixels are paper), or null for a blank image. Used to trim the
// loose logo box down to the mark itself.
export const findInkBounds = (
  data: Uint8ClampedArray,
  size: ImageSize,
  threshold: number = PAPER_THRESHOLD,
): PixelRect | null => {
  let left = size.width;
  let top = size.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const i = (y * size.width + x) * 4;
      const isPaper =
        data[i + 3] < 16 ||
        (data[i] >= threshold &&
          data[i + 1] >= threshold &&
          data[i + 2] >= threshold);
      if (!isPaper) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < 0) {
    return null;
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

// Grows a rect by `margin` px on each side, clamped to the image.
export const expandRect = (
  rect: PixelRect,
  margin: number,
  size: ImageSize,
): PixelRect => {
  const x = Math.max(0, rect.x - margin);
  const y = Math.max(0, rect.y - margin);
  return {
    x,
    y,
    width: Math.min(size.width, rect.x + rect.width + margin) - x,
    height: Math.min(size.height, rect.y + rect.height + margin) - y,
  };
};

// Base64 (no data: prefix) of raw bytes; chunked so large images don't blow
// the argument limit of String.fromCharCode.
export const bytesToBase64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
};

// Whether a box is usable (positive area inside the image).
export const isUsableBox = (box: NormalizedBox | null): box is NormalizedBox =>
  !!box &&
  [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
  box.width > 0 &&
  box.height > 0 &&
  box.x < 1 &&
  box.y < 1;

// The text-letterhead fields to apply to the form.
export const toTextLetterheadValues = (
  result: LetterheadExtractResult,
): LetterheadImportValues => ({
  layout: result.layout,
  lines: result.nameLines.join("\n"),
  contact: result.contactLines.join("\n"),
  color: normalizeLetterheadColor(result.color) ?? "",
});

export const hasExtractedText = (result: LetterheadExtractResult): boolean =>
  result.nameLines.length > 0 || result.contactLines.length > 0;

// Friendly message for a failed extract request.
export const getExtractErrorMessage = (status: number | null): string => {
  if (status === 403) {
    return "You need permission to edit this office's letterhead.";
  }
  if (status === 429) {
    return "Too many imports in a short time. Wait a minute and try again.";
  }
  if (status === 413) {
    return "That page is too large to read. Try a smaller file.";
  }
  if (status === 402) {
    return "You're out of AI credits, so we can't read the header right now.";
  }
  if (status === 504) {
    return "Reading the header took too long. Try again.";
  }
  if (status === 400) {
    return "We couldn't read that page. Try a PDF or a clearer image.";
  }
  return "We couldn't read the header. Try another file or set it up by hand.";
};
