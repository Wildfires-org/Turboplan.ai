import { z } from "zod";

import { ORGANIZATION_PROMPT_MAX_CHARS } from "../../types";
import {
  documentDisplayNameSchema,
  uploadedDocumentFieldsSchema,
} from "../documents/validation";

/** Body of `PUT /api/organizations/:id/context`. An empty prompt clears it. */
export const updateOrganizationPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .max(
      ORGANIZATION_PROMPT_MAX_CHARS,
      `Prompt must be ${ORGANIZATION_PROMPT_MAX_CHARS.toLocaleString("en-US")} characters or fewer`,
    ),
});

/**
 * Body of `POST /api/organization-documents`. The display name gets the same
 * rules as a rename: it is quoted line by line into the AI context block, so
 * control characters (newlines included) must not get in at upload either.
 */
export const createOrganizationDocumentSchema =
  uploadedDocumentFieldsSchema.extend({
    organizationId: z.string().uuid("Invalid organization ID"),
    originalFilename: documentDisplayNameSchema,
  });

/** Body of `PATCH /api/organization-documents/:id`: rename and/or (un)pin. */
export const updateOrganizationDocumentSchema = z
  .object({
    originalFilename: documentDisplayNameSchema.optional(),
    isPinned: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.originalFilename !== undefined || data.isPinned !== undefined,
    "Provide originalFilename or isPinned",
  );
