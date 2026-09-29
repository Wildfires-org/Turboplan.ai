/**
 * Worker-thread entry point for document text extraction.
 *
 * Parsing a PDF is the only genuinely memory-hungry thing this app does, so it
 * runs off the main thread under a hard heap cap (see `run-extraction-in-worker`).
 * A blown cap kills the thread, not the server.
 */

import { parentPort, workerData } from "node:worker_threads";

import {
  type ExtractionResult,
  extractDocumentText,
} from "@wildfires-org/turboplan-document-extraction";

export type ExtractionWorkerData = {
  url: string;
  mimeType: string;
};

const post = (result: ExtractionResult): void => {
  parentPort?.postMessage(result);
};

const main = async (): Promise<void> => {
  const { url, mimeType } = workerData as ExtractionWorkerData;

  try {
    post(await extractDocumentText({ url, mimeType }));
  } catch (err) {
    post({
      ok: false,
      reason: "extraction-failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

// Nothing keeps the event loop alive after the message is posted, so the
// thread exits on its own.
void main();
