"use client";

import { useState } from "react";

import { Stamp } from "lucide-react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { putFetcher } from "@wildfires-org/turboplan-api-client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";
import type { LetterheadSelection } from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import {
  documentLetterheadKey,
  useDocumentLetterhead,
} from "@/hooks/use-document-letterhead";
import { letterheadLogoKey } from "@/hooks/use-letterhead-logo";

const OWN_TABLE_HINT =
  "This document has its own letterhead table. Choosing a letterhead only applies to documents without one.";

interface DocumentLetterheadPickerProps {
  projectId: string;
  documentId: string;
  // The document has an AI-written letterhead table of its own (older docs).
  hasOwnLetterheadTable: boolean;
  disabled?: boolean;
}

// Header icon button with the per-document letterhead choice: the office/org default, one of the
// organization's library letterheads, or none.
export function DocumentLetterheadPicker({
  projectId,
  documentId,
  hasOwnLetterheadTable,
  disabled = false,
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

  const options = data?.options ?? [];
  const savedSelection = data?.selection ?? "default";
  // A deleted library letterhead resolves to the default on the server.
  const isKnownSelection =
    savedSelection === "default" ||
    savedSelection === "none" ||
    options.some((option) => option.id === savedSelection);
  const value =
    pendingSelection ?? (isKnownSelection ? savedSelection : "default");

  const defaultName = data?.defaultLetterhead?.nameLines[0];
  const defaultLabel = data?.defaultLetterhead
    ? `Default — ${defaultName ?? "office letterhead"}`
    : "Default (AI-written)";

  const handleChange = async (selection: LetterheadSelection) => {
    if (selection === value) {
      return;
    }
    setPendingSelection(selection);
    try {
      await trigger({ projectId, selection });
      await Promise.all([
        mutate(documentLetterheadKey(projectId, documentId)),
        mutate(letterheadLogoKey(projectId, documentId)),
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
        {hasOwnLetterheadTable && (
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">
            {OWN_TABLE_HINT}
          </p>
        )}
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(selection) => void handleChange(selection)}
        >
          <DropdownMenuRadioItem value="default">
            {defaultLabel}
          </DropdownMenuRadioItem>
          {options.length > 0 && <DropdownMenuSeparator />}
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.name}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
