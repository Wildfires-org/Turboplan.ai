/**
 * Runs `extractDocumentText` in a worker thread with a hard heap cap.
 *
 * The Fly VM has 512MB total; a runaway PDF must not take the HTTP server with
 * it. Every failure mode (throw, OOM, silent exit, timeout) is normalised into
 * an `ExtractionResult` so callers never have to try/catch.
 */

import { Worker } from "node:worker_threads";

// Types and the light subpaths only: the root entry loads the parsers, which
// belong in the worker, not in the server's main thread.
import type { ExtractionResult } from "@wildfires-org/turboplan-document-extraction";
import {
  getGenericExtractionError,
  getResaveHint,
} from "@wildfires-org/turboplan-document-extraction/errors";
import { DOC_MIME } from "@wildfires-org/turboplan-document-extraction/mime";

export type ExtractionInput = {
  url: string;
  mimeType: string;
};

export type RunExtractionOptions = {
  timeoutMs?: number;
  maxOldGenerationSizeMb?: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;
/**
 * Legacy .doc parsing has super-linear paths a crafted file can hit, and the
 * extraction queue is global and sequential, so a .doc gets far less time
 * than a PDF. A real one downloads and parses in a few seconds. The budget
 * also covers the download, so it stays well above the extractor's 30s fetch
 * timeout: a slow download then fails as a download, not as "took too long".
 */
const LEGACY_DOC_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_OLD_GENERATION_MB = 256;
const MAX_YOUNG_GENERATION_MB = 48;

/** The worker's own failure: user-facing message, raw cause for the logs. */
const failure = (message: string, detail?: string): ExtractionResult => ({
  ok: false,
  reason: "extraction-failed",
  message,
  ...(detail !== undefined ? { detail } : {}),
});

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const resolveExtractionTimeoutMs = (mimeType: string): number =>
  mimeType.toLowerCase().trim() === DOC_MIME
    ? LEGACY_DOC_TIMEOUT_MS
    : DEFAULT_TIMEOUT_MS;

const isOutOfMemoryError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  (err as NodeJS.ErrnoException).code === "ERR_WORKER_OUT_OF_MEMORY";

/**
 * Locate the worker entry file.
 *
 * Built (esbuild `app` mode): this module is inlined into `dist/app/server.js`,
 * while the worker is a separate bundle at `dist/documents/extraction-worker.js`
 * — hence the climb out of `dist/app/`.
 *
 * Dev (`tsx watch`) and vitest: the module runs from `src/documents/*.ts` and
 * the worker is its `.ts` sibling. The extension of `import.meta.url` is what
 * tells the two apart.
 */
const resolveWorkerPath = (): URL => {
  if (import.meta.url.endsWith(".ts")) {
    return new URL("./extraction-worker.ts", import.meta.url);
  }
  return new URL("../documents/extraction-worker.js", import.meta.url);
};

export const runExtractionInWorker = (
  input: ExtractionInput,
  {
    timeoutMs = resolveExtractionTimeoutMs(input.mimeType),
    maxOldGenerationSizeMb = DEFAULT_MAX_OLD_GENERATION_MB,
  }: RunExtractionOptions = {},
): Promise<ExtractionResult> =>
  new Promise<ExtractionResult>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(resolveWorkerPath(), {
        workerData: input,
        resourceLimits: {
          maxOldGenerationSizeMb,
          maxYoungGenerationSizeMb: MAX_YOUNG_GENERATION_MB,
        },
      });
    } catch (err) {
      resolve(
        failure(getGenericExtractionError(input.mimeType), describeError(err)),
      );
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (result: ExtractionResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve(result);
    };

    timer = setTimeout(() => {
      void worker.terminate();
      settle(
        failure(
          `Reading this file took too long. ${getResaveHint(input.mimeType)}`,
          `Extraction timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
    timer.unref?.();

    worker.on("message", (result: ExtractionResult) => {
      settle(result);
      void worker.terminate();
    });

    worker.on("error", (err: unknown) => {
      settle(
        failure(
          isOutOfMemoryError(err)
            ? `This file is too large or complex to read. ${getResaveHint(input.mimeType)}`
            : getGenericExtractionError(input.mimeType),
          describeError(err),
        ),
      );
    });

    worker.on("exit", () => {
      settle(
        failure(
          getGenericExtractionError(input.mimeType),
          "Extraction worker exited without a result",
        ),
      );
    });
  });
