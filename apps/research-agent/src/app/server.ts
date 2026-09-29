import "./instrument";

import { serve } from "@hono/node-server";

import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

import { createDocumentExtraction } from "../documents/create-document-extraction";
import { logger } from "../infra/logger";
import { getModalResources } from "../infra/modal-setup";
import {
  getFastModelClientOptions,
  getFastModelId,
  getModelProviderName,
} from "../infra/model-provider";
import { createTargetApiClient } from "../infra/target-api-client";
import { initMemoryService } from "../memory";
import { createLocalRunner } from "../runners/local-runner";
import { createModalRunner } from "../runners/modal-runner";
import { reattachOrphanedRuns } from "../runs/reattach-orphaned-runs";
import { createRunManager } from "../runs/run-manager";
import { createRunRepository } from "../runs/run-repository";
import { registerGracefulShutdown } from "./graceful-shutdown";
import { createRouter } from "./router";

async function main(): Promise<void> {
  const env = getResearchAgentEnv();

  const repository = createRunRepository();

  logger.log(
    `Model provider: ${getModelProviderName(env)} (key value not logged)`,
    "server",
  );

  const memoryService = initMemoryService(
    getFastModelId(env),
    getFastModelClientOptions(env),
  );
  logger.log("Memory mechanism enabled", "success");

  const modalResources = env.AGENT_LOCAL ? null : await getModalResources();
  const runner = env.AGENT_LOCAL
    ? createLocalRunner()
    : createModalRunner(modalResources!);

  const targetApiClient = createTargetApiClient();
  const runManager = createRunManager(
    memoryService,
    runner,
    repository,
    targetApiClient,
  );

  const documentExtraction = createDocumentExtraction();

  registerGracefulShutdown(runManager, documentExtraction);

  const app = createRouter(env, runManager, documentExtraction);

  logger.log(
    `Agent server listening on :${env.PORT} (${env.AGENT_LOCAL ? "local" : "modal"})`,
    "server",
  );
  serve({ fetch: app.fetch, port: env.PORT });

  documentExtraction.start();
  logger.log("Document text extraction loop started", "success");

  // Reconcile orphaned runs from previous server instance (non-blocking)
  void reattachOrphanedRuns(
    repository,
    runManager,
    modalResources?.client ?? null,
  );
}

main().catch((err) => {
  logger.error("Failed to start", err);
  process.exit(1);
});
