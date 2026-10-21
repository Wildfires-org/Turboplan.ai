/**
 * Worker-thread entry point for document text extraction and letterhead
 * analysis.
 *
 * Parsing a PDF is the only genuinely memory-hungry thing this app does, so it
 * runs off the main thread under a hard heap cap (see `run-extraction-in-worker`).
 * A blown cap kills the thread, not the server.
 *
 * One bundle serves both tasks. Each branch loads its libraries with
 * `import()`, so an extraction never loads pdf.js, the canvas or the model
 * SDK, and letterhead analysis never loads the text parsers.
 */

import { parentPort, workerData } from "node:worker_threads";

import { getGenericExtractionError } from "@wildfires-org/turboplan-document-extraction/errors";

import type { LetterheadWorkerInput } from "./letterhead/analysis-task";

export type ExtractionWorkerData =
  | { task: "extract"; url: string; mimeType: string }
  | ({ task: "letterhead" } & LetterheadWorkerInput);

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const runTask = async (data: ExtractionWorkerData): Promise<unknown> => {
  if (data.task === "letterhead") {
    const { runLetterheadInThisThread } = await import(
      "./letterhead/analysis-task-worker"
    );
    return runLetterheadInThisThread(data);
  }
  const { extractDocumentText } = await import(
    "@wildfires-org/turboplan-document-extraction"
  );
  return extractDocumentText({ url: data.url, mimeType: data.mimeType });
};

/** A result even when the task throws, shaped like what each caller expects. */
const failureFor = (data: ExtractionWorkerData, err: unknown) =>
  data.task === "extract"
    ? {
        ok: false,
        reason: "extraction-failed",
        message: getGenericExtractionError(data.mimeType),
        detail: describeError(err),
      }
    : { ok: false, reason: "worker-failed", detail: describeError(err) };

const main = async (): Promise<void> => {
  const data = workerData as ExtractionWorkerData;

  try {
    parentPort?.postMessage(await runTask(data));
  } catch (err) {
    parentPort?.postMessage(failureFor(data, err));
  }
};

// Nothing keeps the event loop alive after the message is posted, so the
// thread exits on its own.
void main();
