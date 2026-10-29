"use client";

import { useEffect, useRef, useState } from "react";

import { AnimatePresence, MotionConfig } from "framer-motion";
import { toast } from "sonner";

import { RenameDocumentDialog } from "@wildfires-org/turboplan-documents/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@wildfires-org/turboplan-utils";
import { ORGANIZATION_DOCUMENTS_MAX } from "@wildfires-org/turboplan-workspace/types";

import { useOrganizationDocuments } from "@/hooks/use-organization-documents";
import {
  DESTRUCTIVE_BUTTON_CLASS,
  EMPTY_STATE_TEXT_CLASS,
  EMPTY_STATE_TITLE_CLASS,
  SKELETON_BAR_CLASS,
} from "@/lib/glass";
import { getProcessingAnnouncement } from "@/lib/organization-context";
import { cn } from "@/lib/utils";
import type { OrganizationDocument } from "@/types/organization-context";
import { OrganizationDocumentRow } from "./organization-document-row";

interface OrganizationDocumentListProps {
  organizationId: string;
  /** Owner or editor: pin, rename and delete */
  canEdit: boolean;
}

type ExtractionStatuses = ReadonlyMap<
  string,
  OrganizationDocument["extractionStatus"]
>;

const getErrorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * The organization's reference documents, key documents first then newest
 * (the order the AI reads them in). Polls while any document is processing.
 */
export const OrganizationDocumentList = ({
  organizationId,
  canEdit,
}: OrganizationDocumentListProps) => {
  const {
    documents,
    isLoading,
    hasError,
    pendingSince,
    setPinned,
    renameDocument,
    deleteDocument,
  } = useOrganizationDocuments({ organizationId, pollPendingExtraction: true });

  const [renameTarget, setRenameTarget] = useState<OrganizationDocument | null>(
    null,
  );
  const [isRenaming, setIsRenaming] = useState(false);
  // Kept after closing so the dialog does not go blank while it animates out.
  const [deleteTarget, setDeleteTarget] = useState<OrganizationDocument | null>(
    null,
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const hasDeletedRef = useRef(false);

  // Announce documents that finish processing; the rows themselves are not a
  // live region (re-sorting them would re-read the whole list).
  const [announcement, setAnnouncement] = useState("");
  const previousStatusesRef = useRef<ExtractionStatuses | null>(null);
  useEffect(() => {
    if (isLoading) {
      return;
    }
    const message = getProcessingAnnouncement(
      previousStatusesRef.current,
      documents,
    );
    previousStatusesRef.current = new Map(
      documents.map((document) => [document.id, document.extractionStatus]),
    );
    if (message) {
      setAnnouncement(message);
    }
  }, [documents, isLoading]);

  const handleTogglePin = async (document: OrganizationDocument) => {
    const isPinned = !document.isPinned;
    try {
      await setPinned(document.id, isPinned);
    } catch (error) {
      toast.error(
        getErrorText(
          error,
          isPinned
            ? "Could not mark the key document"
            : "Could not unmark the key document",
        ),
      );
    }
  };

  const handleRename = async (documentId: string, newName: string) => {
    setIsRenaming(true);
    try {
      await renameDocument(documentId, newName);
      setRenameTarget(null);
    } catch (error) {
      toast.error(getErrorText(error, "Could not rename the document"));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteRequest = (document: OrganizationDocument) => {
    setDeleteTarget(document);
    setIsDeleteOpen(true);
  };

  // Optimistic: the row goes at once and comes back if the delete fails.
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }
    const document = deleteTarget;
    hasDeletedRef.current = true;
    setIsDeleteOpen(false);
    try {
      await deleteDocument(document.id);
      toast.success(`Deleted ${document.originalFilename}`);
    } catch (error) {
      toast.error(getErrorText(error, "Could not delete the document"));
    }
  };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading documents" className="space-y-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl border border-white/90 bg-white/50 px-3 py-3 dark:border-white/10 dark:bg-slate-900/40"
          >
            <span className={cn(SKELETON_BAR_CLASS, "size-8 rounded-lg")} />
            <div className="flex-1 space-y-2">
              <span className={cn(SKELETON_BAR_CLASS, "block h-4 w-1/2")} />
              <span className={cn(SKELETON_BAR_CLASS, "block h-3 w-1/3")} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <p className="text-[13px] leading-5 text-error-700">
        Could not load the documents. Reload the page to try again.
      </p>
    );
  }

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div ref={listRef} tabIndex={-1} className="outline-none">
        {documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-900/10 px-4 py-8 text-center dark:border-white/10">
            <p className={EMPTY_STATE_TITLE_CLASS}>No documents yet</p>
            <p className={cn(EMPTY_STATE_TEXT_CLASS, "mx-auto mt-1 max-w-md")}>
              {canEdit
                ? "Add policies, standards, templates or past work the AI should know about."
                : "No one has added documents for this organization yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs leading-5 text-gray-550">
              {documents.length} of {ORGANIZATION_DOCUMENTS_MAX} documents. Key
              documents are always included for the AI first.
            </p>
            <MotionConfig reducedMotion="user">
              <ul aria-label="Organization documents" className="space-y-2">
                <AnimatePresence initial={false}>
                  {documents.map((document) => (
                    <OrganizationDocumentRow
                      key={document.id}
                      document={document}
                      canEdit={canEdit}
                      pendingSince={pendingSince.get(document.id)}
                      onTogglePin={handleTogglePin}
                      onRename={setRenameTarget}
                      onDelete={handleDeleteRequest}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </MotionConfig>
          </div>
        )}
      </div>

      {renameTarget && (
        <RenameDocumentDialog
          document={renameTarget}
          isRenaming={isRenaming}
          onOpenChange={(open) => {
            if (!open) {
              setRenameTarget(null);
            }
          }}
          onRename={handleRename}
        />
      )}

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            // The deleted row's menu button is gone: land on the list instead.
            if (hasDeletedRef.current) {
              hasDeletedRef.current = false;
              event.preventDefault();
              listRef.current?.focus();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.originalFilename}&rdquo;? The AI will
              stop using it in chats and research. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <Button variant="glass" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className={DESTRUCTIVE_BUTTON_CLASS}
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
