// Run by word-fields.test.ts in a child process: as the main thread it spawns
// itself as a worker with the research agent's resource limits and prints the
// outcome as JSON; as the worker it pushes a flood-shaped body through the
// guarded word-extractor. A fatal V8 abort inside the worker kills this whole
// process (exit 134), which the test sees as a failure instead of losing its
// own runner.
import { createRequire } from "node:module";
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from "node:worker_threads";

// Mirrors DEFAULT_MAX_OLD_GENERATION_MB / MAX_YOUNG_GENERATION_MB in
// apps/research-agent/src/documents/run-extraction-in-worker.ts.
const RESOURCE_LIMITS = {
  maxOldGenerationSizeMb: 256,
  maxYoungGenerationSizeMb: 48,
};

// Each about 16-25M characters: well inside the 50MB download cap.
const SHAPES: Record<string, () => string> = {
  // Stray field ends: the shape that used to abort the process.
  "stray-ends": () => "a\x15".repeat(12_500_000),
  // Complete fields, each one becoming NULs for clean() to delete.
  fields: () => "\x13x\x15".repeat(4_000_000),
  // Empty paragraphs: aborts the process in word-extractor alone.
  paragraphs: () => "a\r".repeat(8_000_000),
};

type Outcome =
  | { outcome: "done"; bodyLength: number }
  | { outcome: "rejected"; message: string }
  | { outcome: "error"; code?: string };

const runInWorker = async (shape: string) => {
  // The worker does not get the tsx loader, so load the TypeScript source
  // through its API.
  const { tsImport } = await import("tsx/esm/api");
  const { installFieldCodeGuard } = (await tsImport(
    "../../src/word-fields.ts",
    import.meta.url,
  )) as typeof import("../../src/word-fields");
  installFieldCodeGuard();

  const require = createRequire(import.meta.url);
  const WordOleExtractor = require("word-extractor/lib/word-ole-extractor.js");

  const text = SHAPES[shape]();
  const extractor = new WordOleExtractor();
  extractor._pieces = [
    { startCp: 0, endCp: text.length, length: text.length, text },
  ];
  extractor._boundaries = { ccpText: text.length };

  let result: Outcome;
  try {
    result = {
      outcome: "done",
      bodyLength: extractor.buildDocument().getBody().length,
    };
  } catch (error) {
    result = { outcome: "rejected", message: (error as Error).message };
  }
  parentPort?.postMessage(result);
};

if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url), {
    workerData: process.argv[2],
    resourceLimits: RESOURCE_LIMITS,
  });
  worker.once("message", (result: Outcome) => {
    console.log(JSON.stringify(result));
  });
  worker.once("error", (error: NodeJS.ErrnoException) => {
    console.log(JSON.stringify({ outcome: "error", code: error.code }));
  });
} else {
  void runInWorker(workerData as string);
}
