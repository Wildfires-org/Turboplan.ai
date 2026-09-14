"use client";

import { useCallback, useState } from "react";

import { CheckSquare } from "lucide-react";
import type { User } from "next-auth";

import { SectionCard } from "../../section-card";
import { ProjectTasks } from "../project-tasks";
import type { DragHandleProps } from "../sortable-module";

interface TasksSectionProps {
  projectId: string;
  projectName?: string;
  user?: User;
  isHidden: boolean;
  isToggling: boolean;
  onToggleVisibility: () => void;
  isPrivate: boolean;
  isTogglingPublicVisibility: boolean;
  onTogglePublicVisibility?: () => void;
  dragHandleProps?: DragHandleProps;
  /** When true, hides edit controls */
  readOnly?: boolean;
}

const pluralize = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

export function TasksSection({
  projectId,
  projectName,
  user,
  isHidden,
  isToggling,
  onToggleVisibility,
  isPrivate,
  isTogglingPublicVisibility,
  onTogglePublicVisibility,
  dragHandleProps,
  readOnly = false,
}: TasksSectionProps) {
  const [counts, setCounts] = useState<{
    milestones: number;
    tasks: number;
  } | null>(null);

  // Stable callback so ProjectTasks' reporting effect doesn't re-run each render.
  const handleCounts = useCallback(
    (next: { milestones: number; tasks: number }) => {
      setCounts((prev) =>
        prev && prev.milestones === next.milestones && prev.tasks === next.tasks
          ? prev
          : next,
      );
    },
    [],
  );

  const subtitle = counts
    ? `${pluralize(counts.milestones, "milestone")} · ${pluralize(counts.tasks, "task")}`
    : undefined;

  return (
    <SectionCard
      title="Tasks"
      icon={<CheckSquare className="size-4" aria-hidden />}
      subtitle={subtitle}
      onToggleVisibility={onToggleVisibility}
      isHidden={isHidden}
      isTogglingVisibility={isToggling}
      onTogglePublicVisibility={onTogglePublicVisibility}
      isPrivate={isPrivate}
      isTogglingPublicVisibility={isTogglingPublicVisibility}
      dragHandleProps={dragHandleProps}
      readOnly={readOnly}
    >
      <ProjectTasks
        projectId={projectId}
        projectName={projectName}
        user={user}
        readOnly={readOnly}
        onCounts={handleCounts}
      />
    </SectionCard>
  );
}
