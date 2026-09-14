import type { Context } from "hono";

import type { RunManager } from "../../runs/run-manager";

export function createCancelRunHandler(runManager: RunManager) {
  return async (c: Context): Promise<Response> => {
    const runId = c.req.param("runId");
    if (!runId) {
      return c.json({ error: "Missing runId" }, 400);
    }
    const result = await runManager.cancelRun(runId);

    if (!result.cancelled) {
      return c.json({ error: result.reason ?? "Cannot cancel run" }, 400);
    }

    return c.json({ message: "Run cancelled", runId }, 200);
  };
}
