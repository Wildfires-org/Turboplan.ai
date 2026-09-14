import type { Context } from "hono";

import type { RunManager } from "../../runs/run-manager";

export function createGetRunStatusHandler(runManager: RunManager) {
  return async (c: Context): Promise<Response> => {
    const runId = c.req.param("runId");
    if (!runId) {
      return c.json({ error: "Missing runId" }, 400);
    }
    const run = await runManager.getStatus(runId);

    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }

    return c.json(run);
  };
}
