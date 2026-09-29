/**
 * Hono router for research-agent-sandbox.
 * Sole place for routes and middleware.
 */

import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ResearchAgentEnvType } from "@wildfires-org/turboplan-env";

import type { DocumentExtractionService } from "../documents/extraction-service";
import { createAddContextHandler } from "../http/handlers/add-context";
import { createCancelRunHandler } from "../http/handlers/cancel-run";
import { createExtractDocumentsHandler } from "../http/handlers/extract-documents";
import { createGetRunStatusHandler } from "../http/handlers/get-run-status";
import { createResumeRunHandler } from "../http/handlers/resume-run";
import { createRunAgentHandler } from "../http/handlers/run-agent";
import {
  createApiKeyAuthMiddleware,
  createOriginGuardMiddleware,
} from "../http/middlewares";
import type { ResearchAgentContext } from "../http/types";
import { logger } from "../infra/logger";
import type { RunManager } from "../runs/run-manager";

export const createRouter = (
  env: ResearchAgentEnvType,
  runManager: RunManager,
  documentExtraction: DocumentExtractionService,
): Hono<ResearchAgentContext> => {
  const app = new Hono<ResearchAgentContext>();

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    logger.error("Unhandled error", err);
    // No-ops when Sentry is not initialized (SENTRY_DSN unset)
    Sentry.withScope((scope) => {
      scope.setContext("request", {
        path: c.req.path,
        method: c.req.method,
      });
      Sentry.captureException(err);
    });
    return c.json({ error: "Internal Server Error" }, 500);
  });

  // Preflight: OPTIONS requests to /api/* return 204 (no API key required)
  app.options("/api/*", (c) => c.newResponse(null, { status: 204 }));

  // Middleware chain: guard → env → auth
  app.use("/api/agent/*", createOriginGuardMiddleware(env.ALLOWED_ORIGINS));
  app.use("/api/documents/*", createOriginGuardMiddleware(env.ALLOWED_ORIGINS));
  app.use("/api/agent/*", async (c, next) => {
    c.set("env", env);
    await next();
  });

  // API key auth for all protected routes (everything except /health)
  const apiKeyAuth = createApiKeyAuthMiddleware(env.AGENT_API_KEY);
  app.use("/api/*", apiKeyAuth);

  // Health endpoints
  app.get("/health", async (c) => {
    const runComponents = await runManager.healthCheck();
    const isHealthy = runComponents.db !== "unavailable";
    const components = {
      ...runComponents,
      documentExtraction: documentExtraction.getStatus(),
    };
    return c.json(
      { status: isHealthy ? "ok" : "degraded", ts: Date.now(), components },
      isHealthy ? 200 : 503,
    );
  });

  // Agent endpoints — handlers created once, not per-request
  const runAgentHandler = createRunAgentHandler(runManager);
  const getRunStatusHandler = createGetRunStatusHandler(runManager);
  const cancelRunHandler = createCancelRunHandler(runManager);
  const addContextHandler = createAddContextHandler(runManager);
  const resumeRunHandler = createResumeRunHandler(runManager);

  app.post("/api/agent/run", runAgentHandler);
  app.get("/api/agent/run/:runId", getRunStatusHandler);
  app.post("/api/agent/run/:runId/cancel", cancelRunHandler);
  app.post("/api/agent/run/:runId/add-context", addContextHandler);
  app.post("/api/agent/run/:runId/resume", resumeRunHandler);

  // Document endpoints
  app.post(
    "/api/documents/extract",
    createExtractDocumentsHandler(documentExtraction),
  );

  // 404 handler
  app.notFound((c) => c.json({ error: "Not Found" }, 404));

  return app;
};
