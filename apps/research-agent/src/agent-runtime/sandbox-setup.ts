import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { getAgentRuntimeEnv } from "./env";

const env = getAgentRuntimeEnv();

export function ensureRuntimePath(): void {
  if (env.AGENT_LOCAL) return; // PATH already correct on dev machine
  // Claude Agent SDK may spawn `node` by name; ensure PATH exists in sandbox.
  if (!process.env.PATH) {
    process.env.PATH =
      "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
  }
}

export function ensureClaudeHomeFiles(): void {
  if (env.AGENT_LOCAL) return; // ~/.claude already exists on dev machine
  const claudeDir = "/root/.claude";
  const remoteSettingsPath = `${claudeDir}/remote-settings.json`;

  mkdirSync(claudeDir, { recursive: true });
  if (!existsSync(remoteSettingsPath)) {
    writeFileSync(remoteSettingsPath, "{}\n", "utf8");
  }
}
