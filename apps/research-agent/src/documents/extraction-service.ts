/**
 * Background poller that turns pending documents into extracted text.
 *
 * One loop serves every document table ("source"): sources take turns within a
 * pass, so there is never more than one extraction worker at a time. Every
 * dependency is injected so the loop can be unit-tested without a database or
 * a real worker thread.
 */

import type { ExtractionResult } from "@wildfires-org/turboplan-document-extraction";
import { getGenericExtractionError } from "@wildfires-org/turboplan-document-extraction/errors";

import { logger as defaultLogger, type Logger } from "../infra/logger";
import type { ExtractionInput } from "./run-extraction-in-worker";

export type ExtractionStatusValue =
  | "pending"
  | "done"
  | "failed"
  | "unsupported";

/** The subset of a document row this loop needs. */
export type PendingDocument = {
  id: string;
  url: string;
  mimeType: string;
  originalFilename: string;
};

export type ExtractionUpdate = {
  extractionStatus: ExtractionStatusValue;
  extractedText?: string | null;
  extractionError?: string | null;
  /** Only ever set for sources with a `summarize` step. */
  summary?: string | null;
};

/** Short key-facts summary of extracted text, or null when there is none. */
export type DocumentSummarizer = (input: {
  text: string;
  filename: string;
}) => Promise<string | null>;

/** One document table the loop drains. */
export type ExtractionSource = {
  /** Used in log lines, e.g. "project" or "organization". */
  name: string;
  fetchPending: (limit: number) => Promise<PendingDocument[]>;
  persist: (id: string, data: ExtractionUpdate) => Promise<unknown>;
  /**
   * Runs after a successful extraction; its result is persisted as `summary`.
   * A throw is logged and stored as `summary: null` — the extraction itself
   * still counts as done.
   */
  summarize?: DocumentSummarizer;
};

export type DocumentExtractionStatus = {
  inFlight: boolean;
  lastRunAt: number | null;
  processed: number;
  failed: number;
};

export type DocumentExtractionService = {
  start(): void;
  stop(): Promise<void>;
  wake(): void;
  getStatus(): DocumentExtractionStatus;
};

export type DocumentExtractionServiceDeps = {
  /** Drained in array order within each pass. */
  sources: ExtractionSource[];
  runExtraction: (input: ExtractionInput) => Promise<ExtractionResult>;
  pollIntervalMs?: number;
  /** Documents fetched per source per pass. */
  batchSize?: number;
  logger?: Logger;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 5;

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const toUpdate = (result: ExtractionResult): ExtractionUpdate => {
  if (result.ok) {
    return {
      extractionStatus: "done",
      extractedText: result.text,
      extractionError: null,
    };
  }

  if (result.reason === "unsupported-format") {
    return {
      extractionStatus: "unsupported",
      extractedText: null,
      extractionError: result.message ?? "Unsupported document format",
    };
  }

  return {
    extractionStatus: "failed",
    extractedText: null,
    extractionError: result.message ?? result.reason,
  };
};

export const createDocumentExtractionService = ({
  sources,
  runExtraction,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  batchSize = DEFAULT_BATCH_SIZE,
  logger = defaultLogger,
}: DocumentExtractionServiceDeps): DocumentExtractionService => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;
  let lastRunAt: number | null = null;
  let processed = 0;
  let failed = 0;

  const summarizeDocument = async (
    source: ExtractionSource,
    summarize: DocumentSummarizer,
    doc: PendingDocument,
    text: string,
  ): Promise<string | null> => {
    try {
      return await summarize({ text, filename: doc.originalFilename });
    } catch (err) {
      // Filename and error message only: the document text never reaches logs.
      logger.log(
        `[${source.name}] Summary failed for ${doc.originalFilename}: ${describeError(err)}`,
        "warning",
      );
      return null;
    }
  };

  const processDocument = async (
    source: ExtractionSource,
    doc: PendingDocument,
  ): Promise<void> => {
    let result: ExtractionResult;
    try {
      result = await runExtraction({ url: doc.url, mimeType: doc.mimeType });
    } catch (err) {
      result = {
        ok: false,
        reason: "extraction-failed",
        message: getGenericExtractionError(doc.mimeType),
        detail: describeError(err),
      };
    }

    const update = toUpdate(result);
    if (result.ok) {
      processed += 1;
      if (source.summarize) {
        update.summary = await summarizeDocument(
          source,
          source.summarize,
          doc,
          result.text,
        );
      }
    } else {
      failed += 1;
      // Only the user-facing message is stored; the raw cause goes to logs.
      const detail = result.detail ? ` (${result.detail})` : "";
      logger.log(
        `[${source.name}] Extraction ${update.extractionStatus} for ${doc.originalFilename}: ${update.extractionError}${detail}`,
        "warning",
      );
    }

    // A persist failure must not abort the rest of the batch — the document
    // stays "pending" and is picked up on a later pass.
    try {
      await source.persist(doc.id, update);
    } catch (err) {
      logger.error(
        `[${source.name}] Failed to persist extraction for ${doc.id}`,
        err,
      );
    }
  };

  const drainSource = async (source: ExtractionSource): Promise<void> => {
    let documents: PendingDocument[];
    try {
      documents = await source.fetchPending(batchSize);
    } catch (err) {
      logger.error(
        `[${source.name}] Failed to load documents pending extraction`,
        err,
      );
      return;
    }

    if (documents.length === 0) {
      return;
    }

    logger.log(
      `[${source.name}] Extracting text for ${documents.length} document(s)`,
      "info",
    );

    for (const doc of documents) {
      // Leave the rest "pending" for the next boot rather than delay shutdown.
      if (stopped) {
        return;
      }
      await processDocument(source, doc);
    }
  };

  const runOnce = async (): Promise<void> => {
    // Sequential on purpose: one worker thread at a time on a 512MB box, so
    // sources take turns instead of running side by side. Each source fails
    // independently — a broken query in one never skips the others.
    for (const source of sources) {
      if (stopped) {
        return;
      }
      await drainSource(source);
    }
  };

  const tick = (): void => {
    if (stopped || inFlight) {
      return;
    }
    lastRunAt = Date.now();
    inFlight = runOnce()
      .catch((err) => {
        logger.error("Document extraction pass failed", err);
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
      // Bounded by the current document: its worker timeout plus, for a
      // summarized source, the summary request timeout.
      await inFlight;
    },

    wake(): void {
      tick();
    },

    getStatus(): DocumentExtractionStatus {
      return {
        inFlight: inFlight !== null,
        lastRunAt,
        processed,
        failed,
      };
    },
  };
};
