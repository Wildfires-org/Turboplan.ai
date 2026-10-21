/**
 * Runs `runLetterheadTask` with the real download, renderer and model client.
 * Loaded only by the worker thread's letterhead branch; the SDK, pdf.js and
 * the canvas are imported dynamically so text extraction workers never load
 * them (esbuild hoists static imports of external packages to the top of the
 * worker bundle). The PNG never leaves this thread: only the analysis and the
 * stats are posted back.
 */

import type { LetterheadModelSettings } from "../../infra/model-provider";
import {
  LETTERHEAD_DEADLINE_MS,
  type LetterheadTaskDeps,
  type LetterheadTaskResult,
  type LetterheadWorkerInput,
  runLetterheadTask,
} from "./analysis-task";
import {
  buildLetterheadRequest,
  parseLetterheadMessage,
} from "./letterhead-request";
import { loadHeaderRenderer } from "./render-header";

/** Per attempt; measured 2.9–5.4 s. */
const LETTERHEAD_REQUEST_TIMEOUT_MS = 30_000;
const LETTERHEAD_MAX_RETRIES = 1;

/**
 * The real dependencies of `runLetterheadTask`, libraries loaded up front.
 * The smoke script swaps `download` to read local files.
 */
export const loadLetterheadTaskDeps = async (
  settings: LetterheadModelSettings,
): Promise<Omit<LetterheadTaskDeps, "signal">> => {
  const [{ default: Anthropic }, { downloadDocument }, renderHeader] =
    await Promise.all([
      import("@anthropic-ai/sdk"),
      import("@wildfires-org/turboplan-document-extraction/download"),
      loadHeaderRenderer(),
    ]);

  // OpenRouter only: auth goes via authToken (Authorization: Bearer), and
  // apiKey: null keeps the SDK from picking up ANTHROPIC_API_KEY.
  const client = new Anthropic({
    baseURL: settings.baseURL,
    authToken: settings.authToken,
    apiKey: null,
  });

  return {
    download: (target, signal) => downloadDocument(target, { signal }),
    renderHeader,
    readLetterhead: async (header, signal) => {
      const message = await client.messages.create(
        buildLetterheadRequest(settings.model, header),
        {
          signal,
          timeout: LETTERHEAD_REQUEST_TIMEOUT_MS,
          maxRetries: LETTERHEAD_MAX_RETRIES,
        },
      );
      return parseLetterheadMessage(message);
    },
  };
};

export const runLetterheadInThisThread = async ({
  url,
  settings,
}: LetterheadWorkerInput): Promise<LetterheadTaskResult> => {
  const deps = await loadLetterheadTaskDeps(settings);
  return runLetterheadTask(url, {
    ...deps,
    signal: AbortSignal.timeout(LETTERHEAD_DEADLINE_MS),
  });
};
