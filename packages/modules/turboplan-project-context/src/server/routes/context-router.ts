import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { profile, projectContext, user } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
  requireProjectReadOrPublicGov,
} from "@wildfires-org/turboplan-rbac/hono";

import {
  createProjectContextSchema,
  updateProjectContextSchema,
} from "../../schemas";

export const contextRouter = new Hono<RBACContext>();

// GET /:id/context - List context entries ordered by creation date
contextRouter.get(
  "/:id/context",
  requireProjectReadOrPublicGov((c) => c.req.param("id")!, {
    moduleName: "context",
  }),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      const context = await db
        .select({
          id: projectContext.id,
          projectId: projectContext.projectId,
          label: projectContext.label,
          content: projectContext.content,
          url: projectContext.url,
          createdBy: projectContext.createdBy,
          createdAt: projectContext.createdAt,
          updatedAt: projectContext.updatedAt,
          creatorFirstName: profile.firstName,
          creatorLastName: profile.lastName,
          creatorAvatarUrl: profile.avatarUrl,
        })
        .from(projectContext)
        .leftJoin(user, eq(user.id, projectContext.createdBy))
        .leftJoin(profile, eq(profile.userId, user.id))
        .where(eq(projectContext.projectId, id))
        .orderBy(projectContext.createdAt);

      return c.json({ context });
    } catch (error) {
      console.error("Failed to get project context:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// POST /:id/context - Add a context entry manually
contextRouter.post(
  "/:id/context",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      const body = await c.req.json();
      const validationResult = createProjectContextSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { label, content, url } = validationResult.data;

      const [newEntry] = await db
        .insert(projectContext)
        .values({
          projectId: id,
          label,
          content,
          url: url ?? null,
          createdBy: c.get("user").userId,
        })
        .returning();

      return c.json({ contextEntry: newEntry }, 201);
    } catch (error) {
      console.error("Failed to add project context entry:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// DELETE /:id/context/:contextId - Remove a context entry
contextRouter.delete(
  "/:id/context/:contextId",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const contextId = c.req.param("contextId")!;

      // Check entry exists and belongs to project
      const existingEntry = await db
        .select()
        .from(projectContext)
        .where(
          and(
            eq(projectContext.id, contextId),
            eq(projectContext.projectId, id),
          ),
        )
        .limit(1);

      if (existingEntry.length === 0) {
        return c.json({ error: "Context entry not found" }, 404);
      }

      await db.delete(projectContext).where(eq(projectContext.id, contextId));

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to delete project context entry:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PATCH /:id/context/:contextId - Update a context entry
contextRouter.patch(
  "/:id/context/:contextId",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const contextId = c.req.param("contextId")!;

      // Check entry exists and belongs to project
      const existingEntry = await db
        .select()
        .from(projectContext)
        .where(
          and(
            eq(projectContext.id, contextId),
            eq(projectContext.projectId, id),
          ),
        )
        .limit(1);

      if (existingEntry.length === 0) {
        return c.json({ error: "Context entry not found" }, 404);
      }

      const body = await c.req.json();
      const validationResult = updateProjectContextSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { url, ...rest } = validationResult.data;
      const updates = {
        ...rest,
        ...(url !== undefined ? { url: url ?? null } : {}),
      };

      // Ensure at least one field is being updated
      if (Object.keys(updates).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
      }

      const [updated] = await db
        .update(projectContext)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(projectContext.id, contextId))
        .returning();

      return c.json({ contextEntry: updated });
    } catch (error) {
      console.error("Failed to update project context entry:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
