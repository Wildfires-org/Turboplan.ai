"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  DocumentsSectionUI,
  useProjectDocuments,
} from "@wildfires-org/turboplan-documents/client";
import {
  ContextFormDialog,
  ProjectContextList,
  useProjectContext,
} from "@wildfires-org/turboplan-project-context/client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { StartResearchButton } from "@wildfires-org/turboplan-research-agent-integration/client";
import { Button } from "@wildfires-org/turboplan-utils";

import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectContextPageSectionProps {
  projectId: string;
  userId: string;
}

export function ProjectContextPageSection({
  projectId,
  userId,
}: ProjectContextPageSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { addEntry, isMutating } = useProjectContext({ projectId });
  const { hasPermission: canEdit } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.UPDATE,
  });
  const { documents: researchedDocuments } = useProjectDocuments({
    projectId,
    source: "research",
  });

  const handleAddContext = async (data: {
    label: string;
    content: string;
    url?: string;
  }) => {
    try {
      await addEntry(data);
      toast.success("Context entry added successfully");
      setIsAddDialogOpen(false);
    } catch {
      toast.error("Failed to add context entry");
    }
  };

  return (
    <>
      <section className={cn(PANEL_CLASS, "space-y-4")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className={PANEL_TITLE_CLASS}>Project Context</h3>
            <p className="text-[13px] leading-5 text-gray-550">
              Key information and references for this project.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StartResearchButton
              projectId={projectId}
              canEdit={canEdit}
              appearance="glass"
            />
            <Button
              variant="brand"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus aria-hidden />
              Add context
            </Button>
          </div>
        </div>

        <ProjectContextList projectId={projectId} readOnly={false} />
      </section>

      {researchedDocuments.length > 0 && (
        <section className={cn(PANEL_CLASS, "space-y-4")}>
          <div>
            <h3 className={PANEL_TITLE_CLASS}>Researched documents</h3>
            <p className="text-[13px] leading-5 text-gray-550">
              Documents the research agent found and saved for this project.
            </p>
          </div>
          <DocumentsSectionUI
            projectId={projectId}
            userId={userId}
            source="research"
            readOnly
          />
        </section>
      )}

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
    </>
  );
}
