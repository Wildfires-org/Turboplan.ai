"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@wildfires-org/turboplan-utils";
import type { ProjectWithCoverImage } from "@wildfires-org/turboplan-workspace/types";

import { useDeleteTemplate } from "@/hooks/use-delete-template";
import { DESTRUCTIVE_BUTTON_CLASS } from "@/lib/glass";

interface DeleteTemplateDialogProps {
  template: ProjectWithCoverImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
  onSuccess,
}: DeleteTemplateDialogProps) {
  const { deleteTemplate, isDeleting } = useDeleteTemplate(template.id);

  const handleDelete = async () => {
    try {
      await deleteTemplate();
      toast.success("Template deleted successfully");
      onSuccess();
    } catch {
      toast.error("Failed to delete template");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{template.name}
            &rdquo;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <Button
            variant="glass"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className={DESTRUCTIVE_BUTTON_CLASS}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
