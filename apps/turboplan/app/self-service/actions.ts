/**
 * Self-service actions for user registration and project creation
 *
 * This file re-exports all self-service actions from their individual modules:
 * - check-email.ts: Email existence check
 * - create-user-with-organization.ts: New user registration flow
 * - create-project.ts: Authenticated user project creation
 *
 * Note: Each individual file has its own "use server" directive.
 */

// Re-export actions
export { checkEmailExists } from "./check-email";
export { createProjectForAuthenticatedUser } from "./create-project";
export { createUserWithOrganization } from "./create-user-with-organization";
// Re-export types
export type {
  CheckEmailResult,
  CreateProjectInput,
  CreateProjectResult,
  CreateUserWithOrganizationResult,
  SelfServiceInput,
} from "./types";
