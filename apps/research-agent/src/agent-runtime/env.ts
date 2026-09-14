// Standalone env module - can't use @wildfires-org/turboplan-env because
// agent-runtime runs inside a Modal sandbox with a minimal Docker image
// that has no access to monorepo packages.

export type AgentRuntimeEnv = {
  RUN_ID: string;
  AGENT_CWD: string;
  CLAUDE_MODEL: string;
  DEBUG_CLAUDE_AGENT_SDK: boolean;
  AGENT_LOCAL: boolean;
  FIRECRAWL_API_KEY: string;
};

let cached: AgentRuntimeEnv | null = null;

export const getAgentRuntimeEnv = (): AgentRuntimeEnv => {
  if (!cached) {
    cached = {
      RUN_ID: process.env.RUN_ID ?? "runtime-session",
      AGENT_CWD: process.env.AGENT_CWD ?? "/app",
      CLAUDE_MODEL: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5-20250929",
      DEBUG_CLAUDE_AGENT_SDK: process.env.DEBUG_CLAUDE_AGENT_SDK === "true",
      AGENT_LOCAL: process.env.AGENT_LOCAL === "true",
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ?? "",
    };
  }
  return cached;
};
