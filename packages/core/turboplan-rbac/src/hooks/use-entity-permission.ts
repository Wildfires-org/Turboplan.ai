"use client";

import { useCallback } from "react";

import useSWR, { useSWRConfig } from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";

import type { ActionType, EntityTypeType, MemberRoleType } from "../types";
import {
  ENTITY_ACTIONS_KEY_PREFIX,
  getEntityActionsKey,
} from "../utils/entity-actions-key";

type UseEntityPermissionConfig = {
  userId: string | undefined;
  entityType: EntityTypeType;
  entityId: string;
  action: ActionType;
};

export type EntityActionsResponse = {
  /**
   * Every action the current user may perform on this entity. Already accounts
   * for admin overrides, inherited roles and upward-read — never re-derive
   * permissions from `effectiveRole` on the client.
   */
  actions: ActionType[];
  effectiveRole: MemberRoleType | null;
};

/**
 * React hook to check if a user has a specific permission for an entity
 *
 * Fetches the full action list for the entity once and derives the answer
 * locally, so a single request serves every action checked on that entity —
 * components asking about different actions on the same entity share one
 * SWR cache entry instead of issuing a request each.
 *
 * @example
 * ```tsx
 * const { hasPermission, isChecking } = useEntityPermission({
 *   userId: session?.user?.id,
 *   entityType: EntityType.ORGANIZATION,
 *   entityId: orgId,
 *   action: Action.MANAGE_MEMBERS,
 * });
 *
 * if (isChecking) return <Spinner />;
 *
 * return hasPermission ? <ManageButton /> : <ViewOnlyMode />;
 * ```
 *
 * @param config - Configuration object with user and entity details
 * @returns Object with hasPermission boolean and isChecking loading state
 */
export const useEntityPermission = ({
  userId,
  entityType,
  entityId,
  action,
}: UseEntityPermissionConfig) => {
  // Return a null key if userId is missing to prevent unnecessary requests
  const key = userId ? getEntityActionsKey(entityId, entityType) : null;

  const { data, error, isLoading } = useSWR<EntityActionsResponse>(
    key,
    fetcher,
    {
      revalidateOnFocus: false, // Permissions don't change frequently
      // Cheap backstop against unbounded staleness (see below).
      revalidateOnReconnect: true,
      // With no cached or fallback data SWR still fetches on mount (`data` is
      // undefined), so unseeded call sites are unaffected. A value seeded via
      // `SWRConfig.fallback` is NOT re-fetched on mount — which is what makes
      // server-side seeding actually save a request. The trade-off: an entry
      // stays cached for the SPA session unless something invalidates it.
      // Membership mutations do that via `useInvalidateEntityActions`; a role
      // change made by someone else is picked up on reconnect or reload.
      revalidateIfStale: false,
      dedupingInterval: 60000, // Cache for 1 minute
      shouldRetryOnError: false, // Don't retry on permission errors
    },
  );

  return {
    hasPermission: data?.actions.includes(action) ?? false,
    isChecking: isLoading,
    error,
  };
};

/**
 * Returns a function that drops every cached `/api/permissions/actions` entry
 * so the next render re-fetches. Call it after any membership mutation
 * (invite, role change, removal) — `useEntityPermission` never revalidates a
 * cached entry on its own.
 */
export const useInvalidateEntityActions = () => {
  const { mutate } = useSWRConfig();
  return useCallback(
    () =>
      mutate(
        (key) =>
          typeof key === "string" && key.startsWith(ENTITY_ACTIONS_KEY_PREFIX),
      ),
    [mutate],
  );
};
