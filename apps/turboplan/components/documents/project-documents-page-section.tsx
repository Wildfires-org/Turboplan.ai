"use client";

import { useRef } from "react";

import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  ACCEPT_STRING,
  DocumentsSectionUI,
  useProjectDocuments,
} from "@wildfires-org/turboplan-documents/client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Button } from "@wildfires-org/turboplan-utils";

interface ProjectDocumentsPageSectionProps {
  projectId: string;
  userId: string;
}

export function ProjectDocumentsPageSection({
  projectId,
  userId,
}: ProjectDocumentsPageSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument, isUploading, uploadProgress } = useProjectDocuments({
    projectId,
    source: "upload",
  });
  const { hasPermission: canEdit } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.UPDATE,
  });

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

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-end gap-4 pb-4">
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleUploadClick}
              disabled={isUploading}
              variant="secondary"
              size="sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {uploadProgress > 0 ? `${uploadProgress}%` : "..."}
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload
                </>
              )}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
            />
          </div>
        )}
      </div>
      <DocumentsSectionUI
        projectId={projectId}
        userId={userId}
        source="upload"
        onFileUpload={uploadDocument}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        className="pb-0 flex-1"
        variant="page"
      />
    </div>
  );
}
