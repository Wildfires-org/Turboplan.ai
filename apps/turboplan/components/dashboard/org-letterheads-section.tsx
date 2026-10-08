"use client";

import { useState } from "react";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { deleteFetcher } from "@wildfires-org/turboplan-api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
} from "@wildfires-org/turboplan-utils";
import {
  type LibraryLetterhead,
  MAX_LIBRARY_LETTERHEADS,
  parseLetterheadLines,
} from "@wildfires-org/turboplan-workspace/types";

import { LetterheadBand } from "@/components/letterhead-band";
import { toast } from "@/components/toast";
import {
  organizationLetterheadsKey,
  useOrganizationLetterheads,
} from "@/hooks/use-organization-letterheads";
import { LibraryLetterheadDialog } from "./library-letterhead-dialog";

type EditorState = { letterhead?: LibraryLetterhead } | null;

interface OrgLetterheadsSectionProps {
  organizationId: string;
  canEdit: boolean;
}

// The organization's library of extra letterheads (partner or client agency),
// which documents can pick instead of the office/org default.
export function OrgLetterheadsSection({
  organizationId,
  canEdit,
}: OrgLetterheadsSectionProps) {
  const { letterheads, error, isLoading, mutate } =
    useOrganizationLetterheads(organizationId);
  const [editor, setEditor] = useState<EditorState>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryLetterhead | null>(
    null,
  );
  const { trigger: deleteLetterhead, isMutating: isDeleting } = useSWRMutation(
    organizationLetterheadsKey(organizationId),
    deleteFetcher<{ success: true }>,
  );
  const isAtLimit = letterheads.length >= MAX_LIBRARY_LETTERHEADS;

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    try {
      await deleteLetterhead(pendingDelete.id);
      await mutate();
      toast({ type: "success", description: "Letterhead deleted." });
      setPendingDelete(null);
    } catch (deleteError) {
      toast({
        type: "error",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete letterhead",
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-medium">Letterheads</h3>
          <p className="text-xs text-gray-550">
            Extra letterheads (e.g. a partner or client agency) that documents
            can use instead of the default.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={() => setEditor({})}
            disabled={isLoading || isAtLimit}
            title={
              isAtLimit
                ? `You can keep up to ${MAX_LIBRARY_LETTERHEADS} letterheads.`
                : undefined
            }
          >
            <Plus aria-hidden className="size-4" />
            Add letterhead
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8 text-gray-550">
          <Loader2
            aria-label="Loading letterheads"
            className="size-5 animate-spin"
          />
        </div>
      ) : error ? (
        <p className="rounded-2xl bg-brandAlt-100/80 p-4 text-sm text-error-700 dark:bg-white/5">
          Couldn&apos;t load letterheads.
        </p>
      ) : letterheads.length === 0 ? (
        <p className="rounded-2xl bg-brandAlt-100/80 p-6 text-center text-sm text-gray-550 ring-1 ring-inset ring-brandAlt-200/70 dark:bg-white/5 dark:ring-white/10">
          No extra letterheads yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {letterheads.map((letterhead) => (
            <li
              key={letterhead.id}
              className="flex items-center gap-3 rounded-2xl bg-brandAlt-100/80 p-2 pr-3 ring-1 ring-inset ring-brandAlt-200/70 dark:bg-white/5 dark:ring-white/10"
            >
              <LetterheadThumbnail letterhead={letterhead} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {letterhead.name}
              </p>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-xl"
                    aria-label={`Edit ${letterhead.name}`}
                    onClick={() => setEditor({ letterhead })}
                  >
                    <Pencil aria-hidden className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-xl text-gray-550 hover:text-error-700"
                    aria-label={`Delete ${letterhead.name}`}
                    onClick={() => setPendingDelete(letterhead)}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <LibraryLetterheadDialog
          organizationId={organizationId}
          letterhead={editor.letterhead}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditor(null);
            }
          }}
          onSaved={() => void mutate()}
        />
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete letterhead?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; will be removed. Documents
              that use it fall back to the default letterhead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog open until the delete settles.
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// A sheet-of-paper thumbnail: the band at full size, scaled to half and
// clipped to its top, so it matches the real letterhead's proportions.
const LetterheadThumbnail = ({
  letterhead,
}: {
  letterhead: LibraryLetterhead;
}) => {
  const hasMarginLogo = letterhead.layout === "columns" && !!letterhead.logoUrl;

  return (
    <div
      aria-hidden
      className="pointer-events-none h-12 w-28 shrink-0 overflow-hidden rounded-lg bg-white text-zinc-900 ring-1 ring-black/5 sm:w-44 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div
        className={cn(
          "w-[200%] origin-top-left scale-50 p-3",
          hasMarginLogo && "md:pl-16",
        )}
      >
        <LetterheadBand
          letterhead={{
            layout: letterhead.layout,
            nameLines: parseLetterheadLines(letterhead.lines),
            contactLines: parseLetterheadLines(letterhead.contact),
            color: letterhead.color,
          }}
          logoSrc={letterhead.logoUrl}
          className="mb-0"
        />
      </div>
    </div>
  );
};
