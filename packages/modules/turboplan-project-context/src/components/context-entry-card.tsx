"use client";

import { useEffect, useRef, useState } from "react";

import { format } from "date-fns";
import {
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Trash2,
  User,
} from "lucide-react";

import {
  AlertDialog,
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
} from "@wildfires-org/turboplan-utils";

import type { ContextEntryWithCreator } from "../types";

interface ContextEntryCardProps {
  entry: ContextEntryWithCreator;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  isLast: boolean;
  readOnly: boolean;
}

export function ContextEntryCard({
  entry,
  onEdit,
  onDelete,
  isLast,
  readOnly,
}: ContextEntryCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  // Detect whether the (collapsed) content overflows 3 lines so the "Show more"
  // toggle only renders when there's actually more to reveal.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || isExpanded) {
      return;
    }
    setIsClamped(el.scrollHeight > el.clientHeight);
  }, [entry.content, isExpanded]);

  const creatorName = [entry.creatorFirstName, entry.creatorLastName]
    .filter(Boolean)
    .join(" ");
  const creatorInitials = [
    entry.creatorFirstName?.[0],
    entry.creatorLastName?.[0],
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase();
  const formattedDate = format(new Date(entry.createdAt), "MMMM d, yyyy");

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setIsDeleteDialogOpen(false);
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
          <span className="text-xs leading-4 text-gray-600">
            {formattedDate}
          </span>

          {creatorName && (
            <>
              <span className="size-0.5 rounded-full bg-gray-500" />
              <div className="flex items-center gap-2">
                <div className="flex items-center py-0.5">
                  {entry.creatorAvatarUrl ? (
                    <img
                      src={entry.creatorAvatarUrl}
                      alt={creatorName}
                      className="size-6 rounded-full object-cover"
                    />
                  ) : creatorInitials ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-brand-800 text-[10px] font-medium text-white ring-2 ring-white">
                      {creatorInitials}
                    </span>
                  ) : (
                    <div className="flex size-4 items-center overflow-hidden rounded-full bg-gray-300">
                      <User className="size-4 text-gray-500" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium leading-4 text-foreground">
                  {creatorName}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Line + card */}
      <div className="flex gap-4">
        <div className="flex w-6 shrink-0 items-center justify-center overflow-hidden rounded-full px-[11px]">
          <div
            className={cn("h-full w-px bg-brand-800/15", isLast && "opacity-0")}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col pb-6 pt-2">
          <div className="rounded-2xl border border-white/90 bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-18px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900/60">
            <div className="flex items-start gap-4">
              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-5 text-gray-900">
                    {entry.label}
                  </p>
                  <p
                    ref={contentRef}
                    className={cn(
                      "whitespace-pre-line break-words text-sm leading-5 text-gray-600",
                      !isExpanded && "line-clamp-3",
                    )}
                  >
                    {entry.content}
                  </p>
                  {isClamped && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded((v) => !v)}
                      className="w-fit text-xs font-medium text-brand-800 transition-colors hover:text-brand-900"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>

                {/* URL chip */}
                {entry.url && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-white/85 bg-white/55 px-2.5 py-1 text-xs leading-5 text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] transition-colors hover:bg-white/90"
                    >
                      <Paperclip className="size-5 shrink-0" />
                      <span className="truncate max-w-[240px]">
                        {new URL(entry.url).hostname}
                      </span>
                    </a>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!readOnly && (
                <div className="flex shrink-0 items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Entry actions"
                        className="flex size-7 items-center justify-center rounded-lg text-gray-600 hover:bg-brandAlt-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 data-[state=open]:bg-brandAlt-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={onEdit}>
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setIsDeleteDialogOpen(true)}
                        className="text-error-700 focus:text-error-700"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
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
            <AlertDialogTitle>Delete Context Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{entry.label}&rdquo;? This
              action cannot be undone.
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
    </div>
  );
}
