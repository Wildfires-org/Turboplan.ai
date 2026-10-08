"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import useSWRMutation from "swr/mutation";

import { postFetcher, putFetcher } from "@wildfires-org/turboplan-api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@wildfires-org/turboplan-utils";
import {
  type LibraryLetterhead,
  type LibraryLetterheadFormData,
  libraryLetterheadSchema,
} from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { organizationLetterheadsKey } from "@/hooks/use-organization-letterheads";
import { LetterheadEditor } from "./letterhead-editor";

type LetterheadResponse = { letterhead: LibraryLetterhead };

interface LibraryLetterheadDialogProps {
  organizationId: string;
  // The letterhead being edited; omitted when adding a new one.
  letterhead?: LibraryLetterhead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Add/edit form for one of the organization's library letterheads. Mount it
// only while open so the form resets between letterheads.
export function LibraryLetterheadDialog({
  organizationId,
  letterhead,
  open,
  onOpenChange,
  onSaved,
}: LibraryLetterheadDialogProps) {
  const listKey = organizationLetterheadsKey(organizationId);
  const { trigger: createLetterhead, isMutating: isCreating } = useSWRMutation(
    listKey,
    postFetcher<LetterheadResponse>,
  );
  const { trigger: updateLetterhead, isMutating: isUpdating } = useSWRMutation(
    letterhead ? `${listKey}/${letterhead.id}` : null,
    putFetcher<LetterheadResponse>,
  );
  const isSaving = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LibraryLetterheadFormData>({
    resolver: zodResolver(libraryLetterheadSchema),
    defaultValues: {
      name: letterhead?.name ?? "",
      layout: letterhead?.layout ?? "split",
      lines: letterhead?.lines ?? "",
      contact: letterhead?.contact ?? "",
      logoUrl: letterhead?.logoUrl ?? "",
      color: letterhead?.color ?? "",
    },
  });

  // An empty logoUrl clears the logo on the server.
  const onSubmit = handleSubmit(async (body) => {
    try {
      if (letterhead) {
        await updateLetterhead(body);
      } else {
        await createLetterhead(body);
      }
      toast({
        type: "success",
        description: letterhead ? "Letterhead updated." : "Letterhead added.",
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to save letterhead",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={isSaving ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-24px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogTitle>
            {letterhead ? "Edit letterhead" : "Add letterhead"}
          </DialogTitle>
          <DialogDescription>
            Documents in this organization can pick it instead of the default
            letterhead.
          </DialogDescription>
        </DialogHeader>

        <form
          id="library-letterhead-form"
          onSubmit={(event) => {
            // Keep the submit from bubbling to the org settings form behind.
            event.stopPropagation();
            void onSubmit(event);
          }}
          className="flex-1 space-y-4 overflow-y-auto px-6 py-5"
        >
          <div className="space-y-2">
            <Label
              htmlFor="libraryLetterheadName"
              className="text-sm font-medium"
            >
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="libraryLetterheadName"
              placeholder="Cleveland National Forest"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-error-700">{errors.name.message}</p>
            )}
            <p className="text-xs text-gray-550">
              Shown in the document letterhead picker.
            </p>
          </div>

          <LetterheadEditor
            idPrefix="libraryLetterhead"
            linesField={register("lines")}
            contactField={register("contact")}
            layout={watch("layout")}
            lines={watch("lines")}
            contact={watch("contact")}
            logoUrl={watch("logoUrl") ?? ""}
            color={watch("color") ?? ""}
            onLayoutChange={(layout) =>
              setValue("layout", layout, { shouldDirty: true })
            }
            onLogoChange={(url) =>
              setValue("logoUrl", url ?? "", { shouldDirty: true })
            }
            onColorChange={(color) =>
              setValue("color", color, { shouldDirty: true })
            }
            onImport={({ layout, lines, contact, color, logoUrl }) => {
              const options = { shouldDirty: true };
              setValue("layout", layout, options);
              setValue("color", color, options);
              if (lines !== undefined) {
                setValue("lines", lines, options);
              }
              if (contact !== undefined) {
                setValue("contact", contact, options);
              }
              if (logoUrl) {
                setValue("logoUrl", logoUrl, options);
              }
            }}
            organizationId={organizationId}
            initialLogoUrl={letterhead?.logoUrl}
            linesError={errors.lines?.message}
            contactError={errors.contact?.message}
            disabled={isSaving}
          />
        </form>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="glass"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            form="library-letterhead-form"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : letterhead ? (
              "Save letterhead"
            ) : (
              "Add letterhead"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
