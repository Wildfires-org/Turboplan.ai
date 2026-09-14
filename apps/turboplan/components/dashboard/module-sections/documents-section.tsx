"use client";

import { useCallback, useRef } from "react";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ACCEPT_STRING,
  ProjectDocumentsSection,
  useProjectDocuments,
} from "@wildfires-org/turboplan-documents/client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";

import { SectionCard } from "../../section-card";
import type { DragHandleProps } from "../sortable-module";

interface DocumentsSectionProps {
  projectId: string;
  userId?: string;
  isHidden: boolean;
  isToggling: boolean;
  onToggleVisibility: () => void;
  isPrivate: boolean;
  isTogglingPublicVisibility: boolean;
  onTogglePublicVisibility?: () => void;
  dragHandleProps?: DragHandleProps;
  /** When true, hides edit controls */
  readOnly?: boolean;
  /** Whether the research phase is completed */
  isResearchPhaseCompleted: boolean;
  /** Base URL for navigating to the project chat */
  chatBaseUrl?: string;
}

export function DocumentsSection({
  projectId,
  userId,
  isHidden,
  isToggling,
  onToggleVisibility,
  isPrivate,
  isTogglingPublicVisibility,
  onTogglePublicVisibility,
  dragHandleProps,
  readOnly = false,
  isResearchPhaseCompleted,
  chatBaseUrl,
}: DocumentsSectionProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSuggestionClick = useCallback(
    (content: string) => {
      if (chatBaseUrl) {
        router.push(
          `${chatBaseUrl}?prefillContent=${encodeURIComponent(content)}`,
        );
      }
    },
    [chatBaseUrl, router],
  );

  // Use the project documents hook for count and upload
  const { documents, uploadDocument, isUploading } = useProjectDocuments({
    projectId,
    source: "upload",
  });

  // Check if user has UPDATE permission (Editor+) on the project
  const { hasPermission: canEdit } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.UPDATE,
  });

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadDocument(file);
      toast.success("Document uploaded successfully");
    } catch (error) {
      console.error("Failed to upload document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document",
      );
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Blue "+ Add" action link in the header triggers the hidden file input.
  const canUpload = !readOnly && canEdit;

  const fileCount = documents.length;
  const subtitle =
    fileCount > 0
      ? `${fileCount} file${fileCount === 1 ? "" : "s"}`
      : undefined;

  return (
    <SectionCard
      title="Documents"
      icon={<FileText className="size-4" aria-hidden />}
      subtitle={subtitle}
      actionLink={
        canUpload ? { label: "+ Add", onClick: handleUploadClick } : undefined
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
      {/* Hidden file input driven by the header "+ Add" action link */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleFileSelect}
        disabled={isUploading}
        className="hidden"
      />
      <ProjectDocumentsSection
        projectId={projectId}
        userId={userId}
        source="upload"
        readOnly={readOnly}
        isResearchPhaseCompleted={isResearchPhaseCompleted}
        onSuggestionClick={chatBaseUrl ? handleSuggestionClick : undefined}
      />
    </SectionCard>
  );
}
