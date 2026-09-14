"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import type { Project } from "@wildfires-org/turboplan-db/types";

type ProjectWithRelations = {
  project: Project;
};

const apiClient = new ApiClient();

const completeResearchFetcher = async (
  url: string,
): Promise<{ success: boolean }> => {
  const { data, error } = await apiClient.post<{ success: boolean }>(url, {});

  if (error) {
    throw new Error(error || "Failed to complete research phase");
  }

  return data as { success: boolean };
};

export const useResearchPhase = (projectId: string | null) => {
  const projectKey = projectId ? `/api/projects/${projectId}` : null;

  const { data, mutate: mutateProject } = useSWR<ProjectWithRelations>(
    projectKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { trigger, isMutating } = useSWRMutation(
    projectId ? `/api/projects/${projectId}/complete-research-phase` : null,
    completeResearchFetcher,
    {
      onSuccess: () => {
        mutateProject();
      },
    },
  );

  return {
    isResearchPhaseCompleted: data?.project?.isResearchPhaseCompleted ?? false,
    completeResearchPhase: trigger,
    isCompleting: isMutating,
  };
};
