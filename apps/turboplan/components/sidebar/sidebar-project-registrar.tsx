"use client";

import { useMemo } from "react";

import { useSidebarSlot } from "@/hooks/use-sidebar-slot";
import { SidebarProjectContent } from "./sidebar-project-content";

interface SidebarProjectRegistrarProps {
  projectName: string;
  projectId?: string;
  isResearchPhaseCompleted: boolean;
}

export function SidebarProjectRegistrar({
  projectName,
  projectId,
  isResearchPhaseCompleted,
}: SidebarProjectRegistrarProps) {
  const content = useMemo(
    () => (
      <SidebarProjectContent
        projectName={projectName}
        projectId={projectId}
        isResearchPhaseCompleted={isResearchPhaseCompleted}
      />
    ),
    [projectName, projectId, isResearchPhaseCompleted],
  );
  useSidebarSlot(content);
  return null;
}
