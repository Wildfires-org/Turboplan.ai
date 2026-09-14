import type { Context } from "hono";

import { logger } from "../../infra/logger";
import type { RunManager } from "../../runs/run-manager";
import { buildRuntimeContext } from "../../runs/utils/build-runtime-context";
import type { ResearchAgentContext } from "../types";
import { joinBaseAndPath } from "../utils/join-base-and-path";
import { assertPublicTarget } from "../utils/resolve-guard";
import { validateResumeBody } from "../validation";

export function createResumeRunHandler(runManager: RunManager) {
  return async (c: Context<ResearchAgentContext>): Promise<Response> => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const { ok, data, error } = validateResumeBody(body);
    if (!ok) {
      return c.json({ error }, 400);
    }

    const runId = c.req.param("runId");
    if (!runId) {
      return c.json({ error: "Missing runId" }, 400);
    }

    if (data.targetApiUrl) {
      const resolveError = await assertPublicTarget(data.targetApiUrl);
      if (resolveError) {
        return c.json({ error: resolveError }, 400);
      }
    }

    const targetApiUrl = data.targetApiUrl
      ? joinBaseAndPath(data.targetApiUrl, c.get("env").TARGET_API_ROOT_PATH)
      : undefined;

    let runtimeContext: string | undefined;
    if (targetApiUrl) {
      logger.log(`resume targetApiUrl=${targetApiUrl}`, "target-api");
      runtimeContext = buildRuntimeContext({
        targetApiUrl,
        webhookSecret: data.webhookSecret ?? "",
      });
    }

    const result = await runManager.resumeRun(runId, {
      prompt: data.prompt,
      webhookSecret: data.webhookSecret,
      runtimeContext,
      targetApiUrl,
    });
    if (result.ok) {
      return c.json(
        {
          success: true,
          runId: result.runId,
          status: result.status,
          message: "Run resumed",
        },
        202,
      );
    }

    if (result.reason === "run_not_found") {
      return c.json({ error: "Run not found" }, 404);
    }

    if (result.reason === "prompt_required_for_completed") {
      return c.json({ error: result.message, status: result.status }, 400);
    }

    return c.json({ error: result.message, status: result.status }, 409);
  };
}
