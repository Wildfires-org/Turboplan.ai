"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

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
import {
  type EditOfficeFormData,
  editOfficeSchema,
  type Office,
  OfficeStatus,
} from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { AppUrls } from "@/lib/nav/urls";
import { DocumentBrandingFields } from "./document-branding-fields";

const apiClient = new ApiClient();

interface EditOfficeDialogProps {
  office: Office;
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOfficeDialog({
  office,
  organizationSlug,
  open,
  onOpenChange,
  onSuccess,
}: EditOfficeDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<EditOfficeFormData>({
    resolver: zodResolver(editOfficeSchema),
    defaultValues: {
      name: office.name,
      description: office.description || "",
      status: office.status as OfficeStatus,
      documentLogoUrl: office.documentLogoUrl || "",
      documentFooterText: office.documentFooterText || "",
      documentFooterNote: office.documentFooterNote || "",
      documentFooterLogoUrl: office.documentFooterLogoUrl || "",
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const onSubmit = handleSubmit(async (data) => {
    setIsLoading(true);

    try {
      const { data: response, error } = await apiClient.put<{ office: Office }>(
        `/api/offices/${office.id}`,
        data,
      );

      if (error) {
        throw new Error(error || "Failed to update office");
      }

      toast({
        type: "success",
        description: "Office updated successfully!",
      });

      onSuccess();
      onOpenChange(false);

      // If slug changed, navigate to new URL
      const updatedOffice = response?.office;
      if (updatedOffice && updatedOffice.slug !== office.slug) {
        router.push(AppUrls.office(organizationSlug, updatedOffice.slug));
      }
    } catch (error) {
      console.error("Error updating office:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to update office",
      });
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] max-w-[480px] overflow-y-auto p-6 sm:p-7">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Edit aria-hidden className="size-5 text-brand-800" />
            Edit Office
          </AlertDialogTitle>
          <AlertDialogDescription>
            Update office details. Changes will be visible across your
            workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <DocumentBrandingFields
            textField={register("documentFooterText")}
            noteField={register("documentFooterNote")}
            onDocumentLogoChange={(url) =>
              setValue("documentLogoUrl", url ?? "")
            }
            onFooterLogoChange={(url) =>
              setValue("documentFooterLogoUrl", url ?? "")
            }
            initialDocumentLogoUrl={office.documentLogoUrl}
            initialFooterLogoUrl={office.documentFooterLogoUrl}
            textError={errors.documentFooterText?.message}
            noteError={errors.documentFooterNote?.message}
            disabled={isLoading}
          />

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-error-700">*</span>
            </Label>
            <Input id="name" placeholder="Office name" {...register("name")} />
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
              placeholder="Brief description of the office..."
              rows={3}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-error-700">
                {errors.description.message}
              </p>
            )}
            <p className="text-xs tabular-nums text-gray-550">
              {((watch("description") as string) || "").length}/500 characters
            </p>
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
