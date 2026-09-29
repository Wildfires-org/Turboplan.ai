// ============================================================================
// USER SEARCH SCOPE
// ============================================================================
// `GET /api/users/search` is not a global directory: every call names the
// organization, office or project it is searching on behalf of. The caller must
// be able to READ that entity, and fuzzy matches are limited to people on that
// entity's own branch of the hierarchy.
// ============================================================================

import { type SQL, sql } from "drizzle-orm";

import {
  office,
  officeUsers,
  organizationUsers,
  project,
  projectUsers,
  user,
} from "@wildfires-org/turboplan-db";
import { EntityType, type EntityTypeType } from "@wildfires-org/turboplan-rbac";

export type UserSearchEntityScope = {
  entityType: EntityTypeType;
  entityId: string;
};

/**
 * The resolved hierarchy of a search scope. `projectId` implies `officeId`:
 * a project scope carries its office and organization, an office scope its
 * organization.
 */
export type UserSearchBranch =
  | { organizationId: string }
  | { organizationId: string; officeId: string }
  | { organizationId: string; officeId: string; projectId: string };

type ScopeParams = {
  organizationId?: string;
  officeId?: string;
  projectId?: string;
};

/**
 * Turn the query-string scope params into the entity whose READ permission
 * gates the search. Exactly one of them must be present; anything else (none,
 * or an ambiguous combination) yields `null` and a 400.
 */
export const resolveUserSearchScope = (
  params: ScopeParams,
): UserSearchEntityScope | null => {
  const candidates: UserSearchEntityScope[] = [];

  if (params.organizationId) {
    candidates.push({
      entityType: EntityType.ORGANIZATION,
      entityId: params.organizationId,
    });
  }
  if (params.officeId) {
    candidates.push({
      entityType: EntityType.OFFICE,
      entityId: params.officeId,
    });
  }
  if (params.projectId) {
    candidates.push({
      entityType: EntityType.PROJECT,
      entityId: params.projectId,
    });
  }

  return candidates.length === 1 ? candidates[0] : null;
};

const isOrganizationMember = (
  organizationId: string,
): SQL => sql`${user.id} in (
    select ${organizationUsers.userId} from ${organizationUsers}
    where ${organizationUsers.organizationId} = ${organizationId}
  )`;

const isOfficeMember = (officeId: string): SQL => sql`${user.id} in (
    select ${officeUsers.userId} from ${officeUsers}
    where ${officeUsers.officeId} = ${officeId}
  )`;

/**
 * SQL condition: the user holds a role on the search scope's own branch.
 *
 * - project: the project, its office, its organization
 * - office: the office, its live projects, its organization
 * - organization: anywhere in the organization tree
 *
 * Siblings are never reachable: a project member cannot see who holds roles on
 * other projects of the same office or organization.
 */
export const isMemberOfSearchBranch = (branch: UserSearchBranch): SQL => {
  if ("projectId" in branch) {
    return sql`(
  ${user.id} in (
    select ${projectUsers.userId} from ${projectUsers}
    where ${projectUsers.projectId} = ${branch.projectId}
  ) or ${isOfficeMember(branch.officeId)} or ${isOrganizationMember(branch.organizationId)}
)`;
  }

  if ("officeId" in branch) {
    return sql`(
  ${isOfficeMember(branch.officeId)} or ${user.id} in (
    select ${projectUsers.userId} from ${projectUsers}
    inner join ${project} on ${project.id} = ${projectUsers.projectId}
    where ${project.officeId} = ${branch.officeId}
    and ${project.deletedAt} is null
  ) or ${isOrganizationMember(branch.organizationId)}
)`;
  }

  return sql`(
  ${isOrganizationMember(branch.organizationId)} or ${user.id} in (
    select ${officeUsers.userId} from ${officeUsers}
    inner join ${office} on ${office.id} = ${officeUsers.officeId}
    where ${office.organizationId} = ${branch.organizationId}
  ) or ${user.id} in (
    select ${projectUsers.userId} from ${projectUsers}
    inner join ${project} on ${project.id} = ${projectUsers.projectId}
    inner join ${office} on ${office.id} = ${project.officeId}
    where ${office.organizationId} = ${branch.organizationId}
    and ${project.deletedAt} is null
  )
)`;
};
