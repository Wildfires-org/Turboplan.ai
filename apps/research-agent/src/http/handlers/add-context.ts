import type { Context } from "hono";

import type { RunManager } from "../../runs/run-manager";
import { validateContext } from "../validation";

export function createAddContextHandler(runManager: RunManager) {
  return async (c: Context): Promise<Response> => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const { ok, data, error } = validateContext(body);
    if (!ok) {
      return c.json({ error }, 400);
    }

    const runId = c.req.param("runId");
    if (!runId) {
      return c.json({ error: "Missing runId" }, 400);
    }
    const result = await runManager.addContext(runId, data.context);
    if (result.ok) {
      return c.json(
        {
          success: true,
          delivery: result.delivery,
          message: "Context accepted",
        },
        202,
      );
    }

    if (result.reason === "run_not_found") {
      return c.json({ error: "Run not found" }, 404);
    }

    if (result.reason === "run_terminal") {
      return c.json(
        {
          error:
            "Run is already finished. Use /resume to continue (prompt required only for completed runs).",
          status: result.status,
        },
        409,
      );
    }

    return c.json(
      {
        error: "Run cannot accept runtime messages",
        status: result.status,
      },
      409,
    );
  };
}
