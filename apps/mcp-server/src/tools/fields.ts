import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq, gt, max, sql } from "drizzle-orm";
import { z } from "zod";

import { projectField } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  computeChanges,
  createTimelineRecord,
  projectCustomFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";

import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import { projectExists } from "../utils/queries.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

const MAX_FIELDS_PER_PROJECT = 50;
export const MAX_FIELDS_PER_BATCH = 20;

const fieldNameSchema = z.string().min(1).max(100);
const fieldTypeSchema = z.enum(["text", "list"]);
const tooltipSchema = z.string().max(500);
const fieldValuesSchema = z.array(z.string().max(500));

// Shared per-field shape used by both add_project_field and add_project_fields
// so the batch variant validates each item exactly like the singular tool.
export const batchFieldItemSchema = z.object({
  name: fieldNameSchema,
  type: fieldTypeSchema,
  isRequired: z.boolean().optional().default(false),
  tooltip: tooltipSchema.optional(),
  values: fieldValuesSchema.optional().default([]),
});

// The exact array schema the add_project_fields handler validates against.
export const addProjectFieldsSchema = z
  .array(batchFieldItemSchema)
  .min(1)
  .max(MAX_FIELDS_PER_BATCH);

const serializeField = (f: typeof projectField.$inferSelect) => ({
  id: f.id,
  name: f.name,
  type: f.type,
  isRequired: f.isRequired,
  tooltip: f.tooltip,
  order: f.order,
  values: f.values,
});

