/**
 * Background loop that analyzes the letterhead of pending documents, separate
 * from text extraction: its own poll and its own worker, one at a time, behind
 * the worker gate it shares with extraction (so the two never run side by
 * side; either waits at most one document of the other). Only PDFs are
 * analyzed; anything else is stored as "none" without being downloaded. The
 * logo crops the worker returns are stored through `storeLogo`; without it (no
 * storage configured) the grid is kept without its logo cells.
 *
 * Each run is counted on the row before the worker starts (`claim`), so a PDF
 * that crashes the whole process is not picked first on every boot: the
 * pending query skips rows out of attempts and every pass starts by marking
 * those "failed" (`failExhausted`). Only a permanent failure is stored as
 * "failed" straight away; a temporary one leaves the row pending for another
 * attempt. An API error (OpenRouter down, out of credit, rate limiting) also
 * pauses the loop, so an outage does not use up the backlog's attempts.
 *
 * Every dependency is injected so the loop is unit-tested without a database,
 * a worker thread or storage.
 */

import type {
  LetterheadAnalysis,
  LetterheadCell,
  LetterheadGrid,
  LetterheadGridDraft,
} from "@wildfires-org/turboplan-document-extraction/letterhead";
import { PDF_MIME } from "@wildfires-org/turboplan-document-extraction/mime";

import { logger as defaultLogger, type Logger } from "../../infra/logger";
import {
  createDocumentPollLoop,
  type DocumentLoop,
  type PendingDocument,
  type PollSource,
} from "../document-poll-loop";
import { runUngated, type WorkerGate } from "../worker-gate";
import type {
  LetterheadFailureReason,
  LetterheadTaskAnalysis,
  LetterheadTaskResult,
} from "./analysis-task";

/** What is stored on the document row (both document tables). */
export type LetterheadUpdate = {
  status: "done" | "none" | "failed";
  analysis: LetterheadAnalysis | null;
};

export type LetterheadSource = PollSource & {
  /**
   * Counts an attempt on a pending row right before its worker starts: the
   * attempts so far, this one included, or null when the row is gone, no
   * longer pending or out of attempts (it is then skipped).
   */
  claim: (id: string) => Promise<number | null>;
  /** Marks "failed" the pending rows out of attempts; resolves how many. */
  failExhausted: () => Promise<number>;
  /** Resolves false when the row is gone, which is fine. */
  persist: (id: string, update: LetterheadUpdate) => Promise<unknown>;
};

/** Runs the analysis of the PDF at `url`; the model settings are bound in. */
export type LetterheadAnalyzer = (input: {
  url: string;
}) => Promise<LetterheadTaskResult>;

/**
 * Stores one logo crop and resolves its R2 object key (stored in the grid,
 * never a public URL); null (or a throw) drops that logo cell. `index` is the
 * cell's position among the document's logos.
 */
export type LetterheadLogoStore = (
  png: Uint8Array,
  context: { source: string; documentId: string; index: number },
) => Promise<string | null>;

export type LetterheadAnalysisServiceDeps = {
  /** Drained in array order within each pass. */
  sources: LetterheadSource[];
  analyze: LetterheadAnalyzer;
  storeLogo?: LetterheadLogoStore;
  /** Shared with the extraction loop: one document worker at a time. */
  workerGate?: WorkerGate;
  /** How long the loop pauses after an API error. */
  apiErrorBackoffMs?: number;
  pollIntervalMs?: number;
  batchSize?: number;
  logger?: Logger;
  now?: () => number;
};

const NO_LETTERHEAD: LetterheadAnalysis = { hasLetterhead: false, grid: null };

/**
 * Failures that would fail again — a PDF that cannot be rendered, a refusal,
 * an unusable answer — stored as "failed" at once. Any other (download, API
 * error, timeout, worker crash) is temporary: the row stays pending for its
 * next attempt.
 */
const PERMANENT_FAILURES: ReadonlySet<LetterheadFailureReason> = new Set([
  "unreadable",
  "refused",
  "invalid-output",
]);

/**
 * After an API error (an OpenRouter outage, no credit left, rate limiting) no
 * pass starts for this long, so the backlog is not run through meanwhile.
 */
