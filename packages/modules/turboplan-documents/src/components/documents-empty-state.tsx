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
          "mb-4 flex size-16 items-center justify-center rounded-full border border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-12px_rgba(21,102,71,0.18)]",
          isDragActive ? "bg-brand-50" : "bg-white/55",
        )}
      >
        {isDragActive ? (
          <File className="size-7 text-brand-800" />
        ) : (
          <Upload className="size-7 text-brand-800" />
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
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-brand-50">
        <div className="size-8 animate-spin rounded-full border-b-2 border-brand-800 motion-reduce:animate-none" />
      </div>
      <h3 className="mb-2 text-base font-medium">Uploading Document...</h3>
      {uploadProgress > 0 && (
        <div className="mb-2 h-2 w-64 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-brand-800 transition-all duration-300"
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
