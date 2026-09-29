"use client";

import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  useEnhanceProjectPrompt,
  useValidateProjectPrompt,
} from "@wildfires-org/turboplan-ai/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
} from "@wildfires-org/turboplan-utils";

import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { useOrganizationsWithOffices } from "@/hooks/use-organizations-with-offices";
import { AppUrls } from "@/lib/nav/urls";
import { DocumentDropzone } from "./document-dropzone";
import { ModeTabs } from "./mode-tabs";
import { OrgOfficeSelector } from "./org-office-selector";
import { ProjectNameField } from "./project-name-field";
import { PromptSection } from "./prompt-section";
import {
  type DialogFormData,
  type DialogFormInput,
  dialogSchema,
} from "./schema";
import { useCreateProject } from "./use-create-project";

interface AddProjectDialogProps {
  organizationSlug: string;
  officeSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  contentClassName?: string;
}

export function AddProjectDialog({
  organizationSlug,
  officeSlug,
  open,
  onOpenChange,
  onSuccess,
  contentClassName,
}: AddProjectDialogProps) {
  const {
    validate: validatePrompt,
    validation: promptValidation,
    reset: resetPromptValidation,
  } = useValidateProjectPrompt();
  const { enhance: enhancePrompt, isEnhancing } = useEnhanceProjectPrompt();
  const [officeSelectorOpen, setOfficeSelectorOpen] = useState(false);
  // Documents selected in the "Already in progress" dropzone. Kept out of the
  // zod form since File objects don't belong in form values.
  const [documents, setDocuments] = useState<File[]>([]);

  // Fetch all orgs+offices the user has access to (for the office selector display)
  const { organizations, isLoading: isLoadingOrgs } =
    useOrganizationsWithOffices();

  // Use props directly as initial form values. The props come from a server
  // component that already validated access, so we can trust them immediately
  // rather than waiting for SWR data to validate.
  const form = useForm<DialogFormInput, unknown, DialogFormData>({
    resolver: zodResolver(dialogSchema),
    defaultValues: {
      prompt: "",
      name: "",
      organizationSlug,
      officeSlug,
      isTemplate: false,
      hasExistingProject: false,
    },
  });

  // Reset form when dialog opens to pick up current org/office props
  useEffect(() => {
    if (open) {
      form.reset({
        prompt: "",
        name: "",
        organizationSlug,
        officeSlug,
        isTemplate: false,
        hasExistingProject: false,
      });
      setDocuments([]);
      resetPromptValidation();
    }
  }, [open, organizationSlug, officeSlug, resetPromptValidation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive display info for the selected office
  const selectedOrgSlug = form.watch("organizationSlug");
  const selectedOfficeSlug = form.watch("officeSlug");
  const promptValue = form.watch("prompt");
  const nameValue = form.watch("name");
  const hasExistingProject = form.watch("hasExistingProject") ?? false;
  const isPromptEmpty = !promptValue || promptValue.trim().length === 0;
  const isNameEmpty = !nameValue || nameValue.trim().length === 0;
  // Whether the primary required field for the current mode is still empty —
  // drives the submit button's disabled/greyed state.
  const isMissingRequiredField = hasExistingProject
    ? !selectedOfficeSlug || isNameEmpty
    : !selectedOfficeSlug || isPromptEmpty;

  const {
    handleSubmit,
    isUploadingDocuments,
    isUpgradeOpen,
    setIsUpgradeOpen,
    upgradeOrgId,
    upgradeOrgName,
    upgradeOrgSlug,
  } = useCreateProject({
    form,
    organizations,
    documents,
    validatePrompt,
    resetPromptValidation,
    onSuccess,
    onOpenChange,
  });

  const handleOfficeSelect = (orgSlug: string, newOfficeSlug: string) => {
    form.setValue("organizationSlug", orgSlug);
    form.setValue("officeSlug", newOfficeSlug);
    setOfficeSelectorOpen(false);
  };

  const handleOrgSelect = (orgSlug: string) => {
    // When selecting an org, pick its first office if available
    const org = organizations.find((o) => o.slug === orgSlug);
    if (org && org.offices.length > 0) {
      form.setValue("organizationSlug", orgSlug);
      form.setValue("officeSlug", org.offices[0].slug);
    }
    setOfficeSelectorOpen(false);
  };

  const handleExistingProjectChange = (checked: boolean) => {
    // Toggling the mode never touches the prompt/name values, so typed text is
    // preserved when the user flips the checkbox back and forth. We only clear
    // the now-irrelevant validation state for the field that stops being required.
    form.setValue("hasExistingProject", checked, { shouldValidate: false });
    if (checked) {
      resetPromptValidation();
      form.clearErrors("prompt");
    } else {
      // Leaving bring-your-own mode: documents no longer apply to the research
      // path, so drop any that were selected.
      setDocuments([]);
      form.clearErrors("name");
    }
  };

  const handleEnhancePrompt = async () => {
    const currentPrompt = form.getValues("prompt")?.trim() ?? "";
    if (!currentPrompt) {
      return;
    }

    const enhanced = await enhancePrompt(
      currentPrompt,
      promptValidation?.missing,
    );
    if (enhanced) {
      form.setValue("prompt", enhanced);
      resetPromptValidation();
    }
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent
          className={cn("max-w-[620px] p-6 sm:p-7", contentClassName)}
        >
          <AlertDialogHeader className="flex flex-row items-center gap-3">
            <div className="flex-1">
              <AlertDialogTitle className="text-xl">
                Add Project
              </AlertDialogTitle>
              <AlertDialogDescription>
                Add a project to this office.
              </AlertDialogDescription>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="glass press flex size-8 shrink-0 items-center justify-center self-start rounded-full text-foreground hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </button>
          </AlertDialogHeader>

          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Mode tabs joined to the content panel below (folder style) */}
            <ModeTabs
              hasExistingProject={hasExistingProject}
              disabled={form.formState.isSubmitting}
              onModeChange={handleExistingProjectChange}
            >
              <OrgOfficeSelector
                organizations={organizations}
                isLoading={isLoadingOrgs}
                open={officeSelectorOpen}
                onOpenChange={setOfficeSelectorOpen}
                selectedOrgSlug={selectedOrgSlug}
                selectedOfficeSlug={selectedOfficeSlug}
                onOfficeSelect={handleOfficeSelect}
                onOrgSelect={handleOrgSelect}
              />

              {hasExistingProject && (
                <>
                  <ProjectNameField form={form} />
                  <DocumentDropzone
                    files={documents}
                    onFilesChange={setDocuments}
                    disabled={form.formState.isSubmitting}
                  />
                </>
              )}

              <PromptSection
                form={form}
                hasExistingProject={hasExistingProject}
                isPromptEmpty={isPromptEmpty}
                isEnhancing={isEnhancing}
                promptValidation={promptValidation}
                onEnhance={handleEnhancePrompt}
                onPromptChange={resetPromptValidation}
              />
            </ModeTabs>

            <AlertDialogFooter className="gap-2 sm:space-x-0">
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
                disabled={
                  form.formState.isSubmitting ||
                  isEnhancing ||
                  isMissingRequiredField
                }
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {isUploadingDocuments
                      ? "Uploading documents…"
                      : "Creating..."}
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {upgradeOrgId ? (
        <UpgradeModal
          isOpen={isUpgradeOpen}
          onOpenChange={setIsUpgradeOpen}
          organizationId={upgradeOrgId}
          organizationName={upgradeOrgName ?? undefined}
          manageMembersHref={
            upgradeOrgSlug
              ? AppUrls.organizationMembers(upgradeOrgSlug)
              : undefined
          }
        />
      ) : null}
    </>
  );
}
