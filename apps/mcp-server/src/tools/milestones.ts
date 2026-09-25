import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { milestones, type TaskStatus } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  DrizzleMilestoneRepository,
  DrizzleTaskRepository,
  DrizzleUserRepository,
  MilestoneService,
  TaskService,
  validateAssigneeIds,
  validateTaskReferences,
} from "@wildfires-org/turboplan-tasks/server";
import {
  computeChanges,
  createTimelineRecord,
  milestoneFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";

import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import { projectExists } from "../utils/queries.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

const statusSchema = z.enum([
  "draft",
  "not_started",
  "in_progress",
  "completed",
  "delayed",
]);

export const MAX_TASKS_PER_MILESTONE_BATCH = 30;

// Per-task item accepted when creating a milestone with nested tasks. Mirrors
// the create_task input fields that make sense at creation time (dependencies
// are omitted: sibling tasks do not exist yet when the milestone is created).
export const nestedTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  status: statusSchema.optional(),
  projectDocumentIds: z.array(z.string().uuid()).optional(),
});

// The exact schema the create_milestone handler validates the tasks array
// against (optional; capped at MAX_TASKS_PER_MILESTONE_BATCH).
export const nestedTasksSchema = z
  .array(nestedTaskSchema)
  .max(MAX_TASKS_PER_MILESTONE_BATCH)
  .optional();

