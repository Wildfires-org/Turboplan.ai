"use client";

import { useEffect } from "react";

import type { ProjectField } from "@wildfires-org/turboplan-db";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";

import { FieldForm, useFieldForm } from "./field-form";

interface EditFieldDialogProps {
  field: ProjectField;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name?: string;
    type?: "text" | "list";
    isRequired?: boolean;
    tooltip?: string | null;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function EditFieldDialog({
  field,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: EditFieldDialogProps) {
  const { values, setValues, reset, isValid } = useFieldForm({
    name: field.name,
    type: field.type,
    isRequired: field.isRequired,
    tooltip: field.tooltip || "",
  });

  // Reset form when field changes or dialog opens
  useEffect(() => {
    if (open) {
      reset({
        name: field.name,
        type: field.type,
        isRequired: field.isRequired,
        tooltip: field.tooltip || "",
      });
    }
  }, [open, field, reset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    await onSubmit({
      name: values.name.trim(),
      type: values.type,
      isRequired: values.isRequired,
      tooltip: values.tooltip.trim() || null,
    });
  };

  const typeChangeWarning =
    values.type !== field.type && field.values.length > 0
      ? "Changing field type will reset current values."
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>
              Update the field configuration.
            </DialogDescription>
          </DialogHeader>

          <FieldForm
            values={values}
            onValuesChange={setValues}
            isSubmitting={isSubmitting}
            idPrefix="edit-"
            typeChangeWarning={typeChangeWarning}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="glass"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
