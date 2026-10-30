"use client";

import { useId, useRef, useState } from "react";

import { Building2, Pencil, Stamp } from "lucide-react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { putFetcher } from "@wildfires-org/turboplan-api-client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";
import type { LetterheadSelection } from "@wildfires-org/turboplan-workspace/types";

import { SaveLetterheadAsDefaultDialog } from "@/components/save-letterhead-as-default";
import { toast } from "@/components/toast";
import {
  documentLetterheadKey,
  useDocumentLetterhead,
} from "@/hooks/use-document-letterhead";
import { letterheadLogoKeysOf } from "@/hooks/use-letterhead-logo";
import { useSaveLetterheadAsDefault } from "@/hooks/use-save-letterhead-as-default";

const WRITTEN_TABLE_HINT =
  "This document has its own letterhead table. Choosing a letterhead only applies to documents without one.";

interface DocumentLetterheadPickerProps {
  projectId: string;
  documentId: string;
  // The document's content has an AI-written letterhead table (older docs).
  hasWrittenLetterheadTable: boolean;
  disabled?: boolean;
  // The viewer may change the selection (project UPDATE); without it the
  // menu still shows which letterhead is selected.
  canChangeSelection: boolean;
  // Opens the editor of the document's own copy; offered while the copy is
  // the saved selection.
  onEditLetterhead?: () => void;
}

// Header icon button with the per-document letterhead choice: the copy of the
// letterhead of the reference the document was drafted from (when it has
// one), the office/org default, one of the organization's library
// letterheads, or none — and, while the copy is selected, editing it and
// saving it as the organization's (or office's) letterhead.
export function DocumentLetterheadPicker({
  projectId,
  documentId,
  hasWrittenLetterheadTable,
  disabled = false,
  canChangeSelection,
  onEditLetterhead,
}: DocumentLetterheadPickerProps) {
  const data = useDocumentLetterhead(projectId, documentId);
  const { mutate } = useSWRConfig();
  const { trigger, isMutating } = useSWRMutation(
    `/api/documents/${documentId}/letterhead`,
    putFetcher<{ selection: LetterheadSelection }>,
  );
  // Shown while the PUT is in flight so the trigger doesn't snap back.
  const [pendingSelection, setPendingSelection] =
    useState<LetterheadSelection | null>(null);
  const hintId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isSaveAsDefaultOpen, setIsSaveAsDefaultOpen] = useState(false);

  const options = data?.options ?? [];
  const own = data?.own ?? null;
  const savedSelection = data?.selection ?? "default";
  // A deleted library letterhead resolves to the default on the server.
  const isKnownSelection =
    savedSelection === "default" ||
    savedSelection === "none" ||
    (savedSelection === "own" && own !== null) ||
    options.some((option) => option.id === savedSelection);
  const value =
    pendingSelection ?? (isKnownSelection ? savedSelection : "default");
  const isOwnSelected = savedSelection === "own" && own !== null;
  const canEditOwn = !!onEditLetterhead && isOwnSelected;
  // Offered for the copy the document shows, to a user who may change the
  // organization's or the office's letterhead (the copy is saved as stored).
  const saveAsDefault = useSaveLetterheadAsDefault({
    projectId,
    documentId,
    enabled: isOwnSelected,
  });
  const saveAsDefaultCopy = isOwnSelected ? saveAsDefault.copy : null;

  const defaultName = data?.defaultLetterhead?.nameLines[0];
  const defaultLabel = data?.defaultLetterhead
    ? `Default — ${defaultName ?? "office letterhead"}`
    : "Default (AI-written)";

  const handleChange = async (selection: LetterheadSelection) => {
    if (!canChangeSelection || selection === value) {
      return;
    }
    setPendingSelection(selection);
    try {
      await trigger({ projectId, selection });
      await Promise.all([
        mutate(documentLetterheadKey(projectId, documentId)),
        mutate(letterheadLogoKeysOf(projectId, documentId)),
      ]);
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to change letterhead",
      });
    } finally {
      setPendingSelection(null);
    }
  };

  const handleSaveAsDefault = async () => {
    if (await saveAsDefault.save()) {
      setIsSaveAsDefaultOpen(false);
    }
  };

  // The confirmation opens from a menu item, which is gone by then: focus
  // goes back to the menu's trigger.
  const handleSaveAsDefaultCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            className="h-fit p-2 dark:hover:bg-zinc-700"
            aria-label="Document letterhead"
            title="Letterhead"
            disabled={disabled || !data || isMutating}
          >
            <Stamp size={18} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-72 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuLabel>Letterhead</DropdownMenuLabel>
          {hasWrittenLetterheadTable && (
            <p
              id={hintId}
              className="px-2 pb-1.5 text-xs text-muted-foreground"
            >
              {WRITTEN_TABLE_HINT}
            </p>
          )}
          <DropdownMenuRadioGroup
            aria-describedby={hasWrittenLetterheadTable ? hintId : undefined}
            value={value}
            onValueChange={(selection) => void handleChange(selection)}
          >
            {own && (
              <DropdownMenuRadioItem
                value="own"
                title={own.referenceFilename}
                disabled={!canChangeSelection}
              >
                <span className="min-w-0 truncate">
                  From {own.referenceFilename}
                </span>
              </DropdownMenuRadioItem>
            )}
            <DropdownMenuRadioItem
              value="default"
              disabled={!canChangeSelection}
            >
              {defaultLabel}
            </DropdownMenuRadioItem>
            {options.length > 0 && <DropdownMenuSeparator />}
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                disabled={!canChangeSelection}
              >
                {option.name}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="none" disabled={!canChangeSelection}>
              None
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {(canEditOwn || saveAsDefaultCopy) && <DropdownMenuSeparator />}
          {canEditOwn && (
            <DropdownMenuItem
              onSelect={onEditLetterhead}
              disabled={pendingSelection !== null}
            >
              <Pencil aria-hidden className="mr-2 size-4" />
              Edit letterhead…
            </DropdownMenuItem>
          )}
          {saveAsDefaultCopy && (
            <DropdownMenuItem
              onSelect={() => setIsSaveAsDefaultOpen(true)}
              disabled={pendingSelection !== null}
            >
              <Building2 aria-hidden className="mr-2 size-4" />
              {saveAsDefaultCopy.actionLabel}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {saveAsDefaultCopy && (
        <SaveLetterheadAsDefaultDialog
          open={isSaveAsDefaultOpen}
          onOpenChange={setIsSaveAsDefaultOpen}
          copy={saveAsDefaultCopy}
          isSaving={saveAsDefault.isSaving}
          onConfirm={() => void handleSaveAsDefault()}
          onCloseAutoFocus={handleSaveAsDefaultCloseAutoFocus}
        />
      )}
    </>
  );
}
