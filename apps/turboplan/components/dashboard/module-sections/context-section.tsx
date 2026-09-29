"use client";

import { BookOpen } from "lucide-react";

import {
  ProjectContextList,
  useProjectContext,
} from "@wildfires-org/turboplan-project-context/client";
import { StartResearchButton } from "@wildfires-org/turboplan-research-agent-integration/client";

import type { DragHandleProps } from "@/components/dashboard/sortable-module";
import { SectionCard } from "@/components/section-card";

interface ContextSectionProps {
  projectId: string;
  isHidden: boolean;
  isToggling: boolean;
  onToggleVisibility: () => void;
  isPrivate: boolean;
  isTogglingPublicVisibility: boolean;
  onTogglePublicVisibility?: () => void;
  dragHandleProps?: DragHandleProps;
  readOnly?: boolean;
}

export function ContextSection({
  projectId,
  isHidden,
  isToggling,
  onToggleVisibility,
  isPrivate,
  isTogglingPublicVisibility,
  onTogglePublicVisibility,
  dragHandleProps,
  readOnly = false,
}: ContextSectionProps) {
  const { entries } = useProjectContext({ projectId });

  const itemCount = entries.length;
  const subtitle =
    itemCount > 0
      ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
      : undefined;

  return (
    <SectionCard
      title="Context"
      icon={<BookOpen className="size-4" aria-hidden />}
      subtitle={subtitle}
      controls={
        <StartResearchButton
          projectId={projectId}
          canEdit={!readOnly}
          appearance="glass"
        />
      }
      onToggleVisibility={onToggleVisibility}
      isHidden={isHidden}
      isTogglingVisibility={isToggling}
      onTogglePublicVisibility={onTogglePublicVisibility}
      isPrivate={isPrivate}
      isTogglingPublicVisibility={isTogglingPublicVisibility}
      dragHandleProps={dragHandleProps}
      readOnly={readOnly}
    >
      <ProjectContextList projectId={projectId} readOnly={readOnly} />
    </SectionCard>
  );
}
