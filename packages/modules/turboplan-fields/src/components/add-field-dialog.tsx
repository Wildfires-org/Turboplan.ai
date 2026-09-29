"use client";

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

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    type: "text" | "list";
    isRequired: boolean;
    tooltip?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function AddFieldDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: AddFieldDialogProps) {
  const { values, setValues, reset, isValid } = useFieldForm();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    await onSubmit({
      name: values.name.trim(),
      type: values.type,
      isRequired: values.isRequired,
      tooltip: values.tooltip.trim() || undefined,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Field</DialogTitle>
            <DialogDescription>
              Add a custom field to display project information.
            </DialogDescription>
          </DialogHeader>

          <FieldForm
            values={values}
            onValuesChange={setValues}
            isSubmitting={isSubmitting}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="glass"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
