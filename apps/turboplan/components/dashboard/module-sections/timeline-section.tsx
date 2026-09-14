"use client";

import { useState } from "react";

import { Clock } from "lucide-react";

import { useTimeline } from "@/hooks/use-timeline";
import { SectionCard } from "../../section-card";
import type { DragHandleProps } from "../sortable-module";
import { AddTimelineEntryDialog } from "../timeline/add-timeline-entry-dialog";
import { TimelineContent } from "../timeline/timeline-content";

interface TimelineSectionProps {
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

export function TimelineSection({
  projectId,
  isHidden,
  isToggling,
  onToggleVisibility,
  isPrivate,
  isTogglingPublicVisibility,
  onTogglePublicVisibility,
  dragHandleProps,
  readOnly = false,
}: TimelineSectionProps) {
  const {
    entries,
    isLoading,
    error,
    createEntry,
    deleteEntry,
    toggleVisibility,
  } = useTimeline(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const entryCount = entries.length;
  const subtitle =
    entryCount > 0
      ? `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`
      : undefined;

  return (
    <>
      <SectionCard
        title="Timeline"
        icon={<Clock className="size-4" aria-hidden />}
        subtitle={subtitle}
        actionLink={
          !readOnly
            ? { label: "+ Add", onClick: () => setIsDialogOpen(true) }
            : undefined
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
        <TimelineContent
          entries={entries}
          isLoading={isLoading}
          error={error}
          readOnly={readOnly}
          onDeleteEntry={deleteEntry}
          onToggleVisibility={toggleVisibility}
        />
      </SectionCard>

      <AddTimelineEntryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={createEntry}
      />
    </>
  );
}
