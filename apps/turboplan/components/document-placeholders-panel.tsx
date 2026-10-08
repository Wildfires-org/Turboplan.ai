"use client";

import { useEffect, useMemo, useState } from "react";

import { Check, Loader2 } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import { Button, Checkbox, Input, Label } from "@wildfires-org/turboplan-utils";
import type { DocumentProfile } from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  collectPlaceholders,
  fillPlaceholders,
  type OpenPlaceholder,
} from "@/lib/placeholder-fill";

interface DocumentPlaceholdersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  projectId?: string;
  // The artifact's save callback; the editor re-syncs from the saved content.
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}

type RememberFactBody = { projectId: string; label: string; value: string };

// A save normally round-trips in well under a second; after this the panel stops
// waiting for the saved content and unlocks the Apply buttons again.
const SAVE_WAIT_MS = 8000;

const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

// Right-side sheet listing the document's unique open placeholders. Applying a
// value replaces every occurrence of that exact token and saves a new version.
export function DocumentPlaceholdersPanel({
  open,
  onOpenChange,
  content,
  projectId,
  onSaveContent,
}: DocumentPlaceholdersPanelProps) {
  // Typed values by token; untouched inputs fall back to the suggested value.
  const [values, setValues] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState<Record<string, boolean>>({});
  // The content just handed to onSaveContent, until the artifact's content
  // catches up. Further fills build on it so two quick applies don't race.
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  const { trigger: rememberFact } = useSWRMutation(
    "/api/documents/remember-fact",
    postFetcher<{ documentProfile: DocumentProfile }>,
  );

  const isSaving = pendingContent !== null;
  const workingContent = pendingContent ?? content;
  const placeholders = useMemo(
    () => collectPlaceholders(workingContent),
    [workingContent],
  );

  useEffect(() => {
    if (pendingContent === null) {
      return;
    }
    if (pendingContent === content) {
      setPendingContent(null);
      return;
    }
    const timer = setTimeout(() => setPendingContent(null), SAVE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [pendingContent, content]);

  const valueOf = (placeholder: OpenPlaceholder): string =>
    values[placeholder.token] ?? placeholder.suggested;

  const filledPlaceholders = placeholders.filter(
    (placeholder) => valueOf(placeholder).trim() !== "",
  );

  const saveFacts = async (items: OpenPlaceholder[]) => {
    if (!projectId) {
      return;
    }
    const facts = items.filter((item) => remember[item.token]);
    if (facts.length === 0) {
      return;
    }
    try {
      for (const item of facts) {
        await rememberFact({
          projectId,
          label: capitalize(item.label),
          value: valueOf(item).trim(),
        } satisfies RememberFactBody);
      }
      toast({ type: "success", description: "Saved to office details" });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? `Couldn't save to office details: ${error.message}`
            : "Couldn't save to office details",
      });
    }
  };

  const handleApply = (items: OpenPlaceholder[]) => {
    if (isSaving || items.length === 0) {
      return;
    }
    const nextContent = fillPlaceholders(
      workingContent,
      items.map((item) => ({ token: item.token, value: valueOf(item) })),
    );
    if (nextContent === workingContent) {
      return;
    }
    setPendingContent(nextContent);
    onSaveContent(nextContent, false);
    void saveFacts(items);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="bg-black/30"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[400px]"
        // The artifact panel closes on a window-level Escape listener; keep
        // Escape scoped to this sheet.
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left sm:px-5">
          <SheetTitle>Fill in placeholders</SheetTitle>
          <SheetDescription>
            Each value replaces every occurrence of its placeholder in the
            document.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {placeholders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Check className="size-5 text-brand-700" />
              All placeholders are filled.
            </div>
          ) : (
            <ul className="space-y-3">
              {placeholders.map((placeholder, index) => (
                <PlaceholderItem
                  key={placeholder.token}
                  id={`placeholder-fill-${index}`}
                  placeholder={placeholder}
                  value={valueOf(placeholder)}
                  isRemembered={remember[placeholder.token] ?? false}
                  canRemember={Boolean(projectId)}
                  disabled={isSaving}
                  onValueChange={(value) =>
                    setValues((current) => ({
                      ...current,
                      [placeholder.token]: value,
                    }))
                  }
                  onRememberChange={(checked) =>
                    setRemember((current) => ({
                      ...current,
                      [placeholder.token]: checked,
                    }))
                  }
                  onApply={() => handleApply([placeholder])}
                />
              ))}
            </ul>
          )}
        </div>

        {placeholders.length > 0 && (
          <div className="border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="brand"
              className="w-full"
              disabled={isSaving || filledPlaceholders.length === 0}
              onClick={() => handleApply(filledPlaceholders)}
            >
              {isSaving && <Loader2 className="animate-spin" />}
              Apply all filled
              {filledPlaceholders.length > 0 &&
                ` (${filledPlaceholders.length})`}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface PlaceholderItemProps {
  id: string;
  placeholder: OpenPlaceholder;
  value: string;
  isRemembered: boolean;
  canRemember: boolean;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onRememberChange: (checked: boolean) => void;
  onApply: () => void;
}

function PlaceholderItem({
  id,
  placeholder,
  value,
  isRemembered,
  canRemember,
  disabled,
  onValueChange,
  onRememberChange,
  onApply,
}: PlaceholderItemProps) {
  const isSuggested =
    placeholder.suggested !== "" && value === placeholder.suggested;
  const canApply = !disabled && value.trim() !== "";

  return (
    <li className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium leading-snug">
          {capitalize(placeholder.label)}
        </Label>
        {placeholder.count > 1 && (
          <span
            className="shrink-0 rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200"
            title={`Appears ${placeholder.count} times`}
          >
            ×{placeholder.count}
          </span>
        )}
      </div>
      {placeholder.note && (
        <p className="text-xs text-muted-foreground">{placeholder.note}</p>
      )}

      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          className="h-9 min-w-0 flex-1"
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canApply) {
              event.preventDefault();
              onApply();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          disabled={!canApply}
          onClick={onApply}
        >
          Apply
        </Button>
      </div>
      {isSuggested && (
        <p className="text-xs text-yellow-800 dark:text-yellow-200">
          Suggested — check before applying.
        </p>
      )}

      {canRemember && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-remember`}
            checked={isRemembered}
            onCheckedChange={(checked) => onRememberChange(checked === true)}
          />
          <Label
            htmlFor={`${id}-remember`}
            className="text-xs font-normal text-muted-foreground"
          >
            Remember for this office
          </Label>
        </div>
      )}
    </li>
  );
}
