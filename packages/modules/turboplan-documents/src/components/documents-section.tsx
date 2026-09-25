"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AlertCircle,
  Download,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  isSafeHttpUrl,
  SuggestionPills,
} from "@wildfires-org/turboplan-utils";
import { useEmptyStateSuggestions } from "@wildfires-org/turboplan-workspace/client";

import { useProjectDocuments } from "../hooks/use-project-documents";
import type { ProjectDocument, ProjectDocumentSource } from "../types";
import { DocumentCardEditable } from "./document-card";
import {
  DocumentsUploadEmptyState,
  DocumentsUploadingState,
} from "./documents-empty-state";
import { DocumentsList } from "./documents-list";
import { DocumentPreviewDialog } from "./preview/document-preview-dialog";
import { RenameDocumentDialog } from "./rename-document-dialog";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./utils";

type DocumentCardWithActionsProps = {
  document: ProjectDocument;
  readOnly: boolean;
  isDeleting: string | null;
  canModify: boolean;
  onPreview: (doc: ProjectDocument) => void;
  onDelete: (id: string) => void;
  onRename: (doc: ProjectDocument) => void;
};

const DocumentCardWithActions = ({
  document,
  readOnly,
  isDeleting,
  canModify,
  onPreview,
  onDelete,
  onRename,
}: DocumentCardWithActionsProps) => (
  <DocumentCardEditable
    document={document}
    onClick={() => onPreview(document)}
    actions={
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!isSafeHttpUrl(document.url)}
            onClick={(e) => {
              e.stopPropagation();
              if (isSafeHttpUrl(document.url)) {
                window.open(document.url, "_blank");
              }
            }}
          >
            <Download className="mr-2 size-4" />
            Download
          </DropdownMenuItem>
          {!readOnly && canModify && (
            <>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(document);
                }}
              >
                <Pencil className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(document.id);
                }}
                disabled={isDeleting === document.id}
                className="text-destructive focus:text-destructive"
              >
                {isDeleting === document.id ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    }
  />
);

type FolderGroupData = {
  name: string;
  description?: string | null;
  docs: ProjectDocument[];
};

const groupDocumentsByFolder = (
  documents: ProjectDocument[],
): { folders: FolderGroupData[]; ungrouped: ProjectDocument[] } => {
  const folderMap = new Map<string, FolderGroupData>();
  const ungrouped: ProjectDocument[] = [];

  for (const doc of documents) {
    if (doc.folder) {
      const existing = folderMap.get(doc.folder);
      if (existing) {
        existing.docs.push(doc);
        if (!existing.description && doc.folderDescription) {
          existing.description = doc.folderDescription;
        }
      } else {
        folderMap.set(doc.folder, {
          name: doc.folder,
          description: doc.folderDescription,
          docs: [doc],
        });
      }
    } else {
      ungrouped.push(doc);
    }
  }

  return { folders: Array.from(folderMap.values()), ungrouped };
};

type DocumentCardsGridProps = {
  documents: ProjectDocument[];
  readOnly: boolean;
  isDeleting: string | null;
  canModifyDocument: (doc: ProjectDocument) => boolean;
  onPreview: (doc: ProjectDocument) => void;
  onDelete: (id: string) => void;
  onRename: (doc: ProjectDocument) => void;
};

