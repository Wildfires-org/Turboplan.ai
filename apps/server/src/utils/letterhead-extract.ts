import { z } from "zod";

/**
 * Pure parts of `POST /api/documents/letterhead/extract`: request validation,
 * image decoding, the model's output schema + prompt, and normalization of
 * what the model returns. No I/O, so it is unit-testable in isolation.
 */

export const MAX_LETTERHEAD_IMAGE_BYTES = 4 * 1024 * 1024;

// base64 inflates by 4/3; leave headroom for the JSON envelope and ids.
export const MAX_LETTERHEAD_BODY_BYTES =
  Math.ceil((MAX_LETTERHEAD_IMAGE_BYTES * 4) / 3) + 16 * 1024;

const MAX_NAME_LINES = 5;
const MAX_CONTACT_LINES = 6;
const MAX_LINE_LENGTH = 200;
// A box thinner than this (1% of the image) is noise, not a logo.
const MIN_BOX_SIDE = 0.01;

export const LETTERHEAD_LAYOUTS = ["columns", "split", "centered"] as const;
export type LetterheadImportLayout = (typeof LETTERHEAD_LAYOUTS)[number];

export type LetterheadImageMimeType = "image/png" | "image/jpeg";

export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LetterheadExtraction = {
  layout: LetterheadImportLayout;
  nameLines: string[];
  contactLines: string[];
  color: string | null;
  logoBox: NormalizedBox | null;
  headerBottom: number;
};

export const letterheadExtractRequestSchema = z.object({
  organizationId: z.string().uuid(),
  officeId: z.string().uuid().optional(),
  image: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg"]),
});

export type LetterheadExtractRequest = z.infer<
  typeof letterheadExtractRequestSchema
>;

export type ImageSize = { width: number; height: number };

type DecodeResult =
  | { ok: true; bytes: Uint8Array; size: ImageSize }
  | { ok: false; status: 400 | 413; error: string };

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Uint8Array, magic: number[]) =>
  bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);

/**
 * Decode the base64 image (no `data:` prefix) and confirm its magic bytes
 * match the declared type. Size is checked on the encoded length first so an
 * oversized payload is never decoded.
 */
export const decodeLetterheadImage = (
  image: string,
  mimeType: LetterheadImageMimeType,
): DecodeResult => {
  const encoded = image.replace(/\s+/g, "");
  if (encoded.length === 0 || encoded.length % 4 === 1) {
    return { ok: false, status: 400, error: "Invalid image encoding" };
  }
  if (!BASE64_PATTERN.test(encoded)) {
    return { ok: false, status: 400, error: "Invalid image encoding" };
  }
  if (Math.floor((encoded.length * 3) / 4) > MAX_LETTERHEAD_IMAGE_BYTES + 2) {
    return { ok: false, status: 413, error: "Image too large" };
  }

  const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
  if (bytes.length > MAX_LETTERHEAD_IMAGE_BYTES) {
    return { ok: false, status: 413, error: "Image too large" };
  }

  const magic = mimeType === "image/png" ? PNG_MAGIC : JPEG_MAGIC;
  if (!startsWith(bytes, magic)) {
    return { ok: false, status: 400, error: "Image does not match mimeType" };
  }

  const size =
    mimeType === "image/png" ? readPngSize(bytes) : readJpegSize(bytes);
  if (!size) {
    return { ok: false, status: 400, error: "Unreadable image" };
  }

  return { ok: true, bytes, size };
};

const readUint16 = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);

const readUint32 = (bytes: Uint8Array, offset: number) =>
  readUint16(bytes, offset) * 0x10000 + readUint16(bytes, offset + 2);

const validSize = (width: number, height: number): ImageSize | null =>
  width > 0 && height > 0 ? { width, height } : null;

// Anthropic downscales any image whose long edge exceeds 1568 px or whose
// area exceeds ~1.15 MP before the model sees it, and the model then answers
// in the downscaled pixel space.
const MODEL_MAX_EDGE = 1568;
const MODEL_MAX_PIXELS = 1_150_000;

/**
 * The image size as the vision model sees it. The prompt states this size and
 * pixel answers are normalized against it, so fractions stay right whether or
 * not the provider resized the upload.
 */
export const getModelVisibleSize = ({
  width,
  height,
}: ImageSize): ImageSize => {
  const scale = Math.min(
    1,
    MODEL_MAX_EDGE / Math.max(width, height),
    Math.sqrt(MODEL_MAX_PIXELS / (width * height)),
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/** PNG: the IHDR chunk always comes first — width/height at bytes 16..24. */
export const readPngSize = (bytes: Uint8Array): ImageSize | null => {
  if (bytes.length < 24) {
    return null;
  }
  return validSize(readUint32(bytes, 16), readUint32(bytes, 20));
};

/** JPEG: walk the marker segments to the first SOFn frame header. */
export const readJpegSize = (bytes: Uint8Array): ImageSize | null => {
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1] ?? 0;
    // Fill bytes / standalone markers carry no length.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const isFrameHeader =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrameHeader) {
      return validSize(
        readUint16(bytes, offset + 7),
        readUint16(bytes, offset + 5),
      );
    }
    const length = readUint16(bytes, offset + 2);
    if (length < 2) {
      return null;
    }
    offset += 2 + length;
  }
  return null;
};

/**
 * What the model is asked to return. Deliberately loose (no ranges or
 * lengths): a constraint the model misses would fail the whole call, so
 * bounds are enforced afterwards by {@link normalizeLetterheadExtraction}.
 *
 * Geometry is asked for in PIXELS of the stated image size, then normalized
 * here: measured on a real letterhead, Claude places boxes far more
 * accurately in pixels than as 0..1 fractions (which drifted ~0.15 upward).
 */
