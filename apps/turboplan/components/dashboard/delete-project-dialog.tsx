"use client";

import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { useSoftDeleteProject } from "@/hooks/use-soft-delete-project";
import { DESTRUCTIVE_BUTTON_CLASS } from "@/lib/glass";

interface DeleteProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: DeleteProjectDialogProps) {
  const { softDeleteProject, isDeleting } = useSoftDeleteProject(project.id);

  const handleDelete = async () => {
    try {
      await softDeleteProject();
      toast({
        type: "success",
        description: "Project deleted successfully!",
      });
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({
        type: "error",
        description: "Failed to delete project",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{project.name}&rdquo;? You
            can restore it later if needed.
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
