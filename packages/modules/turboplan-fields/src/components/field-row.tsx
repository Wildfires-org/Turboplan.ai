"use client";

import { useState } from "react";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import type { ProjectField } from "@wildfires-org/turboplan-db";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { EditFieldDialog } from "./edit-field-dialog";
import { FieldLabel } from "./field-label";
import { FieldValueEditor } from "./field-value-editor";
import { FieldValuesDisplay } from "./field-values-display";
import { FieldsFieldItem } from "./fields-list-layout";

const fieldLabelColumnClassName = "w-36 shrink-0 sm:w-44";

interface FieldRowProps {
  field: ProjectField;
  onUpdate: (data: {
    name?: string;
    type?: "text" | "list";
    isRequired?: boolean;
    tooltip?: string | null;
    values?: string[];
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  isUpdating?: boolean;
  readOnly?: boolean;
}

export function FieldRow({
  field,
  onUpdate,
  onDelete,
  isUpdating = false,
  readOnly = false,
}: FieldRowProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleValueChange = async (values: string[]) => {
    await onUpdate({ values });
  };

  return (
    <FieldsFieldItem
      withActions={!readOnly}
      className={readOnly ? undefined : "items-start"}
    >
      <FieldLabel
        name={field.name}
        isRequired={field.isRequired}
        tooltip={field.tooltip}
        tooltipVariant="rich"
        className={cn(
          fieldLabelColumnClassName,
          !readOnly && "h-8 items-center",
        )}
      />

      <div className="min-w-0 flex-1">
        {readOnly ? (
          <FieldValuesDisplay
            type={field.type}
            values={field.values}
            fieldId={field.id}
          />
        ) : (
          <FieldValueEditor
            field={field}
            onValueChange={handleValueChange}
            disabled={isUpdating}
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex size-8 shrink-0 items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 rounded-lg p-0 text-gray-600 opacity-0 transition-opacity hover:bg-white hover:text-gray-900 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:bg-white data-[state=open]:opacity-100"
              >
                <MoreVertical className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Edit field
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-error-700 focus:text-error-700"
              >
                <Trash2 className="mr-2 size-4" />
                Delete field
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <EditFieldDialog
            field={field}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSubmit={async (data) => {
              await onUpdate(data);
              setIsEditDialogOpen(false);
            }}
            isSubmitting={isUpdating}
          />

          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete field</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the &quot;{field.name}&quot;
                  field? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </FieldsFieldItem>
  );
}
