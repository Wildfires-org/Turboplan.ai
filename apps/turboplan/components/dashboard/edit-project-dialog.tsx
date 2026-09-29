"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@wildfires-org/turboplan-utils";
import {
  type EditProjectFormData,
  editProjectSchema,
  type Project,
  ProjectStatus,
} from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { AppUrls } from "@/lib/nav/urls";

type EditProjectFormInput = z.input<typeof editProjectSchema>;

const apiClient = new ApiClient();

interface EditProjectDialogProps {
  project: Project;
  organizationSlug: string;
  officeSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditProjectDialog({
  project,
  organizationSlug,
  officeSlug,
  open,
  onOpenChange,
  onSuccess,
}: EditProjectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<EditProjectFormInput, unknown, EditProjectFormData>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description || "",
      status: project.status as ProjectStatus,
      startDate: new Date(project.startDate ?? new Date()),
      endDate: new Date(project.endDate ?? new Date()),
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const formatDateForInput = (date: Date | undefined | null): string => {
    if (!date) return "";
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [dateError, setDateError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (data) => {
    setDateError(null);

    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      setDateError("End date must be after start date");
      return;
    }

    setIsLoading(true);

    try {
      const { data: response, error } = await apiClient.put<{
        project: Project;
      }>(`/api/projects/${project.id}`, data);

      if (error) {
        throw new Error(error || "Failed to update project");
      }

      toast({
        type: "success",
        description: "Project updated successfully!",
      });

      onSuccess();
      onOpenChange(false);

      // If slug changed, navigate to new URL
      const updatedProject = response?.project;
      if (updatedProject && updatedProject.slug !== project.slug) {
        const newUrl = project.isTemplate
          ? AppUrls.template(organizationSlug, officeSlug, updatedProject.slug)
          : AppUrls.project(organizationSlug, officeSlug, updatedProject.slug);
        router.push(newUrl);
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to update project",
      });
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[480px] p-6 sm:p-7">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Edit aria-hidden className="size-5 text-brand-800" />
            {project.isTemplate ? "Edit Template" : "Edit Project"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {project.isTemplate
              ? "Update template details. Changes will be visible across your workspace."
              : "Update project details. Changes will be visible across your workspace."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-error-700">*</span>
            </Label>
            <Input id="name" placeholder="Project name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-error-700">{errors.name.message}</p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Brief description of the project..."
              rows={3}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-error-700">
                {errors.description.message}
              </p>
            )}
            <p className="text-xs tabular-nums text-gray-550">
              {((watch("description") as string) || "").length}/1000 characters
            </p>
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium">
                Start Date <span className="text-error-700">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                required
                value={formatDateForInput(
                  watch("startDate") as Date | undefined,
                )}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setValue("startDate", new Date(`${val}T00:00:00`));
                  setDateError(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium">
                End Date <span className="text-error-700">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                required
                value={formatDateForInput(watch("endDate") as Date | undefined)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setValue("endDate", new Date(`${val}T00:00:00`));
                  setDateError(null);
                }}
              />
            </div>
          </div>
          {dateError && <p className="text-xs text-error-700">{dateError}</p>}

          {/* Status Field */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              Status
            </Label>
            <Select
              value={watch("status") as string}
              onValueChange={(value) =>
                setValue("status", value as EditProjectFormData["status"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-xs text-error-700">{errors.status.message}</p>
            )}
          </div>

          <AlertDialogFooter className="gap-2 pt-2 sm:space-x-0">
            <Button
              type="button"
              variant="glass"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
