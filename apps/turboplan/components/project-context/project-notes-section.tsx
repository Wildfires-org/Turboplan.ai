"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  ContextFormDialog,
  ProjectContextList,
  useProjectContext,
} from "@wildfires-org/turboplan-project-context/client";
import { Button } from "@wildfires-org/turboplan-utils";

import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectNotesSectionProps {
  projectId: string;
  /** Project UPDATE: add, edit and delete notes */
  canEdit: boolean;
  /** In a narrow container (the chat Context panel): stack the header */
  isNarrow?: boolean;
}

type ContextEntryInput = {
  label: string;
  content: string;
  url?: string;
};

/** The project's "Notes and references" with an "Add context" dialog. */
export const ProjectNotesSection = ({
  projectId,
  canEdit,
  isNarrow = false,
}: ProjectNotesSectionProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { addEntry, isMutating } = useProjectContext({ projectId });

  const handleAddContext = async (data: ContextEntryInput) => {
    try {
      await addEntry(data);
      toast.success("Context entry added successfully");
      setIsAddDialogOpen(false);
    } catch {
      toast.error("Failed to add context entry");
    }
  };

  return (
    <section className={cn(PANEL_CLASS, "space-y-4")}>
      <div
        className={cn(
          "flex flex-col gap-3",
          !isNarrow && "sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div>
          <h3 className={PANEL_TITLE_CLASS}>Notes and references</h3>
          <p className="text-[13px] leading-5 text-gray-550">
            Key information and references for this project.
          </p>
        </div>
        {canEdit && (
          <Button
            variant="brand"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className={cn(isNarrow && "self-start")}
          >
            <Plus aria-hidden />
            Add context
          </Button>
        )}
      </div>

      <ProjectContextList projectId={projectId} readOnly={!canEdit} />

      <ContextFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddContext}
        isSubmitting={isMutating}
        title="Add Context"
        description="Add a context entry to capture project information."
        submitLabel="Add Context"
        submittingLabel="Adding..."
      />
    </section>
  );
};
