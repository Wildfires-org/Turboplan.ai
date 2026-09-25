/**
 * Background poller that turns pending project documents into extracted text.
 *
 * Every dependency is injected so the loop can be unit-tested without a
 * database or a real worker thread.
 */

import type { ExtractionResult } from "@wildfires-org/turboplan-document-extraction";

import { logger as defaultLogger, type Logger } from "../infra/logger";
import type { ExtractionInput } from "./run-extraction-in-worker";

export type ExtractionStatusValue =
  | "pending"
  | "done"
  | "failed"
  | "unsupported";

/** The subset of a project document this loop needs. */
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
  fetchPending: (limit: number) => Promise<PendingDocument[]>;
  persist: (id: string, data: ExtractionUpdate) => Promise<unknown>;
  runExtraction: (input: ExtractionInput) => Promise<ExtractionResult>;
  pollIntervalMs?: number;
  batchSize?: number;
  logger?: Logger;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 5;

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
  fetchPending,
  persist,
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

  const processDocument = async (doc: PendingDocument): Promise<void> => {
    let result: ExtractionResult;
    try {
      result = await runExtraction({ url: doc.url, mimeType: doc.mimeType });
    } catch (err) {
      result = {
        ok: false,
        reason: "extraction-failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }

    const update = toUpdate(result);
    if (update.extractionStatus === "done") {
      processed += 1;
    } else {
      failed += 1;
      logger.log(
        `Extraction ${update.extractionStatus} for ${doc.originalFilename}: ${update.extractionError}`,
        "warning",
      );
    }

    // A persist failure must not abort the rest of the batch — the document
    // stays "pending" and is picked up on a later pass.
    try {
      await persist(doc.id, update);
    } catch (err) {
      logger.error(`Failed to persist extraction for ${doc.id}`, err);
    }
  };

  const runOnce = async (): Promise<void> => {
    let documents: PendingDocument[];
    try {
      documents = await fetchPending(batchSize);
    } catch (err) {
      logger.error("Failed to load documents pending extraction", err);
      return;
    }

    if (documents.length === 0) {
      return;
    }

    logger.log(`Extracting text for ${documents.length} document(s)`, "info");

    // Sequential on purpose: one worker thread at a time on a 512MB box.
    for (const doc of documents) {
      await processDocument(doc);
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
      // Bounded by the per-document worker timeout.
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
