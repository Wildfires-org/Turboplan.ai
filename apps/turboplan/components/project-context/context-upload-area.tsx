"use client";

import { useLocalStorage } from "usehooks-ts";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";

import { OrganizationDocumentsDropzone } from "@/components/organization-context/organization-documents-dropzone";
import { useOrganizationContextPermissions } from "@/hooks/use-organization-context-permissions";
import {
  type ContextUploadTarget,
  getContextUploadTargets,
  pickContextUploadTarget,
} from "@/lib/context-upload-target";
import { cn } from "@/lib/utils";
import { ContextUploadTargetSwitch } from "./context-upload-target-switch";
import { ProjectContextDropzone } from "./project-context-dropzone";

interface ContextUploadAreaProps {
  projectId: string;
  userId: string;
  /** The project's organization; null hides the organization target */
  organization: { id: string; name: string } | null;
  /** Documents module enabled */
  isDocumentsEnabled: boolean;
  /** Map module enabled */
  isMapEnabled: boolean;
  /** Organization context (prompt, memory, documents) enabled */
  isOrganizationContextEnabled: boolean;
  /** In a narrow container (the chat Context panel): stack the dropzones */
  isNarrow?: boolean;
  className?: string;
}

const UPLOAD_TARGET_STORAGE_KEY = "project-context-upload-target";

/**
 * Where files for the AI are added from a project: the project dropzone, the
 * organization dropzone, or both behind a "Project / {organization}" switch
 * (the choice is remembered per user). Renders nothing until the permission
 * checks land, or when the user cannot add files anywhere.
 */
export const ContextUploadArea = ({
  projectId,
  userId,
  organization,
  isDocumentsEnabled,
  isMapEnabled,
  isOrganizationContextEnabled,
  isNarrow = false,
  className,
}: ContextUploadAreaProps) => {
  const { hasPermission: canEdit, isChecking: isCheckingEdit } =
    useEntityPermission({
      userId,
      entityType: EntityType.PROJECT,
      entityId: projectId,
      action: Action.UPDATE,
    });
  const { canEditOrganization, isCheckingOrganization } =
    useOrganizationContextPermissions({
      userId: isOrganizationContextEnabled ? userId : undefined,
      organizationId: organization?.id ?? null,
    });

  // Per user, read after hydration so the server and client render alike.
  const [preferredUploadTarget, setPreferredUploadTarget] =
    useLocalStorage<ContextUploadTarget>(
      `${UPLOAD_TARGET_STORAGE_KEY}:${userId}`,
      "project",
      { initializeWithValue: false },
    );
  const uploadTargets = getContextUploadTargets({
    canAddProjectFiles: canEdit && (isDocumentsEnabled || isMapEnabled),
    canAddOrganizationFiles:
      isOrganizationContextEnabled && canEditOrganization,
  });
  // Wait for both checks so the dropzone does not swap targets as they land.
  const isCheckingUploadTargets = isCheckingEdit || isCheckingOrganization;
  const uploadTarget = isCheckingUploadTargets
    ? null
    : pickContextUploadTarget(uploadTargets, preferredUploadTarget);

  if (!uploadTarget) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {organization &&
        (uploadTargets.length > 1 ? (
          <ContextUploadTargetSwitch
            value={uploadTarget}
            organizationName={organization.name}
            onChange={setPreferredUploadTarget}
          />
        ) : (
          uploadTarget === "organization" && (
            // No switch, so say where these files go.
            <p className="text-xs leading-5 text-gray-550 [overflow-wrap:anywhere]">
              Files you add here go to the {organization.name} context, shared
              with the AI in every project in {organization.name}.
            </p>
          )
        ))}
      {/* Both stay mounted so switching keeps each one's upload rows. */}
      {uploadTargets.includes("project") && (
        <ProjectContextDropzone
          projectId={projectId}
          acceptsDocuments={isDocumentsEnabled}
          acceptsGisLayers={isMapEnabled}
          isNarrow={isNarrow}
          className={cn(uploadTarget !== "project" && "hidden")}
        />
      )}
      {organization && uploadTargets.includes("organization") && (
        <OrganizationDocumentsDropzone
          organizationId={organization.id}
          isNarrow={isNarrow}
          className={cn(uploadTarget !== "organization" && "hidden")}
        />
      )}
    </div>
  );
};
