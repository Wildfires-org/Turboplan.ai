"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
  Textarea,
} from "@wildfires-org/turboplan-utils";

import { toast } from "@/components/toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddTimelineEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { title: string; description?: string }) => Promise<void>;
}

export function AddTimelineEntryDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddTimelineEntryDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const handleSubmit = async (data: FormData) => {
    try {
      await onSubmit({
        title: data.title,
        description: data.description || undefined,
      });

      toast({ type: "success", description: "Timeline entry added" });
      form.reset();
      onOpenChange(false);
    } catch {
      toast({ type: "error", description: "Failed to add timeline entry" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="flex flex-row items-start justify-between">
          <div>
            <AlertDialogTitle>Add Timeline Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new entry on the project timeline.
            </AlertDialogDescription>
          </div>
          <Button
            variant="glass"
            size="icon"
            aria-label="Close"
            className="size-8 shrink-0 text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </AlertDialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Public Scoping Period"
              {...form.register("title")}
              disabled={form.formState.isSubmitting}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-error-700">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description..."
              rows={3}
              {...form.register("description")}
              disabled={form.formState.isSubmitting}
            />
          </div>

          <AlertDialogFooter className="gap-2">
            <Button
              type="button"
              variant="glass"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Entry"
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
