"use client";

import { type FormEvent, useState } from "react";

import { Loader2 } from "lucide-react";

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@wildfires-org/turboplan-utils";

import type { ProjectDocument } from "../types";

const MAX_FILENAME_LENGTH = 255;

type RenameDocumentDialogProps = {
  /** The document being renamed. Render the dialog only when non-null. */
  document: ProjectDocument;
  isRenaming: boolean;
  onOpenChange: (open: boolean) => void;
  /** Parent closes the dialog on success; on failure it leaves it open and toasts. */
  onRename: (documentId: string, newName: string) => Promise<void>;
};

/**
 * Splits a filename into an editable basename and its extension (leading dot
 * included). Names with no dot ("README") and dotfiles (".env") have no
 * extension, so the whole string stays editable.
 */
const splitFilename = (filename: string) => {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return { basename: filename, extension: "" };
  }

  return {
    basename: filename.slice(0, dotIndex),
    extension: filename.slice(dotIndex),
  };
};

/**
 * Small dialog for renaming a project document's display filename.
 * Enter submits, Escape/Cancel closes, Save is disabled while unchanged.
 *
 * Only the basename is editable — the extension is pinned and rendered as a
 * suffix. Renaming ".pdf" away breaks downloads (the download link uses this
 * name verbatim) and a swapped extension misrepresents the file's type.
 */
export const RenameDocumentDialog = ({
  document,
  isRenaming,
  onOpenChange,
  onRename,
}: RenameDocumentDialogProps) => {
  const { basename, extension } = splitFilename(document.originalFilename);
  const [value, setValue] = useState(basename);

  const trimmedValue = value.trim();
  const nextFilename = `${trimmedValue}${extension}`;
  const canSave =
    trimmedValue.length > 0 &&
    nextFilename.length <= MAX_FILENAME_LENGTH &&
    nextFilename !== document.originalFilename &&
    !isRenaming;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    await onRename(document.id, nextFilename);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Change the display name of this document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="document-name">Name</Label>
            <div
              className={cn(
                "flex h-10 w-full items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                isRenaming && "cursor-not-allowed opacity-50",
              )}
            >
              <Input
                id="document-name"
                className="h-full min-w-0 flex-1 border-0 bg-transparent pr-0 shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-100"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                maxLength={MAX_FILENAME_LENGTH - extension.length}
                disabled={isRenaming}
                autoFocus
              />
              {extension ? (
                <span
                  className="shrink-0 select-none pr-3 text-muted-foreground text-base md:text-sm"
                  title="The file extension cannot be changed"
                >
                  {extension}
                </span>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {isRenaming ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
