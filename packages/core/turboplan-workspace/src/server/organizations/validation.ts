import { z } from "zod";

import { EMAIL_DOMAIN_REGEX } from "@wildfires-org/turboplan-utils/server";

import { OrganizationStatus, OrganizationType } from "./types";

// Organization validation schemas
export const editOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be less than 255 characters"),
  shortName: z
    .string()
    .max(20, "Short name must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  country: z
    .string()
    .max(100, "Country must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  type: z.nativeEnum(OrganizationType),
  status: z.nativeEnum(OrganizationStatus),
  logoUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
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

export const createOrganizationSchema = editOrganizationSchema
  .omit({ logoUrl: true })
  .extend({
    logoUrl: z.string().url("Please enter a valid URL").optional(),
    createdBy: z.string().min(1, "Creator ID is required"),
  });

// Owner-managed email domains for an organization. Kept separate from
// editOrganizationSchema so the general PUT /:id (editor+) cannot touch the
// auto-affiliation domains — those changes are gated to org owners on the
// dedicated PUT /:id/email-domains route.
export const editOrganizationEmailDomainsSchema = z.object({
  emailDomains: z.array(z.string().regex(EMAIL_DOMAIN_REGEX)).max(20),
});

// Inferred types
export type EditOrganizationFormData = z.infer<typeof editOrganizationSchema>;
export type CreateOrganizationFormData = z.infer<
  typeof createOrganizationSchema
>;
export type EditOrganizationEmailDomainsData = z.infer<
  typeof editOrganizationEmailDomainsSchema
>;