const milestoneExists = async (id: string) => {
  const result = await db
    .select()
    .from(milestones)
    .where(eq(milestones.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
};

/** First reference error across a batch of nested tasks, or `null`. */
const firstTaskReferenceError = async (
  projectId: string,
  nestedTasks: z.infer<typeof nestedTaskSchema>[],
): Promise<string | null> => {
  for (const nestedTask of nestedTasks) {
    const error = await validateTaskReferences(projectId, nestedTask);
    if (error) {
      return error;
    }
  }
  return null;
};

const getProjectIdFromMilestone = (
  milestone: typeof milestones.$inferSelect,
): string => {
  return milestone.projectId ?? milestone.documentId;
};

export const registerMilestoneTools = (
  server: McpServer,
  user: McpUserContext,
) => {
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
    "list_milestones",
    {
      description:
        "List all milestones for a project, including their nested tasks. Requires read access to the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ projectId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ projectId: entityIdSchema }),
          { projectId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const proj = await projectExists(projectId as string);
        const notFound = assertEntityExists(
          proj,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const milestonesWithTasks =
          await milestoneService.getMilestonesByProjectId(projectId as string);

        const result = milestonesWithTasks.map((m) => ({
          id: m.id,
          projectId: projectId as string,
          title: m.title,
          status: m.status,
          startDate: m.startDate,
          dueDate: m.dueDate,
          assigneeIds: m.assigneeIds,
          order: m.order,
          tasks: m.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            startDate: t.startDate,
            dueDate: t.dueDate,
            assigneeIds: t.assigneeIds,
            description: t.description,
          })),
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
    "get_milestone",
    {
      description:
        "Get a single milestone by ID with its tasks. Requires read access to the project.",
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

        const existing = await milestoneExists(milestoneId as string);
        const notFound = assertEntityExists(
          existing,
          milestoneId as string,
          "milestone",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const projectId = getProjectIdFromMilestone(existing!);

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

        const milestonesWithTasks =
          await milestoneService.getMilestonesByProjectId(projectId);
        const milestone = milestonesWithTasks.find(
          (m) => m.id === (milestoneId as string),
        );

        if (!milestone) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Access denied.",
              },
            ],
          };
        }

        const result = {
          id: milestone.id,
          projectId,
          title: milestone.title,
          status: milestone.status,
          startDate: milestone.startDate,
          dueDate: milestone.dueDate,
          assigneeIds: milestone.assigneeIds,
          order: milestone.order,
          tasks: milestone.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            startDate: t.startDate,
            dueDate: t.dueDate,
            assigneeIds: t.assigneeIds,
            description: t.description,
          })),
        };

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
    "create_milestone",
    {
      description:
        "Create a new milestone in a project, optionally with its tasks in the same call. Requires editor role or higher on the project. Dates default to tomorrow (start) and next week (due) if not provided. Pass a 'tasks' array (max 30) to create the milestone and all its tasks together; if any task is invalid, nothing is created. Omit 'tasks' to create an empty milestone (unchanged behavior).",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        title: z
          .string()
          .min(1)
          .max(255)
          .describe("Milestone title (1-255 chars)"),
        startDate: z
          .string()
          .optional()
          .describe(
            "Start date as ISO 8601 datetime string (default: tomorrow)",
          ),
        dueDate: z
          .string()
          .optional()
          .describe(
            "Due date as ISO 8601 datetime string (default: next week)",
          ),
        assigneeIds: z
          .array(z.string().uuid())
          .optional()
          .describe("Array of user UUIDs to assign"),
        tasks: z
          .array(
            z.object({
              title: z.string().min(1).max(255).describe("Task title"),
              description: z
                .string()
                .max(2000)
                .optional()
                .describe("Task description"),
              startDate: z
                .string()
                .optional()
                .describe(
                  "Start date as ISO 8601 datetime string (default: today)",
                ),
              dueDate: z
                .string()
                .optional()
                .describe(
                  "Due date as ISO 8601 datetime string (default: tomorrow)",
                ),
              assigneeIds: z
                .array(z.string().uuid())
                .optional()
                .describe("Array of user UUIDs to assign"),
              status: z
                .enum([
                  "draft",
                  "not_started",
                  "in_progress",
                  "completed",
                  "delayed",
                ])
                .optional()
                .describe("Task status (default: not_started)"),
              projectDocumentIds: z
                .array(z.string().uuid())
                .optional()
                .describe("Array of project document UUIDs to link"),
            }),
          )
          .max(MAX_TASKS_PER_MILESTONE_BATCH)
          .optional()
          .describe(
            `Optional tasks to create under this milestone (max ${MAX_TASKS_PER_MILESTONE_BATCH})`,
          ),
      },
    },
    async ({ projectId, title, startDate, dueDate, assigneeIds, tasks }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            title: z.string().min(1).max(255),
            startDate: z.string().datetime().optional(),
            dueDate: z.string().datetime().optional(),
            assigneeIds: z.array(z.string().uuid()).optional(),
            tasks: nestedTasksSchema,
          }),
          { projectId, title, startDate, dueDate, assigneeIds, tasks },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const proj = await projectExists(projectId as string);
        const notFound = assertEntityExists(
          proj,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        // Validate the milestone's and every nested task's references before
        // anything is inserted, so a bad id never leaves a partial milestone.
        const referenceError =
          (await validateAssigneeIds(validated.assigneeIds)) ??
          (await firstTaskReferenceError(
            projectId as string,
            validated.tasks ?? [],
          ));
        if (referenceError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: referenceError }],
          };
        }

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const resolvedStartDate = validated.startDate
          ? new Date(validated.startDate)
          : tomorrow;
        const resolvedDueDate = validated.dueDate
          ? new Date(validated.dueDate)
          : nextWeek;

        const milestone = await milestoneService.createMilestone({
          title: validated.title,
          assigneeIds: validated.assigneeIds,
          startDate: resolvedStartDate,
          dueDate: resolvedDueDate,
          documentId: projectId as string,
          projectId: projectId as string,
          userId: user.userId,
        });

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "milestone",
          entityId: milestone.id,
          entityName: milestone.title,
          action: "created",
          metadata: { source: "mcp", actor: user.actor },
        });

        // Nested tasks: each is created exactly as create_task would, under the
        // new milestone. The tasks package repositories use the shared db client
        // rather than an injectable transaction, so a single DB transaction is
        // not achievable through the service layer. To preserve all-or-nothing
        // semantics, validation runs up front and any mid-flight failure is
        // compensated by deleting the created tasks and the milestone before the
        // error is surfaced to the caller.
        const createdTasks: Awaited<
          ReturnType<typeof taskService.createTask>
        >[] = [];

        if (validated.tasks && validated.tasks.length > 0) {
          const taskNow = new Date();
          const taskToday = new Date(taskNow);
          taskToday.setHours(0, 0, 0, 0);
          const taskTomorrow = new Date(taskNow);
          taskTomorrow.setDate(taskTomorrow.getDate() + 1);
          taskTomorrow.setHours(0, 0, 0, 0);

          try {
            for (const taskInput of validated.tasks) {
              const task = await taskService.createTask({
                title: taskInput.title,
                description: taskInput.description,
                assigneeIds: taskInput.assigneeIds,
                projectDocumentIds: taskInput.projectDocumentIds,
                status: taskInput.status as TaskStatus | undefined,
                startDate: taskInput.startDate
                  ? new Date(taskInput.startDate)
                  : taskToday,
                dueDate: taskInput.dueDate
                  ? new Date(taskInput.dueDate)
                  : taskTomorrow,
                milestoneId: milestone.id,
                documentId: projectId as string,
                userId: user.userId,
              });

              await createTimelineRecord({
                projectId: projectId as string,
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

              createdTasks.push(task);
            }
          } catch (error) {
            // Compensating rollback: undo everything created in this call.
            // Deleting the milestone cascades to its tasks, so it is the
            // authoritative cleanup; explicit task deletes run first as
            // best-effort. If the milestone delete itself fails, partial
            // state remains — surface that so the caller does not retry
            // assuming nothing was created.
            for (const created of createdTasks) {
              try {
                await taskService.deleteTask(created.id);
              } catch (cleanupError) {
                console.error(
                  `Rollback: failed to delete task ${created.id}`,
                  cleanupError,
                );
              }
            }
            try {
              await milestoneService.deleteMilestone(milestone.id);
            } catch (cleanupError) {
              console.error(
                `Rollback: failed to delete milestone ${milestone.id}`,
                cleanupError,
              );
              const reason =
                error instanceof Error ? error.message : String(error);
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Task creation failed (${reason}) and rollback was incomplete: milestone ${milestone.id} may still exist with partial tasks. Verify project state before retrying.`,
                  },
                ],
              };
            }
            throw error;
          }
        }

        // Creating tasks recalculates the milestone status in the DB, so
        // re-read it for an accurate response when tasks were added. Without
        // tasks this stays the freshly-created milestone (unchanged behavior).
        let milestoneStatus = milestone.status;
        if (createdTasks.length > 0) {
          const refreshed = await milestoneService.getMilestoneById(
            milestone.id,
          );
          if (refreshed) {
            milestoneStatus = refreshed.status;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  milestone: {
                    id: milestone.id,
                    projectId: projectId as string,
                    title: milestone.title,
                    status: milestoneStatus,
                    startDate: milestone.startDate,
                    dueDate: milestone.dueDate,
                    assigneeIds: milestone.assigneeIds,
                    order: milestone.order,
                  },
                  tasks: createdTasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: t.status,
                    startDate: t.startDate,
                    dueDate: t.dueDate,
                    assigneeIds: t.assigneeIds,
                    milestoneId: t.milestoneId,
                    order: t.order,
                  })),
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
    "update_milestone",
    {
      description:
        "Update a milestone's fields. Requires editor role or higher on the project. Start date must be before due date.",
      inputSchema: {
        milestoneId: z.string().uuid().describe("Milestone UUID"),
        title: z
          .string()
          .min(1)
          .max(255)
          .optional()
          .describe("New milestone title"),
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
          .describe("New milestone status"),
        assigneeIds: z
          .array(z.string().uuid())
          .optional()
          .describe("New array of user UUIDs to assign"),
      },
    },
    async ({ milestoneId, title, startDate, dueDate, status, assigneeIds }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            milestoneId: entityIdSchema,
            title: z.string().min(1).max(255).optional(),
            startDate: z.string().datetime().optional(),
            dueDate: z.string().datetime().optional(),
            status: statusSchema.optional(),
            assigneeIds: z.array(z.string().uuid()).optional(),
          }),
          { milestoneId, title, startDate, dueDate, status, assigneeIds },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await milestoneExists(milestoneId as string);
        const notFound = assertEntityExists(
          existing,
          milestoneId as string,
          "milestone",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const projectId = getProjectIdFromMilestone(existing!);

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

        const assigneeError = await validateAssigneeIds(validated.assigneeIds);
        if (assigneeError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: assigneeError }],
          };
        }

        const updateData: Record<string, unknown> = {};

        if (validated.title !== undefined) {
          updateData.title = validated.title;
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

        const updatedMilestone = await milestoneService.updateMilestone(
          milestoneId as string,
          updateData,
        );

        if (!updatedMilestone) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Failed to update milestone.",
              },
            ],
          };
        }

        const changes = computeChanges(
          existing as unknown as Record<string, unknown>,
          updatedMilestone as unknown as Record<string, unknown>,
          milestoneFieldDefs,
        );
        if (changes.length > 0) {
          await createTimelineRecord({
            projectId,
            userId: user.userId,
            entityType: "milestone",
            entityId: milestoneId as string,
            entityName: updatedMilestone.title,
            action: "updated",
            changes,
            metadata: { source: "mcp", actor: user.actor },
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  milestone: {
                    id: updatedMilestone.id,
                    projectId,
                    title: updatedMilestone.title,
                    status: updatedMilestone.status,
                    startDate: updatedMilestone.startDate,
                    dueDate: updatedMilestone.dueDate,
                    assigneeIds: updatedMilestone.assigneeIds,
                    order: updatedMilestone.order,
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
    "delete_milestone",
    {
      description:
        "Delete a milestone and all its tasks (cascade). Requires editor role or higher on the project.",
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

        const existing = await milestoneExists(milestoneId as string);
        const notFound = assertEntityExists(
          existing,
          milestoneId as string,
          "milestone",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const projectId = getProjectIdFromMilestone(existing!);

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

        await milestoneService.deleteMilestone(milestoneId as string);

        await createTimelineRecord({
          projectId,
          userId: user.userId,
          entityType: "milestone",
          entityId: milestoneId as string,
          entityName: existing!.title,
          action: "deleted",
          metadata: { source: "mcp", actor: user.actor },
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
};
