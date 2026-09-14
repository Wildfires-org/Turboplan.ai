import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  catalogerEntry,
  catalogerRun,
  office,
  organization,
  profile,
  project,
  user,
} from "@wildfires-org/turboplan-db/schemas";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

import { reconcileCatalogerRunStatus } from "./service";

const formatUserName = (
  firstName: string | null,
  lastName: string | null,
): string | null => {
  if (!firstName && !lastName) {
    return null;
  }
  return [firstName, lastName].filter(Boolean).join(" ");
};

const catalogerAdminRouter = new Hono<RBACContext>();

/**
 * GET /runs
 * List cataloger runs with optional filtering.
 */
catalogerAdminRouter.get(
  "/runs",
  zValidator(
    "query",
    z.object({
      status: z.string().optional(),
      userId: z.string().uuid().optional(),
    }),
  ),
  async (c) => {
    try {
      const { status, userId } = c.req.valid("query");

      const conditions = [];
      if (status) {
        conditions.push(eq(catalogerRun.status, status));
      }
      if (userId) {
        conditions.push(eq(catalogerRun.userId, userId));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const runs = await db
        .select({
          ...getTableColumns(catalogerRun),
          userEmail: user.email,
          userFirstName: profile.firstName,
          userLastName: profile.lastName,
        })
        .from(catalogerRun)
        .leftJoin(user, eq(catalogerRun.userId, user.id))
        .leftJoin(profile, eq(catalogerRun.userId, profile.userId))
        .where(where)
        .orderBy(desc(catalogerRun.createdAt));

      // Fire-and-forget: reconcile non-terminal runs in the background (capped)
      reconcileCatalogerRunStatus(runs.map((r) => r.id)).catch((error) => {
        console.error(
          "[cataloger-admin] Background reconciliation error:",
          error,
        );
      });

      return c.json({
        // Strip webhookSecret so we don't leak it to the client
        runs: runs.map(
          ({ userFirstName, userLastName, webhookSecret: _, ...rest }) => ({
            ...rest,
            userName: formatUserName(userFirstName, userLastName),
          }),
        ),
      });
    } catch (error) {
      console.error("Failed to list cataloger runs:", error);
      return c.json({ error: "Failed to list cataloger runs" }, 500);
    }
  },
);

/**
 * GET /runs/:runId
 * Get a single cataloger run with its entries.
 */
catalogerAdminRouter.get(
  "/runs/:runId",
  zValidator("param", z.object({ runId: z.string().uuid() })),
  async (c) => {
    try {
      const { runId } = c.req.valid("param");

      const [runResult] = await db
        .select({
          ...getTableColumns(catalogerRun),
          userEmail: user.email,
          userFirstName: profile.firstName,
          userLastName: profile.lastName,
        })
        .from(catalogerRun)
        .leftJoin(user, eq(catalogerRun.userId, user.id))
        .leftJoin(profile, eq(catalogerRun.userId, profile.userId))
        .where(eq(catalogerRun.id, runId))
        .limit(1);

      if (!runResult) {
        return c.json({ error: "Cataloger run not found" }, 404);
      }

      // Reconcile non-terminal run with the external service
      const reconciled = await reconcileCatalogerRunStatus([runResult.id], 1);
      const update = reconciled.get(runResult.id);
      if (update) {
        runResult.status = update.status;
        runResult.currentStep = update.currentStep;
      }

      const entries = await db
        .select({
          ...getTableColumns(catalogerEntry),
          projectName: project.name,
          projectSlug: project.slug,
          organizationName: organization.name,
          organizationSlug: organization.slug,
          officeName: office.name,
          officeSlug: office.slug,
        })
        .from(catalogerEntry)
        .leftJoin(project, eq(catalogerEntry.projectId, project.id))
        .leftJoin(
          organization,
          eq(catalogerEntry.organizationId, organization.id),
        )
        .leftJoin(office, eq(catalogerEntry.officeId, office.id))
        .where(eq(catalogerEntry.catalogerRunId, runId))
        .orderBy(desc(catalogerEntry.createdAt));

      // Strip webhookSecret so we don't leak it to the client
      const {
        userFirstName,
        userLastName,
        webhookSecret: _,
        ...restRun
      } = runResult;
      const run = {
        ...restRun,
        userName: formatUserName(userFirstName, userLastName),
      };

      return c.json({ run, entries });
    } catch (error) {
      console.error("Failed to get cataloger run:", error);
      return c.json({ error: "Failed to get cataloger run" }, 500);
    }
  },
);

export default catalogerAdminRouter;
