"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import type { ValidatePromptResult } from "@wildfires-org/turboplan-ai/client";
import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { MAX_FILE_SIZE } from "@wildfires-org/turboplan-documents/client";
import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import type {
  CreateProjectClientFormData,
  OrganizationWithOffices,
  Project,
} from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { refreshOfficeProjects } from "@/lib/cache/projects-swr";
import { AppUrls } from "@/lib/nav/urls";
import { registerProjectDocument } from "@/lib/project-documents";
import type { DialogForm, DialogFormData } from "./schema";

// An uploaded document blob paired with the source File, ready to be registered
// against the project once it exists.
type UploadedDocument = { file: File; url: string; pathname: string };

const apiClient = new ApiClient();

interface UseCreateProjectParams {
  form: DialogForm;
  organizations: OrganizationWithOffices[];
  // Files selected in the bring-your-own-project dropzone. Uploaded and
  // registered as project documents on submit; empty for the research path.
  documents: File[];
  validatePrompt: (prompt: string) => Promise<ValidatePromptResult | null>;
  resetPromptValidation: () => void;
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
}

export function useCreateProject({
  form,
  organizations,
  documents,
  validatePrompt,
  resetPromptValidation,
  onSuccess,
  onOpenChange,
}: UseCreateProjectParams) {
  const router = useRouter();
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  // True while the selected documents are being uploaded to storage — drives
  // the submit button's "Uploading documents…" label.
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  // Same upload mechanism as the chat input (PUT to R2). Capped at the shared
  // project-document limit so the upload hook, dropzone validation, and server
  // schema all enforce the same size. Errors are handled per-file below, so no
  // onError toast here.
  const { upload: uploadDocument } = useFileUpload({
    maxSize: MAX_FILE_SIZE,
  });
  // UUID of the org the (blocked) create was attempted against — drives the
  // checkout the upgrade modal kicks off. Captured at the 403 so it stays
  // correct even if the user later changes the office selector.
  const [upgradeOrgId, setUpgradeOrgId] = useState<string | null>(null);
  // Display name of the org the blocked create targeted — shown in the upgrade
  // modal's org-binding disclosure. Captured alongside the id at the 403.
  const [upgradeOrgName, setUpgradeOrgName] = useState<string | null>(null);
  // Slug of the org the blocked create targeted — used to build the "Manage
  // members" link in the upgrade modal. Captured alongside the id at the 403.
  const [upgradeOrgSlug, setUpgradeOrgSlug] = useState<string | null>(null);

  const handleSubmit = async (data: DialogFormData) => {
    try {
      resetPromptValidation();
      const trimmedPrompt = data.prompt?.trim() ?? "";
      const hasExisting = data.hasExistingProject ?? false;

      let payload: CreateProjectClientFormData;
      // Blobs uploaded up-front for the bring-your-own-project path, registered
      // against the project once it's created.
      let uploadedDocuments: UploadedDocument[] = [];

      if (hasExisting) {
        // Bring-your-own-project: skip AI prompt validation and auto-naming.
        // The user supplies the name; the prompt is optional context.
        const trimmedName = data.name?.trim() ?? "";
        if (!trimmedName) {
          form.setError("name", { message: "Project name is required" });
          return;
        }

        payload = {
          ...data,
          name: trimmedName,
          hasExistingProject: true,
          // Send the optional prompt only when the user typed something —
          // `undefined` is dropped from the JSON body.
          prompt: trimmedPrompt || undefined,
        };

        // Upload any selected documents before creating the project. Failed
        // uploads are reported and skipped; the flow continues with the rest.
        if (documents.length > 0) {
          setIsUploadingDocuments(true);
          try {
            const results = await Promise.all(
              documents.map(async (file): Promise<UploadedDocument | null> => {
                try {
                  const result = await uploadDocument(file);
                  return {
                    file,
                    url: result.url,
                    pathname: result.pathname,
                  };
                } catch (uploadError) {
                  console.error(
                    "Failed to upload document:",
                    file.name,
                    uploadError,
                  );
                  return null;
                }
              }),
            );
            uploadedDocuments = results.filter(
              (result): result is UploadedDocument => result !== null,
            );
          } finally {
            setIsUploadingDocuments(false);
          }

          const failedNames = documents
            .filter((file) => !uploadedDocuments.some((u) => u.file === file))
            .map((file) => file.name);
          if (failedNames.length > 0) {
            toast({
              type: "error",
              description: `Failed to upload: ${failedNames.join(", ")}`,
            });
          }
        }
      } else {
        if (!trimmedPrompt) {
          form.setError("prompt", {
            message: "Project setup prompt is required",
          });
          return;
        }

        // Validate prompt with AI before generating name
        const validation = await validatePrompt(trimmedPrompt);
        if (validation && !validation.valid) {
          return;
        }

        // Generate project name from AI based on the validated prompt
        const { data: nameData, error: nameError } = await apiClient.post<{
          projectTitle: string;
        }>("/generate-titles", { description: trimmedPrompt });

        if (nameError || !nameData?.projectTitle) {
          throw new Error(
            nameError || "Failed to generate project name. Please try again.",
          );
        }

        payload = {
          ...data,
          name: nameData.projectTitle,
          prompt: trimmedPrompt,
        };
      }

      // NOTE: If this create is blocked below (e.g. over quota), any documents
      // uploaded above are orphaned in storage. Acceptable trade-off — we upload
      // first so the AI can read them immediately after the redirect.
      const {
        data: createdProject,
        error,
        code,
      } = await apiClient.post<Project & { initialChatId: string }>(
        "/api/projects",
        payload,
      );

      // The org's plan has reached its active-project limit — open the full
      // upgrade/billing modal (plan picker + checkout) for the targeted org.
      // The org UUID is already in scope via the loaded org list, so we resolve
      // it from the submitted slug without an extra network round-trip.
      if (code === "UPGRADE_REQUIRED") {
        const targetOrg = organizations.find(
          (o) => o.slug === payload.organizationSlug,
        );
        if (targetOrg) {
          setUpgradeOrgId(targetOrg.id);
          setUpgradeOrgName(targetOrg.name);
          setUpgradeOrgSlug(targetOrg.slug);
          setIsUpgradeOpen(true);
          // Close the create dialog so the upgrade modal isn't stacked behind it.
          onOpenChange(false);
        } else {
          // Org id couldn't be resolved (list not loaded) — fall back to the
          // billing settings link so the user still has a path forward.
          toast({
            type: "error",
            description:
              "This organization reached its plan limit for projects.",
            action: {
              label: "Upgrade",
              href: AppUrls.organizationBilling(payload.organizationSlug),
            },
          });
        }
        return;
      }

      if (error) {
        throw new Error(error || "Failed to create project");
      }

      // Validate the response before any success UI — a malformed response
      // must surface as a single error, not a success toast followed by a
      // stranded user with no redirect.
      if (!createdProject?.slug || !createdProject?.initialChatId) {
        throw new Error(
          "Project creation response missing slug or initialChatId",
        );
      }

      toast({ type: "success", description: "Project created successfully" });
      form.reset();

      // Use form values (may differ from props if user changed office)
      await refreshOfficeProjects(payload.organizationSlug, payload.officeSlug);

      onSuccess();
      onOpenChange(false);

      const chatUrl = AppUrls.projectChatById(
        payload.organizationSlug,
        payload.officeSlug,
        createdProject.slug,
        createdProject.initialChatId,
      );

      if (hasExisting) {
        // Register each uploaded blob as a project document (best-effort — a
        // failure here shouldn't block the redirect).
        let registeredCount = 0;
        for (const upload of uploadedDocuments) {
          const registered = await registerProjectDocument(apiClient, {
            projectId: createdProject.id,
            file: upload.file,
            url: upload.url,
            pathname: upload.pathname,
          });
          if (registered) {
            registeredCount += 1;
          } else {
            console.error(
              "Failed to register project document:",
              upload.file.name,
            );
          }
        }

        if (registeredCount > 0) {
          // Documents are in the project library — auto-send a message so the
          // AI immediately reads them and reports back. The user's optional
          // setup prompt rides along so that context reaches the model on the
          // first turn instead of being silently dropped.
          const documentsBlurb =
            "I've uploaded my project documents — please read them and tell me what you learned about the project.";
          const initialMessageContent = trimmedPrompt
            ? `${documentsBlurb}\n\nAdditional context about the project: ${trimmedPrompt}`
            : documentsBlurb;
          router.push(
            `${chatUrl}?initialMessageContent=${encodeURIComponent(initialMessageContent)}`,
          );
          return;
        }

        // No documents registered: pre-fill (without auto-sending) an invitation
        // to upload existing documents so the AI can learn the project from them.
        const prefillContent =
          "I have documents about my project — I'll upload them here so you can learn about it.";
        router.push(
          `${chatUrl}?prefillContent=${encodeURIComponent(prefillContent)}`,
        );
        return;
      }

      // Trigger research agent (fire-and-forget — don't block redirect)
      if (trimmedPrompt && isResearchAgentPackageEnabled()) {
        apiClient
          .post(
            `/api/ai/research-agent/bootstrapper/project/${createdProject.id}/start`,
            {},
          )
          .catch((err) =>
            console.error("[ResearchAgent] Failed to trigger:", err),
          );
      }

      router.push(
        trimmedPrompt
          ? `${chatUrl}?initialMessageContent=${encodeURIComponent(trimmedPrompt)}`
          : chatUrl,
      );
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to create project",
      });
    }
  };

  return {
    handleSubmit,
    isUploadingDocuments,
    isUpgradeOpen,
    setIsUpgradeOpen,
    upgradeOrgId,
    upgradeOrgName,
    upgradeOrgSlug,
  };
}
