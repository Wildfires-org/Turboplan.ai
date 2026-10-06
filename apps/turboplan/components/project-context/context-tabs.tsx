"use client";

import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";

import { Building2, FolderOpen, type LucideIcon } from "lucide-react";

import { OrganizationContextSection } from "@/components/organization-context/organization-context-section";
import type { ContextTabsState } from "@/hooks/use-context-tabs";
import { type ContextTab, getTabIndexForKey } from "@/lib/context-tab";
import {
  PANEL_CLASS,
  SEGMENT_ACTIVE_CLASS,
  SEGMENT_CLASS,
  SEGMENT_INACTIVE_CLASS,
  SEGMENTED_TRACK_CLASS,
  SKELETON_BAR_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ContextTabListProps {
  state: ContextTabsState;
  /** In a narrow container (the chat Context panel): full-width tabs */
  isNarrow?: boolean;
  className?: string;
}

interface ContextTabPanelsProps {
  state: ContextTabsState;
  userId: string;
  organization: { id: string; name: string; slug: string };
  /** The Project tab's content (it differs between the page and the panel) */
  projectContent: ReactNode;
  /** In a narrow container (the chat Context panel): stack rows */
  isNarrow?: boolean;
  /** Classes for each tab panel (spacing between its sections) */
  className?: string;
}

// The organization's name is shown inside its tab: long workspace names
// ("someone+55's Organization") would be cut off in the segmented control.
const TABS: Record<ContextTab, { label: string; icon: LucideIcon }> = {
  project: { label: "Project", icon: FolderOpen },
  organization: { label: "Organization", icon: Building2 },
};

const getTabId = (idPrefix: string, tab: ContextTab) =>
  `${idPrefix}-tab-${tab}`;

const getPanelId = (idPrefix: string, tab: ContextTab) =>
  `${idPrefix}-panel-${tab}`;

/**
 * "Project | Organization" tabs over a project's Context (ARIA tabs: arrow
 * keys, Home and End move and select). Nothing when only one tab is shown.
 */
export const ContextTabList = ({
  state,
  isNarrow = false,
  className,
}: ContextTabListProps) => {
  const { tabs, activeTab, selectTab, idPrefix } = state;
  const tabRefs = useRef<Partial<Record<ContextTab, HTMLButtonElement>>>({});

  if (tabs.length < 2 || !activeTab) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nextIndex = getTabIndexForKey(
      event.key,
      tabs.indexOf(activeTab),
      tabs.length,
    );
    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Context"
      onKeyDown={handleKeyDown}
      className={cn(
        SEGMENTED_TRACK_CLASS,
        isNarrow ? "w-full" : "w-fit",
        className,
      )}
    >
      {tabs.map((tab) => {
        const { label, icon: Icon } = TABS[tab];
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            ref={(element) => {
              if (element) {
                tabRefs.current[tab] = element;
              }
            }}
            type="button"
            role="tab"
            id={getTabId(idPrefix, tab)}
            aria-selected={isActive}
            aria-controls={getPanelId(idPrefix, tab)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => selectTab(tab)}
            className={cn(
              SEGMENT_CLASS,
              isNarrow && "flex-1 justify-center",
              isActive ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS,
            )}
          >
            <Icon aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
};

/**
 * The Project and Organization tab panels. Each mounts the first time it is
 * shown and then stays mounted (hidden), so switching back keeps upload rows
 * and an unsaved prompt edit. The Organization tab is the organization
 * Context page's own body, so the two never drift apart.
 */
export const ContextTabPanels = ({
  state,
  userId,
  organization,
  projectContent,
  isNarrow = false,
  className,
}: ContextTabPanelsProps) => {
  const { tabs, activeTab, idPrefix } = state;
  const [shownTabs, setShownTabs] = useState<ContextTab[]>([]);
  if (activeTab && !shownTabs.includes(activeTab)) {
    setShownTabs([...shownTabs, activeTab]);
  }

  if (!activeTab) {
    return <ContextTabsSkeleton />;
  }

  const hasTabList = tabs.length > 1;
  const getContent = (tab: ContextTab) =>
    tab === "project" ? (
      projectContent
    ) : (
      <OrganizationContextSection
        userId={userId}
        organizationId={organization.id}
        organizationName={organization.name}
        orgSlug={organization.slug}
        variant="embedded"
        isNarrow={isNarrow}
      />
    );

  return tabs.map((tab) => (
    <div
      key={tab}
      id={getPanelId(idPrefix, tab)}
      role={hasTabList ? "tabpanel" : undefined}
      aria-labelledby={hasTabList ? getTabId(idPrefix, tab) : undefined}
      hidden={tab !== activeTab}
      className={className}
    >
      {(tab === activeTab || shownTabs.includes(tab)) && getContent(tab)}
    </div>
  ));
};

const ContextTabsSkeleton = () => (
  <div
    role="status"
    aria-label="Loading context"
    className={cn(PANEL_CLASS, "space-y-3")}
  >
    <div className={cn(SKELETON_BAR_CLASS, "h-5 w-40")} />
    <div className={cn(SKELETON_BAR_CLASS, "h-4 w-3/4")} />
    <div className={cn(SKELETON_BAR_CLASS, "h-28 w-full rounded-2xl")} />
  </div>
);
