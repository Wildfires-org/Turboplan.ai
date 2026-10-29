"use client";

import {
  DocumentsSectionUI,
  useProjectDocuments,
} from "@wildfires-org/turboplan-documents/client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { StartResearchButton } from "@wildfires-org/turboplan-research-agent-integration/client";

import {
  ContextTabList,
  ContextTabPanels,
} from "@/components/project-context/context-tabs";
import { ProjectContextDropzone } from "@/components/project-context/project-context-dropzone";
import { ProjectDocumentsSection } from "@/components/project-context/project-documents-section";
import { ProjectGisLayersPanel } from "@/components/project-context/project-gis-layers-panel";
import { ProjectNotesSection } from "@/components/project-context/project-notes-section";
import { useContextTabs } from "@/hooks/use-context-tabs";
import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectContextPageSectionProps {
  projectId: string;
  userId: string;
  /** The project's organization */
  organization: { id: string; name: string; slug: string };
  /** Documents module enabled (resolved on the server) */
  isDocumentsEnabled: boolean;
  /** Map module enabled (resolved on the server) */
  isMapEnabled: boolean;
  /** Organization context (prompt, memory, documents) enabled, on the server */
  isOrganizationContextEnabled: boolean;
}

export function ProjectContextPageSection({
  projectId,
  userId,
  organization,
  isDocumentsEnabled,
  isMapEnabled,
  isOrganizationContextEnabled,
}: ProjectContextPageSectionProps) {
  const tabsState = useContextTabs({
    userId,
    organizationId: organization.id,
    isOrganizationContextEnabled,
  });
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
  const canDropFiles = canEdit && (isDocumentsEnabled || isMapEnabled);

  const projectContent = (
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

      {isDocumentsEnabled && (
        <ProjectDocumentsSection projectId={projectId} userId={userId} />
      )}

      {isMapEnabled && (
        <ProjectGisLayersPanel projectId={projectId} canDelete={canDelete} />
      )}

      <ProjectNotesSection projectId={projectId} canEdit={canEdit} />

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
    </>
  );

  return (
    <>
      <ContextTabList state={tabsState} />
      <ContextTabPanels
        state={tabsState}
        userId={userId}
        organization={organization}
        projectContent={projectContent}
        className="space-y-6"
      />
    </>
  );
}
