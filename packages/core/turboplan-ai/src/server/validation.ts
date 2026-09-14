import { z } from "zod";

/**
 * Schema for image generation request
 */
export const generateImageSchema = z.object({
  entityId: z.string().uuid("Invalid entity ID"),
  entityType: z.enum(["project", "office", "organization"], {
    message: "Entity type must be one of: project, office, organization",
  }),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  style: z.string().optional(),
  ratio: z.string().optional(),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

/**
 * Schema for auto-generate project image request
 */
export const autoGenerateProjectImageSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  projectTitle: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
});

export type AutoGenerateProjectImageInput = z.infer<
  typeof autoGenerateProjectImageSchema
>;
