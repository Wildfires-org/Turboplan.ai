import { and, eq, gt, max, sql } from "drizzle-orm";
import { Hono } from "hono";

import { project, projectField } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import {
  computeChanges,
  createTimelineRecord,
  projectCustomFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";

import {
  createProjectFieldSchema,
  MAX_FIELDS_PER_PROJECT,
  updateProjectFieldSchema,
} from "../../schemas/field-validation";

// Helper to check if project exists
async function projectExists(id: string) {
  const result = await db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);
  return result.length > 0;
}

export const fieldsRouter = new Hono<RBACContext>();

// GET /:id/fields - Get project fields (RBAC: READ)
fieldsRouter.get(
  "/:id/fields",
  requirePermission(EntityType.PROJECT, Action.READ, (c) => c.req.param("id")!),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      if (!(await projectExists(id))) {
        return c.json({ error: "Project not found" }, 404);
      }

      const fields = await db
        .select()
        .from(projectField)
        .where(eq(projectField.projectId, id))
        .orderBy(projectField.order);

      return c.json({ fields });
    } catch (error) {
      console.error("Failed to get project fields:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// POST /:id/fields - Add a new field (RBAC: UPDATE)
fieldsRouter.post(
  "/:id/fields",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      if (!(await projectExists(id))) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Check field limit
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projectField)
        .where(eq(projectField.projectId, id));

      const currentFieldCount = countResult[0]?.count ?? 0;
      if (currentFieldCount >= MAX_FIELDS_PER_PROJECT) {
        return c.json(
          {
            error: `Maximum number of fields (${MAX_FIELDS_PER_PROJECT}) reached`,
          },
          400,
        );
      }

      const body = await c.req.json();
      const validationResult = createProjectFieldSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { name, type, isRequired, tooltip, values } = validationResult.data;

      // Use transaction to prevent race conditions with concurrent requests
      const newField = await db.transaction(async (tx) => {
        // Get max order for this project
        const maxOrderResult = await tx
          .select({ maxOrder: max(projectField.order) })
          .from(projectField)
          .where(eq(projectField.projectId, id));

        const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

        // Insert new field
        const [inserted] = await tx
          .insert(projectField)
          .values({
            projectId: id,
            name,
            type,
            isRequired,
            tooltip,
            order: nextOrder,
            values,
          })
          .returning();

        return inserted;
      });

      await createTimelineRecord({
        projectId: id,
        userId: c.get("user").userId,
        entityType: "field",
        entityId: newField.id,
        entityName: newField.name,
        action: "created",
      });

      return c.json({ field: newField }, 201);
    } catch (error) {
      console.error("Failed to add project field:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PUT /:id/fields/:fieldId - Update a field (RBAC: UPDATE)
fieldsRouter.put(
  "/:id/fields/:fieldId",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const fieldId = c.req.param("fieldId")!;

      // Check field exists and belongs to project
      const existingField = await db
        .select()
        .from(projectField)
        .where(
          and(eq(projectField.id, fieldId), eq(projectField.projectId, id)),
        )
        .limit(1);

      if (existingField.length === 0) {
        return c.json({ error: "Field not found" }, 404);
      }

      const body = await c.req.json();
      const validationResult = updateProjectFieldSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const updateData = validationResult.data;

      // Build update object with only provided fields
      const updateValues: Partial<typeof projectField.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (updateData.name !== undefined) updateValues.name = updateData.name;
      if (updateData.type !== undefined) updateValues.type = updateData.type;
      if (updateData.isRequired !== undefined)
        updateValues.isRequired = updateData.isRequired;
      if (updateData.tooltip !== undefined)
        updateValues.tooltip = updateData.tooltip ?? null;
      if (updateData.values !== undefined)
        updateValues.values = updateData.values;

      const oldField = existingField[0];

      const [updatedField] = await db
        .update(projectField)
        .set(updateValues)
        .where(eq(projectField.id, fieldId))
        .returning();

      const changes = computeChanges(
        oldField,
        updatedField,
        projectCustomFieldDefs,
      );
      if (changes.length > 0) {
        await createTimelineRecord({
          projectId: id,
          userId: c.get("user").userId,
          entityType: "field",
          entityId: fieldId,
          entityName: updatedField.name,
          action: "updated",
          changes,
        });
      }

      return c.json({ field: updatedField });
    } catch (error) {
      console.error("Failed to update project field:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// DELETE /:id/fields/:fieldId - Delete a field (RBAC: UPDATE)
fieldsRouter.delete(
  "/:id/fields/:fieldId",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const fieldId = c.req.param("fieldId")!;

      // Check field exists and belongs to project
      const existingField = await db
        .select()
        .from(projectField)
        .where(
          and(eq(projectField.id, fieldId), eq(projectField.projectId, id)),
        )
        .limit(1);

      if (existingField.length === 0) {
        return c.json({ error: "Field not found" }, 404);
      }

      const deletedOrder = existingField[0].order;

      // Use transaction to prevent race conditions with concurrent requests
      await db.transaction(async (tx) => {
        // Delete the field
        await tx.delete(projectField).where(eq(projectField.id, fieldId));

        // Decrement order for all fields after the deleted one
        await tx
          .update(projectField)
          .set({ order: sql`${projectField.order} - 1` })
          .where(
            and(
              eq(projectField.projectId, id),
              gt(projectField.order, deletedOrder),
            ),
          );
      });

      await createTimelineRecord({
        projectId: id,
        userId: c.get("user").userId,
        entityType: "field",
        entityId: fieldId,
        entityName: existingField[0].name,
        action: "deleted",
      });

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to delete project field:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
