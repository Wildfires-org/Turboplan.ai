/**
 * Milestones router
 * Provides REST API endpoints for milestones
 *
 * Routes guarded by `requireProjectPermissionFromMilestone` /
 * `requireProjectReadAccessFromMilestone` answer 403 for a milestone id that
 * does not exist, so the "Milestone not found" 404 branches on those routes are
 * unreachable. See `rbac-guards.ts` for why.
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { Action } from "@wildfires-org/turboplan-rbac";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";
import {
  computeChanges,
  createTimelineRecord,
  milestoneFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";

import { TaskStatus } from "../types";
import { projectIdOfMilestone } from "./milestone-project";
import {
  assigneesVisibleTo,
  requireProjectPermission,
  requireProjectPermissionFromMilestone,
  requireProjectReadAccess,
  requireProjectReadAccessFromMilestone,
} from "./rbac-guards";
import { validateAssigneeIds } from "./reference-validation";
import {
  DrizzleMilestoneRepository,
  DrizzleTaskRepository,
  DrizzleUserRepository,
} from "./repository";
import { MilestoneService } from "./service";

// Create a new Hono router
const router = new Hono<RBACContext>();

// Initialize repositories and services
const userRepository = new DrizzleUserRepository();
const milestoneRepository = new DrizzleMilestoneRepository(userRepository);
const taskRepository = new DrizzleTaskRepository(userRepository);
const milestoneService = new MilestoneService(milestoneRepository);
milestoneService.setTaskRepository(taskRepository);

// API validation schemas - clean and simple, based on database schema
const milestoneCreateAPISchema = z.object({
  title: z.string().min(1),
  assigneeIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  status: z
    .enum([
      TaskStatus.DRAFT,
      TaskStatus.NOT_STARTED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.DELAYED,
    ])
    .optional(),
  order: z.number().optional(),
});

const milestoneUpdateAPISchema = z.object({
  title: z.string().min(1).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  status: z
    .enum([
      TaskStatus.DRAFT,
      TaskStatus.NOT_STARTED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.DELAYED,
    ])
    .optional(),
  order: z.number().optional(),
});

// ============================================
// MILESTONE ROUTES
// ============================================

// GET all milestones for a document
router.get(
  "/document/:documentId",
  requireProjectReadAccess("documentId"),
  async (c) => {
    const documentId = c.req.param("documentId");

    if (!documentId) {
      return c.json({ error: "Document ID is required" }, 400);
    }

    try {
      const milestones = await milestoneService.getAllMilestones(documentId);
      return c.json({ milestones: assigneesVisibleTo(c, milestones) });
    } catch (_error) {
      return c.json({ error: "Failed to fetch milestones" }, 500);
    }
  },
);

// GET milestones with tasks by document ID
router.get(
  "/document/:documentId/tasks",
  requireProjectReadAccess("documentId"),
  async (c) => {
    const documentId = c.req.param("documentId");

    if (!documentId) {
      return c.json({ error: "Document ID is required" }, 400);
    }

    try {
      const milestonesWithTasks =
        await milestoneService.getMilestonesWithTasks(documentId);

      if (!milestonesWithTasks) {
        return c.json({ error: "Milestone not found" }, 404);
      }

      return c.json({
        milestones: assigneesVisibleTo(c, milestonesWithTasks),
      });
    } catch (_error) {
      return c.json({ error: "Failed to fetch milestone with tasks" }, 500);
    }
  },
);

// GET milestones for a specific project (alternative route pattern)
router.get(
  "/:projectId/milestones",
  requireProjectReadAccess("projectId"),
  async (c) => {
    const projectId = c.req.param("projectId");

    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400);
    }

    try {
      const milestonesWithTasks =
        await milestoneService.getMilestonesByProjectId(projectId);

      return c.json(assigneesVisibleTo(c, milestonesWithTasks));
    } catch (error) {
      console.error("Failed to fetch milestones for project:", error);
      return c.json({ error: "Failed to fetch milestones for project" }, 500);
    }
  },
);

// GET milestone by ID
router.get("/:id", requireProjectReadAccessFromMilestone(), async (c) => {
  const id = c.req.param("id")!;

  try {
    const milestone = await milestoneService.getMilestoneById(id);

    if (!milestone) {
      return c.json({ error: "Milestone not found" }, 404);
    }

    const [visibleMilestone] = assigneesVisibleTo(c, [milestone]);
    return c.json({ milestone: visibleMilestone });
  } catch (_error) {
    return c.json({ error: "Failed to fetch milestone" }, 500);
  }
});

// GET milestones by status
router.get(
  "/document/:documentId/status/:status",
  requireProjectReadAccess("documentId"),
  async (c) => {
    const documentId = c.req.param("documentId");
    const statusParam = c.req.param("status")!;

    if (!documentId) {
      return c.json({ error: "Document ID is required" }, 400);
    }

    // Validate status
    if (!Object.values(TaskStatus).includes(statusParam as TaskStatus)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    try {
      const milestones = await milestoneService.getMilestonesByStatus(
        documentId,
        statusParam as TaskStatus,
      );
      return c.json({ milestones: assigneesVisibleTo(c, milestones) });
    } catch (_error) {
      return c.json({ error: "Failed to fetch milestones by status" }, 500);
    }
  },
);

// CREATE a new milestone
router.post(
  "/document/:documentId",
  requireProjectPermission(Action.UPDATE, "documentId"),
  zValidator("json", milestoneCreateAPISchema),
  async (c) => {
    // Get authenticated user from context
    const user = c.get("user");

    const userId = user.userId;

    const documentId = c.req.param("documentId");

    if (!documentId) {
      return c.json({ error: "Document ID is required" }, 400);
    }

    const data = c.req.valid("json");

    // A milestone's only cross-entity reference is its assignees.
    const assigneeError = await validateAssigneeIds(data.assigneeIds);
    if (assigneeError) {
      return c.json({ error: assigneeError }, 400);
    }

    try {
      // Convert API data to operations schema format - dates are required
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(0, 0, 0, 0);

      const milestoneInput = {
        title: data.title,
        assigneeIds: data.assigneeIds,
        status: data.status,
        order: data.order,
        startDate: data.startDate ? new Date(data.startDate) : tomorrow,
        dueDate: data.dueDate ? new Date(data.dueDate) : nextWeek,
        // `documentId` is the project the guard authorised; record it as the
        // milestone's project too, so the row resolves without the fallback.
        documentId,
        projectId: documentId,
        userId,
      };

      const milestone = await milestoneService.createMilestone(milestoneInput);

      await createTimelineRecord({
        projectId: documentId,
        userId,
        entityType: "milestone",
        entityId: milestone.id,
        entityName: milestone.title,
        action: "created",
      });

      return c.json({ milestone }, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create milestone",
        },
        400,
      );
    }
  },
);

// CREATE a new milestone for restore operations (with custom ID)
router.post(
  "/document/:documentId/restore",
  requireProjectPermission(Action.UPDATE, "documentId"),
  zValidator(
    "json",
    milestoneCreateAPISchema.extend({
      // See the tasks router's restore route: the id must parse as a uuid, and
      // there is deliberately no `userId` field — the recorded author is always
      // the authenticated caller, never one the client names.
      id: z.string().uuid(),
    }),
  ),
  async (c) => {
    // Get authenticated user from context
    const user = c.get("user");
    const userId = user.userId;

    const documentId = c.req.param("documentId");

    if (!documentId) {
      return c.json({ error: "Document ID is required" }, 400);
    }

    const data = c.req.valid("json");

    const assigneeError = await validateAssigneeIds(data.assigneeIds);
    if (assigneeError) {
      return c.json({ error: assigneeError }, 400);
    }

    try {
      const milestone = await milestoneService.createMilestoneForRestore({
        id: data.id, // Use provided ID for restore
        title: data.title,
        assigneeIds: data.assigneeIds,
        status: data.status,
        order: data.order,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
        documentId,
        projectId: documentId,
        userId,
      });

      await createTimelineRecord({
        projectId: documentId,
        userId,
        entityType: "milestone",
        entityId: milestone.id,
        entityName: milestone.title,
        action: "created",
      });

      return c.json({ milestone }, 201);
    } catch (error) {
      // Logged, not returned: the thrown message can carry driver-level detail
      // about rows the caller never had access to.
      console.error("Failed to create milestone for restore:", error);
      return c.json({ error: "Failed to create milestone for restore" }, 400);
    }
  },
);

// UPDATE a milestone
router.put(
  "/:id",
  requireProjectPermissionFromMilestone(Action.UPDATE),
  zValidator("json", milestoneUpdateAPISchema),
  async (c) => {
    const id = c.req.param("id")!;
    const data = c.req.valid("json");
    const user = c.get("user");
    const userId = user?.userId;

    const assigneeError = await validateAssigneeIds(data.assigneeIds);
    if (assigneeError) {
      return c.json({ error: assigneeError }, 400);
    }

    try {
      // Fetch existing milestone for timeline diff
      const existingMilestone = await milestoneService.getMilestoneById(id);

      const milestone = await milestoneService.updateMilestone(id, {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });

      if (!milestone) {
        return c.json({ error: "Milestone not found" }, 404);
      }

      if (userId) {
        const changes = computeChanges(
          existingMilestone as unknown as Record<string, unknown>,
          milestone as unknown as Record<string, unknown>,
          milestoneFieldDefs,
        );
        if (changes.length > 0) {
          await createTimelineRecord({
            projectId: projectIdOfMilestone(milestone),
            userId,
            entityType: "milestone",
            entityId: milestone.id,
            entityName: milestone.title,
            action: "updated",
            changes,
          });
        }
      }

      return c.json({ milestone });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update milestone",
        },
        400,
      );
    }
  },
);

// DELETE a milestone
router.delete(
  "/:id",
  requireProjectPermissionFromMilestone(Action.DELETE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      // Fetch milestone before deletion for timeline recording
      const existingMilestone = await milestoneService.getMilestoneById(id);

      const success = await milestoneService.deleteMilestone(id);

      if (!success) {
        return c.json({ error: "Milestone not found" }, 404);
      }

      if (existingMilestone && userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(existingMilestone),
          userId,
          entityType: "milestone",
          entityId: id,
          entityName: existingMilestone.title,
          action: "deleted",
        });
      }

      return c.json({ success: true });
    } catch (_error) {
      return c.json({ error: "Failed to delete milestone" }, 500);
    }
  },
);

// Mark milestone as completed
router.patch(
  "/:id/complete",
  requireProjectPermissionFromMilestone(Action.UPDATE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      const existingMilestone = await milestoneService.getMilestoneById(id);
      const milestone = await milestoneService.markMilestoneAsCompleted(id);

      if (!milestone) {
        return c.json({ error: "Milestone not found" }, 404);
      }

      if (userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(milestone),
          userId,
          entityType: "milestone",
          entityId: milestone.id,
          entityName: milestone.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: existingMilestone?.status,
              newValue: "completed",
              valueType: "enum",
            },
          ],
        });
      }

      return c.json({ milestone });
    } catch (_error) {
      return c.json({ error: "Failed to mark milestone as completed" }, 500);
    }
  },
);

// Mark milestone as in progress
router.patch(
  "/:id/in-progress",
  requireProjectPermissionFromMilestone(Action.UPDATE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      const existingMilestone = await milestoneService.getMilestoneById(id);
      const milestone = await milestoneService.markMilestoneAsInProgress(id);

      if (!milestone) {
        return c.json({ error: "Milestone not found" }, 404);
      }

      if (userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(milestone),
          userId,
          entityType: "milestone",
          entityId: milestone.id,
          entityName: milestone.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: existingMilestone?.status,
              newValue: "in_progress",
              valueType: "enum",
            },
          ],
        });
      }

      return c.json({ milestone });
    } catch (_error) {
      return c.json({ error: "Failed to mark milestone as in progress" }, 500);
    }
  },
);

// Mark milestone as delayed
router.patch(
  "/:id/delayed",
  requireProjectPermissionFromMilestone(Action.UPDATE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      const existingMilestone = await milestoneService.getMilestoneById(id);
      const milestone = await milestoneService.markMilestoneAsDelayed(id);

      if (!milestone) {
        return c.json({ error: "Milestone not found" }, 404);
      }

      if (userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(milestone),
          userId,
          entityType: "milestone",
          entityId: milestone.id,
          entityName: milestone.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: existingMilestone?.status,
              newValue: "delayed",
              valueType: "enum",
            },
          ],
        });
      }

      return c.json({ milestone });
    } catch (_error) {
      return c.json({ error: "Failed to mark milestone as delayed" }, 500);
    }
  },
);

export default router;
