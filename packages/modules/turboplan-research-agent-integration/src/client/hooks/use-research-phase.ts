"use client";

import useSWR, { mutate } from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import type { Project } from "@wildfires-org/turboplan-db/types";

import { getResearchAgentMessagesKey } from "./use-research-agent-messages";

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

// Client-only SWR key used as shared state: every useResearchPhase instance
// (research panel footer, chat view) sees the same in-flight flag.
const getSuggestionsGeneratingKey = (projectId: string) =>
  `research-phase/${projectId}/generating-suggestions`;

/**
 * Build the next-step chips from the project's saved data, then refresh the
 * research messages that carry them. The flag is set before the project
 * revalidates, so the chat never flashes the fallback chips in between.
 * Failures are logged; the fallback chips then remain.
 */
const generateSuggestionsAfterResearch = async (
  projectId: string,
  revalidateProject: () => Promise<unknown>,
) => {
  const generatingKey = getSuggestionsGeneratingKey(projectId);
  await mutate(generatingKey, true, { revalidate: false });
  try {
    const request = apiClient.post(
      `/api/ai/research-agent/bootstrapper/project/${projectId}/suggestions/regenerate`,
      {},
    );
    await revalidateProject();
    const { error } = await request;
    if (error) {
      console.error("[research-phase] Failed to generate suggestions:", error);
    }
    await mutate(getResearchAgentMessagesKey(projectId));
  } finally {
    await mutate(generatingKey, false, { revalidate: false });
  }
};

export const useResearchPhase = (projectId: string | null) => {
  const projectKey = projectId ? `/api/projects/${projectId}` : null;

  const { data, mutate: mutateProject } = useSWR<ProjectWithRelations>(
    projectKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: isGeneratingSuggestions = false } = useSWR<boolean>(
    projectId ? getSuggestionsGeneratingKey(projectId) : null,
    null,
    {
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const { trigger, isMutating } = useSWRMutation(
    projectId ? `/api/projects/${projectId}/complete-research-phase` : null,
    completeResearchFetcher,
    {
      onSuccess: () => {
        // The trigger only exists with a projectId. Chips become visible now,
        // so build them from what the user saved.
        if (projectId) {
          void generateSuggestionsAfterResearch(projectId, mutateProject);
        }
      },
    },
  );

  return {
    isResearchPhaseCompleted: data?.project?.isResearchPhaseCompleted ?? false,
    completeResearchPhase: trigger,
    isCompleting: isMutating,
    isGeneratingSuggestions,
  };
};
