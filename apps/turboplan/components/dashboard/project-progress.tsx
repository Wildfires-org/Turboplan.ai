"use client";

import { useState } from "react";

import type { User } from "next-auth";

import { ProjectProgress as ProjectProgressBase } from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { PublicVisibilityDropdown } from "./public-visibility-dropdown";

interface ProjectProgressProps {
  project: Project;
  user?: User;
  onVisibilityChange?: (isPublic: boolean) => void;
  /**
   * Hide the visibility (eye) action. Used when the eye is rendered elsewhere
   * (e.g. the overlapping header card renders it in the top-right cluster).
   */
  hideActions?: boolean;
}

export function ProjectProgress({
  project,
  user,
  onVisibilityChange,
  hideActions = false,
}: ProjectProgressProps) {
  const [_isProjectPublic, setIsProjectPublic] = useState(project.isPublic);

  const handleVisibilityChange = (isPublic: boolean) => {
    setIsProjectPublic(isPublic);
    onVisibilityChange?.(isPublic);
  };

  return (
    <ProjectProgressBase
      startDate={project.startDate}
      endDate={project.endDate}
      renderActions={
        hideActions
          ? undefined
          : () => (
              <PublicVisibilityDropdown
                project={project}
                userId={user?.id}
                onVisibilityChange={handleVisibilityChange}
              />
            )
      }
    />
  );
}
