"use client";

import { useState } from "react";

import {
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Trash2,
  User,
} from "lucide-react";

import { DocumentPreviewDialog } from "@wildfires-org/turboplan-documents/client";
import type { TimelineDisplayEntry } from "@wildfires-org/turboplan-timeline-records/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { toast } from "@/components/toast";

interface TimelineEntryProps {
  entry: TimelineDisplayEntry;
  isLast?: boolean;
  readOnly?: boolean;
  onDelete?: (id: string) => Promise<void>;
  onToggleVisibility?: (id: string) => Promise<void>;
}

export function TimelineEntry({
  entry,
  isLast = false,
  readOnly = false,
  onDelete,
  onToggleVisibility,
}: TimelineEntryProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [previewDocIndex, setPreviewDocIndex] = useState<number | null>(null);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
      toast({ type: "success", description: "Timeline entry deleted" });
      setIsDeleteDialogOpen(false);
    } catch {
      toast({
        type: "error",
        description: "Failed to delete timeline entry",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Row 1: Circle + meta info */}
      <div className="flex items-center gap-4">
        <div className="size-6 shrink-0 rounded-full border-[5px] border-white bg-brand-800 shadow-[0_2px_6px_-2px_rgba(15,23,42,0.3)]" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs leading-4 text-gray-550">
            {entry.dateRange}
          </span>
          <span aria-hidden className="size-0.5 rounded-full bg-gray-550" />
          <div className="flex items-center gap-2">
            <div className="flex items-center py-0.5">
              {entry.authorAvatarUrl ? (
                <img
                  src={entry.authorAvatarUrl}
                  alt={entry.authorName}
                  className="size-6 rounded-full bg-white object-cover shadow-sm ring-2 ring-white"
                />
              ) : entry.authorInitials ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-800 text-[10px] font-medium text-white shadow-sm ring-2 ring-white">
                  {entry.authorInitials}
                </span>
              ) : (
                <div className="flex size-4 items-center overflow-hidden rounded-full bg-brand-800 shadow-sm ring-1 ring-white">
                  <User className="size-4 text-white" />
                </div>
              )}
            </div>
            <span className="text-xs font-medium leading-4 text-foreground">
              {entry.authorName}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Line + card */}
      <div className="flex gap-4">
        <div className="flex w-6 shrink-0 items-center justify-center overflow-hidden rounded-full px-[11px]">
          <div
            className={`h-full w-px bg-brand-800/15 ${isLast ? "opacity-0" : ""}`}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col pb-6 pt-2">
          <div
            data-testid="timeline-entry"
            className="rounded-2xl border border-white/90 bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-18px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900/60"
          >
            <div className="flex items-start gap-4">
              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="break-words text-sm font-medium leading-5 text-gray-900">
                    {entry.title}
                  </p>
                  {entry.description && (
                    <p className="whitespace-pre-line break-words text-sm leading-5 text-gray-550">
                      {entry.description}
                    </p>
                  )}
                </div>

                {/* Document chips */}
                {entry.documents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {entry.documents.map((doc, idx) => (
                      <div
                        key={`${doc.filename}-${idx}`}
                        className="glass flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs leading-5 text-foreground transition-colors hover:bg-white/90"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewDocIndex(idx)}
                          className="flex items-center gap-2 rounded px-1 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                        >
                          <Paperclip className="size-5 shrink-0" />
                          {doc.filename}
                        </button>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1 text-gray-550 hover:bg-brandAlt-100 hover:text-foreground"
                          aria-label={`Open ${doc.filename} in new tab`}
                          title="Open in new tab"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {!readOnly && onToggleVisibility && (
                  <button
                    type="button"
                    className="press flex size-7 items-center justify-center rounded-lg text-gray-550 hover:bg-brandAlt-100 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50"
                    disabled={isTogglingVisibility}
                    onClick={async () => {
                      setIsTogglingVisibility(true);
                      try {
                        await onToggleVisibility(entry.id);
                      } finally {
                        setIsTogglingVisibility(false);
                      }
                    }}
                    aria-label={entry.isPublic ? "Make private" : "Make public"}
                    title={entry.isPublic ? "Make private" : "Make public"}
                  >
                    {entry.isPublic ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>
                )}

                {!readOnly && onDelete && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Entry actions"
                        className="press flex size-7 items-center justify-center rounded-lg text-gray-550 hover:bg-brandAlt-100 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 data-[state=open]:bg-brandAlt-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setIsDeleteDialogOpen(true)}
                        className="text-error-700 focus:text-error-700"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timeline Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this timeline entry? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {previewDocIndex !== null && entry.documents[previewDocIndex] && (
        <DocumentPreviewDialog
          id={`${entry.id}-${previewDocIndex}`}
          filename={entry.documents[previewDocIndex].filename}
          url={entry.documents[previewDocIndex].url}
          open={previewDocIndex !== null}
          onOpenChange={(open) => {
            if (!open) setPreviewDocIndex(null);
          }}
        />
      )}
    </div>
  );
}
