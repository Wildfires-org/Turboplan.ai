import { build } from "esbuild";

const sharedConfig = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
};

const buildTargets = {
  server: {
    entryPoints: ["src/app/server.ts"],
    outfile: "dist/app/server.js",
  },
  // Separate bundle on purpose: worker_threads needs a real file on disk, and
  // `run-extraction-in-worker.ts` resolves it as ../documents/extraction-worker.js
  // relative to dist/app/server.js.
  extractionWorker: {
    entryPoints: ["src/documents/extraction-worker.ts"],
    outfile: "dist/documents/extraction-worker.js",
  },
  agent: {
    entryPoints: ["src/agent-runtime/run.ts"],
    outfile: "dist/agent-runtime/run.js",
  },
};

const buildModes = {
  app: ["server", "extractionWorker"],
  agent: ["agent"],
  all: Object.keys(buildTargets),
};

const mode = process.argv[2] ?? "app";
const targets = buildModes[mode];

if (!targets) {
  throw new Error("Invalid build mode. Use: app | agent | all");
}

await Promise.all(
  targets.map((name) =>
    build({
      ...sharedConfig,
      ...buildTargets[name],
    }),
  ),
);
