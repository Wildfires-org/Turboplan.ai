"use client";

import { type ReactNode, useRef, useState } from "react";

import { Pencil, Trash2 } from "lucide-react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { deleteFetcher } from "@wildfires-org/turboplan-api-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
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
import { gridLogoCells } from "@wildfires-org/turboplan-workspace/types";

import { DocumentLogoUpload } from "@/components/dashboard/document-logo-upload";
import { GridLetterheadEditor } from "@/components/grid-letterhead-editor";
import { LetterheadBand } from "@/components/letterhead-band";
import { useUser } from "@/components/providers/user-provider";
import { toast } from "@/components/toast";
import {
  revalidateDefaultLetterheadGrid,
  useDefaultLetterheadGrid,
  useDefaultLetterheadGridLogos,
} from "@/hooks/use-default-letterhead-grid";
import {
  type DefaultLetterheadGridOwner,
  type DefaultLetterheadGridResponse,
  defaultGridPreviewLetterhead,
  defaultLetterheadGridUrl,
  defaultLetterheadSettingsCopy,
  defaultLetterheadSettingsView,
} from "@/lib/default-letterhead-grid";

interface DefaultLetterheadGridSettingsProps {
  owner: DefaultLetterheadGridOwner;
  // The owner's document logo (the form's value): documents draw it in the
  // margin of a grid without logo cells. Null for none — and for a banner
  // layout, whose image it is.
  marginLogoSrc: string | null;
  // Sets the form's document logo from the grid view (the layout settings,
  // which hold its upload, are hidden there); without it the grid view has
  // no logo upload.
  onMarginLogoChange?: (url: string | null) => void;
  // The layout settings make a letterhead of their own: removing the grid
  // brings them back (else an office's documents go back to the
  // organization's letterhead, an organization's to none).
  hasLayoutLetterhead: boolean;
  disabled?: boolean;
  // The layout settings, shown (unchanged) while no grid is set.
  children: ReactNode;
}

// The Letterhead block of the organization / office settings. A default
// saved from a document's letterhead ("Save as organization letterhead")
// replaces the layout settings while it is set: it is shown instead of them,
// with the margin logo's upload, and Edit (the grid editor) and Remove (the
// layout settings apply again) for a user who may change the organization /
// office. Without one, the layout settings show as before.
export function DefaultLetterheadGridSettings({
  owner,
  marginLogoSrc,
  onMarginLogoChange,
  hasLayoutLetterhead,
  disabled = false,
  children,
}: DefaultLetterheadGridSettingsProps) {
  const { user } = useUser();
  const { mutate } = useSWRConfig();
  const { data, error } = useDefaultLetterheadGrid(owner);
  const { hasPermission: canUpdate } = useEntityPermission({
    userId: user?.id,
    entityType:
      owner.kind === "organization"
        ? EntityType.ORGANIZATION
        : EntityType.OFFICE,
    entityId: owner.id,
    action: Action.UPDATE,
  });
  const view = defaultLetterheadSettingsView({ data, error }, canUpdate);
  const grid = view.kind === "grid" ? view.grid : null;
  const { logoSrcs, logoLoading } = useDefaultLetterheadGridLogos(
    owner,
    grid,
    view.kind === "grid" ? view.version : null,
  );
  // The key is the settings' GET: not revalidated here, the answer seeds it.
  const { trigger: removeGrid, isMutating: isRemoving } = useSWRMutation(
    defaultLetterheadGridUrl(owner),
    deleteFetcher<DefaultLetterheadGridResponse>,
    { revalidate: false },
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  // The confirmation has no trigger: focus goes back to Remove, or — once
  // the grid and its buttons are gone — to this block.
  const blockRef = useRef<HTMLDivElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const copy = defaultLetterheadSettingsCopy({
    ownerKind: owner.kind,
    hasLayoutLetterhead,
    canEdit: view.kind === "grid" && view.canEdit,
  });

  const handleRemove = async () => {
    try {
      await removeGrid();
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to remove letterhead",
      });
      return;
    }
    revalidateDefaultLetterheadGrid(mutate, owner, {
      grid: null,
      version: null,
    });
    setIsRemoveOpen(false);
    toast({ type: "success", description: "Letterhead removed." });
  };

  const handleRemoveCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    const removeButton = removeButtonRef.current;
    (removeButton?.isConnected ? removeButton : blockRef.current)?.focus();
  };

  const showMarginLogo =
    !!grid && !!marginLogoSrc && gridLogoCells(grid).length === 0;
  const ownerName = owner.kind === "organization" ? "organization" : "office";

  return (
    <div
      ref={blockRef}
      tabIndex={-1}
      role="group"
      aria-label="Default letterhead"
      aria-busy={view.kind === "loading" || undefined}
      className="space-y-4 focus:outline-none"
    >
      {view.kind === "loading" && (
        // Until the GET answers: the layout settings would be replaced by a
        // grid as soon as it arrives.
        <div
          data-testid="default-letterhead-loading"
          className="h-40 animate-pulse rounded-xl bg-background/70 ring-1 ring-inset ring-border dark:bg-white/5"
        >
          <span className="sr-only">Loading letterhead…</span>
        </div>
      )}

      {view.kind === "legacy" && children}

      {view.kind === "grid" && (
        <>
          <div
            data-testid="default-letterhead-grid-preview"
            className={cn(
              "overflow-hidden rounded-xl bg-white p-4 text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-100",
              showMarginLogo && "md:pl-16",
            )}
          >
            <LetterheadBand
              letterhead={defaultGridPreviewLetterhead(view.grid)}
              logoSrc={showMarginLogo ? marginLogoSrc : null}
              logoSrcs={logoSrcs}
              logoLoading={logoLoading}
              className="mb-0"
            />
          </div>
          <p className="text-xs text-gray-550">{copy.note}</p>
          {view.canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="glass"
                size="sm"
                onClick={() => setIsEditorOpen(true)}
                disabled={disabled || isRemoving}
              >
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button
                ref={removeButtonRef}
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-gray-550 hover:text-error-700"
                onClick={() => setIsRemoveOpen(true)}
                disabled={disabled || isRemoving}
              >
                <Trash2 aria-hidden />
                Remove
              </Button>
            </div>
          )}
          {onMarginLogoChange && (
            // The same form field as the layout settings' document logo.
            <DocumentLogoUpload
              label="Margin logo"
              value={marginLogoSrc}
              onChange={onMarginLogoChange}
              helperText={
                owner.kind === "office"
                  ? "Used when the letterhead has no logo; without one, documents use the organization's. PNG or JPEG."
                  : "Used when the letterhead has no logo. PNG or JPEG."
              }
              disabled={disabled}
            />
          )}
        </>
      )}

      {isEditorOpen && view.kind === "grid" && view.canEdit && (
        <GridLetterheadEditor
          target={{
            kind: "default",
            owner,
            version: view.version,
            marginLogoSrc,
          }}
          grid={view.grid}
          open
          onOpenChange={setIsEditorOpen}
        />
      )}

      <AlertDialog
        open={isRemoveOpen}
        onOpenChange={(open) => {
          if (!open && isRemoving) {
            return;
          }
          setIsRemoveOpen(open);
        }}
      >
        <AlertDialogContent onCloseAutoFocus={handleRemoveCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove the {ownerName}&apos;s letterhead?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {copy.removeDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Kept open until the removal settles.
                event.preventDefault();
                void handleRemove();
              }}
              disabled={isRemoving}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
