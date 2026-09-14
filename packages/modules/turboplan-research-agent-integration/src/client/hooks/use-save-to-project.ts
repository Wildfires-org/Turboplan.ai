"use client";

import { mutate } from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

const apiClient = new ApiClient();

type ArtifactType =
  | "documents"
  | "milestones"
  | "fields"
  | "context"
  | "timeline";

type SaveToProjectByIndexArgs = {
  itemIndices: number[];
};

type SaveToProjectMilestoneArgs = {
  selections: Array<{
    milestoneIndex: number;
    taskIndices: number[];
  }>;
};

type SaveToProjectArgs = SaveToProjectByIndexArgs | SaveToProjectMilestoneArgs;

type SaveToProjectResponse = {
  success: boolean;
  savedCount: number;
  skipped?: string[];
};

async function saveToProjectFetcher(
  url: string,
  { arg }: { arg: SaveToProjectArgs },
): Promise<SaveToProjectResponse> {
  const { data, error } = await apiClient.post<SaveToProjectResponse>(url, arg);

  if (error) {
    throw new Error(error || "Failed to save to project");
  }

  return data as SaveToProjectResponse;
}

export function useSaveToProject(
  messageId: string,
  artifactType: ArtifactType,
  projectId?: string,
) {
  const projectDocumentsKey = projectId
    ? `/api/project-documents?projectId=${encodeURIComponent(projectId)}`
    : null;

  const { trigger, isMutating, error } = useSWRMutation(
    projectId
      ? `/api/ai/research-agent/bootstrapper/project/${projectId}/messages/${messageId}/save-${artifactType}`
      : null,
    saveToProjectFetcher,
  );

  const saveWithRevalidation = async (arg: SaveToProjectArgs) => {
    const result = await trigger(arg);

    if (
      result?.success &&
      artifactType === "documents" &&
      projectDocumentsKey
    ) {
      await mutate(projectDocumentsKey);
    }

    return result;
  };

  return {
    save: saveWithRevalidation,
    isSaving: isMutating,
    error,
  };
}
