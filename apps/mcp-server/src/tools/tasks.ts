import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { TaskStatus, tasks } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import {
  getMilestoneProjectId,
  getTaskProjectId,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  DrizzleMilestoneRepository,
  DrizzleTaskRepository,
  DrizzleUserRepository,
  MilestoneService,
  TaskService,
  validateTaskReferences,
} from "@wildfires-org/turboplan-tasks/server";
import {
  computeChanges,
  createTimelineRecord,
  taskFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";

import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

const statusSchema = z.enum([
  "draft",
  "not_started",
  "in_progress",
  "completed",
  "delayed",
]);

const taskExists = async (id: string) => {
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
};

export const registerTaskTools = (server: McpServer, user: McpUserContext) => {
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

  server.registerTool(
    "list_tasks",
    {
      description:
        "List all tasks in a milestone. Requires read access to the project.",
      inputSchema: {
        milestoneId: z.string().uuid().describe("Milestone UUID"),
      },
    },
    async ({ milestoneId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ milestoneId: entityIdSchema }),
          { milestoneId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const projectId = await getMilestoneProjectId(milestoneId as string);
        if (!projectId) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Access denied." }],
          };
        }

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const taskList = await taskService.getTasksByMilestone(
          milestoneId as string,
        );

        const result = taskList.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          startDate: t.startDate,
          dueDate: t.dueDate,
          assigneeIds: t.assigneeIds,
          dependencies: t.dependencies,
          projectDocumentIds: t.projectDocumentIds,
          order: t.order,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "get_task",
    {
      description:
        "Get a single task by ID. Requires read access to the project.",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
      },
    },
    async ({ taskId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ taskId: entityIdSchema }),
          { taskId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await taskExists(taskId as string);
        const notFound = assertEntityExists(
          existing,
          taskId as string,
          "task",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        // Not `existing.documentId`: on legacy tasks that is a chat document.
        const projectId =
          (await getTaskProjectId(taskId as string)) ?? existing!.documentId;

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const task = await taskService.getTaskById(taskId as string);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: task!.id,
                  title: task!.title,
                  description: task!.description,
                  status: task!.status,
                  startDate: task!.startDate,
                  dueDate: task!.dueDate,
                  assigneeIds: task!.assigneeIds,
                  dependencies: task!.dependencies,
                  projectDocumentIds: task!.projectDocumentIds,
                  milestoneId: task!.milestoneId,
                  order: task!.order,
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "create_task",
    {
      description:
        "Create a new task in a milestone. Requires editor role or higher on the project. Dates default to today (start) and tomorrow (due) if not provided.",
      inputSchema: {
        milestoneId: z.string().uuid().describe("Milestone UUID"),
        title: z.string().min(1).max(255).describe("Task title"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Task description"),
        startDate: z
          .string()
          .optional()
          .describe("Start date as ISO 8601 datetime string (default: today)"),
        dueDate: z
          .string()
          .optional()
          .describe("Due date as ISO 8601 datetime string (default: tomorrow)"),
        assigneeIds: z
          .array(z.string().uuid())
          .optional()
          .describe("Array of user UUIDs to assign"),
        status: z
          .enum(["draft", "not_started", "in_progress", "completed", "delayed"])
          .optional()
          .describe("Task status (default: not_started)"),
        dependencies: z
          .array(z.string().uuid())
          .optional()
          .describe("Array of task UUIDs this task depends on"),
        projectDocumentIds: z
          .array(z.string().uuid())
          .optional()
          .describe("Array of project document UUIDs to link"),
      },
    },
    async ({
      milestoneId,
      title,
      description,
      startDate,
      dueDate,
      assigneeIds,
      status,
      dependencies,
      projectDocumentIds,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            milestoneId: entityIdSchema,
            title: z.string().min(1).max(255),
            description: z.string().max(2000).optional(),
            startDate: z.string().datetime().optional(),
            dueDate: z.string().datetime().optional(),
            assigneeIds: z.array(z.string().uuid()).optional(),
            status: statusSchema.optional(),
            dependencies: z.array(z.string().uuid()).optional(),
            projectDocumentIds: z.array(z.string().uuid()).optional(),
          }),
          {
            milestoneId,
            title,
            description,
            startDate,
            dueDate,
            assigneeIds,
            status,
            dependencies,
            projectDocumentIds,
          },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const projectId = await getMilestoneProjectId(milestoneId as string);
        if (!projectId) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Access denied." }],
          };
        }

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        const referenceError = await validateTaskReferences(
          projectId,
          validated,
        );
        if (referenceError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: referenceError }],
          };
        }

        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const task = await taskService.createTask({
          title: validated.title,
          description: validated.description,
          assigneeIds: validated.assigneeIds,
          dependencies: validated.dependencies,
          projectDocumentIds: validated.projectDocumentIds,
          status: validated.status as TaskStatus | undefined,
          startDate: validated.startDate
            ? new Date(validated.startDate)
            : today,
          dueDate: validated.dueDate ? new Date(validated.dueDate) : tomorrow,
          milestoneId: validated.milestoneId,
          documentId: projectId,
          userId: user.userId,
        });

        await createTimelineRecord({
          projectId,
          userId: user.userId,
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "created",
          metadata: {
            source: "mcp",
            actor: user.actor,
            milestoneId: task.milestoneId,
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  task: {
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    startDate: task.startDate,
                    dueDate: task.dueDate,
                    assigneeIds: task.assigneeIds,
                    milestoneId: task.milestoneId,
                    order: task.order,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "update_task",
    {
      description:
        "Update a task's fields. Requires editor role or higher on the project. Start date must be before due date.",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
        title: z.string().min(1).max(255).optional().describe("New task title"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("New task description"),
        startDate: z
          .string()
          .optional()
          .describe("New start date as ISO 8601 datetime string"),
        dueDate: z
          .string()
          .optional()
          .describe("New due date as ISO 8601 datetime string"),
        status: z
          .enum(["draft", "not_started", "in_progress", "completed", "delayed"])
          .optional()
          .describe("New task status"),
        assigneeIds: z
          .array(z.string().uuid())
          .optional()
          .describe("New array of user UUIDs to assign"),
        milestoneId: z
          .string()
          .uuid()
          .optional()
          .describe("Move task to a different milestone"),
        projectDocumentIds: z
          .array(z.string().uuid())
          .optional()
          .describe("New array of project document UUIDs to link"),
      },
    },
    async ({
      taskId,
      title,
      description,
      startDate,
      dueDate,
      status,
      assigneeIds,
      milestoneId,
      projectDocumentIds,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            taskId: entityIdSchema,
            title: z.string().min(1).max(255).optional(),
            description: z.string().max(2000).optional(),
            startDate: z.string().datetime().optional(),
            dueDate: z.string().datetime().optional(),
            status: statusSchema.optional(),
            assigneeIds: z.array(z.string().uuid()).optional(),
            milestoneId: entityIdSchema.optional(),
            projectDocumentIds: z.array(z.string().uuid()).optional(),
          }),
          {
            taskId,
            title,
            description,
            startDate,
            dueDate,
            status,
            assigneeIds,
            milestoneId,
            projectDocumentIds,
          },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await taskExists(taskId as string);
        const notFound = assertEntityExists(
          existing,
          taskId as string,
          "task",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        // Not `existing.documentId`: on legacy tasks that is a chat document.
        const projectId =
          (await getTaskProjectId(taskId as string)) ?? existing!.documentId;

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        // The task's own project is where every incoming id must resolve.
        const referenceError = await validateTaskReferences(
          projectId,
          validated,
        );
        if (referenceError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: referenceError }],
          };
        }

        const updateData: Record<string, unknown> = {};

        if (validated.title !== undefined) {
          updateData.title = validated.title;
        }
        if (validated.description !== undefined) {
          updateData.description = validated.description;
        }
        if (validated.startDate !== undefined) {
          updateData.startDate = new Date(validated.startDate);
        }
        if (validated.dueDate !== undefined) {
          updateData.dueDate = new Date(validated.dueDate);
        }
        if (validated.status !== undefined) {
          updateData.status = validated.status;
        }
        if (validated.assigneeIds !== undefined) {
          updateData.assigneeIds = validated.assigneeIds;
        }
        if (validated.milestoneId !== undefined) {
          const targetProjectId = await getMilestoneProjectId(
            validated.milestoneId,
          );
          if (!targetProjectId || targetProjectId !== projectId) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: "Access denied." }],
            };
          }
          updateData.milestoneId = validated.milestoneId;
        }
        if (validated.projectDocumentIds !== undefined) {
          updateData.projectDocumentIds = validated.projectDocumentIds;
        }

        const updatedTask = await taskService.updateTask(
          taskId as string,
          updateData,
        );

        if (!updatedTask) {
          return {
            isError: true,
            content: [
              { type: "text" as const, text: "Failed to update task." },
            ],
          };
        }

        const changes = computeChanges(
          existing as unknown as Record<string, unknown>,
          updatedTask as unknown as Record<string, unknown>,
          taskFieldDefs,
        );
        if (changes.length > 0) {
          await createTimelineRecord({
            projectId,
            userId: user.userId,
            entityType: "task",
            entityId: taskId as string,
            entityName: updatedTask.title,
            action: "updated",
            changes,
            metadata: {
              source: "mcp",
              actor: user.actor,
              milestoneId: updatedTask.milestoneId,
            },
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  task: {
                    id: updatedTask.id,
                    title: updatedTask.title,
                    description: updatedTask.description,
                    status: updatedTask.status,
                    startDate: updatedTask.startDate,
                    dueDate: updatedTask.dueDate,
                    assigneeIds: updatedTask.assigneeIds,
                    milestoneId: updatedTask.milestoneId,
                    order: updatedTask.order,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "delete_task",
    {
      description:
        "Delete a task. Requires editor role or higher on the project.",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
      },
    },
    async ({ taskId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ taskId: entityIdSchema }),
          { taskId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await taskExists(taskId as string);
        const notFound = assertEntityExists(
          existing,
          taskId as string,
          "task",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        // Not `existing.documentId`: on legacy tasks that is a chat document.
        const projectId =
          (await getTaskProjectId(taskId as string)) ?? existing!.documentId;

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        await taskService.deleteTask(taskId as string);

        await createTimelineRecord({
          projectId,
          userId: user.userId,
          entityType: "task",
          entityId: taskId as string,
          entityName: existing!.title,
          action: "deleted",
          metadata: {
            source: "mcp",
            actor: user.actor,
            milestoneId: existing!.milestoneId,
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true }, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "update_task_status",
    {
      description:
        "Update a task's status. Convenience tool for quick status transitions. Requires editor role or higher on the project.",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
        status: z
          .enum(["not_started", "in_progress", "completed", "delayed"])
          .describe("New status"),
      },
    },
    async ({ taskId, status }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            taskId: entityIdSchema,
            status: z.enum([
              "not_started",
              "in_progress",
              "completed",
              "delayed",
            ]),
          }),
          { taskId, status },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await taskExists(taskId as string);
        const notFound = assertEntityExists(
          existing,
          taskId as string,
          "task",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        // Not `existing.documentId`: on legacy tasks that is a chat document.
        const projectId =
          (await getTaskProjectId(taskId as string)) ?? existing!.documentId;

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const previousStatus = existing!.status;
        const validated = validation.data;

        let updatedTask;
        switch (validated.status) {
          case "not_started":
            updatedTask = await taskService.markTaskAsNotStarted(
              taskId as string,
            );
            break;
          case "in_progress":
            updatedTask = await taskService.markTaskAsInProgress(
              taskId as string,
            );
            break;
          case "completed":
            updatedTask = await taskService.markTaskAsCompleted(
              taskId as string,
            );
            break;
          case "delayed":
            updatedTask = await taskService.markTaskAsDelayed(taskId as string);
            break;
        }

        if (!updatedTask) {
          return {
            isError: true,
            content: [
              { type: "text" as const, text: "Failed to update task status." },
            ],
          };
        }

        await createTimelineRecord({
          projectId,
          userId: user.userId,
          entityType: "task",
          entityId: taskId as string,
          entityName: updatedTask.title,
          action: "updated",
          changes: [
            {
              field: "status",
              previousValue: previousStatus,
              newValue: validated.status,
              valueType: "enum",
            },
          ],
          metadata: {
            source: "mcp",
            actor: user.actor,
            milestoneId: updatedTask.milestoneId,
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  task: {
                    id: updatedTask.id,
                    title: updatedTask.title,
                    status: updatedTask.status,
                    milestoneId: updatedTask.milestoneId,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "move_task",
    {
      description:
        "Move a task to a different milestone. Recalculates status on both source and target milestones. Requires editor role or higher on the project.",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
        targetMilestoneId: z.string().uuid().describe("Target milestone UUID"),
      },
    },
    async ({ taskId, targetMilestoneId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            taskId: entityIdSchema,
            targetMilestoneId: entityIdSchema,
          }),
          { taskId, targetMilestoneId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await taskExists(taskId as string);
        const notFound = assertEntityExists(
          existing,
          taskId as string,
          "task",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        // Not `existing.documentId`: on legacy tasks that is a chat document.
        const projectId =
          (await getTaskProjectId(taskId as string)) ?? existing!.documentId;

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const targetProjectId = await getMilestoneProjectId(
          targetMilestoneId as string,
        );
        if (!targetProjectId || targetProjectId !== projectId) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Access denied." }],
          };
        }

        const oldMilestoneId = existing!.milestoneId;

        const updatedTask = await taskService.moveTaskToMilestone(
          taskId as string,
          targetMilestoneId as string,
        );

        if (!updatedTask) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Failed to move task." }],
          };
        }

        await createTimelineRecord({
          projectId,
          userId: user.userId,
          entityType: "task",
          entityId: taskId as string,
          entityName: updatedTask.title,
          action: "updated",
          changes: [
            {
              field: "milestoneId",
              previousValue: oldMilestoneId,
              newValue: targetMilestoneId as string,
              valueType: "text",
            },
          ],
          metadata: {
            source: "mcp",
            actor: user.actor,
            milestoneId: targetMilestoneId as string,
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  task: {
                    id: updatedTask.id,
                    title: updatedTask.title,
                    status: updatedTask.status,
                    milestoneId: updatedTask.milestoneId,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );
};
