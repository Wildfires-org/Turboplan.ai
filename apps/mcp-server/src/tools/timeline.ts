import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { timelineRecord } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  createTimelineRecordOrThrow,
  getTimeline,
  getTimelineStats,
} from "@wildfires-org/turboplan-timeline-records/server";
import {
  ACTIONS,
  ENTITY_TYPES,
} from "@wildfires-org/turboplan-timeline-records/types";
import { getProjectById } from "@wildfires-org/turboplan-workspace/server";

import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import { projectExists } from "../utils/queries.js";
import type { McpUserContext } from "../utils/types.js";
import {
  entityIdSchema,
  httpUrlSchema,
  validateToolInput,
} from "../utils/validation.js";

export const MAX_TIMELINE_EVENTS_PER_BATCH = 30;

const resourceUrlSchema = z.object({
  url: httpUrlSchema.describe("Direct link to the resource (http/https only)"),
  filename: z
    .string()
    .min(1)
    .max(255)
    .describe("Display name for the resource"),
  type: z.string().max(100).optional().describe("Optional resource type/label"),
});

// Per-event schema, shared between create_timeline_event and the batch variant.
// The startedAt/endedAt ordering guard is applied identically per event.
export const timelineEventSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    startedAt: z.string().datetime().optional(),
    endedAt: z.string().datetime().optional(),
    resourceUrls: z.array(resourceUrlSchema).max(10).optional(),
    isPublic: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.startedAt &&
      value.endedAt &&
      new Date(value.endedAt) < new Date(value.startedAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedAt"],
        message: "endedAt must not be before startedAt",
      });
    }
  });

// The exact array schema the create_timeline_events handler validates against.
export const createTimelineEventsSchema = z
  .array(timelineEventSchema)
  .min(1)
  .max(MAX_TIMELINE_EVENTS_PER_BATCH);

type ValidatedTimelineEvent = z.infer<typeof timelineEventSchema>;

// Builds the exact timeline_record row that create_timeline_event writes via
// createTimelineRecordOrThrow, so batch inserts are byte-for-byte identical.
export const buildEventRow = (
  event: ValidatedTimelineEvent,
  params: {
    projectId: string;
    projectName: string;
    userId: string;
    actor: string;
  },
) => ({
  projectId: params.projectId,
  userId: params.userId,
  entityType: "project" as const,
  entityId: params.projectId,
  entityName: params.projectName,
  action: "created" as const,
  title: event.title,
  description: event.description ?? null,
  changes: null,
  resourceUrls: event.resourceUrls ?? null,
  isPublic: event.isPublic ?? true,
  startedAt: event.startedAt ? new Date(event.startedAt) : null,
  endedAt: event.endedAt ? new Date(event.endedAt) : null,
  metadata: { source: "mcp", actor: params.actor, backfilled: true },
});

