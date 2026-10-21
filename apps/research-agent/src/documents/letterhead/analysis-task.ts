/**
 * Letterhead analysis of one PDF, start to finish: download, render the top of
 * page 1, find the logo boxes, ask the vision model for the letterhead's text
 * blocks, match them to the PDF's own text and lay the letterhead out as a
 * grid of text and logo cells, the logos cropped from the render. Nothing is
 * uploaded or stored here.
 *
 * Pure apart from the injected download / render / model calls, so the flow
 * is unit-tested with fakes. `analysis-task-worker.ts` wires the real ones
 * inside the worker thread.
 */

import type { DownloadResult } from "@wildfires-org/turboplan-document-extraction/download";
import {
  type Box,
  dropMarksInTextBlocks,
  filterPlacedLogos,
  findInkColor,
  findLogoMarks,
  isScannedHeader,
  type LetterheadGridDraft,
  type LogoCropper,
  type MatchedBlock,
  matchBlocksToText,
  measureBlockInk,
  type PdfTextItem,
  toGridDraft,
  toTextLines,
} from "@wildfires-org/turboplan-document-extraction/letterhead";

import type { LetterheadModelSettings } from "../../infra/model-provider";
import type { LetterheadReading } from "./letterhead-request";

/** Download, render and model call together. The worker is killed at 60 s. */
export const LETTERHEAD_DEADLINE_MS = 50_000;

export type LetterheadWorkerInput = {
  url: string;
  settings: LetterheadModelSettings;
};

/** The top of page 1, rendered, plus where the PDF drew images and text. */
export type RenderedHeader = {
  /** The header crop, PNG-encoded — what the model sees. */
  png: Uint8Array;
  /** Opaque RGBA pixels of the same crop, for logo marks and ink colour. */
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  /** The whole rendered page; image boxes are in its pixel space. */
  page: { width: number; height: number };
  /** Images the PDF drew that reach into the header. */
  imageBoxes: Box[];
  /** The PDF's text runs in the header (none for a scan). */
  textItems: PdfTextItem[];
  /**
   * A PNG of part of the header crop, in its pixel space. Throws when the box
   * lies outside the crop.
   */
  cropPng: (box: Box) => Uint8Array;
};

/**
 * "pdf": images the PDF itself places (exact boxes). "pixels": ink blobs in
 * the rendered header (scans). "none": no logo.
 */
export type LogoSource = "pdf" | "pixels" | "none";

export type LogoCandidates = { source: LogoSource; boxes: Box[] };

/** Counts and timings for the `[letterhead]` log line. Never any text. */
export type LetterheadStats = {
  renderMs: number;
  modelMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Where the grid's logo boxes came from. */
  logoSource: LogoSource;
  logoCount: number;
  /** The model's letterhead lines, and how many the text layer printed. */
  lineCount: number;
  printedLineCount: number;
};

/** The worker's analysis: the grid still carries its logo crops. */
export type LetterheadTaskAnalysis = {
  hasLetterhead: boolean;
  grid: LetterheadGridDraft | null;
};

export type LetterheadFailureReason =
  | "fetch-failed"
  | "unreadable"
  | "refused"
  | "invalid-output"
  | "api-error"
  | "timeout"
  | "worker-failed";

export type LetterheadTaskResult =
  | { ok: true; analysis: LetterheadTaskAnalysis; stats: LetterheadStats }
  | {
      ok: false;
      reason: LetterheadFailureReason;
      /** For logs only: never document text. */
      detail?: string;
      /** Missing when the worker itself failed. */
      stats?: LetterheadStats;
    };

export type LetterheadTaskDeps = {
  download: (url: string, signal: AbortSignal) => Promise<DownloadResult>;
  /** Throws when the PDF cannot be opened or rendered. */
  renderHeader: (bytes: Uint8Array) => Promise<RenderedHeader>;
  /** Throws on API and network errors. */
  readLetterhead: (
    header: Pick<RenderedHeader, "png" | "width" | "height">,
    signal: AbortSignal,
  ) => Promise<LetterheadReading>;
  /** The overall deadline; aborting it also aborts the model request. */
  signal: AbortSignal;
  now?: () => number;
};

