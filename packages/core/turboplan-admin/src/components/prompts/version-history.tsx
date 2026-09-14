"use client";

import { useState } from "react";

import { Clock, Eye, Leaf, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import useSWRMutation from "swr/mutation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import type { PromptVersion } from "@wildfires-org/turboplan-db/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  ScrollArea,
} from "@wildfires-org/turboplan-utils";

import { VersionDiff } from "./version-diff";

interface VersionHistoryProps {
  promptName: string;
  versions: PromptVersion[];
  selectedVersionNumber: number | null;
  onSelectVersion: (versionNumber: number) => void;
  onRollback: () => void;
}

const apiClient = new ApiClient();

export function VersionHistory({
  promptName,
  versions,
  selectedVersionNumber,
  onSelectVersion,
  onRollback,
}: VersionHistoryProps) {
  const [diffVersion, setDiffVersion] = useState<PromptVersion | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<PromptVersion | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<PromptVersion | null>(null);

  const { trigger: triggerRollback, isMutating: isRollingBack } =
    useSWRMutation(
      `/api/admin/prompts/${promptName}/rollback`,
      (url, { arg }: { arg: { version: number } }) =>
        apiClient.post(url, { version: arg.version }),
    );

  const { trigger: triggerDelete, isMutating: isDeleting } = useSWRMutation(
    deleteTarget
      ? `/api/admin/prompts/${promptName}/versions/${deleteTarget.version}`
      : null,
    (url) => apiClient.delete(url),
  );

  const activeVersion = versions.find((v) => v.isActive);
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  const handleRollback = async () => {
    if (!rollbackTarget) return;

    try {
      await triggerRollback({ version: rollbackTarget.version });
      toast.success(`Rolled back to version ${rollbackTarget.version}`);
      setRollbackTarget(null);
      onRollback();
    } catch (error) {
      console.error("Rollback failed:", error);
      toast.error("Failed to rollback");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await triggerDelete();
      toast.success(`Deleted version ${deleteTarget.version}`);
      setDeleteTarget(null);
      onRollback();
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete version");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="space-y-1 p-4 pt-0">
              {sortedVersions.map((version) => {
                const isSelected = selectedVersionNumber === version.version;

                return (
                  <div
                    key={version.version}
                    className={cn(
                      "p-3 rounded-md border cursor-pointer transition-colors",
                      version.isActive &&
                        !isSelected &&
                        "border-blue-500/30 bg-blue-500/10",
                      !version.isActive &&
                        !isSelected &&
                        "border-transparent hover:bg-muted/50",
                      isSelected && "border-border bg-muted",
                    )}
                    onClick={() => onSelectVersion(version.version)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{version.version}</span>
                        {version.isActive && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                        {version.isHardcoded && (
                          <Badge
                            variant="outline"
                            className="text-xs gap-1"
                            title="This version is hardcoded in the codebase and cannot be deleted"
                          >
                            <Leaf className="size-3" />
                            Hardcoded
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDiffVersion(version);
                          }}
                          title="View diff"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        {!version.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRollbackTarget(version);
                            }}
                            title="Rollback to this version"
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        )}
                        {!version.isActive &&
                          !version.isHardcoded &&
                          versions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(version);
                              }}
                              title="Delete this version"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString()}
                    </div>
                    {version.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {version.notes}
                      </p>
                    )}
                  </div>
                );
              })}
              {versions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No versions yet
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Diff Dialog */}
      {diffVersion && activeVersion && (
        <VersionDiff
          open={!!diffVersion}
          onOpenChange={(open) => !open && setDiffVersion(null)}
          currentVersion={activeVersion}
          compareVersion={diffVersion}
        />
      )}

      {/* Rollback Confirmation */}
      <AlertDialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Rollback to version {rollbackTarget?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will set version {rollbackTarget?.version} as the active
              version. The current version will be preserved in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={isRollingBack}
            >
              {isRollingBack ? "Rolling back..." : "Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete version {deleteTarget?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove version {deleteTarget?.version} from
              the history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
    </>
  );
}