export const registerTimelineTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "get_timeline",
    {
      description:
        "Get paginated project timeline (activity log). Shows all changes made to the project — tasks created, milestones updated, fields changed, etc. Requires read access to the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Page number (default: 1)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Items per page (default: 20, max: 50)"),
        entityType: z
          .string()
          .optional()
          .describe(`Filter by entity type: ${ENTITY_TYPES.join(", ")}`),
        action: z
          .string()
          .optional()
          .describe(`Filter by action: ${ACTIONS.join(", ")}`),
      },
    },
    async ({ projectId, page, limit, entityType, action }) =>
      runWithWorkerConnection(async () => {
        const entityTypeEnum = z.enum(ENTITY_TYPES).optional();
        const actionEnum = z.enum(ACTIONS).optional();

        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            page: z.number().int().min(1).optional(),
            limit: z.number().int().min(1).max(50).optional(),
            entityType: entityTypeEnum,
            action: actionEnum,
          }),
          { projectId, page, limit, entityType, action },
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

        const validated = validation.data;
        const result = await getTimeline(projectId as string, {
          page: validated.page ?? 1,
          limit: validated.limit ?? 20,
          entityType: validated.entityType,
          action: validated.action,
        });

        const records = result.records.map((r) => ({
          id: r.id,
          entityType: r.entityType,
          entityId: r.entityId,
          entityName: r.entityName,
          action: r.action,
          title: r.title,
          description: r.description,
          changes: r.changes,
          isPublic: r.isPublic,
          createdAt: r.createdAt,
          authorEmail: r.authorEmail,
          authorFirstName: r.authorFirstName,
          authorLastName: r.authorLastName,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { records, pagination: result.pagination },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "get_timeline_stats",
    {
      description:
        "Get activity summary for a project — counts of actions grouped by entity type (e.g. how many tasks created, milestones updated). Requires read access to the project.",
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

        const stats = await getTimelineStats(projectId as string);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "create_timeline_event",
    {
      description:
        "Record a historical public event on a project's timeline (e.g. 'Notice of Intent published', 'Public comment period opened'). Use this to backfill real, verifiable project milestones so the timeline reads as complete. Requires editor role or higher on the project. When recording multiple events at once, prefer create_timeline_events.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        title: z.string().min(1).max(255).describe("Event title"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Event description / details"),
        startedAt: z
          .string()
          .datetime()
          .optional()
          .describe("When the event started (ISO 8601 datetime)"),
        endedAt: z
          .string()
          .datetime()
          .optional()
          .describe(
            "When the event ended (ISO 8601 datetime, not before startedAt)",
          ),
        resourceUrls: z
          .array(resourceUrlSchema)
          .max(10)
          .optional()
          .describe("Related links (documents, notices) — up to 10"),
        isPublic: z
          .boolean()
          .optional()
          .describe(
            "Whether the event is publicly visible (default: true — historical public events)",
          ),
      },
    },
    async ({
      projectId,
      title,
      description,
      startedAt,
      endedAt,
      resourceUrls,
      isPublic,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z
            .object({
              projectId: entityIdSchema,
              title: z.string().min(1).max(255),
              description: z.string().max(2000).optional(),
              startedAt: z.string().datetime().optional(),
              endedAt: z.string().datetime().optional(),
              resourceUrls: z.array(resourceUrlSchema).max(10).optional(),
              isPublic: z.boolean().optional(),
            })
            .superRefine((value, ctx) => {
              if (
                value.startedAt &&
                value.endedAt &&
                new Date(value.endedAt) < new Date(value.startedAt)
              ) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["endedAt"],
                  message: "endedAt must not be before startedAt",
                });
              }
            }),
          {
            projectId,
            title,
            description,
            startedAt,
            endedAt,
            resourceUrls,
            isPublic,
          },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const project = await getProjectById(projectId as string);
        const notFound = assertEntityExists(
          project,
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

        // Throwing variant: the calling agent must see insert failures rather
        // than have them silently swallowed.
        await createTimelineRecordOrThrow({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "project",
          entityId: projectId as string,
          entityName: project!.name,
          action: "created",
          title: validated.title,
          description: validated.description,
          isPublic: validated.isPublic ?? true,
          startedAt: validated.startedAt,
          endedAt: validated.endedAt,
          resourceUrls: validated.resourceUrls,
          // backfilled: distinguishes user-authored historical events from
          // system-generated audit records sharing the same action values.
          metadata: { source: "mcp", actor: user.actor, backfilled: true },
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
    "create_timeline_events",
    {
      description:
        "Record multiple historical public events on a project's timeline in a single call (e.g. 'Notice of Intent published', 'Public comment period opened'). Use this to backfill real, verifiable project milestones. Requires editor role or higher on the project. Maximum 30 events per call. All events are created together — if any event is invalid, none are created.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        events: z
          .array(
            z.object({
              title: z.string().min(1).max(255).describe("Event title"),
              description: z
                .string()
                .max(2000)
                .optional()
                .describe("Event description / details"),
              startedAt: z
                .string()
                .datetime()
                .optional()
                .describe("When the event started (ISO 8601 datetime)"),
              endedAt: z
                .string()
                .datetime()
                .optional()
                .describe(
                  "When the event ended (ISO 8601 datetime, not before startedAt)",
                ),
              resourceUrls: z
                .array(resourceUrlSchema)
                .max(10)
                .optional()
                .describe("Related links (documents, notices) — up to 10"),
              isPublic: z
                .boolean()
                .optional()
                .describe(
                  "Whether the event is publicly visible (default: true — historical public events)",
                ),
            }),
          )
          .min(1)
          .max(MAX_TIMELINE_EVENTS_PER_BATCH)
          .describe(`Events to record (1-${MAX_TIMELINE_EVENTS_PER_BATCH})`),
      },
    },
    async ({ projectId, events }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            events: createTimelineEventsSchema,
          }),
          { projectId, events },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const project = await getProjectById(projectId as string);
        const notFound = assertEntityExists(
          project,
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

        // All-or-nothing: a single multi-row insert is atomic and propagates
        // DB errors to the caller, matching create_timeline_event's throwing
        // semantics. Each row is byte-for-byte identical to the singular tool.
        const rows = validated.events.map((event) =>
          buildEventRow(event, {
            projectId: projectId as string,
            projectName: project!.name,
            userId: user.userId,
            actor: user.actor,
          }),
        );

        await db.insert(timelineRecord).values(rows);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, created: rows.length },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );
};
