import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { projectContext } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import { projectExists } from "../utils/queries.js";
import type { McpUserContext } from "../utils/types.js";
import {
  entityIdSchema,
  httpUrlSchema,
  validateToolInput,
} from "../utils/validation.js";

export const MAX_CONTEXT_ENTRIES_PER_BATCH = 20;

// Shared per-entry shape, identical to the singular add_project_context input,
// reused by the batch variant so both validate each entry the same way.
export const contextEntrySchema = z.object({
  label: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  url: httpUrlSchema.optional(),
});

// The exact array schema the add_project_context_entries handler validates.
export const addProjectContextEntriesSchema = z
  .array(contextEntrySchema)
  .min(1)
  .max(MAX_CONTEXT_ENTRIES_PER_BATCH);

export const registerContextTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "list_project_context",
    {
      description:
        "List all context entries for a project. Context entries contain structured background information (e.g. regulatory background, environmental analysis) typically populated by the research agent. Requires read access to the project.",
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

        const entries = await db
          .select({
            id: projectContext.id,
            label: projectContext.label,
            content: projectContext.content,
            url: projectContext.url,
            createdAt: projectContext.createdAt,
          })
          .from(projectContext)
          .where(eq(projectContext.projectId, projectId as string))
          .orderBy(projectContext.createdAt);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(entries, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "add_project_context",
    {
      description:
        "Add a context entry to a project. Context entries store structured background information such as regulatory background, environmental analysis, or project history. Requires editor role or higher on the project. When adding multiple context entries at once, prefer add_project_context_entries.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        label: z
          .string()
          .min(1)
          .max(200)
          .describe("Context entry label (e.g. 'Regulatory Background')"),
        content: z
          .string()
          .min(1)
          .max(50000)
          .describe("Context entry content (detailed text, max 50000 chars)"),
        url: z
          .string()
          .optional()
          .describe("Optional source URL for the context entry"),
      },
    },
    async ({ projectId, label, content, url }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            label: z.string().min(1).max(200),
            content: z.string().min(1).max(50000),
            url: httpUrlSchema.optional(),
          }),
          { projectId, label, content, url },
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

        const [newEntry] = await db
          .insert(projectContext)
          .values({
            projectId: projectId as string,
            label: validated.label,
            content: validated.content,
            url: validated.url,
            createdBy: user.userId,
          })
          .returning();

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "context",
          entityId: newEntry.id,
          entityName: newEntry.label,
          action: "created",
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  contextEntry: {
                    id: newEntry.id,
                    label: newEntry.label,
                    content: newEntry.content,
                    url: newEntry.url,
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
    "add_project_context_entries",
    {
      description:
        "Add multiple context entries to a project in a single call. Context entries store structured background information such as regulatory background, environmental analysis, or project history. Requires editor role or higher on the project. Maximum 20 entries per call. All entries are created together — if any entry is invalid, none are created.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        entries: z
          .array(
            z.object({
              label: z
                .string()
                .min(1)
                .max(200)
                .describe("Context entry label (e.g. 'Regulatory Background')"),
              content: z
                .string()
                .min(1)
                .max(50000)
                .describe(
                  "Context entry content (detailed text, max 50000 chars)",
                ),
              url: z
                .string()
                .optional()
                .describe("Optional source URL for the context entry"),
            }),
          )
          .min(1)
          .max(MAX_CONTEXT_ENTRIES_PER_BATCH)
          .describe(
            `Context entries to create (1-${MAX_CONTEXT_ENTRIES_PER_BATCH})`,
          ),
      },
    },
    async ({ projectId, entries }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            entries: addProjectContextEntriesSchema,
          }),
          { projectId, entries },
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

        // All-or-nothing: insert every entry in one transaction.
        const insertedEntries = await db.transaction(async (tx) => {
          const created: (typeof projectContext.$inferSelect)[] = [];
          for (const entry of validated.entries) {
            const [newEntry] = await tx
              .insert(projectContext)
              .values({
                projectId: projectId as string,
                label: entry.label,
                content: entry.content,
                url: entry.url,
                createdBy: user.userId,
              })
              .returning();
            created.push(newEntry);
          }
          return created;
        });

        // One timeline record per created entry, matching the singular tool.
        for (const newEntry of insertedEntries) {
          await createTimelineRecord({
            projectId: projectId as string,
            userId: user.userId,
            entityType: "context",
            entityId: newEntry.id,
            entityName: newEntry.label,
            action: "created",
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
                  contextEntries: insertedEntries.map((e) => ({
                    id: e.id,
                    label: e.label,
                    content: e.content,
                    url: e.url,
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
    "update_project_context",
    {
      description:
        "Update a context entry. Requires editor role or higher on the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        contextId: z.string().uuid().describe("Context entry UUID"),
        label: z.string().min(1).max(200).optional().describe("New label"),
        content: z
          .string()
          .min(1)
          .max(50000)
          .optional()
          .describe("New content (max 50000 chars)"),
        url: z
          .string()
          .optional()
          .nullable()
          .describe("New source URL (null to clear)"),
      },
    },
    async ({ projectId, contextId, label, content, url }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            contextId: entityIdSchema,
            label: z.string().min(1).max(200).optional(),
            content: z.string().min(1).max(50000).optional(),
            url: httpUrlSchema.nullable().optional(),
          }),
          { projectId, contextId, label, content, url },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existingEntry = await db
          .select()
          .from(projectContext)
          .where(
            and(
              eq(projectContext.id, contextId as string),
              eq(projectContext.projectId, projectId as string),
            ),
          )
          .limit(1);

        const notFound = assertEntityExists(
          existingEntry[0],
          contextId as string,
          "context entry",
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
        const updates: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (validated.label !== undefined) {
          updates.label = validated.label;
        }
        if (validated.content !== undefined) {
          updates.content = validated.content;
        }
        if (validated.url !== undefined) {
          updates.url = validated.url ?? null;
        }

        const [updated] = await db
          .update(projectContext)
          .set(updates)
          .where(eq(projectContext.id, contextId as string))
          .returning();

        const changes = [];
        if (
          validated.label !== undefined &&
          validated.label !== existingEntry[0].label
        ) {
          changes.push({
            field: "label",
            previousValue: existingEntry[0].label,
            newValue: validated.label,
            valueType: "text" as const,
          });
        }
        if (
          validated.content !== undefined &&
          validated.content !== existingEntry[0].content
        ) {
          changes.push({
            field: "content",
            previousValue: "(previous content)",
            newValue: "(updated content)",
            valueType: "text" as const,
          });
        }
        if (
          validated.url !== undefined &&
          validated.url !== existingEntry[0].url
        ) {
          changes.push({
            field: "url",
            previousValue: existingEntry[0].url,
            newValue: validated.url ?? null,
            valueType: "text" as const,
          });
        }

        if (changes.length > 0) {
          await createTimelineRecord({
            projectId: projectId as string,
            userId: user.userId,
            entityType: "context",
            entityId: contextId as string,
            entityName: updated.label,
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
                  contextEntry: {
                    id: updated.id,
                    label: updated.label,
                    content: updated.content,
                    url: updated.url,
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
    "delete_project_context",
    {
      description:
        "Delete a context entry from a project. Requires editor role or higher on the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        contextId: z.string().uuid().describe("Context entry UUID"),
      },
    },
    async ({ projectId, contextId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            contextId: entityIdSchema,
          }),
          { projectId, contextId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existingEntry = await db
          .select()
          .from(projectContext)
          .where(
            and(
              eq(projectContext.id, contextId as string),
              eq(projectContext.projectId, projectId as string),
            ),
          )
          .limit(1);

        const notFound = assertEntityExists(
          existingEntry[0],
          contextId as string,
          "context entry",
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

        const entryLabel = existingEntry[0].label;

        await db
          .delete(projectContext)
          .where(eq(projectContext.id, contextId as string));

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "context",
          entityId: contextId as string,
          entityName: entryLabel,
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