export const API_ERROR_BACKOFF_MS = 5 * 60_000;

/**
 * A logo upload that takes longer is given up (the loop runs one document at
 * a time, so a hung upload would stall it).
 */
export const LOGO_STORE_TIMEOUT_MS = 15_000;

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// The store's key, or null when it fails, throws or takes too long.
const storeWithin = async (
  store: () => Promise<string | null>,
  timeoutMs: number,
): Promise<string | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve()
        .then(store)
        .catch(() => null),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * The stored grid for the worker's draft: logo crops stored (one `storeLogo`
 * call each, side by side, numbered in reading order), cells whose crop could
 * not be stored — failed, threw, or took over `timeoutMs` — left out. Without
 * a store, no logo cells. The base text size is kept (absent stays absent).
 */
export const toStoredGrid = async (
  draft: LetterheadGridDraft,
  storeLogo:
    | ((png: Uint8Array, index: number) => Promise<string | null>)
    | null,
  timeoutMs = LOGO_STORE_TIMEOUT_MS,
): Promise<LetterheadGrid> => {
  let logoIndex = 0;
  const cells = await Promise.all(
    draft.cells.map(async (cell): Promise<LetterheadCell | null> => {
      if (cell.kind === "text") {
        return cell;
      }
      if (!storeLogo) {
        return null;
      }
      const index = logoIndex;
      logoIndex += 1;
      const { png, ...rest } = cell;
      const key = await storeWithin(() => storeLogo(png, index), timeoutMs);
      return key ? { ...rest, key } : null;
    }),
  );
  return {
    cells: cells.filter((cell): cell is LetterheadCell => cell !== null),
    color: draft.color,
    ...(draft.fontSize !== undefined ? { fontSize: draft.fontSize } : {}),
  };
};

// A grid left with no cells — a letterhead of logos alone whose crops could
// not be stored — is no letterhead.
const toUpdate = (
  analysis: LetterheadTaskAnalysis,
  grid: LetterheadAnalysis["grid"],
): LetterheadUpdate =>
  analysis.hasLetterhead && grid && grid.cells.length > 0
    ? { status: "done", analysis: { hasLetterhead: true, grid } }
    : { status: "none", analysis: NO_LETTERHEAD };

const describeGrid = (grid: LetterheadGridDraft): string => {
  const textCells = grid.cells.filter((cell) => cell.kind === "text").length;
  const logoCells = grid.cells.length - textCells;
  const lines = grid.cells.reduce(
    (count, cell) => count + (cell.kind === "text" ? cell.lines.length : 0),
    0,
  );
  return `${textCells} text cell(s) / ${lines} line(s) / ${logoCells} logo(s) / colour ${grid.color ?? "plain"}`;
};

/** One line per analyzed document: layout, counts and timings, never text. */
export const formatLetterheadLogLine = (
  filename: string,
  result: LetterheadTaskResult,
): string => {
  const outcome = !result.ok
    ? `failed (${result.reason})`
    : result.analysis.grid
      ? `done, ${describeGrid(result.analysis.grid)}`
      : "none (no letterhead)";
  const stats = result.stats
    ? [
        `logos ${result.stats.logoSource}${result.stats.logoCount > 0 ? ` x${result.stats.logoCount}` : ""}`,
        `lines printed ${result.stats.printedLineCount}/${result.stats.lineCount}`,
        `render ${result.stats.renderMs} ms`,
        `model ${result.stats.modelMs} ms`,
        `tokens in ${result.stats.inputTokens} / out ${result.stats.outputTokens}`,
      ].join(", ")
    : "no stats";
  const detail = !result.ok && result.detail ? ` — ${result.detail}` : "";
  return `[letterhead] ${filename}: ${outcome}, ${stats}${detail}`;
};

const isPdf = (mimeType: string): boolean =>
  mimeType.toLowerCase().trim() === PDF_MIME;

