"use client";

import { type ReactNode, useId, useState } from "react";

import { Building2, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  cn,
} from "@wildfires-org/turboplan-utils";

import { useSaveLetterheadAsDefault } from "@/hooks/use-save-letterhead-as-default";
import type { SaveAsDefaultLetterheadCopy } from "@/lib/default-letterhead-grid";

interface SaveLetterheadAsDefaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: SaveAsDefaultLetterheadCopy;
  isSaving: boolean;
  onConfirm: () => void;
  // The button that opens it (focus returns there); without one, say where
  // focus goes on close with `onCloseAutoFocus`.
  trigger?: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
}

interface SaveAsDefaultLetterheadButtonProps {
  projectId: string;
  documentId: string;
  // The editor has unsaved changes: the action saves the stored copy, so it
  // waits for them to be saved.
  isDirty: boolean;
  disabled?: boolean;
}

// Asks before a document's copy becomes the organization's (or office's)
// letterhead, naming which one it replaces. Stays open while saving; Escape
// never reaches the artifact panel behind it.
export function SaveLetterheadAsDefaultDialog({
  open,
  onOpenChange,
  copy,
  isSaving,
  onConfirm,
  trigger,
  onCloseAutoFocus,
}: SaveLetterheadAsDefaultDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSaving) {
          return;
        }
        onOpenChange(next);
      }}
    >
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Kept open until the save settles.
              event.preventDefault();
              onConfirm();
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              copy.confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// "Save as organization (or office) letterhead…" in the letterhead editor of
// a document's copy. Hidden when the user may change neither default; while
// the editor has unsaved changes it does nothing and says why — still
// focusable (`aria-disabled`), so the hint is announced, and the hint's line
// is kept when it is not shown, so the footer does not move.
export function SaveAsDefaultLetterheadButton({
  projectId,
  documentId,
  isDirty,
  disabled = false,
}: SaveAsDefaultLetterheadButtonProps) {
  const { copy, isSaving, save } = useSaveLetterheadAsDefault({
    projectId,
    documentId,
    enabled: true,
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const hintId = useId();

  if (!copy) {
    return null;
  }

  const handleConfirm = async () => {
    if (await save()) {
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <SaveLetterheadAsDefaultDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        copy={copy}
        isSaving={isSaving}
        onConfirm={() => void handleConfirm()}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-lg aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-current"
            disabled={disabled || isSaving}
            aria-disabled={isDirty || undefined}
            aria-describedby={isDirty ? hintId : undefined}
            onClick={(event) => {
              // Runs before the dialog trigger's own handler, which then
              // leaves the dialog closed.
              if (isDirty) {
                event.preventDefault();
              }
            }}
          >
            <Building2 aria-hidden />
            {copy.actionLabel}
          </Button>
        }
      />
      <span
        id={hintId}
        className={cn("text-xs text-gray-550", !isDirty && "invisible")}
      >
        Save your changes first.
      </span>
    </div>
  );
}
