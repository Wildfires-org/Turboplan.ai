"use client";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";

interface UseOrganizationContextPermissionsOptions {
  /** Undefined skips the request (e.g. organization context feature off) */
  userId: string | undefined;
  organizationId: string | null;
}

/**
 * What the user may do with an organization's context from one of its
 * projects: read it (project members can, upward READ) and edit it (owner or
 * editor). One request answers both; none without a user or organization.
 */
export const useOrganizationContextPermissions = ({
  userId,
  organizationId,
}: UseOrganizationContextPermissionsOptions) => {
  const permission = {
    userId: organizationId ? userId : undefined,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId ?? "",
  };
  const { hasPermission: canEditOrganization, isChecking } =
    useEntityPermission({ ...permission, action: Action.UPDATE });
  const { hasPermission: canReadOrganization } = useEntityPermission({
    ...permission,
    action: Action.READ,
  });

  return {
    canEditOrganization,
    canReadOrganization,
    isCheckingOrganization: isChecking,
  };
};
