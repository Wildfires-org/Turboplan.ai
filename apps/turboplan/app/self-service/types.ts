import { z } from "zod";

import { signupAttributionSchema } from "@/lib/signup-attribution";

export const selfServiceSchema = z.object({
  email: z.string().email("Invalid email address"),
  projectTitle: z.string().min(1, "Project title is required"),
  projectDescription: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  officeId: z.string().uuid().optional(),
  /**
   * PostHog anonymous id + campaign params forwarded from the landing page.
   * Re-validated server-side (the client is not trusted); every field is
   * length-capped and control-char free, and bad values drop silently rather
   * than failing the signup.
   */
  attribution: signupAttributionSchema.optional(),
});

export type SelfServiceInput = z.infer<typeof selfServiceSchema>;

export interface CheckEmailResult {
  exists: boolean;
  error?: string;
}

export interface CreateUserWithOrganizationResult {
  status:
    | "success"
    | "email_sent"
    | "user_exists"
    | "invalid_data"
    | "failed"
    | "in_progress";
  error?: string;
  redirectTo?: string;
  email?: string;
}

export interface CreateProjectResult {
  status: "success" | "invalid_data" | "failed" | "upgrade_required";
  error?: string;
  redirectTo?: string;
  /**
   * Slug of the organization the project would have belonged to. Set on
   * `upgrade_required` so the client can link to that org's billing settings.
   */
  organizationSlug?: string;
  /**
   * UUID of the organization the project would have belonged to. Set on
   * `upgrade_required` so the client can start a checkout for that org
   * (the billing/checkout endpoints key on the org id, not the slug).
   */
  organizationId?: string;
}

export interface CreateProjectInput {
  projectTitle: string;
  projectDescription?: string;
  existingOrgId?: string;
  existingOfficeId?: string;
}
