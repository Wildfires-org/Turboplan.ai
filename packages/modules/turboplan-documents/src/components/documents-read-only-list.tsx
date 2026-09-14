"use client";

import { useState } from "react";

import { DocumentCardReadOnly } from "./document-card";
import { DocumentsEmptyState } from "./documents-empty-state";
import { DocumentsList } from "./documents-list";
import { DocumentPreviewDialog } from "./preview/document-preview-dialog";

export interface ReadOnlyDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface DocumentsReadOnlyListProps {
  documents: ReadOnlyDocument[];
  className?: string;
  variant?: "default" | "compact";
  emptyTitle?: string;
  emptyMessage?: string;
  onDocumentClick?: (document: ReadOnlyDocument) => void;
}

export function DocumentsReadOnlyList({
  documents,
  className,
  variant = "compact",
  emptyTitle = "No Documents",
  emptyMessage = "This template doesn't have any documents yet.",
  onDocumentClick,
}: DocumentsReadOnlyListProps) {
  const [previewDoc, setPreviewDoc] = useState<ReadOnlyDocument | null>(null);

  if (documents.length === 0) {
    return (
      <DocumentsEmptyState
        className={className}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
      />
    );
  }

  const handleDocumentClick = onDocumentClick ?? setPreviewDoc;

  return (
    <>
      <DocumentsList variant={variant} className={className}>
        {documents.map((document) => (
          <DocumentCardReadOnly
            key={document.id}
            document={document}
            onClick={handleDocumentClick}
          />
        ))}
      </DocumentsList>

      {previewDoc && !onDocumentClick && (
        <DocumentPreviewDialog
          id={previewDoc.id}
          filename={previewDoc.originalFilename}
          url={previewDoc.url}
          mimeType={previewDoc.mimeType}
          open={!!previewDoc}
          onOpenChange={(open) => {
            if (!open) setPreviewDoc(null);
          }}
        />
      )}
    </>
  );
}
