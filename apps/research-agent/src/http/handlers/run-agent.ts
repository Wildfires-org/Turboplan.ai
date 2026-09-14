import type { Context } from "hono";

import { logger } from "../../infra/logger";
import type { RunManager } from "../../runs/run-manager";
import { buildRuntimeContext } from "../../runs/utils/build-runtime-context";
import type { ResearchAgentContext } from "../types";
import { joinBaseAndPath } from "../utils/join-base-and-path";
import { assertPublicTarget } from "../utils/resolve-guard";
import { validateRunBody } from "../validation";

export function createRunAgentHandler(runManager: RunManager) {
  return async (c: Context<ResearchAgentContext>): Promise<Response> => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const env = c.get("env");

    const { ok, data, error } = validateRunBody(body);
    if (!ok) {
      return c.json({ error }, 400);
    }

    // The schema guard only sees the hostname; this resolves it so a
    // public-looking name that points into private space is rejected too.
    const resolveError = await assertPublicTarget(data.targetApiUrl);
    if (resolveError) {
      return c.json({ error: resolveError }, 400);
    }

    const targetApiUrl = joinBaseAndPath(
      data.targetApiUrl,
      env.TARGET_API_ROOT_PATH,
    );
    logger.log(`targetApiUrl=${targetApiUrl}`, "target-api");

    const relevantMemories = await runManager.getRelevantMemories(data.prompt);

    const runtimeContext = buildRuntimeContext({
      targetApiUrl,
      skill: data.skill,
      projectId: data.projectId,
      webhookSecret: data.webhookSecret,
      relevantMemories,
    });

    const promptWithContext = data.prompt + runtimeContext;

    try {
      const { runId, status } = await runManager.startRun(promptWithContext, {
        projectId: data.projectId,
        webhookSecret: data.webhookSecret,
        targetApiUrl,
        skill: data.skill,
      });
      return c.json({ runId, status }, 202);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 502);
    }
  };
}
