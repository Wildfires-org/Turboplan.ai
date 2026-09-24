"use client";

import { useState } from "react";

import { Plus } from "lucide-react";

import { Button } from "@wildfires-org/turboplan-utils";

import { useTimeline } from "@/hooks/use-timeline";
import { HEADER_ACTION_BUTTON_CLASS, PANEL_CLASS } from "@/lib/glass";
import { AddTimelineEntryDialog } from "./add-timeline-entry-dialog";
import { TimelineContent } from "./timeline-content";

interface TimelinePageProps {
  projectId: string;
}

export function TimelinePage({ projectId }: TimelinePageProps) {
  const {
    entries,
    isLoading,
    error,
    createEntry,
    deleteEntry,
    toggleVisibility,
  } = useTimeline(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className={PANEL_CLASS}>
      <div className="mb-4 flex min-h-9 items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-gray-550">
          Decisions, milestones and activity on this project.
        </p>
        <Button
          variant="brand"
          size="sm"
          className={HEADER_ACTION_BUTTON_CLASS}
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus aria-hidden />
          Add Entry
        </Button>
      </div>

      <TimelineContent
        entries={entries}
        isLoading={isLoading}
        error={error}
        onDeleteEntry={deleteEntry}
        onToggleVisibility={toggleVisibility}
      />

      <AddTimelineEntryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={createEntry}
      />
    </div>
  );
}
