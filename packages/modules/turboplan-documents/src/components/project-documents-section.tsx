"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  Download,
  FileText,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { DocumentsUploadEmptyState } from "./documents-empty-state";
import { DocumentPreviewDialog } from "./preview/document-preview-dialog";
import { RenameDocumentDialog } from "./rename-document-dialog";
import { formatDateTime, getDisplaySource, getFileTypeLabel } from "./utils";

interface DocumentRowData {
  id: string;
  originalFilename: string;
  mimeType: string;
  url: string;
  createdAt: string;
}

/**
 * Build the "PDF · source" subtitle. Shows the external host for hosted docs,
 * falling back to the upload date for docs stored in our own blob storage.
 */
const getDocumentSubtitle = (document: DocumentRowData): string => {
  const type = getFileTypeLabel(document.mimeType);
  const source =
    getDisplaySource(document.url) ?? formatDateTime(document.createdAt);
  return `${type} · ${source}`;
};

interface DocumentRowContentProps {
  document: DocumentRowData;
}

const DocumentRowContent = ({ document }: DocumentRowContentProps) => {
  return (
    <>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EBF5FF]">
        <FileText className="size-[15px] text-[#1489FF]" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[13px] font-medium leading-[19.5px] text-foreground">
          {document.originalFilename}
        </p>
        <p className="truncate text-[11px] leading-4 text-muted-foreground">
          {getDocumentSubtitle(document)}
        </p>
      </div>
    </>
  );
};

const SKELETON_BAR_CLASS =
  "rounded-md bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none dark:bg-slate-800/70";

/** Three placeholder rows at DocumentRow's metrics (px-3 py-2, 32px tile,
 * 19.5px + 16px text lines). */
const DocumentRowsSkeleton = () => (
  <div role="status" aria-label="Loading documents" className="flex flex-col">
    {["w-[56%]", "w-[44%]", "w-[64%]"].map((widthClass) => (
      <div key={widthClass} className="flex items-center gap-2.5 px-3 py-2">
        <span
          className={cn(SKELETON_BAR_CLASS, "size-8 shrink-0 rounded-[10px]")}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex h-[19.5px] items-center">
            <span className={cn(SKELETON_BAR_CLASS, "h-3", widthClass)} />
          </span>
          <span className="flex h-4 items-center">
            <span className={cn(SKELETON_BAR_CLASS, "h-2.5 w-24")} />
          </span>
        </div>
      </div>
    ))}
  </div>
);

interface DocumentRowProps {
  document: DocumentRowData;
  actions?: ReactNode;
  onClick?: () => void;
}

