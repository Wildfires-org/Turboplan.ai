"use client";

import { useEffect, useState } from "react";

import { Eye, EyeOff, Loader2 } from "lucide-react";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { OwnershipStatus } from "@wildfires-org/turboplan-db/types";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { useIsCitizen } from "@/hooks/use-citizen-mode";

const apiClient = new ApiClient();

interface PublicVisibilityButtonProps {
  project: Project;
  userId?: string;
  onVisibilityChange?: (isPublic: boolean) => void;
}

export function PublicVisibilityDropdown({
  project,
  userId,
  onVisibilityChange,
}: PublicVisibilityButtonProps) {
  const [isPublic, setIsPublic] = useState(project.isPublic);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    setIsPublic(project.isPublic);
  }, [project.isPublic]);

  const isCitizen = useIsCitizen();

  // Check if user has MANAGE_MEMBERS permission (owner-level access)
  const { hasPermission, isChecking } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: project.id,
    action: Action.MANAGE_MEMBERS,
  });

  // Citizens should never see privacy controls regardless of their role
  if (isCitizen) {
    return null;
  }

  // Hide visibility toggle for submitted/rejected projects (pending review)
  if (
    project.ownershipStatus === OwnershipStatus.SUBMITTED ||
    project.ownershipStatus === OwnershipStatus.REJECTED
  ) {
    return null;
  }

  // Don't render if user doesn't have permission or still checking
  if (isChecking || !hasPermission) {
    return null;
  }

  const handleClick = () => {
    // Toggle visibility
    const newVisibility = !isPublic;
    setPendingVisibility(newVisibility);
    setConfirmDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (pendingVisibility === null) return;

    setIsUpdating(true);
    setConfirmDialogOpen(false);

    try {
      const { error } = await apiClient.put(`/api/projects/${project.id}`, {
        isPublic: pendingVisibility,
      });

      if (error) {
        throw new Error(error);
      }

      setIsPublic(pendingVisibility);
      onVisibilityChange?.(pendingVisibility);

      toast({
        type: "success",
        description: pendingVisibility
          ? "Project is now public"
          : "Project is now private",
      });
    } catch (error) {
      console.error("Failed to update visibility:", error);
      toast({
        type: "error",
        description: "Failed to update project visibility",
      });
    } finally {
      setIsUpdating(false);
      setPendingVisibility(null);
    }
  };

  const handleCancel = () => {
    setConfirmDialogOpen(false);
    setPendingVisibility(null);
  };

  return (
    <>
      {/* Gradient border wrapper for published state */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "relative rounded-md p-[3px]",
                isPublic
                  ? "bg-gradient-to-r from-[#49F3A1] via-[#2CBCFF] to-[#FFDF2C]"
                  : "bg-transparent",
              )}
              style={
                isPublic
                  ? {
                      background:
                        "linear-gradient(115deg, #49F3A1 0.42%, #2CBCFF 53.83%, #FFDF2C 109.33%)",
                    }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={handleClick}
                disabled={isUpdating}
                aria-label={
                  isPublic ? "Make project private" : "Make project public"
                }
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-[5px] transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isPublic
                    ? "bg-black text-white hover:bg-black/90"
                    : "bg-neutral-100 text-black hover:bg-neutral-200",
                )}
              >
                {isUpdating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isPublic ? (
                  <Eye className="size-3.5" />
                ) : (
                  <EyeOff className="size-3.5" />
                )}
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isPublic ? "Make project private" : "Make project public"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingVisibility
                ? "Make Project Public?"
                : "Make Project Private?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingVisibility
                ? "Anyone with the link will be able to view this project's documents, tasks, and maps in read-only mode. Chat will remain private and only accessible to project members."
                : "Only users with explicit access will be able to view this project. Existing public links will stop working."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {pendingVisibility ? "Make Public" : "Make Private"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
