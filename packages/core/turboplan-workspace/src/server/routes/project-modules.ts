import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";

import { project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import { getProjectById, getProjectWithRelations } from "../projects/queries";
import {
  toggleModulePublicVisibilitySchema,
  toggleModuleVisibilitySchema,
  updateModuleColumnsSchema,
  updateModuleOrderSchema,
} from "../projects/validation";

export const projectModulesRouter = new Hono<RBACContext>();

// PATCH /:id/modules - Toggle module visibility (RBAC: UPDATE)
projectModulesRouter.patch(
  "/:id/modules",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if project exists
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body
      const validationResult = toggleModuleVisibilitySchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { moduleName } = validationResult.data;

      // Get current hidden modules array
      const currentHiddenModules = projectRecord.hiddenModules || [];

      // Toggle module in hidden modules array
      let updatedHiddenModules: string[];
      if (currentHiddenModules.includes(moduleName)) {
        // Module is hidden, remove it (show module)
        updatedHiddenModules = currentHiddenModules.filter(
          (m) => m !== moduleName,
        );
      } else {
        // Module is visible, add it (hide module)
        updatedHiddenModules = [...currentHiddenModules, moduleName];
      }

      // Update project with new hidden modules array
      await db
        .update(project)
        .set({
          hiddenModules: updatedHiddenModules,
          updatedAt: new Date(),
        })
        .where(and(eq(project.id, id), isNull(project.deletedAt)));

      const user = c.get("user");

      await createTimelineRecord({
        projectId: id,
        userId: user.userId,
        entityType: "project",
        entityId: id,
        action: "updated",
        changes: [
          {
            field: "hiddenModules",
            previousValue: currentHiddenModules,
            newValue: updatedHiddenModules,
            valueType: "json",
          },
        ],
      });

      // Return updated project
      const updatedProject = await getProjectWithRelations(id);
      return c.json(updatedProject);
    } catch (error) {
      console.error("Failed to toggle module visibility:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PATCH /:id/modules/public - Toggle module public visibility (RBAC: MANAGE_MEMBERS)
// Controls which modules are visible to public/non-logged-in users on catalog
// Requires MANAGE_MEMBERS (owner-level) permission to match the UI check
projectModulesRouter.patch(
  "/:id/modules/public",
  requirePermission(
    EntityType.PROJECT,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if project exists
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body
      const validationResult =
        toggleModulePublicVisibilitySchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { moduleName } = validationResult.data;

      // Get current private modules array
      const currentPrivateModules = projectRecord.privateModules || [];

      // Toggle module in private modules array
      let updatedPrivateModules: string[];
      if (currentPrivateModules.includes(moduleName)) {
        // Module is private, remove it (make it public)
        updatedPrivateModules = currentPrivateModules.filter(
          (m) => m !== moduleName,
        );
      } else {
        // Module is public, add it (make it private)
        updatedPrivateModules = [...currentPrivateModules, moduleName];
      }

      // Update project with new private modules array
      await db
        .update(project)
        .set({
          privateModules: updatedPrivateModules,
          updatedAt: new Date(),
        })
        .where(and(eq(project.id, id), isNull(project.deletedAt)));

      const user = c.get("user");

      await createTimelineRecord({
        projectId: id,
        userId: user.userId,
        entityType: "project",
        entityId: id,
        action: "updated",
        changes: [
          {
            field: "privateModules",
            previousValue: currentPrivateModules,
            newValue: updatedPrivateModules,
            valueType: "json",
          },
        ],
      });

      // Return updated project
      const updatedProject = await getProjectWithRelations(id);
      return c.json(updatedProject);
    } catch (error) {
      console.error("Failed to toggle module public visibility:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PATCH /:id/module-order - Update module order (RBAC: UPDATE)
projectModulesRouter.patch(
  "/:id/module-order",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if project exists
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body
      const validationResult = updateModuleOrderSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { moduleOrder } = validationResult.data;

      // Update project with new module order
      await db
        .update(project)
        .set({
          moduleOrder,
          updatedAt: new Date(),
        })
        .where(and(eq(project.id, id), isNull(project.deletedAt)));

      const user = c.get("user");

      await createTimelineRecord({
        projectId: id,
        userId: user.userId,
        entityType: "project",
        entityId: id,
        action: "updated",
        changes: [
          {
            field: "moduleOrder",
            previousValue: null,
            newValue: moduleOrder,
            valueType: "json",
          },
        ],
      });

      // Return updated project
      const updatedProject = await getProjectWithRelations(id);
      return c.json(updatedProject);
    } catch (error) {
      console.error("Failed to update module order:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PATCH /:id/module-columns - Update module column assignment (RBAC: UPDATE)
projectModulesRouter.patch(
  "/:id/module-columns",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if project exists
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body
      const validationResult = updateModuleColumnsSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { moduleColumns } = validationResult.data;

      // Update project with new module column assignment
      await db
        .update(project)
        .set({
          moduleColumns,
          updatedAt: new Date(),
        })
        .where(and(eq(project.id, id), isNull(project.deletedAt)));

      const user = c.get("user");

      await createTimelineRecord({
        projectId: id,
        userId: user.userId,
        entityType: "project",
        entityId: id,
        action: "updated",
        changes: [
          {
            field: "moduleColumns",
            previousValue: null,
            newValue: moduleColumns,
            valueType: "json",
          },
        ],
      });

      // Return updated project
      const updatedProject = await getProjectWithRelations(id);
      return c.json(updatedProject);
    } catch (error) {
      console.error("Failed to update module columns:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
