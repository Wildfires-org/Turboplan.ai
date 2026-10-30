import { clipBox } from "./boxes";
import { luminanceAt, PAPER_LUMINANCE } from "./pixels";
import type { Box } from "./types";

// Every second pixel of each box is sampled.
const SAMPLE_STEP = 2;
// Black and grey ink: a channel spread below this has no hue worth keeping.
const MIN_CHANNEL_SPREAD = 40;
// Hue buckets of 30°; the winning bucket must hold this share of the
// coloured ink, else the letterhead is treated as plain.
const HUE_BUCKETS = 12;
const MIN_WINNING_SHARE = 0.5;
// Coloured text colours nearly all of its ink; coloured ink below this share
// of all ink is a stray (anti-aliased edges, a coloured rule) in black text.
const MIN_COLOURED_SHARE = 0.3;

const toHex = (value: number): string =>
  Math.round(value).toString(16).padStart(2, "0");

const hueBucket = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue: number;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  const degrees = (hue * 60 + 360) % 360;
  return Math.floor(degrees / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
};

type ColouredPixel = { r: number; g: number; b: number; luminance: number };

// Mean colour of the darker half of the pixels: anti-aliased glyph edges are
// blended toward the paper (same hue, lighter), so the full mean comes out
// paler than the printed ink.
const meanOfDarkerHalf = (pixels: ColouredPixel[]) => {
  const darker = [...pixels]
    .sort((a, b) => a.luminance - b.luminance)
    .slice(0, Math.max(1, Math.ceil(pixels.length / 2)));
  const mean = (channel: "r" | "g" | "b") =>
    darker.reduce((sum, pixel) => sum + pixel[channel], 0) / darker.length;
  return { r: mean("r"), g: mean("g"), b: mean("b") };
};

/**
 * The accent colour of the ink inside `boxes` (the bold lines' boxes) of an
 * opaque RGBA image, as a lowercase hex: the mean of the darker half of the
 * coloured ink pixels in the commonest hue, when coloured ink is a real share
 * of the ink and that hue dominates it. Null for black or grey text, or when
 * nothing is there.
 */
export const findInkColor = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  boxes: Box[],
): string | null => {
  const image = { x: 0, y: 0, width, height };
  const buckets: ColouredPixel[][] = Array.from(
    { length: HUE_BUCKETS },
    () => [],
  );
  let inkCount = 0;
  let colouredCount = 0;

  for (const raw of boxes) {
    const box = clipBox(raw, image);
    if (!box) {
      continue;
    }
    const x0 = Math.floor(box.x);
    const y0 = Math.floor(box.y);
    const x1 = Math.ceil(box.x + box.width);
    const y1 = Math.ceil(box.y + box.height);
    for (let y = y0; y < y1; y += SAMPLE_STEP) {
      for (let x = x0; x < x1; x += SAMPLE_STEP) {
        const p = (y * width + x) * 4;
        const r = rgba[p];
        const g = rgba[p + 1];
        const b = rgba[p + 2];
        const luminance = luminanceAt(rgba, p);
        if (luminance >= PAPER_LUMINANCE) {
          continue;
        }
        inkCount++;
        if (Math.max(r, g, b) - Math.min(r, g, b) < MIN_CHANNEL_SPREAD) {
          continue;
        }
        colouredCount++;
        buckets[hueBucket(r, g, b)].push({ r, g, b, luminance });
      }
    }
  }

  if (inkCount === 0 || colouredCount < inkCount * MIN_COLOURED_SHARE) {
    return null;
  }
  const [winner] = [...buckets].sort((a, b) => b.length - a.length);
  if (winner.length < colouredCount * MIN_WINNING_SHARE) {
    return null;
  }
  const { r, g, b } = meanOfDarkerHalf(winner);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
