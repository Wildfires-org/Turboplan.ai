import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

import type { CatalogerRun } from "@wildfires-org/turboplan-db/schemas";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

import { catalogerCreateEntrySchema } from "../schemas";
import { handleRouteError } from "../utils";
import { webhookLoggerMiddleware } from "../webhook-logger-middleware";
import { getCatalogerRunByWebhookSecret } from "./repository";
import { createCatalogEntry } from "./service";

// ---------------------------------------------------------------------------
// Webhook auth context + middleware
// ---------------------------------------------------------------------------

type CatalogerWebhookContext = RBACContext & {
  Variables: RBACContext["Variables"] & {
    catalogerRun: CatalogerRun;
  };
};

const catalogerWebhookMiddleware = createMiddleware<CatalogerWebhookContext>(
  async (c, next) => {
    const secret = c.req.header("x-webhook-secret");
    if (!secret) {
      return c.json({ error: "Unauthorized - Missing webhook secret" }, 401);
    }

    const run = await getCatalogerRunByWebhookSecret(secret);
    if (!run) {
      return c.json({ error: "Unauthorized - Invalid webhook secret" }, 401);
    }

    c.set("catalogerRun", run);
    await next();
  },
);

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const catalogerWebhookRouter = new Hono<CatalogerWebhookContext>();

catalogerWebhookRouter.use("/*", catalogerWebhookMiddleware);
// Registered AFTER the secret check on purpose: logging an unauthenticated
// request would let anyone write rows into webhook_request_log.
catalogerWebhookRouter.use("/*", webhookLoggerMiddleware);

// POST /project-template - Create a full catalog entry (org -> office -> project)
catalogerWebhookRouter.post(
  "/project-template",
  zValidator("json", catalogerCreateEntrySchema),
  async (c) => {
    try {
      const entry = c.req.valid("json");
      const catalogerRun = c.get("catalogerRun");

      const result = await createCatalogEntry(entry, catalogerRun);

      return c.json({
        success: true,
        entryId: result.id,
        projectId: result.projectId,
      });
    } catch (error) {
      return handleRouteError(c, "cataloger-webhook-entry", error);
    }
  },
);

export default catalogerWebhookRouter;
