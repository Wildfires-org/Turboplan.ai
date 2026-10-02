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

import { ProjectContextDropzone } from "@/components/project-context/project-context-dropzone";
import { ProjectGisLayersPanel } from "@/components/project-context/project-gis-layers-panel";
import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectContextPageSectionProps {
  projectId: string;
  userId: string;
  /** Documents module enabled (resolved on the server) */
  isDocumentsEnabled: boolean;
  /** Map module enabled (resolved on the server) */
  isMapEnabled: boolean;
}

export function ProjectContextPageSection({
  projectId,
  userId,
  isDocumentsEnabled,
  isMapEnabled,
}: ProjectContextPageSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { addEntry, isMutating } = useProjectContext({ projectId });
  const { hasPermission: canEdit } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.UPDATE,
  });
  const { hasPermission: canDelete } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.DELETE,
  });
  const { documents: researchedDocuments } = useProjectDocuments({
    projectId,
    source: "research",
  });
  const { documents: uploadedDocuments } = useProjectDocuments({
    projectId,
    source: "upload",
  });
  const canDropFiles = canEdit && (isDocumentsEnabled || isMapEnabled);

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
              Everything the assistant should know about this project.
            </p>
          </div>
          <StartResearchButton
            projectId={projectId}
            canEdit={canEdit}
            appearance="glass"
          />
        </div>

        {canDropFiles && (
          <ProjectContextDropzone
            projectId={projectId}
            acceptsDocuments={isDocumentsEnabled}
            acceptsGisLayers={isMapEnabled}
          />
        )}
      </section>

      {isDocumentsEnabled && uploadedDocuments.length > 0 && (
        <section className={cn(PANEL_CLASS, "space-y-4")}>
          <div>
            <h3 className={PANEL_TITLE_CLASS}>Documents</h3>
            <p className="text-[13px] leading-5 text-gray-550">
              Uploaded plans, permits and reports. Their text is read by the
              assistant once extracted.
            </p>
          </div>
          {/* The only poller of this list on the page (showExtractionStatus
              polls while text is pending); the dropzone rows above read the
              same SWR cache and update with it. */}
          <DocumentsSectionUI
            projectId={projectId}
            userId={userId}
            source="upload"
            showExtractionStatus
          />
        </section>
      )}

      {isMapEnabled && (
        <ProjectGisLayersPanel projectId={projectId} canDelete={canDelete} />
      )}

      <section className={cn(PANEL_CLASS, "space-y-4")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            >
              <Plus aria-hidden />
              Add context
            </Button>
          )}
        </div>

        <ProjectContextList projectId={projectId} readOnly={!canEdit} />
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
