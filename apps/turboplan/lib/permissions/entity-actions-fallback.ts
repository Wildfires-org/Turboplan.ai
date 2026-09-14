import "server-only";

import { EntityType, getEntityActionsKey } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

type ProjectPageActionsFallbackArgs = {
  userId: string;
  email?: string;
  organizationId: string;
  officeId: string;
  projectId: string;
};

/**
 * Pre-computes the action lists the project/template page's client components
 * ask `useEntityPermission` for, keyed exactly as the hook keys them.
 *
 * Feed the result to `SwrFallbackProvider` so those components render with real
 * permissions on first paint instead of firing three
 * `/api/permissions/actions` requests right after hydration. The three entities
 * resolve in one batched pass — a single admin check, membership lookup and
 * ancestor query serve all of them — so seeding costs one round-trip, not one
 * per entity.
 */
export const getProjectPageActionsFallback = async ({
  userId,
  email,
  organizationId,
  officeId,
  projectId,
}: ProjectPageActionsFallbackArgs): Promise<Record<string, unknown>> => {
  const rbac = getRBACService();

  let organizationActions: unknown;
  let officeActions: unknown;
  let projectActions: unknown;
  try {
    [organizationActions, officeActions, projectActions] =
      await rbac.getAllowedActionsBatch(
        userId,
        [
          { entityId: organizationId, entityType: EntityType.ORGANIZATION },
          { entityId: officeId, entityType: EntityType.OFFICE },
          { entityId: projectId, entityType: EntityType.PROJECT },
        ],
        { email },
      );
  } catch (error) {
    // Seeding is an optimisation: fall back to client-side fetching rather
    // than failing the whole page render.
    console.error("Failed to pre-compute entity actions:", error);
    return {};
  }

  return {
    [getEntityActionsKey(organizationId, EntityType.ORGANIZATION)]:
      organizationActions,
    [getEntityActionsKey(officeId, EntityType.OFFICE)]: officeActions,
    [getEntityActionsKey(projectId, EntityType.PROJECT)]: projectActions,
  };
};