const NO_LETTERHEAD: LetterheadTaskAnalysis = {
  hasLetterhead: false,
  grid: null,
};

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * Logo boxes of a rendered header: the images the PDF places, when any is a
 * logo candidate; otherwise ink blobs in the pixels (a scan is one page-sized
 * image, so its logos exist only as pixels).
 */
export const locateLogos = (header: RenderedHeader): LogoCandidates => {
  const placed = filterPlacedLogos(
    header.imageBoxes,
    header.page,
    header.height,
  );
  if (placed.length > 0) {
    return { source: "pdf", boxes: placed };
  }
  const marks = findLogoMarks(header.rgba, header.width, header.height);
  return marks.length > 0
    ? { source: "pixels", boxes: marks }
    : { source: "none", boxes: [] };
};

/**
 * The letterhead's accent colour: the ink of its bold lines the text layer
 * prints (the agency and department names — not a bold "Subject:" or "DRAFT"
 * elsewhere in the header). Without any (a scan, whose OCR layer says nothing
 * of weight, or a name drawn as an image), the ink inside the model's boxes
 * of the name blocks the text layer prints nothing of. Wordmarks are part of
 * the logo, drawn from its image: their ink is not the text's colour.
 */
export const readInkColor = (
  header: Pick<RenderedHeader, "rgba" | "width" | "height">,
  allBlocks: MatchedBlock[],
): string | null => {
  const blocks = allBlocks.filter((block) => !block.wordmark);
  const boldBoxes = blocks.flatMap((block) =>
    block.matched.flatMap(({ printed }) =>
      printed?.bold === true ? [printed.box] : [],
    ),
  );
  const boxes =
    boldBoxes.length > 0
      ? boldBoxes
      : blocks
          .filter(
            (block) =>
              block.role === "name" &&
              block.matched.length > 0 &&
              block.matched.every(({ printed }) => printed === null),
          )
          .map((block) => block.box);
  if (boxes.length === 0) {
    return null;
  }
  return findInkColor(header.rgba, header.width, header.height, boxes);
};

/**
 * A block the text layer prints nothing of (a scan, or a name drawn as an
 * image) with its lines read from their ink in the render (`ink`: each
 * line's font size and the rows the ink spans), so its lines are sized and
 * placed by their visible glyphs rather than the model's loose box. Returned
 * as it is when any line is printed (the text layer is exact) or the lines
 * cannot be measured.
 */
export const withBlockInk = (
  header: Pick<RenderedHeader, "rgba" | "width" | "height">,
  block: MatchedBlock,
): MatchedBlock => {
  if (
    block.matched.length === 0 ||
    block.matched.some(({ printed }) => printed !== null)
  ) {
    return block;
  }
  const ink = measureBlockInk(
    header.rgba,
    header.width,
    header.height,
    block.box,
    block.matched.map(({ text }) => text),
  );
  return ink ? { ...block, ink } : block;
};

type RenderOutcome =
  | {
      ok: true;
      header: Pick<RenderedHeader, "png" | "width" | "height" | "rgba">;
      logos: LogoCandidates;
      textLines: PdfTextItem[];
      /** An OCR text layer over a scan, not the PDF's own text. */
      isScan: boolean;
      cropPng: RenderedHeader["cropPng"];
      renderMs: number;
    }
  | {
      ok: false;
      reason: LetterheadFailureReason;
      detail?: string;
      renderMs: number;
    };

/**
 * Download, render and find the logos. Its own function so the PDF bytes can
 * be collected before the model call: only the PNG and pixels of the header,
 * the logo boxes, the text lines and the cropper leave it. `renderMs` leaves
 * the download out.
 */
const renderDocument = async (
  url: string,
  deps: LetterheadTaskDeps,
  now: () => number,
): Promise<RenderOutcome> => {
  const downloaded = await deps.download(url, deps.signal);
  if (!downloaded.ok) {
    return {
      ok: false,
      reason: "fetch-failed",
      detail: downloaded.detail ?? downloaded.message,
      renderMs: 0,
    };
  }
  const startedAt = now();
  try {
    const rendered = await deps.renderHeader(downloaded.buffer);
    const { png, rgba, width, height, cropPng } = rendered;
    const isScan = isScannedHeader(rendered.imageBoxes, rendered);
    // An OCR layer's fonts say nothing about the weight printed on the scan.
    const textItems = isScan
      ? rendered.textItems.map((item) => ({ ...item, bold: null }))
      : rendered.textItems;
    return {
      ok: true,
      header: { png, rgba, width, height },
      logos: locateLogos(rendered),
      textLines: toTextLines(textItems),
      isScan,
      cropPng,
      renderMs: now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "unreadable",
      detail: describeError(err),
      renderMs: now() - startedAt,
    };
  }
};