const DocumentCardsGrid = ({
  documents,
  readOnly,
  isDeleting,
  canModifyDocument,
  onPreview,
  onDelete,
  onRename,
}: DocumentCardsGridProps) => {
  const { folders, ungrouped } = useMemo(
    () => groupDocumentsByFolder(documents),
    [documents],
  );
  const hasFolders = folders.length > 0;

  if (!hasFolders) {
    return (
      <DocumentsList variant="section">
        {documents.map((document) => (
          <DocumentCardWithActions
            key={document.id}
            document={document}
            readOnly={readOnly}
            isDeleting={isDeleting}
            canModify={canModifyDocument(document)}
            onPreview={onPreview}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </DocumentsList>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {folders.map((folder) => (
        <div key={folder.name}>
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {folder.name}
            </span>
            {folder.description && (
              <span className="text-xs text-muted-foreground">
                · {folder.description}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              ({folder.docs.length})
            </span>
          </div>
          <DocumentsList variant="section">
            {folder.docs.map((document) => (
              <DocumentCardWithActions
                key={document.id}
                document={document}
                readOnly={readOnly}
                isDeleting={isDeleting}
                canModify={canModifyDocument(document)}
                onPreview={onPreview}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </DocumentsList>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div>
          {folders.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-foreground">
                Other Documents
              </span>
              <span className="text-xs text-muted-foreground">
                ({ungrouped.length})
              </span>
            </div>
          )}
          <DocumentsList variant="section">
            {ungrouped.map((document) => (
              <DocumentCardWithActions
                key={document.id}
                document={document}
                readOnly={readOnly}
                isDeleting={isDeleting}
                canModify={canModifyDocument(document)}
                onPreview={onPreview}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </DocumentsList>
        </div>
      )}
    </div>
  );
};

export interface DocumentsSectionUIProps {
  projectId: string;
  userId?: string;
  /** Only show documents of this origin (e.g. "research" on the Context page) */
  source?: ProjectDocumentSource;
  /** When true, hides edit controls */
  readOnly?: boolean;
  /** Callback to handle file upload */
  onFileUpload?: (file: File) => Promise<unknown>;
  /** Whether a file is currently being uploaded */
  isUploading?: boolean;
  /** Upload progress percentage (0-100) */
  uploadProgress?: number;
  className?: string;
  /** The variant of the documents section */
  variant?: "default" | "page";
  /** Whether the research phase is completed */
  isResearchPhaseCompleted?: boolean;
  /** Callback when a suggestion pill is clicked */
  onSuggestionClick?: (content: string) => void;
}

/**
 * Documents section UI component.
 * Renders the file list and delete dialogs with drag & drop upload support.
 * Use this component inside an AccordionHeader wrapper.
 */
export function DocumentsSectionUI({
  projectId,
  userId,
  source,
  readOnly = false,
  onFileUpload,
  isUploading = false,
  uploadProgress = 0,
  className,
  variant = "default",
  isResearchPhaseCompleted,
  onSuggestionClick,
}: DocumentsSectionUIProps) {
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<ProjectDocument | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);

  const { suggestions, isLoading: isSuggestionsLoading } =
    useEmptyStateSuggestions({
      projectId,
      section: "documents",
      enabled: isResearchPhaseCompleted ?? false,
    });

  const placeholderSuggestions = [
    { label: "Draft a scoping letter", content: "" },
    { label: "Create NEPA checklist", content: "" },
    { label: "Write project summary", content: "" },
  ];

  // Use the project documents hook
  const {
    documents,
    isLoading,
    deleteDocument,
    renameDocument,
    isDeleting,
    isRenaming,
  } = useProjectDocuments({
    projectId,
    source,
  });

  // Check if user has UPDATE permission (Editor+) on the project
  const { hasPermission: canEdit } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.UPDATE,
  });

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setDropError(null);

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      if (onFileUpload) {
        await onFileUpload(file);
      }
    },
    [onFileUpload],
  );

  // Handle rejected files
  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors.length > 0) {
        const error = rejection.errors[0];
        if (error.code === "file-too-large") {
          setDropError("File size must be less than 50MB");
        } else if (error.code === "file-invalid-type") {
          setDropError(
            "Please upload a PDF or Word document (.pdf, .doc, .docx)",
          );
        } else {
          setDropError(error.message);
        }
      }
    }
  }, []);

  // Enable dropzone only if user can edit and has upload handler
  const dropzoneEnabled = canEdit && !readOnly && !!onFileUpload;

  const { getRootProps, getInputProps, isDragActive, inputRef } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ALLOWED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: !dropzoneEnabled || isUploading,
    noClick: documents.length > 0, // Only allow click in empty state
  });

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteFileId) return;

    try {
      await deleteDocument(deleteFileId);
      toast.success("Document deleted successfully");
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeleteFileId(null);
    }
  };

  // Handle rename submit
  const handleRenameSubmit = async (documentId: string, newName: string) => {
    try {
      await renameDocument(documentId, newName);
      setRenameDoc(null);
    } catch (error) {
      console.error("Failed to rename document:", error);
      toast.error("Failed to rename document");
    }
  };

  // Check if user can rename/delete a document (uploader OR editor+)
  const canModifyDocument = (document: ProjectDocument) => {
    return document.userId === userId || canEdit;
  };

  // Handle browse click
  const handleBrowseClick = () => {
    if (dropzoneEnabled && !isUploading) {
      inputRef.current?.click();
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-col pb-1.5",
          {
            "h-full": variant === "page",
          },
          className,
        )}
      >
        {/* Documents container with gray background */}
        <div
          {...(dropzoneEnabled && documents.length > 0 ? getRootProps() : {})}
          className={cn(
            "group relative z-[2] mb-[-6px] overflow-hidden rounded-xl border border-white/90 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40",
            isDragActive && "border-brand-700 bg-brand-50",
            isUploading && "pointer-events-none opacity-60",
          )}
        >
          {dropzoneEnabled && documents.length > 0 && (
            <input {...getInputProps()} />
          )}

          {/* Loading state */}
          {isLoading && (
            // Card placeholders at DocumentCardEditable's size, same grid.
            <div
              role="status"
              aria-label="Loading documents"
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="h-[86px] rounded-xl bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none dark:bg-slate-800/70"
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && documents.length === 0 && (
            <>
              {isUploading ? (
                <DocumentsUploadingState uploadProgress={uploadProgress} />
              ) : (
                <>
                  {onSuggestionClick && !readOnly && !isDragActive ? (
                    <div className="flex flex-col items-center gap-5 py-8 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <h3 className="text-lg font-medium text-foreground">
                          No documents yet
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-sm leading-5">
                          Drag and drop files here, connect your cloud storage,
                          or ask the Agent to draft the initial project
                          documentation for you.
                        </p>
                      </div>
                      <SuggestionPills
                        suggestions={
                          isResearchPhaseCompleted
                            ? suggestions
                            : placeholderSuggestions
                        }
                        isLoading={
                          isResearchPhaseCompleted && isSuggestionsLoading
                        }
                        disabled={!isResearchPhaseCompleted}
                        onSuggestionClick={onSuggestionClick}
                      />
                    </div>
                  ) : (
                    <DocumentsUploadEmptyState
                      isDragActive={isDragActive}
                      canUpload={canEdit && !readOnly}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* Document cards grid */}
          {!isLoading && documents.length > 0 && (
            <DocumentCardsGrid
              documents={documents}
              readOnly={readOnly}
              isDeleting={isDeleting}
              canModifyDocument={canModifyDocument}
              onPreview={setPreviewDoc}
              onDelete={setDeleteFileId}
              onRename={setRenameDoc}
            />
          )}

          {/* Beaver slides in from bottom on hover (empty state only) */}
          {!isLoading && documents.length === 0 && !isUploading && (
            <div className="pointer-events-none absolute bottom-0 right-6 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-[10%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/shocked-beaver.png"
                alt=""
                width={118}
                height={129}
              />
            </div>
          )}

          {/* Error message */}
          {dropError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-error-50 p-3 ring-1 ring-inset ring-error-700/10">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-error-700" />
              <p className="text-sm text-error-700">{dropError}</p>
            </div>
          )}
        </div>

        {/* Upload area at bottom with dashed border */}
        {dropzoneEnabled && (
          <div
            {...getRootProps()}
            className={cn(
              "relative z-[1] flex items-center justify-center rounded-b-xl border border-t-0 border-dashed border-brand-800/25 pb-4 pt-4 transition-colors",
              isDragActive
                ? "border-brand-700 bg-brand-50"
                : "hover:border-brand-800/45 hover:bg-white/40",
              {
                "flex-1": variant === "page",
              },
              isUploading && "pointer-events-none opacity-60",
            )}
          >
            <input {...getInputProps()} />
            <div className="flex items-center gap-0.5 text-sm">
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Uploading...
                    {uploadProgress > 0 ? ` ${uploadProgress}%` : ""}
                  </span>
                </>
              ) : isDragActive ? (
                <span className="text-brand-800">Drop file to upload</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBrowseClick();
                    }}
                    className="rounded px-0.5 font-medium text-brand-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                  >
                    browse
                  </button>
                  <span className="text-muted-foreground">
                    or drag your files here
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteFileId}
        onOpenChange={(open) => !open && setDeleteFileId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={!!isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      {renameDoc && (
        <RenameDocumentDialog
          document={renameDoc}
          isRenaming={isRenaming === renameDoc.id}
          onOpenChange={(open) => {
            if (!open) {
              setRenameDoc(null);
            }
          }}
          onRename={handleRenameSubmit}
        />
      )}

      {/* Document preview dialog */}
      {previewDoc && (
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