export const createLetterheadAnalysisService = ({
  sources,
  analyze,
  storeLogo,
  workerGate = runUngated,
  apiErrorBackoffMs = API_ERROR_BACKOFF_MS,
  pollIntervalMs,
  batchSize,
  logger = defaultLogger,
  now = Date.now,
}: LetterheadAnalysisServiceDeps): DocumentLoop => {
  let pausedUntil = 0;

  const failExhausted = async (): Promise<void> => {
    for (const source of sources) {
      try {
        const count = await source.failExhausted();
        if (count > 0) {
          logger.log(
            `[${source.name}] ${count} document(s) out of letterhead analysis attempts, marked failed`,
            "warning",
          );
        }
      } catch (err) {
        logger.error(
          `[${source.name}] Failed to mark exhausted letterhead analyses failed`,
          err,
        );
      }
    }
  };

  const analyzeSafely = async (
    doc: PendingDocument,
  ): Promise<LetterheadTaskResult> => {
    try {
      return await analyze({ url: doc.url });
    } catch (err) {
      return { ok: false, reason: "worker-failed", detail: describeError(err) };
    }
  };

  const persist = async (
    source: LetterheadSource,
    doc: PendingDocument,
    update: LetterheadUpdate,
  ): Promise<void> => {
    // A failed write leaves the row pending for a later pass; the rest of the
    // batch goes on.
    try {
      await source.persist(doc.id, update);
    } catch (err) {
      logger.error(
        `[${source.name}] Failed to persist letterhead analysis for ${doc.id}`,
        err,
      );
    }
  };

  const storeLogos = async (
    source: LetterheadSource,
    doc: PendingDocument,
    analysis: LetterheadTaskAnalysis,
  ): Promise<LetterheadAnalysis["grid"]> => {
    if (!analysis.grid) {
      return null;
    }
    const store = storeLogo
      ? (png: Uint8Array, index: number) =>
          storeLogo(png, { source: source.name, documentId: doc.id, index })
      : null;
    const grid = await toStoredGrid(analysis.grid, store);
    const dropped = analysis.grid.cells.length - grid.cells.length;
    if (dropped > 0) {
      logger.log(
        `[letterhead] ${doc.originalFilename}: ${dropped} logo(s) not stored${storeLogo ? "" : " (no logo storage configured)"}`,
        "warning",
      );
    }
    return grid;
  };

  const processDocument = async (
    source: LetterheadSource,
    doc: PendingDocument,
  ): Promise<boolean> => {
    // Word files have no page to render (v1): no download, no model call.
    if (!isPdf(doc.mimeType)) {
      logger.log(
        `[letterhead] ${doc.originalFilename}: none (not a PDF)`,
        "info",
      );
      await persist(source, doc, { status: "none", analysis: NO_LETTERHEAD });
      return true;
    }

    // Claimed once it holds the gate, right before the worker starts: an
    // attempt is only counted when one is made.
    const run = await workerGate(async () => {
      const attempt = await source.claim(doc.id);
      return attempt === null
        ? null
        : { attempt, result: await analyzeSafely(doc) };
    });
    if (!run) {
      logger.log(
        `[letterhead] ${doc.originalFilename}: skipped (no longer pending)`,
        "info",
      );
      return true;
    }
    const { attempt, result } = run;
    logger.log(
      formatLetterheadLogLine(doc.originalFilename, result),
      result.ok ? "info" : "warning",
    );
    if (!result.ok) {
      if (PERMANENT_FAILURES.has(result.reason)) {
        await persist(source, doc, { status: "failed", analysis: null });
      } else {
        logger.log(
          `[letterhead] ${doc.originalFilename}: attempt ${attempt} failed (${result.reason}), left pending`,
          "warning",
        );
      }
      if (result.reason === "api-error") {
        pausedUntil = now() + apiErrorBackoffMs;
        logger.log(
          `[letterhead] Model API error: letterhead analysis paused for ${Math.round(apiErrorBackoffMs / 1000)} s`,
          "warning",
        );
      }
      return false;
    }
    const grid = await storeLogos(source, doc, result.analysis);
    await persist(source, doc, toUpdate(result.analysis, grid));
    return true;
  };

  return createDocumentPollLoop({
    taskName: "letterhead analysis",
    sources,
    processDocument,
    beforePass: failExhausted,
    isPaused: () => now() < pausedUntil,
    pollIntervalMs,
    batchSize,
    logger,
  });
};
