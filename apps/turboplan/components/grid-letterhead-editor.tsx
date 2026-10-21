"use client";

import { useId, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  ArrowDown,
  ArrowUp,
  Bold,
  Loader2,
  type LucideIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Controller,
  type FieldErrors,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";
import {
  GRID_LINE_SIZES,
  type GridLetterheadEdit,
  type GridLineSize,
  type GridVerticalAlign,
  gridLogoCells,
  MAX_GRID_CELLS,
  MAX_GRID_LINES_PER_CELL,
  type PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import { DocumentLogoUpload } from "@/components/dashboard/document-logo-upload";
import { LetterheadColorField } from "@/components/dashboard/letterhead-color-field";
import { LetterheadBand } from "@/components/letterhead-band";
import { SaveAsDefaultLetterheadButton } from "@/components/save-letterhead-as-default";
import { toast } from "@/components/toast";
import {
  fetchDefaultLetterheadGridLogoDataUrl,
  revalidateDefaultLetterheadGrid,
} from "@/hooks/use-default-letterhead-grid";
import { documentLetterheadKey } from "@/hooks/use-document-letterhead";
import {
  fetchLetterheadLogoDataUrl,
  letterheadLogoKeysOf,
} from "@/hooks/use-letterhead-logo";
import {
  type DocumentLetterheadResponse,
  LetterheadSaveError,
  withSavedOwnLetterhead,
} from "@/lib/export/letterhead";
import {
  type GridLetterheadEditorLogoKey,
  type GridLetterheadEditorSaved,
  type GridLetterheadEditorTarget,
  gridEditorDescription,
  gridEditorLogoKey,
  gridEditorSaveUrl,
  saveGridLetterheadEdit,
} from "@/lib/grid-letterhead-editor-target";
import {
  formErrorFromServer,
  formValuesToEdit,
  formValuesToPreview,
  type GridLetterheadFormCell,
  type GridLetterheadFormLogoCell,
  type GridLetterheadFormTextCell,
  type GridLetterheadFormValues,
  gridLetterheadFormSchema,
  gridToFormValues,
  logoColumnIndex,
  withCellRemoved,
  withTextCellAdded,
  withUploadedLogo,
} from "@/lib/grid-letterhead-form";

interface GridLetterheadEditorProps {
  // What is edited — a document's own copy or an organization's / office's
  // default — with the version the save is checked against (refused, 409,
  // once the letterhead changed after the editor opened).
  target: GridLetterheadEditorTarget;
  // The letterhead as its GET sends it (logo cells by `index`): a document's
  // copy while "own" is selected, or the default grid.
  grid: PublicGridLetterhead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TextColumnProps {
  index: number;
  disabled: boolean;
  // Removing a column moves the others: held while a logo uploads.
  isRemoveDisabled: boolean;
  onRemove: () => void;
}

interface LogoColumnProps {
  index: number;
  // The logo shown: the upload, else the saved logo (null while loading).
  src: string | null;
  // Also held while any logo uploads (one upload at a time; removing a
  // column would move the others).
  disabled: boolean;
  // Held while saving only (an upload never changes the alignment).
  isAlignDisabled: boolean;
  onChange: (url: string | null) => void;
  onRemove: () => void;
  onUploadingChange: (isUploading: boolean) => void;
}

type AlignOption = { value: string; label: string; icon: LucideIcon };

interface AlignmentToggleProps {
  // Names the group ("Alignment", "Vertical").
  label: string;
  name: `cells.${number}.align` | `cells.${number}.valign`;
  options: readonly AlignOption[];
  disabled: boolean;
}

interface ColumnHeaderProps {
  id: string;
  index: number;
  kind: string;
  width: number;
  disabled: boolean;
  onRemove: () => void;
}

const FORM_ID = "grid-letterhead-form";

const SIZE_LABELS: Record<GridLineSize, string> = {
  small: "Small",
  normal: "Normal",
  large: "Large",
  xlarge: "Extra large",
  xxlarge: "Huge",
};

// Smallest to largest.
const SIZE_OPTIONS = GRID_LINE_SIZES.map((value) => ({
  value,
  label: SIZE_LABELS[value],
}));

const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
] as const;

// Where a column sits in the row's height when another column is taller.
const VALIGN_OPTIONS = [
  { value: "top", label: "Align top", icon: AlignStartHorizontal },
  { value: "middle", label: "Align middle", icon: AlignCenterHorizontal },
  { value: "bottom", label: "Align bottom", icon: AlignEndHorizontal },
] as const satisfies readonly (AlignOption & { value: GridVerticalAlign })[];

const ICON_BUTTON_CLASS = "size-9 shrink-0 rounded-lg";

// An image's height / width, or null when it does not load: a replaced logo
// keeps its own aspect (the exporters draw a logo at its cell's).
const readImageAspect = (src: string) =>
  new Promise<number | null>((resolve) => {
    const image = document.createElement("img");
    image.onload = () =>
      resolve(
        image.naturalWidth > 0
          ? image.naturalHeight / image.naturalWidth
          : null,
      );
    image.onerror = () => resolve(null);
    image.src = src;
  });

// A saved logo, from the target's logo proxy (see `gridEditorLogoKey`).
const fetchSavedLogo = (key: GridLetterheadEditorLogoKey) =>
  key[0] === "letterhead-logo"
    ? fetchLetterheadLogoDataUrl(key)
    : fetchDefaultLetterheadGridLogoDataUrl(key);

// The saved logo at `key` as a data URL (null while loading or missing);
// nothing is fetched for a null key.
const useSavedLogoState = (key: GridLetterheadEditorLogoKey | null) => {
  const { data, isLoading } = useSWR(key, fetchSavedLogo, {
    revalidateOnFocus: false,
  });
  return { src: data ?? null, isLoading };
};

// Where focus goes back when the dialog closes (it has no Dialog.Trigger):
// what had focus when it opened — for an item of a menu (the Letterhead
// menu), that menu's trigger, which outlives the item.
const focusReturnTarget = (): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return null;
  }
  const triggerId = active
    .closest('[role="menu"]')
    ?.getAttribute("aria-labelledby");
  return (triggerId && document.getElementById(triggerId)) || active;
};

