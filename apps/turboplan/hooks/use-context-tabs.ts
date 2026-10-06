"use client";

import { useId } from "react";

import { useIsClient, useLocalStorage } from "usehooks-ts";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";

import {
  type ContextTab,
  getContextTabStorageKey,
  getContextTabs,
  pickContextTab,
} from "@/lib/context-tab";

interface UseContextTabsOptions {
  userId: string;
  organizationId: string;
  /** Organization context feature on */
  isOrganizationContextEnabled: boolean;
}

export type ContextTabsState = {
  /** The tabs this user sees, project first */
  tabs: ContextTab[];
  /** Null until the remembered tab and the organization check are known */
  activeTab: ContextTab | null;
  selectTab: (tab: ContextTab) => void;
  /** Prefix for the tab and tab panel element ids */
  idPrefix: string;
};

/**
 * The Project / Organization tabs of a project's Context, remembering the
 * last tab per user (the Context page and the chat panel share it). The
 * active tab stays null until both the stored tab (read after hydration) and
 * the organization READ check are in, so it never swaps once shown.
 */
export const useContextTabs = ({
  userId,
  organizationId,
  isOrganizationContextEnabled,
}: UseContextTabsOptions): ContextTabsState => {
  const idPrefix = useId();
  const isClient = useIsClient();
  // Project members can read their organization (upward READ); no request
  // while the feature is off.
  const {
    hasPermission: canReadOrganization,
    isChecking: isCheckingOrganization,
  } = useEntityPermission({
    userId: isOrganizationContextEnabled ? userId : undefined,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId,
    action: Action.READ,
  });
  const [preferredTab, setPreferredTab] = useLocalStorage<ContextTab>(
    getContextTabStorageKey(userId),
    "project",
    { initializeWithValue: false },
  );

  const tabs = getContextTabs({
    canReadOrganizationContext:
      isOrganizationContextEnabled && canReadOrganization,
  });
  const activeTab =
    !isClient || isCheckingOrganization
      ? null
      : pickContextTab(tabs, preferredTab);

  return { tabs, activeTab, selectTab: setPreferredTab, idPrefix };
};
