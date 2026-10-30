import "./instrument";

import { serve } from "@hono/node-server";

import {
  getOptionalR2Env,
  getResearchAgentEnv,
} from "@wildfires-org/turboplan-env";

import { createDocumentExtraction } from "../documents/create-document-extraction";
import { createLetterheadAnalysis } from "../documents/letterhead/create-letterhead-analysis";
import { createR2LogoStore } from "../documents/letterhead/logo-storage";
import { createDocumentSummarizer } from "../documents/summarize-document";
import { createWorkerGate } from "../documents/worker-gate";
import { createFastModelClient } from "../infra/fast-model-client";
import { logger } from "../infra/logger";
import { getModalResources } from "../infra/modal-setup";
import {
  getFastModelClientOptions,
  getFastModelId,
  getLetterheadModelSettings,
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

  // One fast-model client, shared by memory keyword extraction and document
  // summaries. Null when CLAUDE_FAST_MODEL is unset.
  const fastModelId = getFastModelId(env);
  const fastModelClient = fastModelId
    ? createFastModelClient(fastModelId, getFastModelClientOptions(env))
    : null;

  const memoryService = initMemoryService(fastModelClient);
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

  const summarizeDocument = createDocumentSummarizer(fastModelClient);
  logger.log(
    summarizeDocument
      ? `Organization document summaries enabled (${fastModelId})`
      : "Organization document summaries disabled (CLAUDE_FAST_MODEL unset)",
    summarizeDocument ? "success" : "warning",
  );
  // One document worker thread at a time across both loops below: two side
  // by side would not fit the 512MB machine.
  const documentWorkerGate = createWorkerGate();
  const documentExtraction = createDocumentExtraction({
    summarize: summarizeDocument,
    workerGate: documentWorkerGate,
  });
  // Letterhead analysis of uploaded PDFs, a second loop beside extraction,
  // through OpenRouter only. Off: no loop, documents stay pending.
  const letterheadSettings = getLetterheadModelSettings(env);
  const letterheadLogoStore = createR2LogoStore(getOptionalR2Env());
  const letterheadAnalysis = createLetterheadAnalysis(letterheadSettings, {
    storeLogo: letterheadLogoStore,
    workerGate: documentWorkerGate,
  });
  logger.log(
    letterheadSettings
      ? `Letterhead analysis enabled (${letterheadSettings.model} via openrouter, logos ${letterheadLogoStore ? "stored in R2" : "not stored: R2 credentials unset"})`
      : "Letterhead analysis disabled (needs OPENROUTER_API_KEY and CLAUDE_LETTERHEAD_MODEL or CLAUDE_FAST_MODEL; CLAUDE_LETTERHEAD_MODEL=off turns it off)",
    letterheadSettings && letterheadLogoStore ? "success" : "warning",
  );

  registerGracefulShutdown(runManager, [
    { name: "document extraction", loop: documentExtraction },
    ...(letterheadAnalysis
      ? [{ name: "letterhead analysis", loop: letterheadAnalysis }]
      : []),
  ]);

  const app = createRouter(env, runManager, documentExtraction);

  logger.log(
    `Agent server listening on :${env.PORT} (${env.AGENT_LOCAL ? "local" : "modal"})`,
    "server",
  );
  serve({ fetch: app.fetch, port: env.PORT });

  documentExtraction.start();
  logger.log("Document text extraction loop started", "success");
  if (letterheadAnalysis) {
    letterheadAnalysis.start();
    logger.log("Letterhead analysis loop started", "success");
  }

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
