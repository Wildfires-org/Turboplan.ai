/**
 * Tasks router
 * Provides REST API endpoints for tasks
 *
 * Routes guarded by `requireProjectPermissionFromTask` /
 * `requireProjectReadAccessFromTask` answer 403 for a task id that does not
 * exist, so the "Task not found" 404 branches below are unreachable on those
 * routes. See `rbac-guards.ts` for why.
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  getProjectDocumentsByIds,
  getTaskProjectId,
} from "@wildfires-org/turboplan-db/queries";
import { Action } from "@wildfires-org/turboplan-rbac";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";
import {
  computeChanges,
  createTimelineRecord,
  taskFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";
import type { FieldChange } from "@wildfires-org/turboplan-timeline-records/types";

import { TaskStatus } from "../types";
import {
  assigneesVisibleTo,
  requireProjectPermission,
  requireProjectPermissionFromTask,
  requireProjectReadAccess,
  requireProjectReadAccessFromMilestone,
  requireProjectReadAccessFromTask,
} from "./rbac-guards";

/**
 * Resolve newly linked document metadata from projectDocumentIds changes.
 * Returns resourceUrls for documents that were added (not removed).
 *
 * The lookup is scoped to `projectId` — the project whose timeline record these
 * urls are about to be written into. `validateTaskReferences` already rejects a
 * write naming a foreign document, so this scope is the second line: even if an
 * id slipped through, another project's url/filename/mimeType never reaches
 * this project's timeline.
 */
const resolveDocumentResourceUrls = async (
  projectId: string,
  changes: FieldChange[],
): Promise<{ url: string; filename: string; type?: string }[]> => {
  const docChange = changes.find((ch) => ch.field === "projectDocumentIds");
  if (!docChange) {
    return [];
  }
  const prevIds = Array.isArray(docChange.previousValue)
    ? (docChange.previousValue as string[])
    : [];
  const newIds = Array.isArray(docChange.newValue)
    ? (docChange.newValue as string[])
    : [];
  const addedIds = newIds.filter((id) => !prevIds.includes(id));
  if (addedIds.length === 0) {
    return [];
  }
  const docs = await getProjectDocumentsByIds(addedIds, projectId);
  return docs.map((doc) => ({
    url: doc.url,
    filename: doc.originalFilename,
    type: doc.mimeType,
  }));
};

import { projectIdOfMilestone } from "./milestone-project";
import { getTaskNotificationService } from "./notification-service";
import { validateTaskReferences } from "./reference-validation";
import {
  DrizzleMilestoneRepository,
  DrizzleTaskRepository,
  DrizzleUserRepository,
} from "./repository";
import { MilestoneService, TaskService } from "./service";

// Create a new Hono router
const router = new Hono<RBACContext>();

// Initialize repositories and services
const userRepository = new DrizzleUserRepository();
const milestoneRepository = new DrizzleMilestoneRepository(userRepository);
const taskRepository = new DrizzleTaskRepository(userRepository);
const milestoneService = new MilestoneService(milestoneRepository);
milestoneService.setTaskRepository(taskRepository);
const taskService = new TaskService(
  taskRepository,
  milestoneRepository,
  milestoneService,
);

// API validation schemas - clean and simple, based on database schema
const taskCreateAPISchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  projectDocumentIds: z.array(z.string().uuid()).optional(),
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
  milestoneId: z.string().uuid(),
});

const taskUpdateAPISchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  projectDocumentIds: z.array(z.string().uuid()).optional(),
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
  milestoneId: z.string().uuid().optional(),
});

// ============================================
// TASK ROUTES
// ============================================

// GET all tasks for a document
router.get(
  "/document/:documentId",
  requireProjectReadAccess("documentId"),
  async (c) => {
    const documentId = c.req.param("documentId");

    if (!documentId) {
      return c.json({ error: "Document ID is required" }, 400);
    }

    try {
      const tasks = await taskService.getAllTasks(documentId);
      return c.json({ tasks: assigneesVisibleTo(c, tasks) });
    } catch (_error) {
      return c.json({ error: "Failed to fetch tasks" }, 500);
    }
  },
);

