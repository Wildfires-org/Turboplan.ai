import { z } from "zod";

export const createProjectContextSchema = z.object({
  label: z.string().min(1).max(200),
  content: z.string().min(1),
  url: z.string().url().optional(),
});

export const updateProjectContextSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  url: z.string().url().nullable().optional(),
});

// Inferred types
export type CreateProjectContextData = z.infer<
  typeof createProjectContextSchema
>;
export type UpdateProjectContextData = z.infer<
  typeof updateProjectContextSchema
>;
