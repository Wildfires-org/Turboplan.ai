import type { EntityTypeType } from "../types";

/**
 * Builds the SWR key for an entity's action list.
 *
 * Must be the single source of truth for this key: server pages seed the
 * `SWRConfig` fallback with the same builder, so any drift silently produces a
 * cache miss and an extra request.
 *
 * Lives outside the `"use client"` hooks entry so server components can build
 * the key without pulling the client bundle in.
 */
/** Path prefix shared by every entity-actions SWR key; use it to invalidate them all. */
export const ENTITY_ACTIONS_KEY_PREFIX = "/api/permissions/actions";

export const getEntityActionsKey = (
  entityId: string,
  entityType: EntityTypeType,
): string => {
  const params = new URLSearchParams({ entityId, entityType });

  return `${ENTITY_ACTIONS_KEY_PREFIX}?${params.toString()}`;
};