// GET task by ID
router.get("/:id", requireProjectReadAccessFromTask(), async (c) => {
  const id = c.req.param("id")!;

  try {
    const task = await taskService.getTaskById(id);

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const [visibleTask] = assigneesVisibleTo(c, [task]);
    return c.json({ task: visibleTask });
  } catch (_error) {
    return c.json({ error: "Failed to fetch task" }, 500);
  }
});

// GET tasks by milestone
router.get(
  "/milestone/:milestoneId",
  requireProjectReadAccessFromMilestone("milestoneId"),
  async (c) => {
    const milestoneId = c.req.param("milestoneId")!;

    try {
      const tasks = await taskService.getTasksByMilestone(milestoneId);
      return c.json({ tasks: assigneesVisibleTo(c, tasks) });
    } catch (_error) {
      return c.json({ error: "Failed to fetch tasks by milestone" }, 500);
    }
  },
);

// GET tasks by status and document ID
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
      const tasks = await taskService.getTasksByStatus(
        documentId,
        statusParam as TaskStatus,
      );
      return c.json({ tasks: assigneesVisibleTo(c, tasks) });
    } catch (_error) {
      return c.json({ error: "Failed to fetch tasks by status" }, 500);
    }
  },
);

// CREATE a new task
router.post(
  "/document/:documentId",
  requireProjectPermission(Action.UPDATE, "documentId"),
  zValidator("json", taskCreateAPISchema),
  async (c) => {
    // Get authenticated user from context
    const user = c.get("user");
    const userId = user.userId;

    const documentId = c.req.param("documentId");

    if (!documentId) {
      return c.json({ error: "Document ID is required" }, 400);
    }

    const data = c.req.valid("json");

    // `documentId` is the owning project: every id the task points at must
    // resolve inside it. See reference-validation.ts.
    const referenceError = await validateTaskReferences(documentId, data);
    if (referenceError) {
      return c.json({ error: referenceError }, 400);
    }

    try {
      // Convert API data to operations schema format - dates are required
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const task = await taskService.createTask({
        title: data.title,
        description: data.description,
        assigneeIds: data.assigneeIds,
        dependencies: data.dependencies,
        projectDocumentIds: data.projectDocumentIds,
        status: data.status,
        order: data.order,
        milestoneId: data.milestoneId,
        startDate: data.startDate ? new Date(data.startDate) : today,
        dueDate: data.dueDate ? new Date(data.dueDate) : tomorrow,
        documentId,
        userId,
      });

      // The service checked the milestone belongs to `documentId`, the
      // project the guard authorised.
      await createTimelineRecord({
        projectId: documentId,
        userId,
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
        action: "created",
        metadata: { milestoneId: task.milestoneId },
      });

      return c.json({ task }, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to create task",
        },
        400,
      );
    }
  },
);

