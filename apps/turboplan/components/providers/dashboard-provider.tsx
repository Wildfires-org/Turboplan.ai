"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";

import { posthog } from "posthog-js";

import type {
  Office,
  Organization,
  Project,
} from "@wildfires-org/turboplan-workspace/types";

// ============================================================================
// Dashboard Context Types
// ============================================================================

interface DashboardContext {
  organization: Organization | null;
  office: Office | null;
  project: Project | null;
  /** Resolved project cover URL, so loading states can paint the real
   * header without refetching it. */
  projectCoverImageUrl: string | null;
}

// ============================================================================
// Context Creation
// ============================================================================

const DashboardContext = createContext<DashboardContext | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface DashboardProviderProps {
  children: ReactNode;
  organization: Organization | null;
  office?: Office | null;
  project?: Project | null;
  projectCoverImageUrl?: string | null;
}

export function DashboardProvider({
  children,
  organization,
  office = null,
  project = null,
  projectCoverImageUrl = null,
}: DashboardProviderProps) {
  useEffect(() => {
    // Group analytics: scope subsequent events to the active workspace
    // entities. No-ops when PostHog is not initialized.
    if (!posthog.__loaded) {
      return;
    }
    // Groups are sticky in posthog persistence — clear first so leaving a
    // project/office doesn't keep tagging events with the previous one.
    posthog.resetGroups();
    if (organization?.id) {
      // Personal workspaces are auto-named from the user's email local part —
      // sending that name would leak PII to analytics. Id-only for those.
      const isPersonalOrg = organization.type === "personal";
      posthog.group(
        "organization",
        organization.id,
        isPersonalOrg ? undefined : { name: organization.name },
      );
    }
    if (office?.id) {
      posthog.group("office", office.id, { name: office.name });
    }
    if (project?.id) {
      posthog.group("project", project.id, { name: project.name });
    }
  }, [
    organization?.id,
    organization?.name,
    office?.id,
    office?.name,
    project?.id,
    project?.name,
  ]);

  const value: DashboardContext = {
    organization,
    office,
    project,
    projectCoverImageUrl,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// ============================================================================
// Hook to Use Context
// ============================================================================

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

/** Non-throwing variant for components that may render above the provider
 * (e.g. a loading boundary that sits outside the office layout). */
export const useOptionalDashboard = () => useContext(DashboardContext) ?? null;
