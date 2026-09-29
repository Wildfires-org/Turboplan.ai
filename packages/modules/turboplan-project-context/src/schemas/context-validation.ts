import { z } from "zod";

import {
  HTTP_URL_ONLY_MESSAGE,
  isSafeHttpUrl,
} from "@wildfires-org/turboplan-utils/server";

const httpUrlSchema = z
  .string()
  .url()
  .refine(isSafeHttpUrl, HTTP_URL_ONLY_MESSAGE);

export const createProjectContextSchema = z.object({
  label: z.string().min(1).max(200),
  content: z.string().min(1),
  url: httpUrlSchema.optional(),
});

export const updateProjectContextSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  url: httpUrlSchema.nullable().optional(),
});

// Inferred types
export type CreateProjectContextData = z.infer<
  typeof createProjectContextSchema
>;
export type UpdateProjectContextData = z.infer<
  typeof updateProjectContextSchema
>;
