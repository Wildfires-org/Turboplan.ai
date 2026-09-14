import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  deleteWebhookLogs,
  getWebhookLogById,
  getWebhookLogs,
} from "@wildfires-org/turboplan-db/queries";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

const webhookLogsRouter = new Hono<RBACContext>();

/**
 * GET /
 * List webhook logs with pagination and filtering.
 */
webhookLogsRouter.get(
  "/",
  zValidator(
    "query",
    z.object({
      source: z.enum(["bootstrapper", "cataloger"]).optional(),
    }),
  ),
  async (c) => {
    try {
      const { source } = c.req.valid("query");

      const result = await getWebhookLogs({ source });

      return c.json(result);
    } catch (error) {
      console.error("Failed to get webhook logs:", error);
      return c.json({ error: "Failed to get webhook logs" }, 500);
    }
  },
);

/**
 * GET /:id
 * Get a single webhook log entry with full request/response bodies.
 */
webhookLogsRouter.get(
  "/:id",
  zValidator("param", z.object({ id: z.string().uuid() })),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const log = await getWebhookLogById(id);

      if (!log) {
        return c.json({ error: "Webhook log not found" }, 404);
      }

      return c.json({ log });
    } catch (error) {
      console.error("Failed to get webhook log:", error);
      return c.json({ error: "Failed to get webhook log" }, 500);
    }
  },
);

webhookLogsRouter.post(
  "/delete",
  zValidator(
    "json",
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    }),
  ),
  async (c) => {
    try {
      const { ids } = c.req.valid("json");
      const result = await deleteWebhookLogs(ids);
      return c.json(result);
    } catch (error) {
      console.error("Failed to delete webhook logs:", error);
      return c.json({ error: "Failed to delete webhook logs" }, 500);
    }
  },
);

export { webhookLogsRouter };
