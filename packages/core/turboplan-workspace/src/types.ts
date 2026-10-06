// ============================================================================
// SLUG LOOKUP TYPES
// ============================================================================

/**
 * Result type for slug lookup with redirect info
 * Used by organization, office, and project slug queries
 */
export type SlugLookupResult<T> = {
  entity: T | null;
  foundViaHistory: boolean;
};

// ============================================================================
// ROLES & ENTITIES
// Re-export from RBAC to avoid circular dependencies
// ============================================================================

import type { TaskAssignment } from "@wildfires-org/turboplan-db";
import {
  EntityType as RBACEntityType,
  type EntityTypeType as RBACEntityTypeType,
  MemberRole as RBACMemberRole,
  type MemberRoleType as RBACMemberRoleType,
} from "@wildfires-org/turboplan-rbac";

export const EntityType = RBACEntityType;
export type EntityTypeType = RBACEntityTypeType;
export const MemberRole = RBACMemberRole;
export type MemberRoleType = RBACMemberRoleType;

// ============================================================================
// DIALOG MODES
// ============================================================================

/**
 * Mode for the ManageMembersDialog component
 * - "manage": Default mode for viewing/managing project members and roles
 * - "assign": Mode for selecting members to assign to a task/milestone
 */
export type MembersDialogMode = "manage" | "assign";

// ============================================================================
// MEMBER INHERITANCE
// ============================================================================

export interface InheritanceInfo {
  isDirect: boolean;
  inheritedFrom?: {
    entityId: string;
    entityType: EntityTypeType;
    entityName?: string;
  };
}

export interface MemberWithInheritance {
  userId: string;
  role: MemberRoleType;
  createdAt: Date;
  user: {
    id: string;
    email: string;
  };
  profile: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;
  inheritance: InheritanceInfo;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  invitedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  taskAssignment?: TaskAssignment | null;
}

// ============================================================================
// ORGANIZATION TYPES & VALIDATION
// Re-export for client components
// ============================================================================

export type {
  OfficeWithAccess,
  Organization,
  OrganizationWithOffices,
} from "./server/organizations/types";
export {
  OrganizationStatus,
  OrganizationType,
} from "./server/organizations/types";
export {
  type EditOrganizationFormData,
  editOrganizationSchema,
} from "./server/organizations/validation";

// ============================================================================
// OFFICE TYPES & VALIDATION
// Re-export for client components
// ============================================================================

export {
  type Office,
  type OfficeSearchParams,
  OfficeStatus,
  type OfficeWithProjectCounts,
} from "./server/offices/types";
export {
  type CreateOfficeClientFormData,
  createOfficeClientSchema,
  type EditOfficeFormData,
  editOfficeSchema,
} from "./server/offices/validation";

// ============================================================================
// PROJECT TYPES & VALIDATION
// Re-export for client components
// ============================================================================

export {
  type Project,
  type ProjectSearchParams,
  ProjectStatus,
  type ProjectWithCoverImage,
  type UserProject,
} from "./server/projects/types";
export {
  type CreateProjectClientFormData,
  type CreateProjectFromTemplateFormData,
  createProjectClientSchema,
  createProjectFromTemplateSchema,
  type EditProjectFormData,
  editProjectSchema,
} from "./server/projects/validation";

// ============================================================================
// ORGANIZATION CONTEXT
// ============================================================================

/** Maximum length of an organization's standing AI prompt (after trimming). */
export const ORGANIZATION_PROMPT_MAX_CHARS = 4_000;

/** Maximum number of reference documents an organization can hold. */
export const ORGANIZATION_DOCUMENTS_MAX = 100;

/** Maximum length of one organization memory (after normalising). */
export const ORGANIZATION_MEMORY_MAX_CHARS = 300;

/** Maximum number of memories an organization can hold. */
export const ORGANIZATION_MEMORIES_MAX = 50;

/**
 * A short note the chat assistant saved to the organization at a user's
 * request. One item of `GET /api/organizations/:id/memories` (`createdAt` is
 * an ISO string over JSON).
 */
export type OrganizationMemory = {
  id: string;
  content: string;
  createdAt: string | Date;
  /** Null once the user who asked for the note is deleted */
  createdBy: string | null;
};
