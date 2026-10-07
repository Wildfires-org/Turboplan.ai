"use client";

import { useCallback } from "react";

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

// Projects with a suggestions run in flight, and those asked to run again
// meanwhile. A request during a run is coalesced into one more run, so items
// saved mid-run still reach the chips without stacking regenerate calls.
const runningSuggestionProjects = new Set<string>();
const queuedSuggestionProjects = new Set<string>();

/**
 * Build the next-step chips from the project's saved data, then refresh the
 * research messages that carry them. On research completion the flag is set
 * before the project revalidates, so the chat never flashes the fallback chips
 * in between. Failures are logged; the current chips then remain.
 */
const generateSuggestions = async (
  projectId: string,
  revalidateProject?: () => Promise<unknown>,
) => {
  if (runningSuggestionProjects.has(projectId)) {
    queuedSuggestionProjects.add(projectId);
    return;
  }
  runningSuggestionProjects.add(projectId);

  const generatingKey = getSuggestionsGeneratingKey(projectId);
  await mutate(generatingKey, true, { revalidate: false });
  try {
    do {
      queuedSuggestionProjects.delete(projectId);
      const request = apiClient.post(
        `/api/ai/research-agent/bootstrapper/project/${projectId}/suggestions/regenerate`,
        {},
      );
      await revalidateProject?.();
      const { error } = await request;
      if (error) {
        console.error(
          "[research-phase] Failed to generate suggestions:",
          error,
        );
      }
      await mutate(getResearchAgentMessagesKey(projectId));
    } while (queuedSuggestionProjects.has(projectId));
  } finally {
    runningSuggestionProjects.delete(projectId);
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
          void generateSuggestions(projectId, mutateProject);
        }
      },
    },
  );

  // Rebuilds the chips after the user saves more items post-completion.
  const regenerateSuggestions = useCallback(async () => {
    if (!projectId) {
      return;
    }
    await generateSuggestions(projectId);
  }, [projectId]);

  return {
    isResearchPhaseCompleted: data?.project?.isResearchPhaseCompleted ?? false,
    completeResearchPhase: trigger,
    isCompleting: isMutating,
    isGeneratingSuggestions,
    regenerateSuggestions,
  };
};
