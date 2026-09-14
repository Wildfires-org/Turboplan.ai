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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Project Context</h2>
            <p className="text-sm text-muted-foreground">
              Key information and references for this project.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StartResearchButton projectId={projectId} canEdit={canEdit} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="size-4 mr-2" />
              Add context
            </Button>
          </div>
        </div>

        <ProjectContextList projectId={projectId} readOnly={false} />
      </div>

      {researchedDocuments.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Researched documents</h2>
            <p className="text-sm text-muted-foreground">
              Documents the research agent found and saved for this project.
            </p>
          </div>
          <DocumentsSectionUI
            projectId={projectId}
            userId={userId}
            source="research"
            readOnly
          />
        </div>
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