export const letterheadModelOutputSchema = z.object({
  layout: z
    .enum(LETTERHEAD_LAYOUTS)
    .describe(
      "columns = several bold name blocks side by side plus an address column (agency style); split = logo/name on the left and an address block on the right; centered = everything stacked and centered",
    ),
  nameLines: z
    .array(z.string())
    .describe(
      "Bold identity lines (organization, division, office…) in reading order, original capitalization",
    ),
  contactLines: z
    .array(z.string())
    .describe(
      "Address, phone, fax, web and email lines in reading order, as printed",
    ),
  color: z
    .string()
    .nullable()
    .describe(
      "Dominant brand accent color as #rrggbb when clearly present (colored name text, rule or logo), else null. Never black, white or grey.",
    ),
  logoBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable()
    .describe(
      "Tight box around the graphic logo mark/emblem (not the name text beside it) in pixels of the image, origin top-left; null when there is no logo",
    ),
  headerBottom: z
    .number()
    .describe(
      "y in pixels where the letterhead ends, just below its last line, rule or logo and above any title or body text",
    ),
});

export type LetterheadModelOutput = z.infer<typeof letterheadModelOutputSchema>;

export const buildLetterheadExtractPrompt = ({ width, height }: ImageSize) =>
  `You read the letterhead (the printed header) at the top of a document page image and return its parts as structured data.

Rules:
- Extract ONLY text printed inside the letterhead. Ignore document titles, dates, recipients, salutations, body text and page numbers below it.
- Never guess or invent text. If a part is not printed, return an empty list (or null).
- Keep the original capitalization, spelling and punctuation. One printed line = one entry; do not merge or split lines. Text set in small caps is written in its natural mixed case (e.g. "Building 12, Suite 4"), not all caps.
- nameLines: the bold/prominent identity lines (organization, department, division, office, agency names). Max 5.
- contactLines: street address, city/state/zip, phone, fax, website and email lines. Max 6. Keep labels such as "TEL" or "Fax:" as printed.
- Text that is part of the logo artwork itself is not a name line unless it is also printed as text beside it.
- layout: "columns" when several bold name blocks sit side by side with an address column (government agency style); "split" when the logo and/or name is on the left and an address block on the right; "centered" when the letterhead is a centered stack.
- color: the brand accent color (#rrggbb) only if the letterhead clearly uses one for names, rules or the logo; otherwise null.
- The image is ${width}x${height} pixels. Give all coordinates in pixels of this image, origin top-left.
- logoBox: a tight box around the graphic logo mark/emblem/seal. Exclude the organization name set as text beside the mark (that goes in nameLines). null if there is no logo.
- headerBottom: the y pixel where the letterhead ends (below its last line, rule or logo).`;

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

// 4 decimals is sub-pixel at any realistic size and drops float noise.
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

const cleanLines = (lines: unknown, max: number): string[] => {
  if (!Array.isArray(lines)) {
    return [];
  }
  return lines
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.replace(/\s+/g, " ").trim().slice(0, MAX_LINE_LENGTH))
    .filter((line) => line.length > 0)
    .slice(0, max);
};

const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const normalizeHexColor = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const match = HEX_COLOR.exec(value.trim());
  if (!match?.[1]) {
    return null;
  }
  const hex = match[1].toLowerCase();
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;
  return `#${full}`;
};

const normalizeBox = (
  box: unknown,
  { width: imageWidth, height: imageHeight }: ImageSize,
): NormalizedBox | null => {
  if (!box || typeof box !== "object") {
    return null;
  }
  const { x, y, width, height } = box as Record<string, unknown>;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }
  const left = clamp01(x / imageWidth);
  const top = clamp01(y / imageHeight);
  const right = clamp01((x + width) / imageWidth);
  const bottom = clamp01((y + height) / imageHeight);
  if (right - left < MIN_BOX_SIDE || bottom - top < MIN_BOX_SIDE) {
    return null;
  }
  return {
    x: round4(left),
    y: round4(top),
    width: round4(right - left),
    height: round4(bottom - top),
  };
};

/**
 * Bound and clean the model's answer: collapse whitespace, drop empty lines,
 * cap list lengths, validate the color, convert the pixel geometry to 0..1 of
 * `size` and clamp it into the image. `headerBottom` falls back to 1 (keep the
 * whole image) and never cuts through the logo.
 */
export const normalizeLetterheadExtraction = (
  output: Partial<LetterheadModelOutput>,
  size: ImageSize,
): LetterheadExtraction => {
  const layout = LETTERHEAD_LAYOUTS.includes(
    output.layout as LetterheadImportLayout,
  )
    ? (output.layout as LetterheadImportLayout)
    : "split";

  const logoBox = normalizeBox(output.logoBox, size);
  const headerBottom =
    typeof output.headerBottom === "number" &&
    Number.isFinite(output.headerBottom) &&
    output.headerBottom > 0
      ? round4(clamp01(output.headerBottom / size.height))
      : 1;

  return {
    layout,
    nameLines: cleanLines(output.nameLines, MAX_NAME_LINES),
    contactLines: cleanLines(output.contactLines, MAX_CONTACT_LINES),
    color: normalizeHexColor(output.color),
    logoBox,
    headerBottom: logoBox
      ? Math.max(headerBottom, logoBox.y + logoBox.height)
      : headerBottom,
  };
};
