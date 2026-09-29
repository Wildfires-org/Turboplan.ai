"use client";

import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import { useOptionalDashboard } from "@/components/providers/dashboard-provider";
import { ProjectChatPageFallback } from "./project-chat-page-shell";

/** Route loading state for project chats. While research is in progress the
 * only chat is the initial one, whose research pane opens on load, so the
 * fallback reserves it to avoid a layout shift. */
export function ProjectChatRouteLoading() {
  const project = useOptionalDashboard()?.project;

  return (
    <ProjectChatPageFallback
      showResearchPane={
        isResearchAgentPackageEnabled() &&
        project?.isResearchPhaseCompleted === false
      }
    />
  );
}
