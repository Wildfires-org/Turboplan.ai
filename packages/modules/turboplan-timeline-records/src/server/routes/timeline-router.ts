import { type Context, Hono } from "hono";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  isMembershipGrant,
  type RBACContext,
  requirePermission,
  requireProjectReadOrPublicGov,
} from "@wildfires-org/turboplan-rbac/hono";

import { manualRecordSchema, timelineQuerySchema } from "../../schemas";
import { createTimelineRecord } from "../recorder";
import {
  getTimeline,
  getTimelineStats,
  softDeleteRecord,
  toggleRecordVisibility,
} from "../service";

export const timelineRouter = new Hono<RBACContext>();

/**
 * True when the READ guard let the caller in through the public-government
 * fallback only (no role on the project). The guard leaves `permissionResult`
 * unset in that case.
 */
const isPublicViewer = (c: Context<RBACContext>) => {
  const permissionResult = c.get("permissionResult");
  return !permissionResult || !isMembershipGrant(permissionResult);
};

// GET /:id/timeline — paginated timeline for a project
timelineRouter.get(
  "/:id/timeline",
  requireProjectReadOrPublicGov((c) => c.req.param("id")!, {
    moduleName: "timeline",
  }),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const rawQuery = c.req.query();
      const parseResult = timelineQuerySchema.safeParse(rawQuery);

      if (!parseResult.success) {
        return c.json(
          { error: "Validation failed", details: parseResult.error.issues },
          400,
        );
      }

      const result = await getTimeline(projectId, parseResult.data, {
        publicView: isPublicViewer(c),
      });
      return c.json(result);
    } catch (error) {
      console.error("Failed to get timeline:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// GET /:id/timeline/stats — activity summary for a project
timelineRouter.get(
  "/:id/timeline/stats",
  requireProjectReadOrPublicGov((c) => c.req.param("id")!, {
    moduleName: "timeline",
  }),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const stats = await getTimelineStats(projectId, {
        publicView: isPublicViewer(c),
      });
      return c.json(stats);
    } catch (error) {
      console.error("Failed to get timeline stats:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// POST /:id/timeline — manually create a timeline record
timelineRouter.post(
  "/:id/timeline",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const user = c.get("user");
      const body = await c.req.json();
      const parseResult = manualRecordSchema.safeParse(body);

      if (!parseResult.success) {
        return c.json(
          { error: "Validation failed", details: parseResult.error.issues },
          400,
        );
      }

      const {
        entityType,
        entityId,
        entityName,
        action,
        title,
        description,
        changes,
        resourceUrls,
        isPublic,
        startedAt,
        endedAt,
        metadata,
      } = parseResult.data;

      await createTimelineRecord({
        projectId,
        userId: user.userId,
        entityType,
        entityId,
        entityName,
        action,
        title,
        description,
        changes,
        resourceUrls,
        isPublic,
        startedAt,
        endedAt,
        metadata,
      });

      return c.json({ success: true }, 201);
    } catch (error) {
      console.error("Failed to create timeline record:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PATCH /:id/timeline/:recordId/visibility — toggle public/private
timelineRouter.patch(
  "/:id/timeline/:recordId/visibility",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const recordId = c.req.param("recordId")!;
      const updated = await toggleRecordVisibility(recordId, projectId);

      if (!updated) {
        return c.json({ error: "Record not found" }, 404);
      }

      return c.json(updated);
    } catch (error) {
      console.error("Failed to toggle timeline record visibility:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// DELETE /:id/timeline/:recordId — soft delete a timeline record
timelineRouter.delete(
  "/:id/timeline/:recordId",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const recordId = c.req.param("recordId")!;
      const deleted = await softDeleteRecord(recordId, projectId);

      if (!deleted) {
        return c.json({ error: "Record not found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to delete timeline record:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
