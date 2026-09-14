import { build } from "esbuild";

const sharedConfig = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
};

const buildTargets = {
  app: {
    entryPoints: ["src/app/server.ts"],
    outfile: "dist/app/server.js",
  },
  agent: {
    entryPoints: ["src/agent-runtime/run.ts"],
    outfile: "dist/agent-runtime/run.js",
  },
};

const mode = process.argv[2] ?? "app";

if (mode === "all") {
  await Promise.all(
    Object.values(buildTargets).map((target) =>
      build({
        ...sharedConfig,
        ...target,
      }),
    ),
  );
} else if (mode in buildTargets) {
  await build({
    ...sharedConfig,
    ...buildTargets[mode],
  });
} else {
  throw new Error("Invalid build mode. Use: app | agent | all");
}
