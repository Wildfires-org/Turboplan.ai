import { describe, expect, it } from "vitest";

import { buildLocalAgentEnv } from "../../src/runners/utils/local-agent-env";

const serverEnv = {
  ANTHROPIC_API_KEY: "sk-ant-direct",
  OPENROUTER_API_KEY: "",
  CLAUDE_MODEL: "claude-sonnet-4-6",
  DEBUG_CLAUDE_AGENT_SDK: false,
  FIRECRAWL_API_KEY: "fc-key",
};

describe("buildLocalAgentEnv", () => {
  it("passes only allowlisted host vars and never server credentials", () => {
    const env = buildLocalAgentEnv({
      hostEnv: {
        PATH: "/usr/bin",
        HOME: "/home/dev",
        AGENT_API_KEY: "agent-key",
        MODAL_TOKEN_ID: "modal-id",
        MODAL_TOKEN_SECRET: "modal-secret",
        POSTGRES_URL: "postgres://secret",
        OPENROUTER_API_KEY: "sk-or-host",
      },
      serverEnv,
      workspacePath: "/ws",
      context: {
        runId: "run-1",
        webhookSecret: "whsec",
        targetApiUrl: "https://api.example.test",
      },
    });

    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/dev",
      ANTHROPIC_API_KEY: "sk-ant-direct",
      CLAUDE_MODEL: "claude-sonnet-4-6",
      DEBUG_CLAUDE_AGENT_SDK: "false",
      FIRECRAWL_API_KEY: "fc-key",
      AGENT_CWD: "/ws",
      AGENT_LOCAL: "true",
      RUN_ID: "run-1",
      WEBHOOK_SECRET: "whsec",
      TARGET_API_URL: "https://api.example.test",
    });
  });

  it("leaves RUN_ID unset without a run context", () => {
    const env = buildLocalAgentEnv({
      hostEnv: {},
      serverEnv,
      workspacePath: "/ws",
    });

    expect(env).not.toHaveProperty("RUN_ID");
    expect(env.WEBHOOK_SECRET).toBe("");
    expect(env.TARGET_API_URL).toBe("");
  });
});
