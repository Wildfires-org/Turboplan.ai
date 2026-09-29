import { randomBytes } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  consumeCredits,
  gateCreditsOr402,
  resolveBillingOrgForUser,
} from "@wildfires-org/turboplan-billing/server";
import { CATALOG } from "@wildfires-org/turboplan-billing/types";
import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

import { catalogerRunRequestSchema } from "../schemas";
import { handleRouteError } from "../utils";
import { createCatalogerRun, getCatalogerRunById } from "./repository";
import { reconcileCatalogerExternalStatus, startCatalogerRun } from "./service";

// Platform-admin only: mounted under /api/admin/cataloger (see apps/server
// privateRoutes.ts) so adminMiddleware guards every route. Runs create GOVERNMENT
// orgs and public template projects, so never mount this outside /api/admin.
// Listing runs lives in admin-router.ts (GET /runs).
const catalogerRouter = new Hono<RBACContext>();

// POST /run — Start a cataloger run
catalogerRouter.post(
  "/run",
  zValidator("json", catalogerRunRequestSchema),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const user = c.get("user");
      if (!user?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Skip the external cataloger run under E2E/CI (NODE_ENV=test) so tests
      // never spawn a real deployed agent run. See the bootstrapper /start route.
      if (getApiEnv().NODE_ENV === "test") {
        return c.json({
          skipped: true,
          reason: "Research agent disabled in test environment",
        });
      }

      // Cataloger runs are user-scoped (no project) — bill the personal org.
      // The external run reports no usage back: flat catalog cost at start.
      const billingOrgId = await resolveBillingOrgForUser(user.userId);
      const blocked = await gateCreditsOr402(
        c,
        billingOrgId,
        CATALOG.billing.flat_credit_costs.research_agent_cataloger,
      );
      if (blocked) {
        return blocked;
      }

      const webhookSecret = randomBytes(32).toString("hex");

      const record = await createCatalogerRun({
        userId: user.userId,
        message: body.message,
        webhookSecret,
      });

      if (billingOrgId) {
        await consumeCredits({
          organizationId: billingOrgId,
          userId: user.userId,
          amount: CATALOG.billing.flat_credit_costs.research_agent_cataloger,
          source: "research_cataloger",
          metadata: { runId: record.id },
        }).catch((error: unknown) => {
          console.error(
            "[billing] cataloger credit consumption failed:",
            error,
          );
        });
      }

      const backgroundTask = runWithWorkerConnection(() =>
        startCatalogerRun({
          runId: record.id,
          message: body.message,
          webhookSecret,
        }),
      );
      try {
        c.executionCtx.waitUntil(backgroundTask);
      } catch (err) {
        console.warn("waitUntil unavailable, falling back:", err);
        backgroundTask.catch((bgErr) =>
          console.error("Background task failed:", bgErr),
        );
      }

      return c.json({ runId: record.id, status: "initializing" });
    } catch (error) {
      return handleRouteError(c, "cataloger-run", error);
    }
  },
);

// GET /run/:runId — Get run status
catalogerRouter.get(
  "/run/:runId",
  zValidator("param", z.object({ runId: z.string().uuid() })),
  async (c) => {
    try {
      const { runId } = c.req.valid("param");
      const user = c.get("user");

      const run = await getCatalogerRunById(runId);
      if (!run) {
        return c.json({ error: "Run not found" }, 404);
      }

      if (run.userId !== user.userId) {
        return c.json({ error: "Forbidden" }, 403);
      }

      let { status, currentStep } = run;

      // If run looks active but the external agent already finished, reconcile
      const isActive =
        status === "initializing" ||
        status === "queued" ||
        status === "running";

      if (isActive && run.externalRunId) {
        const reconciled = await reconcileCatalogerExternalStatus(
          run.id,
          run.externalRunId,
        );
        if (reconciled) {
          status = reconciled.status;
          currentStep = reconciled.currentStep;
        }
      }

      return c.json({
        runId: run.id,
        status,
        currentStep,
        entriesCount: run.entriesCount,
        createdAt: run.createdAt?.toISOString(),
        updatedAt: run.updatedAt?.toISOString(),
      });
    } catch (error) {
      return handleRouteError(c, "cataloger-run-status", error);
    }
  },
);

export default catalogerRouter;
