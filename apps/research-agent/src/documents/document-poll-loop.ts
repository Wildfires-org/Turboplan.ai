/**
 * Background poller shared by the document loops (text extraction, letterhead
 * analysis): every pass drains each document table ("source") in turn, one
 * document at a time, so a loop never runs more than one worker thread (and a
 * shared `WorkerGate` keeps the loops from running theirs side by side). What
 * happens to a document is the caller's `processDocument`; the loop owns the
 * timer, the sources, shutdown and the counters.
 */

import { logger as defaultLogger, type Logger } from "../infra/logger";

/** The subset of a document row the loops need. */
export type PendingDocument = {
  id: string;
  url: string;
  mimeType: string;
  originalFilename: string;
};

/** One document table a loop drains. */
export type PollSource = {
  /** Used in log lines, e.g. "project" or "organization". */
  name: string;
  fetchPending: (limit: number) => Promise<PendingDocument[]>;
};

export type DocumentLoopStatus = {
  inFlight: boolean;
  lastRunAt: number | null;
  processed: number;
  failed: number;
};

export type DocumentLoop = {
  start(): void;
  stop(): Promise<void>;
  wake(): void;
  getStatus(): DocumentLoopStatus;
};

export type DocumentPollLoopDeps<TSource extends PollSource> = {
  /** What the loop does, for log lines, e.g. "extraction". */
  taskName: string;
  /** Drained in array order within each pass. */
  sources: TSource[];
  /**
   * Handles one document, persisting included. Resolves true when it was
   * processed, false when it failed (counted in the status); a throw counts
   * as a failure and is logged.
   */
  processDocument: (source: TSource, doc: PendingDocument) => Promise<boolean>;
  /**
   * Runs at the start of every pass, before any source is read; a throw is
   * logged and the pass goes on.
   */
  beforePass?: () => Promise<void>;
  /**
   * While true no pass starts, and a running pass stops before its next
   * document (the rest stay pending for a later pass).
   */
  isPaused?: () => boolean;
  pollIntervalMs?: number;
  /** Documents fetched per source per pass. */
  batchSize?: number;
  logger?: Logger;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 5;

export const createDocumentPollLoop = <TSource extends PollSource>({
  taskName,
  sources,
  processDocument,
  beforePass,
  isPaused = () => false,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  batchSize = DEFAULT_BATCH_SIZE,
  logger = defaultLogger,
}: DocumentPollLoopDeps<TSource>): DocumentLoop => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;
  let lastRunAt: number | null = null;
  let processed = 0;
  let failed = 0;

  const shouldStopPass = (): boolean => stopped || isPaused();

  const runDocument = async (
    source: TSource,
    doc: PendingDocument,
  ): Promise<void> => {
    let isProcessed = false;
    try {
      isProcessed = await processDocument(source, doc);
    } catch (err) {
      logger.error(
        `[${source.name}] Document ${taskName} failed for ${doc.id}`,
        err,
      );
    }
    if (isProcessed) {
      processed += 1;
    } else {
      failed += 1;
    }
  };

  const drainSource = async (source: TSource): Promise<void> => {
    let documents: PendingDocument[];
    try {
      documents = await source.fetchPending(batchSize);
    } catch (err) {
      logger.error(
        `[${source.name}] Failed to load documents pending ${taskName}`,
        err,
      );
      return;
    }

    if (documents.length === 0) {
      return;
    }

    logger.log(
      `[${source.name}] ${documents.length} document(s) pending ${taskName}`,
      "info",
    );

    for (const doc of documents) {
      // Leave the rest pending for the next boot (or pass) rather than delay
      // shutdown or work through a pause.
      if (shouldStopPass()) {
        return;
      }
      await runDocument(source, doc);
    }
  };

  const runOnce = async (): Promise<void> => {
    if (beforePass) {
      try {
        await beforePass();
      } catch (err) {
        logger.error(`Document ${taskName} pass preparation failed`, err);
      }
    }
    // Sequential on purpose: one worker thread at a time on a 512MB box, so
    // sources take turns instead of running side by side. Each source fails
    // independently — a broken query in one never skips the others.
    for (const source of sources) {
      if (shouldStopPass()) {
        return;
      }
      await drainSource(source);
    }
  };

  const tick = (): void => {
    if (inFlight || shouldStopPass()) {
      return;
    }
    lastRunAt = Date.now();
    inFlight = runOnce()
      .catch((err) => {
        logger.error(`Document ${taskName} pass failed`, err);
      })
      .finally(() => {
        inFlight = null;
      });
  };

  return {
    start(): void {
      if (timer) {
        return;
      }
      stopped = false;
      timer = setInterval(tick, pollIntervalMs);
      timer.unref?.();
      tick();
    },

    async stop(): Promise<void> {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      // Bounded by the current document (its worker timeout plus whatever
      // the caller does after it).
      await inFlight;
    },

    wake(): void {
      tick();
    },

    getStatus(): DocumentLoopStatus {
      return {
        inFlight: inFlight !== null,
        lastRunAt,
        processed,
        failed,
      };
    },
  };
};