export const runLetterheadTask = async (
  url: string,
  deps: LetterheadTaskDeps,
): Promise<LetterheadTaskResult> => {
  const now = deps.now ?? Date.now;
  const stats: LetterheadStats = {
    renderMs: 0,
    modelMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    logoSource: "none",
    logoCount: 0,
    lineCount: 0,
    printedLineCount: 0,
  };
  const fail = (
    reason: LetterheadFailureReason,
    detail?: string,
  ): LetterheadTaskResult => ({
    ok: false,
    reason: deps.signal.aborted ? "timeout" : reason,
    ...(detail !== undefined ? { detail } : {}),
    stats,
  });

  const rendered = await renderDocument(url, deps, now);
  stats.renderMs = rendered.renderMs;
  if (!rendered.ok) {
    return fail(rendered.reason, rendered.detail);
  }
  const { header, logos, textLines, isScan, cropPng } = rendered;

  const modelStartedAt = now();
  let reading: LetterheadReading;
  try {
    reading = await deps.readLetterhead(
      { png: header.png, width: header.width, height: header.height },
      deps.signal,
    );
  } catch (err) {
    return fail("api-error", describeError(err));
  } finally {
    stats.modelMs = now() - modelStartedAt;
  }
  stats.inputTokens = reading.inputTokens;
  stats.outputTokens = reading.outputTokens;
  if (!reading.ok) {
    return fail(reading.reason, reading.detail);
  }
  if (!reading.output.hasLetterhead) {
    return { ok: true, analysis: NO_LETTERHEAD, stats };
  }

  // The model places its blocks loosely (enough to merge two columns); on a
  // digital PDF they move onto the text layer's exact positions. A model line
  // a native text layer does not print is logo lettering; an OCR layer's text
  // just reads differently, so on a scan every line is kept. A block nothing
  // of which is printed has its lines sized and placed by their ink.
  const blocks = matchBlocksToText(reading.output.blocks, textLines, {
    dropUnprinted: !isScan,
  }).map((block) => withBlockInk(header, block));
  const lines = reading.output.blocks.flatMap((block) =>
    block.lines.filter((line) => line.trim() !== ""),
  );
  stats.lineCount = lines.length;
  stats.printedLineCount = blocks.reduce(
    (count, block) =>
      count + block.matched.filter(({ printed }) => printed !== null).length,
    0,
  );
  // Bold multi-line text passes the pixel mark test; the model's text blocks
  // are in the same pixel space, so marks that are really text are dropped
  // (the blocks together: a scan's stacked lines merge into one blob). A
  // wordmark is logo, not text: a mark of its lettering stays, for the grid
  // to draw with it. An image the PDF places is a real image; the grid only
  // drops one that sits over printed text.
  const logoBoxes =
    logos.source === "pixels"
      ? dropMarksInTextBlocks(
          logos.boxes,
          blocks.filter((block) => !block.wordmark),
        )
      : logos.boxes;
  // A logo that cannot be cropped is left out, not the whole letterhead.
  const cropLogo: LogoCropper = (box) => {
    try {
      return cropPng(box);
    } catch {
      return null;
    }
  };
  const grid = toGridDraft(
    blocks,
    {
      source: logos.source === "pixels" ? "pixels" : "pdf",
      boxes: logoBoxes,
    },
    header,
    cropLogo,
    readInkColor(header, blocks),
  );
  if (!grid) {
    return { ok: true, analysis: NO_LETTERHEAD, stats };
  }

  const logoCells = grid.cells.filter((cell) => cell.kind === "logo");
  stats.logoSource = logoCells.length > 0 ? logos.source : "none";
  stats.logoCount = logoCells.length;
  return { ok: true, analysis: { hasLetterhead: true, grid }, stats };
};
