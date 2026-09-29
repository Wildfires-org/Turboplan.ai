"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FolderOpen, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
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
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { refreshOfficeProjects } from "@/lib/cache/projects-swr";
import { AppUrls } from "@/lib/nav/urls";

const apiClient = new ApiClient();

interface CreateProjectFromTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Project;
  organizationSlug: string;
  officeSlug: string;
}

function getDefaultProjectName(templateName: string) {
  const withoutPrefix = templateName.replace(/^Template:\s*/i, "").trim();
  return withoutPrefix || templateName;
}

export function CreateProjectFromTemplateDialog({
  open,
  onOpenChange,
  template,
  organizationSlug,
  officeSlug,
}: CreateProjectFromTemplateDialogProps) {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const defaultName = useMemo(
    () => getDefaultProjectName(template.name),
    [template.name],
  );
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(template.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(template.description ?? "");
    }
  }, [defaultName, open, template.description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await apiClient.post<{
        project: Project;
        submitted: boolean;
        location: {
          organizationSlug: string;
          officeSlug: string;
          projectSlug: string;
        };
      }>(`/api/projects/${template.id}/create-from-template`, {
        organizationSlug,
        officeSlug,
        name: trimmedName,
        description: description.trim() || undefined,
      });

      if (error || !data?.project) {
        throw new Error(error || "Failed to create project from template");
      }

      const targetProjectUrl = AppUrls.project(
        organizationSlug,
        officeSlug,
        data.project.slug,
      );
      toast({
        type: "success",
        description: "Project created. Redirecting...",
      });
      onOpenChange(false);
      router.push(targetProjectUrl);
      void refreshOfficeProjects(organizationSlug, officeSlug);
    } catch (error) {
      console.error("Error creating project from template:", error);
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create project from template",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nameInputRef.current?.focus();
        }}
      >
        <AlertDialogHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-800/15">
            <FolderOpen aria-hidden className="size-5" />
          </div>
          <div className="flex-1">
            <AlertDialogTitle>Use Template</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new project from this template
            </AlertDialogDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Close"
            className="size-8 rounded-full p-0 text-gray-550 hover:bg-slate-900/[0.05] hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            <X className="size-4" />
          </Button>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <AlertDialogFooter className="gap-2 sm:space-x-0">
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
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