const DocumentRow = ({ document, actions, onClick }: DocumentRowProps) => {
  return (
    <div
      className={cn(
        "group/row flex items-center gap-2.5 rounded-[10px] px-3 py-2",
        onClick &&
          "cursor-pointer transition-colors hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 dark:hover:bg-white/5",
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <DocumentRowContent document={document} />
      {actions && (
        <div className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
};

interface DocumentRowWithActionsProps {
  document: ProjectDocument;
  readOnly: boolean;
  isDeleting: string | null;
  canModify: boolean;
  onPreview: (doc: ProjectDocument) => void;
  onDelete: (id: string) => void;
  onRename: (doc: ProjectDocument) => void;
}

const DocumentRowWithActions = ({
  document,
  readOnly,
  isDeleting,
  canModify,
  onPreview,
  onDelete,
  onRename,
}: DocumentRowWithActionsProps) => (
  <DocumentRow
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

interface DocumentRowListProps {
  documents: ProjectDocument[];
  readOnly: boolean;
  isDeleting: string | null;
  canModifyDocument: (doc: ProjectDocument) => boolean;
  onPreview: (doc: ProjectDocument) => void;
  onDelete: (id: string) => void;
  onRename: (doc: ProjectDocument) => void;
}

const DocumentRowList = ({
  documents,
  readOnly,
  isDeleting,
  canModifyDocument,
  onPreview,
  onDelete,
  onRename,
}: DocumentRowListProps) => (
  <div className="flex flex-col">
    {documents.map((document) => (
      <DocumentRowWithActions
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
  </div>
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

interface DocumentRowsGridProps {
  documents: ProjectDocument[];
  readOnly: boolean;
  isDeleting: string | null;
  canModifyDocument: (doc: ProjectDocument) => boolean;
  onPreview: (doc: ProjectDocument) => void;
  onDelete: (id: string) => void;
  onRename: (doc: ProjectDocument) => void;
}

const DocumentRowsGrid = ({
  documents,
  readOnly,
  isDeleting,
  canModifyDocument,
  onPreview,
  onDelete,
  onRename,
}: DocumentRowsGridProps) => {
  const { folders, ungrouped } = useMemo(
    () => groupDocumentsByFolder(documents),
    [documents],
  );
  const hasFolders = folders.length > 0;

  if (!hasFolders) {
    return (
      <DocumentRowList
        documents={documents}
        readOnly={readOnly}
        isDeleting={isDeleting}
        canModifyDocument={canModifyDocument}
        onPreview={onPreview}
        onDelete={onDelete}
        onRename={onRename}
      />
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
          <DocumentRowList
            documents={folder.docs}
            readOnly={readOnly}
            isDeleting={isDeleting}
            canModifyDocument={canModifyDocument}
            onPreview={onPreview}
            onDelete={onDelete}
            onRename={onRename}
          />
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
          <DocumentRowList
            documents={ungrouped}
            readOnly={readOnly}
            isDeleting={isDeleting}
            canModifyDocument={canModifyDocument}
            onPreview={onPreview}
            onDelete={onDelete}
            onRename={onRename}
          />
        </div>
      )}
    </div>
  );
};

export interface ProjectDocumentsSectionProps {
  projectId: string;
  userId?: string;
  /** Only show documents of this origin (e.g. "upload" on the project page) */
  source?: ProjectDocumentSource;
  /** When true, hides edit controls */
  readOnly?: boolean;
  className?: string;
  /** Whether the research phase is completed */
  isResearchPhaseCompleted?: boolean;
  /** Callback when a suggestion pill is clicked */
  onSuggestionClick?: (content: string) => void;
}

/**
 * Documents section for the project page section card.
 *
 * Renders compact document rows, the suggestion-pill empty state, and the
 * delete/preview dialogs. Upload is driven solely by the header "+ Add" action
 * in the wrapper, so this component has no internal upload dropzone.
 */
export function ProjectDocumentsSection({
  projectId,
  userId,
  source,
  readOnly = false,
  className,
  isResearchPhaseCompleted,
  onSuggestionClick,
}: ProjectDocumentsSectionProps) {
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<ProjectDocument | null>(null);
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

  // Use the project documents hook (SWR dedupes with the wrapper's call)
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

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteFileId) {
      return;
    }

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

  return (
    <>
      <div className={cn("flex flex-col pb-1.5", className)}>
        <div className="group relative overflow-hidden rounded-lg">
          {/* Loading state */}
          {isLoading && <DocumentRowsSkeleton />}

          {/* Empty state */}
          {!isLoading && documents.length === 0 && (
            <>
              {onSuggestionClick && !readOnly ? (
                <div className="flex flex-col items-center gap-5 py-8 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <h3 className="text-lg font-medium text-foreground">
                      No documents yet
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm leading-5">
                      Drag and drop files here, connect your cloud storage, or
                      ask the Agent to draft the initial project documentation
                      for you.
                    </p>
                  </div>
                  <SuggestionPills
                    suggestions={
                      isResearchPhaseCompleted
                        ? suggestions
                        : placeholderSuggestions
                    }
                    isLoading={isResearchPhaseCompleted && isSuggestionsLoading}
                    disabled={!isResearchPhaseCompleted}
                    onSuggestionClick={onSuggestionClick}
                  />
                </div>
              ) : (
                <DocumentsUploadEmptyState
                  isDragActive={false}
                  canUpload={canEdit && !readOnly}
                />
              )}
            </>
          )}

          {/* Document rows */}
          {!isLoading && documents.length > 0 && (
            <DocumentRowsGrid
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
          {!isLoading && documents.length === 0 && (
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
        </div>
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
            if (!open) {
              setPreviewDoc(null);
            }
          }}
        />
      )}
    </>
  );
}