export const registerFieldTools = (server: McpServer, user: McpUserContext) => {
  server.registerTool(
    "list_project_fields",
    {
      description:
        "List all custom fields for a project. Requires read access to the project.",
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

        const fields = await db
          .select()
          .from(projectField)
          .where(eq(projectField.projectId, projectId as string))
          .orderBy(projectField.order);

        const result = fields.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          isRequired: f.isRequired,
          tooltip: f.tooltip,
          order: f.order,
          values: f.values,
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
    "add_project_field",
    {
      description:
        "Add a custom field to a project. Requires editor role or higher on the project. Maximum 50 fields per project. For text fields, pass the value as a single-element array in 'values' (e.g. [\"my value\"]). For list fields, pass all options in 'values'. When adding multiple fields at once, prefer add_project_fields.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(100).describe("Field name"),
        type: z.enum(["text", "list"]).describe("Field type"),
        isRequired: z
          .boolean()
          .optional()
          .describe("Whether the field is required (default false)"),
        tooltip: z
          .string()
          .max(500)
          .optional()
          .describe("Help text for the field"),
        values: z
          .array(z.string())
          .optional()
          .describe(
            'Field values. For text fields: single-element array with the value (e.g. ["some text"]). For list fields: array of allowed options. Default []',
          ),
      },
    },
    async ({ projectId, name, type, isRequired, tooltip, values }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            name: fieldNameSchema,
            type: fieldTypeSchema,
            isRequired: z.boolean().optional().default(false),
            tooltip: tooltipSchema.optional(),
            values: fieldValuesSchema.optional().default([]),
          }),
          { projectId, name, type, isRequired, tooltip, values },
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

        // The cap check and insert must be atomic: two concurrent adds that
        // both read the count before either inserts would together exceed the
        // cap (and duplicate order values). The per-project advisory lock
        // serializes field mutations; it is released at commit.
        const newField = await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${projectId as string}))`,
          );

          const countResult = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(projectField)
            .where(eq(projectField.projectId, projectId as string));

          const currentFieldCount = countResult[0]?.count ?? 0;
          if (currentFieldCount >= MAX_FIELDS_PER_PROJECT) {
            return null;
          }

          const maxOrderResult = await tx
            .select({ maxOrder: max(projectField.order) })
            .from(projectField)
            .where(eq(projectField.projectId, projectId as string));

          const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

          const [inserted] = await tx
            .insert(projectField)
            .values({
              projectId: projectId as string,
              name: validated.name,
              type: validated.type,
              isRequired: validated.isRequired,
              tooltip: validated.tooltip,
              order: nextOrder,
              values: validated.values,
            })
            .returning();

          return inserted;
        });

        if (!newField) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Maximum number of fields (${MAX_FIELDS_PER_PROJECT}) reached for this project.`,
              },
            ],
          };
        }

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "field",
          entityId: newField.id,
          entityName: newField.name,
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
                  field: {
                    id: newField.id,
                    name: newField.name,
                    type: newField.type,
                    isRequired: newField.isRequired,
                    tooltip: newField.tooltip,
                    order: newField.order,
                    values: newField.values,
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
    "add_project_fields",
    {
      description:
        "Add multiple custom fields to a project in a single call. Requires editor role or higher on the project. Maximum 20 fields per call, and the project total may not exceed 50 fields. All fields are created together — if any field is invalid, none are created. For text fields, pass the value as a single-element array in 'values'; for list fields, pass all options in 'values'.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        fields: z
          .array(
            z.object({
              name: z.string().min(1).max(100).describe("Field name"),
              type: z.enum(["text", "list"]).describe("Field type"),
              isRequired: z
                .boolean()
                .optional()
                .describe("Whether the field is required (default false)"),
              tooltip: z
                .string()
                .max(500)
                .optional()
                .describe("Help text for the field"),
              values: z
                .array(z.string())
                .optional()
                .describe(
                  "Field values. For text fields: single-element array with the value. For list fields: array of allowed options. Default []",
                ),
            }),
          )
          .min(1)
          .max(MAX_FIELDS_PER_BATCH)
          .describe(`Fields to create (1-${MAX_FIELDS_PER_BATCH})`),
      },
    },
    async ({ projectId, fields }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            fields: addProjectFieldsSchema,
          }),
          { projectId, fields },
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

        // All-or-nothing: cap check and every insert run in one transaction,
        // serialized per project by the advisory lock (see add_project_field)
        // so concurrent batches cannot together exceed the cap or duplicate
        // order values. Sequential order mirrors the singular tool.
        const txResult = await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${projectId as string}))`,
          );

          const countResult = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(projectField)
            .where(eq(projectField.projectId, projectId as string));

          const currentFieldCount = countResult[0]?.count ?? 0;
          if (
            currentFieldCount + validated.fields.length >
            MAX_FIELDS_PER_PROJECT
          ) {
            return { capExceeded: true as const, currentFieldCount };
          }

          const maxOrderResult = await tx
            .select({ maxOrder: max(projectField.order) })
            .from(projectField)
            .where(eq(projectField.projectId, projectId as string));

          let nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

          const created: (typeof projectField.$inferSelect)[] = [];
          for (const field of validated.fields) {
            const [inserted] = await tx
              .insert(projectField)
              .values({
                projectId: projectId as string,
                name: field.name,
                type: field.type,
                isRequired: field.isRequired,
                tooltip: field.tooltip,
                order: nextOrder,
                values: field.values,
              })
              .returning();
            created.push(inserted);
            nextOrder += 1;
          }
          return { capExceeded: false as const, created };
        });

        if (txResult.capExceeded) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Maximum number of fields (${MAX_FIELDS_PER_PROJECT}) would be exceeded for this project. Current: ${txResult.currentFieldCount}, requested: ${validated.fields.length}.`,
              },
            ],
          };
        }

        const insertedFields = txResult.created;

        // One timeline record per created field, matching the singular tool.
        for (const newField of insertedFields) {
          await createTimelineRecord({
            projectId: projectId as string,
            userId: user.userId,
            entityType: "field",
            entityId: newField.id,
            entityName: newField.name,
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
                  fields: insertedFields.map(serializeField),
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
    "update_project_field",
    {
      description:
        "Update a custom field on a project. Requires editor role or higher on the project. Use 'values' to set the field content: for text fields pass a single-element array, for list fields pass all options.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        fieldId: z.string().uuid().describe("Field UUID"),
        name: z.string().min(1).max(100).optional().describe("New field name"),
        type: z.enum(["text", "list"]).optional().describe("New field type"),
        isRequired: z
          .boolean()
          .optional()
          .describe("Whether the field is required"),
        tooltip: z
          .string()
          .max(500)
          .optional()
          .nullable()
          .describe("New help text (null to clear)"),
        values: z
          .array(z.string())
          .optional()
          .describe(
            "Field values. For text fields: single-element array with the value. For list fields: array of allowed options",
          ),
      },
    },
    async ({ projectId, fieldId, name, type, isRequired, tooltip, values }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            fieldId: entityIdSchema,
            name: fieldNameSchema.optional(),
            type: fieldTypeSchema.optional(),
            isRequired: z.boolean().optional(),
            tooltip: tooltipSchema.optional().nullable(),
            values: fieldValuesSchema.optional(),
          }),
          { projectId, fieldId, name, type, isRequired, tooltip, values },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        // Check field exists and belongs to project
        const existingField = await db
          .select()
          .from(projectField)
          .where(
            and(
              eq(projectField.id, fieldId as string),
              eq(projectField.projectId, projectId as string),
            ),
          )
          .limit(1);

        const notFound = assertEntityExists(
          existingField[0],
          fieldId as string,
          "field",
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

        // Build partial update object
        const updateValues: Partial<typeof projectField.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (name !== undefined) {
          updateValues.name = name as string;
        }
        if (type !== undefined) {
          updateValues.type = type as "text" | "list";
        }
        if (isRequired !== undefined) {
          updateValues.isRequired = isRequired as boolean;
        }
        if (tooltip !== undefined) {
          updateValues.tooltip = (tooltip as string | null) ?? null;
        }
        if (values !== undefined) {
          updateValues.values = values as string[];
        }

        const oldField = existingField[0];

        const [updatedField] = await db
          .update(projectField)
          .set(updateValues)
          .where(eq(projectField.id, fieldId as string))
          .returning();

        const changes = computeChanges(
          oldField,
          updatedField,
          projectCustomFieldDefs,
        );
        if (changes.length > 0) {
          await createTimelineRecord({
            projectId: projectId as string,
            userId: user.userId,
            entityType: "field",
            entityId: fieldId as string,
            entityName: updatedField.name,
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
                  field: {
                    id: updatedField.id,
                    name: updatedField.name,
                    type: updatedField.type,
                    isRequired: updatedField.isRequired,
                    tooltip: updatedField.tooltip,
                    order: updatedField.order,
                    values: updatedField.values,
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
    "delete_project_field",
    {
      description:
        "Delete a custom field from a project. Requires editor role or higher on the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        fieldId: z.string().uuid().describe("Field UUID"),
      },
    },
    async ({ projectId, fieldId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            fieldId: entityIdSchema,
          }),
          { projectId, fieldId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        // Check field exists and belongs to project
        const existingField = await db
          .select()
          .from(projectField)
          .where(
            and(
              eq(projectField.id, fieldId as string),
              eq(projectField.projectId, projectId as string),
            ),
          )
          .limit(1);

        const notFound = assertEntityExists(
          existingField[0],
          fieldId as string,
          "field",
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

        const deletedOrder = existingField[0].order;

        // Use transaction to delete and reorder atomically
        await db.transaction(async (tx) => {
          await tx
            .delete(projectField)
            .where(eq(projectField.id, fieldId as string));

          await tx
            .update(projectField)
            .set({ order: sql`${projectField.order} - 1` })
            .where(
              and(
                eq(projectField.projectId, projectId as string),
                gt(projectField.order, deletedOrder),
              ),
            );
        });

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "field",
          entityId: fieldId as string,
          entityName: existingField[0].name,
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
