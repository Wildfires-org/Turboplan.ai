/**
 * Smoke test for letterhead analysis: each PDF through the real renderer, the
 * real vision call on OpenRouter and the grid code.
 *
 *   pnpm exec tsx --env-file=.env.local scripts/letterhead-smoke.ts <pdf-path-or-https-url...>
 *
 * An https URL runs the real worker thread end to end (download included). A
 * local path cannot go through `downloadDocument` (https only), so its bytes
 * are read from disk and the same task runs in this process with the same
 * renderer and model call. About $0.004 per PDF. Prints the grid (its text
 * included — this is a developer tool), timings and tokens, never the key, and
 * writes each logo crop next to the script's working directory as
 * `<file>-logo-<n>.png`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

import {
  formatLetterheadLogLine,
  toStoredGrid,
} from "../src/documents/letterhead/analysis-service";
import {
  LETTERHEAD_DEADLINE_MS,
  type LetterheadTaskResult,
  runLetterheadTask,
} from "../src/documents/letterhead/analysis-task";
import { loadLetterheadTaskDeps } from "../src/documents/letterhead/analysis-task-worker";
import { runLetterheadInWorker } from "../src/documents/run-extraction-in-worker";
import { logger } from "../src/infra/logger";
import {
  getLetterheadModelSettings,
  type LetterheadModelSettings,
} from "../src/infra/model-provider";

// US Letter's width in points: the grid's base text size (a fraction of the
// page's width) is also printed as the size it would be on a letter.
const LETTER_WIDTH_PT = 612;

const describeFontSize = (fontSize: number | undefined): string =>
  fontSize === undefined
    ? "base text size unknown"
    : `base text size ${fontSize} of the page width (${(fontSize * LETTER_WIDTH_PT).toFixed(1)} pt on a ${LETTER_WIDTH_PT} pt-wide page)`;

const analyzeLocalFile = async (
  path: string,
  settings: LetterheadModelSettings,
): Promise<LetterheadTaskResult> => {
  const deps = await loadLetterheadTaskDeps(settings);
  return runLetterheadTask(path, {
    ...deps,
    download: async () => ({ ok: true, buffer: await readFile(path) }),
    signal: AbortSignal.timeout(LETTERHEAD_DEADLINE_MS),
  });
};

const main = async (): Promise<void> => {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    logger.log(
      "Usage: tsx --env-file=.env.local scripts/letterhead-smoke.ts <pdf-path-or-https-url...>",
      "error",
    );
    process.exit(1);
  }

  const settings = getLetterheadModelSettings(getResearchAgentEnv());
  if (!settings) {
    logger.log(
      "Letterhead analysis is disabled: set OPENROUTER_API_KEY and CLAUDE_LETTERHEAD_MODEL or CLAUDE_FAST_MODEL",
      "error",
    );
    process.exit(1);
  }
  logger.log(`Letterhead model: ${settings.model} via openrouter`, "info");

  for (const target of targets) {
    const isUrl = target.startsWith("https://");
    const startedAt = Date.now();
    const result = isUrl
      ? await runLetterheadInWorker({ url: target, settings })
      : await analyzeLocalFile(target, settings);
    // The last path segment, never a query string or a decoded separator, so
    // the logo files below land in the working directory.
    const filename = isUrl
      ? basename(new URL(target).pathname) || "document.pdf"
      : basename(target);

    console.log(formatLetterheadLogLine(filename, result));
    if (result.ok && result.analysis.grid) {
      console.log(describeFontSize(result.analysis.grid.fontSize));
    }
    // Logo crops land on disk; the printed grid's logo `key`s are their file
    // names (the service stores an R2 object key there).
    const grid =
      result.ok && result.analysis.grid
        ? await toStoredGrid(result.analysis.grid, async (png, index) => {
            const file = `${filename}-logo-${index}.png`;
            await writeFile(file, png);
            return file;
          })
        : null;
    console.log(
      JSON.stringify({
        file: filename,
        mode: isUrl ? "worker" : "in-process",
        grid,
        ...(result.stats ?? {}),
        totalMs: Date.now() - startedAt,
        ...(result.ok ? {} : { reason: result.reason, detail: result.detail }),
      }),
    );
  }
  // Main thread and worker threads share one process.
  console.log(`maxRssMb ${Math.round(process.resourceUsage().maxRSS / 1024)}`);
};

main().catch((err) => {
  logger.error("Letterhead smoke test failed", err);
  process.exit(1);
});
