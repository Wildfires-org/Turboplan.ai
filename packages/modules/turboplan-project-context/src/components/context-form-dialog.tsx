"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@wildfires-org/turboplan-utils";

import type { CreateContextInput } from "../hooks";

const contextFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(200),
  content: z.string().min(1, "Content is required"),
  url: z
    .union([z.string().url("Please enter a valid URL"), z.literal("")])
    .default(""),
});

type ContextFormInput = z.input<typeof contextFormSchema>;
type ContextFormValues = z.infer<typeof contextFormSchema>;

interface ContextFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateContextInput) => Promise<void>;
  isSubmitting?: boolean;
  title: string;
  description: string;
  submitLabel: string;
  submittingLabel: string;
  initialValues?: { label: string; content: string; url: string };
}

export function ContextFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  title,
  description,
  submitLabel,
  submittingLabel,
  initialValues,
}: ContextFormDialogProps) {
  const form = useForm<ContextFormInput, unknown, ContextFormValues>({
    resolver: zodResolver(contextFormSchema),
    defaultValues: {
      label: initialValues?.label ?? "",
      content: initialValues?.content ?? "",
      url: initialValues?.url ?? "",
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (values: ContextFormValues) => {
    await onSubmit({
      label: values.label.trim(),
      content: values.content.trim(),
      url: values.url.trim() || undefined,
    });
    if (!initialValues) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="context-label">Label</Label>
              <Input
                id="context-label"
                {...form.register("label")}
                placeholder="e.g. Budget, Timeline, Stakeholder"
                maxLength={200}
                disabled={isSubmitting}
              />
              {form.formState.errors.label && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.label.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="context-content">Content</Label>
              <Textarea
                id="context-content"
                {...form.register("content")}
                placeholder="Enter the context details..."
                rows={3}
                disabled={isSubmitting}
              />
              {form.formState.errors.content && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.content.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="context-url">
                URL{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="context-url"
                {...form.register("url")}
                placeholder="https://..."
                disabled={isSubmitting}
              />
              {form.formState.errors.url && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.url.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="glass"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
