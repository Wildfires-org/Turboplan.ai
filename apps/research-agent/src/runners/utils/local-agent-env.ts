import { getModelProviderEnv } from "../../infra/model-provider";
import type { RunnerContext } from "../types";

/**
 * Host variables the agent child process needs to run on a dev machine
 * (resolve `tsx`/`node`/`claude`, find `~/.claude`, write temp files). Anything
 * else in the parent env — AGENT_API_KEY, Modal tokens, DB URLs — must stay out:
 * the agent runs Bash unattended, so its env is readable by prompt-injected
 * commands.
 */
const HOST_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "TERM",
  "NODE_ENV",
] as const;

type LocalAgentServerEnv = Parameters<typeof getModelProviderEnv>[0] & {
  DEBUG_CLAUDE_AGENT_SDK: boolean;
  FIRECRAWL_API_KEY: string;
};

/**
 * Explicit env for the local agent child process. Mirrors what the Modal
 * sandbox receives (see infra/modal-setup.ts and modal-runner.ts) plus the
 * allowlisted host vars above.
 */
export const buildLocalAgentEnv = ({
  hostEnv,
  serverEnv,
  workspacePath,
  context,
}: {
  hostEnv: NodeJS.ProcessEnv;
  serverEnv: LocalAgentServerEnv;
  workspacePath: string;
  context?: RunnerContext;
}): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const key of HOST_ENV_ALLOWLIST) {
    const value = hostEnv[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return {
    ...env,
    ...getModelProviderEnv(serverEnv),
    DEBUG_CLAUDE_AGENT_SDK: serverEnv.DEBUG_CLAUDE_AGENT_SDK ? "true" : "false",
    FIRECRAWL_API_KEY: serverEnv.FIRECRAWL_API_KEY,
    AGENT_CWD: workspacePath,
    AGENT_LOCAL: "true",
    // Unset (not empty) without a run so agent-runtime/env.ts falls back to
    // its default session id.
    ...(context?.runId ? { RUN_ID: context.runId } : {}),
    WEBHOOK_SECRET: context?.webhookSecret ?? "",
    TARGET_API_URL: context?.targetApiUrl ?? "",
  };
};
