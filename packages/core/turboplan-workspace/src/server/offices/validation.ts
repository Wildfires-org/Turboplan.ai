import { z } from "zod";

import { OfficeStatus } from "./types";

// Office validation schemas
export const editOfficeSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  status: z.nativeEnum(OfficeStatus),
  documentLogoUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  documentFooterText: z
    .string()
    .max(200, "Footer text must be less than 200 characters")
    .optional()
    .or(z.literal("")),
  documentFooterNote: z
    .string()
    .max(120, "Footer note must be less than 120 characters")
    .optional()
    .or(z.literal("")),
  documentFooterLogoUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

// Client-side schema (without createdBy - handled by server)
export const createOfficeClientSchema = editOfficeSchema.extend({
  organizationId: z.string().uuid("Invalid organization ID"),
});

// Server-side schema (includes createdBy for API validation)
export const createOfficeSchema = createOfficeClientSchema.extend({
  createdBy: z.string().uuid("Invalid user ID"),
});

export const updateOfficeSchema = editOfficeSchema.partial().extend({
  id: z.string().uuid("Invalid office ID"),
});

// Query parameter validation schemas
export const officeFiltersSchema = z.object({
  status: z.nativeEnum(OfficeStatus).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  search: z.string().max(255).optional(),
});

// Inferred types
export type EditOfficeFormData = z.infer<typeof editOfficeSchema>;
export type CreateOfficeClientFormData = z.infer<
  typeof createOfficeClientSchema
>;
export type CreateOfficeFormData = z.infer<typeof createOfficeSchema>;
export type UpdateOfficeFormData = z.infer<typeof updateOfficeSchema>;
export type OfficeFiltersData = z.infer<typeof officeFiltersSchema>;
