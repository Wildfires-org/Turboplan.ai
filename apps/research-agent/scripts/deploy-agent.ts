import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ModalClient } from "modal";

import { logger } from "../src/infra/logger";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

// Files deployed to volume (mounted at /app in sandbox)
// __dirname = scripts/, so paths are relative from package root
const files = [
  { remote: "/data/run.js", local: "../dist/agent-runtime/run.js" },
  {
    remote: "/data/.claude/research-agent-spec.md",
    local: "../workspace/.claude/research-agent-spec.md",
  },
  {
    remote: "/data/.claude/CLAUDE.md",
    local: "../workspace/.claude/CLAUDE.md",
  },
  {
    remote: "/data/.claude/skills/project-cataloger/SKILL.md",
    local: "../workspace/.claude/skills/project-cataloger/SKILL.md",
  },
  {
    remote: "/data/.claude/skills/project-bootstrapper/SKILL.md",
    local: "../workspace/.claude/skills/project-bootstrapper/SKILL.md",
  },
];

const modal = new ModalClient();
const app = await modal.apps.fromName("research-agent-sandbox", {
  createIfMissing: true,
});
const image = modal.images.fromRegistry("node:22-slim");
const volume = await modal.volumes.fromName("research-agent-sandbox-code", {
  createIfMissing: true,
});

logger.log("Creating sandbox to populate volume...", "deployment");
const sb = await modal.sandboxes.create(app, image, {
  volumes: { "/data": volume },
});

try {
  // Create directory structure
  const mkdirCataloger = await sb.exec([
    "mkdir",
    "-p",
    "/data/.claude/skills/project-cataloger",
  ]);
  await mkdirCataloger.wait();
  const mkdirBootstrapper = await sb.exec([
    "mkdir",
    "-p",
    "/data/.claude/skills/project-bootstrapper",
  ]);
  await mkdirBootstrapper.wait();

  // Write runtime artifact and support files to volume.
  // Streamed via exec stdin — Modal's legacy sandbox filesystem API
  // (sb.open/write) was removed server-side.
  for (const { remote, local } of files) {
    const content = read(local);
    const proc = await sb.exec(["sh", "-c", `cat > ${remote}`], {
      mode: "text",
    });
    await proc.stdin.writeText(content);
    await proc.stdin.close();
    const exitCode = await proc.wait();
    if (exitCode !== 0) {
      throw new Error(`Failed to write ${remote} (exit code ${exitCode})`);
    }
    logger.log(`Wrote ${remote}`, "deployment");
  }

  logger.log("Volume 'research-agent-sandbox-code' is ready", "success");
} finally {
  await sb.terminate();
}
