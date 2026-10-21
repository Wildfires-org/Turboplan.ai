/**
 * Runs `extractDocumentText` — and letterhead analysis — in a worker thread
 * with a hard heap cap.
 *
 * The Fly VM has 512MB total; a runaway PDF must not take the HTTP server with
 * it. Every failure mode (throw, OOM, silent exit, timeout) is normalised into
 * a result so callers never have to try/catch.
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

import type { ExtractionWorkerData } from "./extraction-worker";
import type {
  LetterheadTaskResult,
  LetterheadWorkerInput,
} from "./letterhead/analysis-task";

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
/**
 * Letterhead analysis renders one header: its worker peaks at ~25–40 MB of
 * heap on real letters and 300 dpi scans, and every sample still rendered
 * under a 32 MB cap (24 MB ran out). Twice that leaves room for the model
 * request and the grid. Images are decoded outside the heap (see
 * `PDF_MAX_IMAGE_PIXELS` in letterhead/render-header.ts).
 */
export const LETTERHEAD_MAX_OLD_GENERATION_MB = 64;
const MAX_YOUNG_GENERATION_MB = 48;
/**
 * Letterhead analysis: download, a page render (~0.2–3 s) and one vision call
 * (~3–5 s). The task stops itself at 50 s, so this only fires when stuck.
 */
export const LETTERHEAD_WORKER_TIMEOUT_MS = 60_000;

/** The worker's own failure: user-facing message, raw cause for the logs. */
const extractionFailure = (
  message: string,
  detail?: string,
): ExtractionResult => ({
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
 * Dev (`tsx watch`, scripts) and vitest: the module runs from
 * `src/documents/*.ts`, and the worker starts from a small bootstrap that
 * registers tsx inside the worker thread before loading
 * `extraction-worker.ts`. tsx's hooks do not reach worker threads on their
 * own, and Node's built-in type stripping would then reject the worker's
 * extensionless relative imports. The extension of `import.meta.url` is what
 * tells built from dev apart.
 */
const resolveWorkerPath = (): URL => {
  if (import.meta.url.endsWith(".ts")) {
    return new URL("./extraction-worker-dev.mjs", import.meta.url);
  }
  return new URL("../documents/extraction-worker.js", import.meta.url);
};

type WorkerFailure =
  | { kind: "timeout" }
  | { kind: "out-of-memory"; detail: string }
  | { kind: "crashed"; detail: string }
  | { kind: "no-result" };

/**
 * Spawns the worker for one task and settles exactly once: with the worker's
 * message, or with `onFailure` for a spawn error, crash, OOM, silent exit or
 * timeout. A timeout terminates the worker, which also aborts its requests.
 */
const spawnWorkerTask = <T>({
  workerData,
  timeoutMs,
  maxOldGenerationSizeMb,
  onFailure,
}: {
  workerData: ExtractionWorkerData;
  timeoutMs: number;
  maxOldGenerationSizeMb: number;
  onFailure: (failure: WorkerFailure) => T;
}): Promise<T> =>
  new Promise<T>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(resolveWorkerPath(), {
        workerData,
        resourceLimits: {
          maxOldGenerationSizeMb,
          maxYoungGenerationSizeMb: MAX_YOUNG_GENERATION_MB,
        },
      });
    } catch (err) {
      resolve(onFailure({ kind: "crashed", detail: describeError(err) }));
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (result: T): void => {
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
      settle(onFailure({ kind: "timeout" }));
    }, timeoutMs);
    timer.unref?.();

    worker.on("message", (result: T) => {
      settle(result);
      void worker.terminate();
    });

    worker.on("error", (err: unknown) => {
      settle(
        onFailure(
          isOutOfMemoryError(err)
            ? { kind: "out-of-memory", detail: describeError(err) }
            : { kind: "crashed", detail: describeError(err) },
        ),
      );
    });

    worker.on("exit", () => {
      settle(onFailure({ kind: "no-result" }));
    });
  });

export const runExtractionInWorker = (
  input: ExtractionInput,
  {
    timeoutMs = resolveExtractionTimeoutMs(input.mimeType),
    maxOldGenerationSizeMb = DEFAULT_MAX_OLD_GENERATION_MB,
  }: RunExtractionOptions = {},
): Promise<ExtractionResult> =>
  spawnWorkerTask<ExtractionResult>({
    workerData: { task: "extract", url: input.url, mimeType: input.mimeType },
    timeoutMs,
    maxOldGenerationSizeMb,
    onFailure: (failure) => {
      switch (failure.kind) {
        case "timeout":
          return extractionFailure(
            `Reading this file took too long. ${getResaveHint(input.mimeType)}`,
            `Extraction timed out after ${timeoutMs}ms`,
          );
        case "out-of-memory":
          return extractionFailure(
            `This file is too large or complex to read. ${getResaveHint(input.mimeType)}`,
            failure.detail,
          );
        case "crashed":
          return extractionFailure(
            getGenericExtractionError(input.mimeType),
            failure.detail,
          );
        case "no-result":
          return extractionFailure(
            getGenericExtractionError(input.mimeType),
            "Extraction worker exited without a result",
          );
      }
    },
  });

/** Letterhead analysis of a PDF (see `letterhead/analysis-task.ts`). */
export const runLetterheadInWorker = (
  input: LetterheadWorkerInput,
  {
    timeoutMs = LETTERHEAD_WORKER_TIMEOUT_MS,
    maxOldGenerationSizeMb = LETTERHEAD_MAX_OLD_GENERATION_MB,
  }: RunExtractionOptions = {},
): Promise<LetterheadTaskResult> =>
  spawnWorkerTask<LetterheadTaskResult>({
    workerData: { task: "letterhead", ...input },
    timeoutMs,
    maxOldGenerationSizeMb,
    onFailure: (failure) => {
      switch (failure.kind) {
        case "timeout":
          return {
            ok: false,
            reason: "timeout",
            detail: `Letterhead analysis timed out after ${timeoutMs}ms`,
          };
        case "out-of-memory":
        case "crashed":
          return { ok: false, reason: "worker-failed", detail: failure.detail };
        case "no-result":
          return {
            ok: false,
            reason: "worker-failed",
            detail: "Letterhead worker exited without a result",
          };
      }
    },
  });
