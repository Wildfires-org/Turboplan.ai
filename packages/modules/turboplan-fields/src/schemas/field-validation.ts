import { z } from "zod";

/** Maximum number of custom fields allowed per project */
export const MAX_FIELDS_PER_PROJECT = 50;

/** Maximum number of values a single field can hold */
export const MAX_VALUES_PER_FIELD = 100;

// Project field validation schemas
export const projectFieldTypeSchema = z.enum(["text", "list"]);

const fieldValuesSchema = z
  .array(z.string().max(500))
  .max(MAX_VALUES_PER_FIELD, "Too many values");

export const projectFieldSchema = z.object({
  id: z.string().uuid("Invalid field ID"),
  name: z
    .string()
    .min(1, "Field name is required")
    .max(100, "Field name too long"),
  type: projectFieldTypeSchema,
  isRequired: z.boolean(),
  tooltip: z.string().max(500, "Tooltip too long").optional(),
  order: z.number().int().min(0),
  values: fieldValuesSchema,
});

export const createProjectFieldSchema = z.object({
  name: z
    .string()
    .min(1, "Field name is required")
    .max(100, "Field name too long"),
  type: projectFieldTypeSchema,
  isRequired: z.boolean().default(false),
  tooltip: z.string().max(500, "Tooltip too long").optional(),
  values: fieldValuesSchema.default([]),
});

export const updateProjectFieldSchema = z.object({
  name: z
    .string()
    .min(1, "Field name is required")
    .max(100, "Field name too long")
    .optional(),
  type: projectFieldTypeSchema.optional(),
  isRequired: z.boolean().optional(),
  tooltip: z.string().max(500, "Tooltip too long").optional().nullable(),
  values: fieldValuesSchema.optional(),
});

// Inferred types
export type ProjectFieldType = z.infer<typeof projectFieldTypeSchema>;
export type ProjectFieldData = z.infer<typeof projectFieldSchema>;
export type CreateProjectFieldData = z.infer<typeof createProjectFieldSchema>;
export type UpdateProjectFieldData = z.infer<typeof updateProjectFieldSchema>;
