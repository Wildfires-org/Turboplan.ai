import type { ResearchAgentEnvType } from "@wildfires-org/turboplan-env";

import { createRouter } from "../../src/app/router";
import type { DocumentExtractionService } from "../../src/documents/extraction-service";
import type { TargetApiClient } from "../../src/infra/target-api-client";
import type { MemoryService } from "../../src/memory";
import type { AgentRunner } from "../../src/runners/types";
import { createRunManager, type RunManager } from "../../src/runs/run-manager";
import type { RunRepository } from "../../src/runs/run-repository";

export const TEST_ENV: ResearchAgentEnvType = {
  AGENT_API_KEY: "test-api-key",
  TARGET_API_ROOT_PATH: "/api/webhooks/research-agent",
  ALLOWED_ORIGINS: ["*"],
  CLAUDE_FAST_MODEL: null,
  PORT: 3003,
  AGENT_LOCAL: true,
  RUN_TIMEOUT_MS: 600000,
  LOG_STACK_TRACES: true,
  CLAUDE_MODEL: "claude-sonnet-4-6",
  DEBUG_CLAUDE_AGENT_SDK: false,
  ANTHROPIC_API_KEY: "",
  OPENROUTER_API_KEY: "",
  MODAL_TOKEN_ID: "",
  MODAL_TOKEN_SECRET: "",
  FIRECRAWL_API_KEY: "",
};

export function createMemoryServiceStub(): MemoryService {
  return {
    async getRelevantForPrompt() {
      return [];
    },
    async processRunResult(result) {
      return { cleanResult: result, savedCount: 0 };
    },
  };
}

export function createDocumentExtractionStub(): DocumentExtractionService {
  return {
    start: () => {},
    stop: async () => {},
    wake: () => {},
    getStatus: () => ({
      inFlight: false,
      lastRunAt: null,
      processed: 0,
      failed: 0,
    }),
  };
}

export function createTestApp(
  runner: AgentRunner,
  repository: RunRepository,
  memoryService: MemoryService = createMemoryServiceStub(),
): {
  app: ReturnType<typeof createRouter>;
  runManager: RunManager;
} {
  const targetApiClient: TargetApiClient = {
    request: async () => new Response(),
    sendProgress: async () => {},
  };
  const runManager = createRunManager(
    memoryService,
    runner,
    repository,
    targetApiClient,
  );
  const app = createRouter(
    TEST_ENV,
    runManager,
    createDocumentExtractionStub(),
  );
  return { app, runManager };
}

export function authHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "x-api-key": TEST_ENV.AGENT_API_KEY,
    "content-type": "application/json",
    ...extra,
  });
}