// Edits a grid letterhead — a document's own copy of its reference's
// letterhead (saving changes that document only) or an organization's /
// office's default (`target`): its columns left to right (text lines,
// alignment; logos replaced or removed), adding and removing columns, and
// its colour, with a live preview. A document's copy can also be saved as
// the organization's (or office's) letterhead from here. Mount it only while
// open, so the form starts from the saved letterhead each time.
export function GridLetterheadEditor({
  target,
  grid,
  open,
  onOpenChange,
}: GridLetterheadEditorProps) {
  // The letterhead as it was when the dialog opened: the form, the saved
  // logo indexes and the version sent back refer to it, whatever revalidates
  // meanwhile.
  const [savedGrid] = useState(grid);
  const [savedTarget] = useState(target);
  const [returnFocusTo] = useState(focusReturnTarget);
  const savedLogoCount = gridLogoCells(savedGrid).length;
  // One hook per logo a grid can hold (MAX_GRID_LOGOS). For a document, index
  // 0 of a grid without logo cells is the office → organization logo, drawn
  // in the margin.
  const firstLogo = useSavedLogoState(
    gridEditorLogoKey(savedTarget, 0, savedLogoCount),
  );
  const secondLogo = useSavedLogoState(
    gridEditorLogoKey(savedTarget, 1, savedLogoCount),
  );
  const savedLogos = savedLogoCount > 0 ? [firstLogo, secondLogo] : [];
  const marginLogoSrc =
    savedLogoCount > 0
      ? null
      : savedTarget.kind === "document"
        ? firstLogo.src
        : savedTarget.marginLogoSrc;

  const { mutate } = useSWRConfig();
  // For a default the key is the settings' GET: not revalidated here, the
  // save's answer seeds it (`refreshLetterhead`).
  const { trigger, isMutating: isSaving } = useSWRMutation(
    gridEditorSaveUrl(savedTarget),
    (_url: string, { arg }: { arg: GridLetterheadEdit }) =>
      saveGridLetterheadEdit(savedTarget, arg),
    { revalidate: false },
  );
  // Logo uploads in flight, by column id: saving waits for them.
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  // What had focus when the discard question opened, to go back to when the
  // user keeps editing.
  const discardReturnRef = useRef<HTMLElement | null>(null);
  const addColumnRef = useRef<HTMLButtonElement>(null);
  const previewLabelId = useId();
  const columnsLabelId = useId();

  const form = useForm<GridLetterheadFormValues>({
    resolver: zodResolver(gridLetterheadFormSchema),
    defaultValues: gridToFormValues(savedGrid),
    mode: "onTouched",
  });
  const {
    control,
    getValues,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    formState: { errors, isDirty },
  } = form;
  const { fields, insert, remove } = useFieldArray({ control, name: "cells" });
  // The columns as last rendered: an upload that ends after columns moved
  // looks its own column up by id (see `handleLogoChange`).
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const cells = useWatch({ control, name: "cells" });
  const color = useWatch({ control, name: "color" });
  // Never edited: the saved grid's, so the preview draws at its size.
  const fontSize = useWatch({ control, name: "fontSize" });

  const preview = formValuesToPreview({ cells, color, fontSize }, savedLogos);
  const showMarginLogo =
    !!marginLogoSrc && !cells.some((cell) => cell.kind === "logo");
  const isUploading = fields.some((field) => uploading[field.id]);
  // Adding or removing a column moves the others; held while a logo uploads.
  const isColumnChangeDisabled = isSaving || isUploading;
  const cellsError = errors.cells?.root?.message ?? errors.cells?.message;

  // x / width (and a logo's height) of every column, after one was added or
  // removed: the neighbours' geometry changes with it.
  const setGeometry = (next: GridLetterheadFormCell[]) => {
    next.forEach((cell, index) => {
      setValue(`cells.${index}.x`, cell.x);
      setValue(`cells.${index}.width`, cell.width);
      if (cell.kind === "logo") {
        setValue(`cells.${index}.height`, cell.height);
      }
    });
  };

  const handleAddColumn = () => {
    const { cells: next, index } = withTextCellAdded(getValues("cells"));
    insert(index, next[index], { focusName: `cells.${index}.lines.0.text` });
    setGeometry(next);
  };

  const handleRemoveColumn = (index: number) => {
    const next = withCellRemoved(getValues("cells"), index);
    remove(index);
    setGeometry(next);
    requestAnimationFrame(() => addColumnRef.current?.focus());
  };

  // The logo column `fieldId` is now, or null once it is gone. Looked up when
  // an upload ends (and again after its image loads), never when it started.
  const logoColumnOf = (fieldId: string) =>
    logoColumnIndex(fieldsRef.current, getValues("cells"), fieldId);

  const handleLogoChange = async (fieldId: string, url: string | null) => {
    const index = logoColumnOf(fieldId);
    if (index === null) {
      // The column was removed meanwhile: its upload is dropped.
      return;
    }
    if (!url) {
      handleRemoveColumn(index);
      return;
    }
    // Shown at once in the old box, then at the image's own aspect.
    setValue(`cells.${index}.url`, url, { shouldDirty: true });
    setValue(`cells.${index}.index`, null);
    const aspect = await readImageAspect(url);
    const at = logoColumnOf(fieldId);
    const current =
      at === null
        ? undefined
        : (getValues(`cells.${at}`) as GridLetterheadFormLogoCell);
    if (at !== null && current?.url === url) {
      const replaced = withUploadedLogo(current, url, aspect);
      setValue(`cells.${at}.width`, replaced.width);
      setValue(`cells.${at}.height`, replaced.height);
    }
  };

  const handleUploadingChange = (id: string, isActive: boolean) =>
    setUploading((current) =>
      current[id] === isActive ? current : { ...current, [id]: isActive },
    );

  const handleCloseAutoFocus = (event: Event) => {
    if (returnFocusTo?.isConnected) {
      event.preventDefault();
      returnFocusTo.focus();
    }
  };

  // Escape, a click outside, the close button and Cancel: unsaved edits are
  // only discarded once confirmed. Nothing closes while saving.
  const handleOpenChange = (next: boolean) => {
    if (next || isSaving) {
      return;
    }
    if (isDirty) {
      discardReturnRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setIsDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  // Back to what had focus (the alert has no trigger to return to); after a
  // discard that is gone with the editor, which then returns focus itself.
  const handleDiscardCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    if (discardReturnRef.current?.isConnected) {
      discardReturnRef.current.focus();
    }
  };

  // Drops what the letterhead's caches hold, so what shows it (the document
  // behind the dialog, the settings) follows the saved (or newer) one;
  // `saved`: the save's answer, when it succeeded.
  const refreshLetterhead = (saved?: GridLetterheadEditorSaved) => {
    if (savedTarget.kind === "default") {
      revalidateDefaultLetterheadGrid(
        mutate,
        savedTarget.owner,
        saved?.kind === "default" ? saved.saved : undefined,
      );
      return;
    }
    const { projectId, documentId } = savedTarget;
    // Logos first: a logo cell that moved must not draw the logo cached for
    // its new index while the letterhead below already shows the move.
    void mutate(letterheadLogoKeysOf(projectId, documentId), undefined, {
      revalidate: true,
    });
    const key = documentLetterheadKey(projectId, documentId);
    void (saved?.kind === "document"
      ? mutate(
          key,
          (current?: DocumentLetterheadResponse | null) =>
            current ? withSavedOwnLetterhead(current, saved.saved) : current,
          { revalidate: true },
        )
      : mutate(key));
  };

  const handleOpenAutoFocus = (event: Event) => {
    const firstText = getValues("cells").findIndex(
      (cell) => cell.kind === "text",
    );
    if (firstText >= 0) {
      event.preventDefault();
      setFocus(`cells.${firstText}.lines.0.text`);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      refreshLetterhead(await trigger(formValuesToEdit(values)));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save letterhead";
      toast({ type: "error", description: message });
      if (!(error instanceof LetterheadSaveError)) {
        return;
      }
      if (error.status === 409) {
        // Changed elsewhere (or drafted again): this form's logo indexes may
        // mean other logos now. The message asks to reopen the editor, which
        // then starts from the newer letterhead.
        refreshLetterhead();
        onOpenChange(false);
        return;
      }
      const fieldError =
        error.field && formErrorFromServer(error.field, message, values);
      if (fieldError) {
        setError(
          fieldError.path,
          { type: "server", message: fieldError.message },
          { shouldFocus: true },
        );
      }
      return;
    }
    toast({ type: "success", description: "Letterhead updated." });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={handleCloseAutoFocus}
        className="flex max-h-[90vh] w-[calc(100%-24px)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogTitle>Edit letterhead</DialogTitle>
          <DialogDescription>
            {gridEditorDescription(savedTarget)}
          </DialogDescription>
        </DialogHeader>

        <section
          aria-labelledby={previewLabelId}
          className="shrink-0 space-y-2 border-b border-border px-6 py-4"
        >
          <h3 id={previewLabelId} className="text-sm font-medium">
            Preview
          </h3>
          <div
            data-testid="grid-letterhead-preview"
            className={cn(
              "max-h-[30vh] overflow-y-auto rounded-xl bg-white p-4 text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-100",
              showMarginLogo && "md:pl-16",
            )}
          >
            <LetterheadBand
              letterhead={preview.letterhead}
              logoSrc={showMarginLogo ? marginLogoSrc : null}
              logoSrcs={preview.logoSrcs}
              logoLoading={preview.logoLoading}
              className="mb-0"
            />
          </div>
        </section>

        <FormProvider {...form}>
          <form
            id={FORM_ID}
            noValidate
            onSubmit={(event) => {
              event.stopPropagation();
              void onSubmit(event);
            }}
            className="flex-1 space-y-6 overflow-y-auto px-6 py-5"
          >
            <section aria-labelledby={columnsLabelId} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 id={columnsLabelId} className="text-sm font-medium">
                  Columns
                </h3>
                <span className="text-xs text-gray-550">Left to right</span>
              </div>

              {fields.map((field, index) => {
                // A column never changes kind; its logo does.
                if (field.kind === "logo") {
                  const cell = cells[index];
                  const logo = cell?.kind === "logo" ? cell : field;
                  return (
                    // Keyed by the column, so its uploader is never remounted
                    // (which would lose an upload in flight).
                    <LogoColumn
                      key={field.id}
                      index={index}
                      src={
                        logo.url ??
                        (logo.index === null
                          ? null
                          : (savedLogos[logo.index]?.src ?? null))
                      }
                      disabled={isColumnChangeDisabled}
                      isAlignDisabled={isSaving}
                      onChange={(url) => void handleLogoChange(field.id, url)}
                      onRemove={() => handleRemoveColumn(index)}
                      onUploadingChange={(isActive) =>
                        handleUploadingChange(field.id, isActive)
                      }
                    />
                  );
                }
                return (
                  <TextColumn
                    key={field.id}
                    index={index}
                    disabled={isSaving}
                    isRemoveDisabled={isColumnChangeDisabled}
                    onRemove={() => handleRemoveColumn(index)}
                  />
                );
              })}

              {cellsError && (
                <p role="alert" className="text-xs text-error-700">
                  {cellsError}
                </p>
              )}

              <Button
                ref={addColumnRef}
                type="button"
                variant="glass"
                size="sm"
                onClick={handleAddColumn}
                disabled={
                  isColumnChangeDisabled || fields.length >= MAX_GRID_CELLS
                }
              >
                <Plus aria-hidden />
                Add text column
              </Button>
            </section>

            <LetterheadColorField
              idPrefix="gridLetterhead"
              color={color}
              onColorChange={(next) =>
                setValue("color", next, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              hint="Used for the rule under the letterhead and the bold lines."
              error={errors.color?.message}
              disabled={isSaving}
            />
          </form>
        </FormProvider>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          {savedTarget.kind === "document" && (
            <div className="mr-auto min-w-0">
              <SaveAsDefaultLetterheadButton
                projectId={savedTarget.projectId}
                documentId={savedTarget.documentId}
                isDirty={isDirty}
                disabled={isSaving || isUploading}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="glass"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              form={FORM_ID}
              disabled={isSaving || isUploading}
            >
              {isSaving ? (
                <>
                  <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save letterhead"
              )}
            </Button>
          </div>
        </div>

        <AlertDialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
          <AlertDialogContent onCloseAutoFocus={handleDiscardCloseAutoFocus}>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
              <AlertDialogDescription>
                Your edits to this letterhead have not been saved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onOpenChange(false)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

const ColumnHeader = ({
  id,
  index,
  kind,
  width,
  disabled,
  onRemove,
}: ColumnHeaderProps) => (
  <div className="flex items-center justify-between gap-2">
    <h4 id={id} className="text-sm font-medium">
      Column {index + 1}
      <span className="font-normal text-gray-550">
        {" "}
        · {kind} · {Math.round(width * 100)}% wide
      </span>
    </h4>
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="rounded-lg text-gray-550 hover:text-foreground"
      onClick={onRemove}
      disabled={disabled}
    >
      <Trash2 aria-hidden />
      Remove column
    </Button>
  </div>
);

// A text column: its lines (text, bold, size; added, removed, reordered) and
// its alignment, across and in the row's height.
const TextColumn = ({
  index,
  disabled,
  isRemoveDisabled,
  onRemove,
}: TextColumnProps) => {
  const {
    control,
    register,
    setFocus,
    formState: { errors },
  } = useFormContext<GridLetterheadFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `cells.${index}.lines`,
  });
  const width = useWatch({ control, name: `cells.${index}.width` });
  const headingId = useId();
  const cellErrors = errors.cells?.[index] as
    | FieldErrors<GridLetterheadFormTextCell>
    | undefined;
  const linesError =
    cellErrors?.lines?.root?.message ?? cellErrors?.lines?.message;

  const handleRemoveLine = (lineIndex: number) => {
    remove(lineIndex);
    requestAnimationFrame(() =>
      setFocus(`cells.${index}.lines.${Math.max(0, lineIndex - 1)}.text`),
    );
  };

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="space-y-3 rounded-xl bg-background/70 p-3 ring-1 ring-inset ring-border dark:bg-white/5"
    >
      <ColumnHeader
        id={headingId}
        index={index}
        kind="Text"
        width={width}
        disabled={disabled || isRemoveDisabled}
        onRemove={onRemove}
      />

      <div className="space-y-2">
        {fields.map((line, lineIndex) => {
          const name = `cells.${index}.lines.${lineIndex}` as const;
          const lineError = cellErrors?.lines?.[lineIndex]?.text?.message;
          const errorId = `${headingId}-line-${line.id}`;
          return (
            <div
              key={line.id}
              role="group"
              aria-label={`Line ${lineIndex + 1}`}
              className="space-y-1"
            >
              <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                <Input
                  aria-label="Text"
                  placeholder="Line text"
                  autoComplete="off"
                  aria-invalid={lineError ? true : undefined}
                  aria-describedby={lineError ? errorId : undefined}
                  disabled={disabled}
                  className="h-9 min-w-0 basis-full sm:basis-auto sm:flex-1"
                  {...register(`${name}.text`)}
                />
                <Controller
                  control={control}
                  name={`${name}.bold`}
                  render={({ field }) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Bold"
                      aria-label="Bold"
                      aria-pressed={field.value}
                      onClick={() => field.onChange(!field.value)}
                      disabled={disabled}
                      className={cn(
                        ICON_BUTTON_CLASS,
                        field.value &&
                          "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-700/30 dark:bg-white/10 dark:text-brand-300",
                      )}
                    >
                      <Bold aria-hidden />
                    </Button>
                  )}
                />
                <Controller
                  control={control}
                  name={`${name}.size`}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        aria-label="Size"
                        className="h-9 w-[8rem] shrink-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Move up"
                  aria-label="Move line up"
                  onClick={() => move(lineIndex, lineIndex - 1)}
                  disabled={disabled || lineIndex === 0}
                  className={ICON_BUTTON_CLASS}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Move down"
                  aria-label="Move line down"
                  onClick={() => move(lineIndex, lineIndex + 1)}
                  disabled={disabled || lineIndex === fields.length - 1}
                  className={ICON_BUTTON_CLASS}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remove line"
                  aria-label="Remove line"
                  onClick={() => handleRemoveLine(lineIndex)}
                  disabled={disabled || fields.length === 1}
                  className={ICON_BUTTON_CLASS}
                >
                  <X aria-hidden />
                </Button>
              </div>
              {lineError && (
                <p id={errorId} className="text-xs text-error-700">
                  {lineError}
                </p>
              )}
            </div>
          );
        })}
        {linesError && (
          <p role="alert" className="text-xs text-error-700">
            {linesError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="rounded-lg"
          onClick={() => append({ text: "", bold: false, size: "normal" })}
          disabled={disabled || fields.length >= MAX_GRID_LINES_PER_CELL}
        >
          <Plus aria-hidden />
          Add line
        </Button>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <AlignmentToggle
            label="Alignment"
            name={`cells.${index}.align`}
            options={ALIGN_OPTIONS}
            disabled={disabled}
          />
          <AlignmentToggle
            label="Vertical"
            name={`cells.${index}.valign`}
            options={VALIGN_OPTIONS}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

// A logo column: replace its logo (an upload; the column keeps its width),
// set where it sits in the row's height, or remove the column. A logo the
// server refused (a server error on its `url` / `index`) shows under it.
const LogoColumn = ({
  index,
  src,
  disabled,
  isAlignDisabled,
  onChange,
  onRemove,
  onUploadingChange,
}: LogoColumnProps) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<GridLetterheadFormValues>();
  const width = useWatch({ control, name: `cells.${index}.width` });
  const headingId = useId();
  const errorId = useId();
  const cellErrors = errors.cells?.[index] as
    | FieldErrors<GridLetterheadFormLogoCell>
    | undefined;
  const logoError = cellErrors?.url?.message ?? cellErrors?.index?.message;

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      aria-describedby={logoError ? errorId : undefined}
      className="space-y-3 rounded-xl bg-background/70 p-3 ring-1 ring-inset ring-border dark:bg-white/5"
    >
      <ColumnHeader
        id={headingId}
        index={index}
        kind="Logo"
        width={width}
        disabled={disabled}
        onRemove={onRemove}
      />
      {/* Seeds its thumbnail from `value` whenever that changes (e.g. the
          saved logo finished loading), without remounting. */}
      <DocumentLogoUpload
        label="Logo"
        value={src}
        onChange={onChange}
        onUploadingChange={onUploadingChange}
        helperText="PNG or JPEG. A new logo keeps this column's width."
        disabled={disabled}
      />
      {logoError && (
        <p id={errorId} className="text-xs text-error-700">
          {logoError}
        </p>
      )}
      <div className="flex justify-end">
        <AlignmentToggle
          label="Vertical"
          name={`cells.${index}.valign`}
          options={VALIGN_OPTIONS}
          disabled={isAlignDisabled}
        />
      </div>
    </div>
  );
};

// A column's alignment as a row of icon radio buttons (one per option, named
// by its label), the group named by `label`.
const AlignmentToggle = ({
  label,
  name,
  options,
  disabled,
}: AlignmentToggleProps) => {
  const { register } = useFormContext<GridLetterheadFormValues>();
  const labelId = useId();

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-xs text-gray-550">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="inline-flex rounded-lg bg-background p-0.5 ring-1 ring-inset ring-border"
      >
        {options.map(({ value, label: optionLabel, icon: Icon }) => (
          <label
            key={value}
            title={optionLabel}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-gray-550 transition-colors hover:text-foreground has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 dark:has-[:checked]:bg-white/10 dark:has-[:checked]:text-brand-300"
          >
            <input
              type="radio"
              value={value}
              aria-label={optionLabel}
              disabled={disabled}
              className="sr-only"
              {...register(name)}
            />
            <Icon aria-hidden className="size-4" />
          </label>
        ))}
      </div>
    </div>
  );
};
