"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  Eye,
  Leaf,
  Loader2,
  PlusCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import useSWRMutation from "swr/mutation";
import { useEventListener } from "usehooks-ts";

import { postFetcher, putFetcher } from "@wildfires-org/turboplan-api-client";
import { getActivePromptVersion } from "@wildfires-org/turboplan-db/utils";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@wildfires-org/turboplan-utils";

import { usePrompt, usePromptVariablesFor } from "../../hooks/use-prompts";
import { VariablePicker } from "./variable-picker";

interface PromptEditorProps {
  name: string;
  selectedVersionNumber?: number | null;
}

export function PromptEditor({
  name,
  selectedVersionNumber,
}: PromptEditorProps) {
  const { prompt, isLoading, error, refreshPrompt } = usePrompt(name);
  const [content, setContent] = useState("");
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");

  const { trigger: triggerSave, isMutating: isSaving } = useSWRMutation(
    `/api/admin/prompts/${name}`,
    putFetcher,
  );

  const { trigger: triggerCreateVersion, isMutating: isCreatingVersion } =
    useSWRMutation(`/api/admin/prompts/${name}/versions`, postFetcher);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeVersion = prompt ? getActivePromptVersion(prompt.versions) : null;

  const displayedVersion = useMemo(() => {
    if (selectedVersionNumber != null && prompt?.versions) {
      const found = prompt.versions.find(
        (v) => v.version === selectedVersionNumber,
      );
      if (found) return found;
    }
    return activeVersion;
  }, [selectedVersionNumber, prompt?.versions, activeVersion]);

  const isViewingInactive =
    displayedVersion != null && !displayedVersion.isActive;
  const isHardcoded = displayedVersion?.isHardcoded === true;

  const { variables: applicableVariables } = usePromptVariablesFor(name);

  const missingVariables = useMemo(() => {
    if (applicableVariables.length === 0) return [];
    const presentInContent = new Set<string>();
    const regex = /\{\{(\w+)\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      presentInContent.add(match[1]);
    }
    return applicableVariables
      .map((v) => v.name)
      .filter((name) => !presentInContent.has(name));
  }, [applicableVariables, content]);

  const hasMissingVariables = missingVariables.length > 0;

  const hasChanges = displayedVersion
    ? content !== displayedVersion.content
    : false;

  useEffect(() => {
    if (displayedVersion) {
      setContent(displayedVersion.content);
    }
  }, [displayedVersion?.version, displayedVersion?.isActive]);

  useEventListener("beforeunload", (e) => {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent =
      content.substring(0, start) + variable + content.substring(end);

    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + variable.length,
        start + variable.length,
      );
    }, 0);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    try {
      await triggerSave({
        content,
        notes: null,
        ...(displayedVersion && { version: displayedVersion.version }),
      });
      toast.success("Prompt saved successfully");
      await refreshPrompt();
    } catch {
      toast.error("Failed to save prompt");
    }
  };

  const handleCreateVersion = async () => {
    if (!content.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    try {
      await triggerCreateVersion({
        content,
        notes: versionNotes.trim() || null,
      });
      toast.success("New version created");
      setVersionNotes("");
      setIsVersionDialogOpen(false);
      await refreshPrompt();
    } catch {
      toast.error("Failed to create version");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !prompt) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">{error || "Prompt not found"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4 space-y-3">
          <div>
            <CardTitle>{prompt.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {prompt.description || "No description"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isHardcoded && (
              <VariablePicker
                promptName={name}
                onSelect={handleInsertVariable}
                disabled={isSaving || isCreatingVersion}
                content={content}
              />
            )}
            <Button
              variant="outline"
              onClick={() => setIsVersionDialogOpen(true)}
              disabled={
                isSaving ||
                isCreatingVersion ||
                !content.trim() ||
                hasMissingVariables
              }
              className="gap-2"
            >
              {isCreatingVersion ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlusCircle className="size-4" />
              )}
              Create Version
            </Button>
            {!isHardcoded && (
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || hasMissingVariables}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
            )}
          </div>
          {isViewingInactive && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2">
              <Eye className="size-4 shrink-0 text-blue-500" />
              <span>
                Viewing version {displayedVersion.version}. This is not the
                active version. You can edit and save changes, or rollback from
                the version history to make it active.
              </span>
            </div>
          )}
          {isHardcoded && !isViewingInactive && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <Leaf className="size-4 shrink-0" />
              This is a hardcoded version and cannot be edited. Create a new
              version to make changes.
            </div>
          )}
          {hasChanges && !isHardcoded && (
            <p className="text-sm text-amber-500 mt-2">
              You have unsaved changes
            </p>
          )}
          {hasMissingVariables && !isHardcoded && (
            <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span>
                Missing required variables:{" "}
                {missingVariables.map((v, i) => (
                  <span key={v}>
                    {i > 0 && ", "}
                    <code className="font-mono bg-amber-500/10 px-1 rounded">
                      {`{{${v}}}`}
                    </code>
                  </span>
                ))}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Prompt Content</Label>
            <Textarea
              ref={textareaRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter prompt content..."
              className="min-h-[400px] font-mono text-sm"
              disabled={isSaving || isHardcoded}
              readOnly={isHardcoded}
            />
            <p className="text-xs text-muted-foreground">
              Use {`{{variableName}}`} syntax for variables. Protected sections
              will be shown as read-only.
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            Current version: {displayedVersion?.version || 0} | Last updated:{" "}
            {displayedVersion?.createdAt
              ? new Date(displayedVersion.createdAt).toLocaleString()
              : "Never"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isVersionDialogOpen} onOpenChange={setIsVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="version-notes">Version Notes (optional)</Label>
            <Textarea
              id="version-notes"
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              placeholder="Describe what changed in this version..."
              className="min-h-[80px]"
              disabled={isCreatingVersion}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsVersionDialogOpen(false)}
              disabled={isCreatingVersion}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateVersion}
              disabled={isCreatingVersion}
              className="gap-2"
            >
              {isCreatingVersion && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
