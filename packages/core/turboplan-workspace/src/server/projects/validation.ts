import { z } from "zod";

import { PROJECT_MODULES } from "@wildfires-org/turboplan-db/types";

import { ProjectStatus } from "./types";

// Project validation schemas
export const editProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
  prompt: z
    .string()
    .max(3000, "Prompt must be less than 2000 characters")
    .optional(),
  isTemplate: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  status: z.nativeEnum(ProjectStatus),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Prompt is only mandatory when the user is NOT bringing an existing project.
// We keep the field itself optional at the schema shape level (trim + max) so
// that `createProjectClientSchema` stays a plain ZodObject — the Add Project
// dialog calls `.omit({ name: true })` on it, which only exists on ZodObject
// (not ZodEffects). The "required unless hasExistingProject" rule is enforced
// via `.superRefine` on the server schema only (see below).
const optionalProjectSetupPromptSchema = z
  .string()
  .trim()
  .max(3000, "Prompt must be less than 3000 characters")
  .optional();

// Client-side schema (without createdBy - handled by server)
// Uses slugs instead of IDs - server resolves to IDs
// Status is optional for client - defaults to ACTIVE
export const createProjectClientSchema = editProjectSchema.extend({
  organizationSlug: z.string().min(1, "Organization slug is required"),
  officeSlug: z.string().min(1, "Office slug is required"),
  prompt: optionalProjectSetupPromptSchema,
  // When true, the user already has an ongoing project and the AI research
  // phase is skipped — the prompt becomes optional.
  hasExistingProject: z.boolean().optional(),
  status: z.nativeEnum(ProjectStatus).optional().default(ProjectStatus.ACTIVE),
});

// Server-side schema (includes createdBy for API validation)
// After slug resolution, officeId is added by the server
export const createProjectServerSchema = editProjectSchema
  .extend({
    organizationSlug: z.string().min(1, "Organization slug is required"),
    officeSlug: z.string().min(1, "Office slug is required"),
    prompt: optionalProjectSetupPromptSchema,
    hasExistingProject: z.boolean().optional(),
    createdBy: z.string().uuid("Invalid user ID"),
  })
  .superRefine((data, ctx) => {
    // Prompt is required unless the user is bringing an existing project.
    if (!data.hasExistingProject && !data.prompt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Project setup prompt is required",
        path: ["prompt"],
      });
    }
  });

// Two creation modes share one endpoint, discriminated on the slug pair:
//
// - DIRECT mode (organizationSlug + officeSlug present): create the project
//   straight into the chosen workspace office (gov-staff in-app flow). No
//   personal workspace, no submit, no billing gate.
// - PERSONAL mode (neither slug present, optional submitTo): create the project
//   in the citizen's personal workspace, then optionally submit it for review.
//
// Ambiguous / partial combinations are rejected with a 400.
export const createProjectFromTemplateSchema = z
  .object({
    name: editProjectSchema.shape.name.optional(),
    description: editProjectSchema.shape.description,
    // DIRECT mode target. Both slugs must be provided together.
    organizationSlug: z
      .string()
      .min(1, "Organization slug is required")
      .optional(),
    officeSlug: z.string().min(1, "Office slug is required").optional(),
    // PERSONAL mode: when provided, the freshly created (DRAFT) project is
    // immediately submitted to the chosen government org/office for review via
    // the shared submit flow.
    submitTo: z
      .object({
        organizationId: z.string().uuid(),
        officeId: z.string().uuid(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasOrganizationSlug = data.organizationSlug !== undefined;
    const hasOfficeSlug = data.officeSlug !== undefined;

    // Slugs are a pair: one without the other is ambiguous.
    if (hasOrganizationSlug !== hasOfficeSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "organizationSlug and officeSlug must be provided together for direct creation",
        path: [hasOrganizationSlug ? "officeSlug" : "organizationSlug"],
      });
      return;
    }

    // Direct mode (both slugs) cannot also submit — that is a personal-mode op.
    if (hasOrganizationSlug && hasOfficeSlug && data.submitTo !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "submitTo cannot be combined with organizationSlug/officeSlug (direct creation does not submit)",
        path: ["submitTo"],
      });
    }
  });

export const updateProjectSchema = editProjectSchema.partial().extend({
  id: z.string().uuid("Invalid project ID"),
  lastModifiedBy: z.string().uuid("Invalid user ID"),
});

// Query parameter validation schemas
export const projectFiltersSchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  isTemplate: z.boolean().optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  search: z.string().max(255).optional(),
});

// Module visibility toggle schema (hide from admin UI)
export const toggleModuleVisibilitySchema = z.object({
  moduleName: z.enum(PROJECT_MODULES, {
    message: `Invalid module name. Allowed: ${PROJECT_MODULES.join(", ")}`,
  }),
});

// Module public visibility toggle schema (hide from public/catalog view)
export const toggleModulePublicVisibilitySchema = z.object({
  moduleName: z.enum(PROJECT_MODULES, {
    message: `Invalid module name. Allowed: ${PROJECT_MODULES.join(", ")}`,
  }),
});

// Module order update schema
export const updateModuleOrderSchema = z.object({
  moduleOrder: z.array(
    z.enum(PROJECT_MODULES, {
      message: `Invalid module name. Allowed: ${PROJECT_MODULES.join(", ")}`,
    }),
  ),
});

// Module column assignment update schema (two-column project layout)
export const updateModuleColumnsSchema = z.object({
  moduleColumns: z.record(
    z.enum(PROJECT_MODULES, {
      message: `Invalid module name. Allowed: ${PROJECT_MODULES.join(", ")}`,
    }),
    z.enum(["main", "sidebar"]),
  ),
});

export type EditProjectFormData = z.infer<typeof editProjectSchema>;
export type CreateProjectClientFormData = z.infer<
  typeof createProjectClientSchema
>;
export type CreateProjectServerFormData = z.infer<
  typeof createProjectServerSchema
>;
export type CreateProjectFromTemplateFormData = z.infer<
  typeof createProjectFromTemplateSchema
>;
export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>;
export type ProjectFiltersData = z.infer<typeof projectFiltersSchema>;
export type ToggleModuleVisibilityData = z.infer<
  typeof toggleModuleVisibilitySchema
>;
export type ToggleModulePublicVisibilityData = z.infer<
  typeof toggleModulePublicVisibilitySchema
>;
export type UpdateModuleOrderData = z.infer<typeof updateModuleOrderSchema>;
export type UpdateModuleColumnsData = z.infer<typeof updateModuleColumnsSchema>;
