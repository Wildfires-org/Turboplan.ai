// Reading ink in an opaque RGBA render: what counts as paper, shared by the
// colour, logo-mark and line-height readers so they agree on what ink is.

// Paper (and anti-aliasing against it) is brighter than this: a darker pixel
// is ink.
export const PAPER_LUMINANCE = 200;

/** Perceived brightness (0–255) of the RGBA pixel starting at byte `p`. */
export const luminanceAt = (
  rgba: Uint8ClampedArray | Uint8Array,
  p: number,
): number => 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