// CREATE a new task for restore operations (with custom ID)
router.post(
  "/document/:documentId/restore",
  requireProjectPermission(Action.UPDATE, "documentId"),
  zValidator(
    "json",
    taskCreateAPISchema.extend({
      // Restore replays a client-held snapshot, so the row id comes from the
      // request body. It still has to parse as a uuid: the column is `uuid`, and
      // anything else reaches Postgres as a failed cast (22P02) instead of a
      // validation error.
      //
      // There is deliberately no `userId` field. It used to be accepted "for
      // restore" and written straight to `tasks.user_id`, which let any Editor
      // create a task recorded as authored by somebody else — an Owner, say.
      // The author is always the authenticated caller; a client still sending
      // `userId` has it dropped here by zod.
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

    const referenceError = await validateTaskReferences(documentId, data);
    if (referenceError) {
      return c.json({ error: referenceError }, 400);
    }

    try {
      const task = await taskService.createTaskForRestore({
        id: data.id, // Use provided ID for restore
        title: data.title,
        description: data.description,
        assigneeIds: data.assigneeIds,
        dependencies: data.dependencies,
        status: data.status,
        order: data.order,
        milestoneId: data.milestoneId,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
        documentId,
        userId,
      });

      // The service checked the milestone belongs to `documentId`, the
      // project the guard authorised.
      await createTimelineRecord({
        projectId: documentId,
        userId,
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
        action: "created",
        metadata: { milestoneId: task.milestoneId },
      });

      return c.json({ task }, 201);
    } catch (error) {
      // The thrown message is for the log, not the caller: it can carry
      // driver-level detail about ids the caller never had access to.
      console.error("Failed to create task for restore:", error);
      return c.json({ error: "Failed to create task for restore" }, 400);
    }
  },
);

// UPDATE a task
router.put(
  "/:id",
  requireProjectPermissionFromTask(Action.UPDATE),
  zValidator("json", taskUpdateAPISchema),
  async (c) => {
    const id = c.req.param("id")!;
    const data = c.req.valid("json");

    // Get authenticated user for notification context
    const user = c.get("user");
    const userId = user?.userId;

    try {
      // Get current task to compare assignees before update
      const existingTask = await taskService.getTaskById(id);

      if (!existingTask) {
        return c.json({ error: "Task not found" }, 404);
      }

      // The task's own project (the one the guard authorised) is where every
      // incoming id must resolve — not anything the request body claims. Not
      // `existingTask.documentId`: on legacy tasks that is a chat document.
      const projectId = await getTaskProjectId(id);
      if (!projectId) {
        return c.json({ error: "Task not found" }, 404);
      }

      const referenceError = await validateTaskReferences(projectId, data);
      if (referenceError) {
        return c.json({ error: referenceError }, 400);
      }

      const existingAssigneeIds = new Set(existingTask.assigneeIds || []);

      const updateData = {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      };

      const task = await taskService.updateTask(id, updateData);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const changes = computeChanges(
        existingTask as unknown as Record<string, unknown>,
        task as unknown as Record<string, unknown>,
        taskFieldDefs,
      );
      if (changes.length > 0) {
        const resourceUrls = await resolveDocumentResourceUrls(
          projectId,
          changes,
        );

        await createTimelineRecord({
          projectId,
          userId,
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "updated",
          changes,
          metadata: { milestoneId: task.milestoneId },
          ...(resourceUrls.length > 0 ? { resourceUrls } : {}),
        });
      }

      // Send notifications to newly assigned users (if assignees changed)
      if (data.assigneeIds && userId) {
        const newAssigneeIds = data.assigneeIds.filter(
          (assigneeId) => !existingAssigneeIds.has(assigneeId),
        );

        if (newAssigneeIds.length > 0) {
          // Send notifications asynchronously (don't block the response)
          const notificationService = getTaskNotificationService();
          notificationService
            .notifyNewAssignees(newAssigneeIds, userId, {
              taskId: id,
              taskTitle: task.title,
              taskDescription: task.description,
              milestoneId: task.milestoneId,
              projectId,
            })
            .catch((error) => {
              console.error("Failed to send assignment notifications:", error);
            });
        }
      }

      return c.json({ task });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to update task",
        },
        400,
      );
    }
  },
);

// DELETE a task
router.delete(
  "/:id",
  requireProjectPermissionFromTask(Action.DELETE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      // Fetch task before deletion for timeline recording
      const existingTask = await taskService.getTaskById(id);

      const success = await taskService.deleteTask(id);

      if (!success) {
        return c.json({ error: "Task not found" }, 404);
      }

      if (existingTask) {
        const milestone = await milestoneService.getMilestoneById(
          existingTask.milestoneId,
        );
        if (milestone && userId) {
          await createTimelineRecord({
            projectId: projectIdOfMilestone(milestone),
            userId,
            entityType: "task",
            entityId: id,
            entityName: existingTask.title,
            action: "deleted",
            metadata: { milestoneId: existingTask.milestoneId },
          });
        }
      }

      return c.json({ success: true });
    } catch (_error) {
      return c.json({ error: "Failed to delete task" }, 500);
    }
  },
);

