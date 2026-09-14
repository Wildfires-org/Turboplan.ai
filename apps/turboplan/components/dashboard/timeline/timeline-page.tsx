"use client";

import { useState } from "react";

import { Plus } from "lucide-react";

import { Button } from "@wildfires-org/turboplan-utils";

import { useTimeline } from "@/hooks/use-timeline";
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="mr-1.5 size-4" />
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
