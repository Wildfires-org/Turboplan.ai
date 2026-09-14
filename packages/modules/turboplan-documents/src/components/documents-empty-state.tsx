"use client";

import { File, Upload } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

interface DocumentsEmptyStateProps {
  emptyTitle: string;
  emptyMessage: string;
  className?: string;
}

interface DocumentsUploadEmptyStateProps {
  isDragActive: boolean;
  canUpload: boolean;
}

interface DocumentsUploadingStateProps {
  uploadProgress: number;
}

export function DocumentsEmptyState({
  emptyTitle,
  emptyMessage,
  className,
}: DocumentsEmptyStateProps) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-6", className)}
    >
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-4 text-4xl">📄</div>
        <h3 className="mb-2 text-lg font-medium">{emptyTitle}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    </div>
  );
}

export function DocumentsUploadEmptyState({
  isDragActive,
  canUpload,
}: DocumentsUploadEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div
        className={cn(
          "mb-4 flex h-16 w-16 items-center justify-center rounded-full",
          isDragActive ? "bg-blue-100" : "bg-gray-200",
        )}
      >
        {isDragActive ? (
          <File className="size-8 text-blue-500" />
        ) : (
          <Upload className="size-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="mb-2 text-base font-medium text-foreground">
        {isDragActive ? "Drop file here" : "No Documents Yet"}
      </h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {canUpload
          ? "Drag and drop a file here, or click browse below"
          : "No documents have been uploaded to this project yet."}
      </p>
    </div>
  );
}

export function DocumentsUploadingState({
  uploadProgress,
}: DocumentsUploadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
      <h3 className="mb-2 text-base font-medium">Uploading Document...</h3>
      {uploadProgress > 0 && (
        <div className="mb-2 h-2 w-64 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Please wait while we upload your document
      </p>
    </div>
  );
}