// Mark task as completed
router.patch(
  "/:id/complete",
  requireProjectPermissionFromTask(Action.UPDATE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      const existingTask = await taskService.getTaskById(id);
      const task = await taskService.markTaskAsCompleted(id);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const milestone = await milestoneService.getMilestoneById(
        task.milestoneId,
      );
      if (milestone && userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(milestone),
          userId,
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: existingTask?.status,
              newValue: "completed",
              valueType: "enum",
            },
          ],
          metadata: { milestoneId: task.milestoneId },
        });
      }

      return c.json({ task });
    } catch (_error) {
      return c.json({ error: "Failed to mark task as completed" }, 500);
    }
  },
);

// Mark task as not started
router.patch(
  "/:id/not-started",
  requireProjectPermissionFromTask(Action.UPDATE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      const existingTask = await taskService.getTaskById(id);
      const task = await taskService.markTaskAsNotStarted(id);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const milestone = await milestoneService.getMilestoneById(
        task.milestoneId,
      );
      if (milestone && userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(milestone),
          userId,
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: existingTask?.status,
              newValue: "not_started",
              valueType: "enum",
            },
          ],
          metadata: { milestoneId: task.milestoneId },
        });
      }

      return c.json({ task });
    } catch (_error) {
      return c.json({ error: "Failed to mark task as not started" }, 500);
    }
  },
);

// Mark task as in progress
router.patch(
  "/:id/in-progress",
  requireProjectPermissionFromTask(Action.UPDATE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      const existingTask = await taskService.getTaskById(id);
      const task = await taskService.markTaskAsInProgress(id);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const milestone = await milestoneService.getMilestoneById(
        task.milestoneId,
      );
      if (milestone && userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(milestone),
          userId,
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: existingTask?.status,
              newValue: "in_progress",
              valueType: "enum",
            },
          ],
          metadata: { milestoneId: task.milestoneId },
        });
      }

      return c.json({ task });
    } catch (_error) {
      return c.json({ error: "Failed to mark task as in progress" }, 500);
    }
  },
);

// Mark task as delayed
router.patch(
  "/:id/delayed",
  requireProjectPermissionFromTask(Action.UPDATE),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const userId = user?.userId;

    try {
      const existingTask = await taskService.getTaskById(id);
      const task = await taskService.markTaskAsDelayed(id);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const milestone = await milestoneService.getMilestoneById(
        task.milestoneId,
      );
      if (milestone && userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(milestone),
          userId,
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: existingTask?.status,
              newValue: "delayed",
              valueType: "enum",
            },
          ],
          metadata: { milestoneId: task.milestoneId },
        });
      }

      return c.json({ task });
    } catch (_error) {
      return c.json({ error: "Failed to mark task as delayed" }, 500);
    }
  },
);

// Move task to different milestone
router.patch(
  "/:id/move",
  requireProjectPermissionFromTask(Action.UPDATE),
  zValidator("json", z.object({ milestoneId: z.string().uuid() })),
  async (c) => {
    const id = c.req.param("id")!;
    const { milestoneId } = c.req.valid("json");
    const user = c.get("user");
    const userId = user?.userId;

    try {
      // Fetch old task to capture previous milestone ID
      const existingTask = await taskService.getTaskById(id);
      const oldMilestoneId = existingTask?.milestoneId;

      const task = await taskService.moveTaskToMilestone(id, milestoneId);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const newMilestone = await milestoneService.getMilestoneById(milestoneId);
      if (newMilestone && userId) {
        await createTimelineRecord({
          projectId: projectIdOfMilestone(newMilestone),
          userId,
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "updated",
          changes: [
            {
              field: "milestoneId",
              previousValue: oldMilestoneId,
              newValue: milestoneId,
              valueType: "text",
            },
          ],
          metadata: { milestoneId },
        });
      }

      return c.json({ task });
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Failed to move task",
        },
        400,
      );
    }
  },
);

export default router;
