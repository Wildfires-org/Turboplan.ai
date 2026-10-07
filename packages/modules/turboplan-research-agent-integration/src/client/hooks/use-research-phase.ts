"use client";

import { useCallback } from "react";

import useSWR, { mutate } from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import type { Project } from "@wildfires-org/turboplan-db/types";

import type { SuggestionItem, SuggestionStreamEvent } from "../../types";
import { readNdjson } from "../read-ndjson";
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

// Client-only SWR keys used as shared state: every useResearchPhase instance
// (research panel footer, chat view) sees the same in-flight flag and the
// chips streamed so far (null when no pass is streaming).
const getSuggestionsGeneratingKey = (projectId: string) =>
  `research-phase/${projectId}/generating-suggestions`;
const getStreamingSuggestionsKey = (projectId: string) =>
  `research-phase/${projectId}/streaming-suggestions`;

const SHARED_STATE_SWR_OPTIONS = {
  revalidateOnMount: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// Projects with a suggestions run in flight, and those asked to run again
// meanwhile. A request during a run is coalesced into one more run, so items
// saved mid-run still reach the chips without stacking regenerate calls.
const runningSuggestionProjects = new Set<string>();
const queuedSuggestionProjects = new Set<string>();

/**
 * One regenerate pass. Chips land in the streaming key as the server sends
 * them. On `done` the stored set is refetched first and only then is the
 * streamed list cleared, so the chat goes from one list to the other without
 * a frame of fallback chips. Any failure clears the streamed list and leaves
 * the stored chips as they were.
 */
const runSuggestionsPass = async (projectId: string) => {
  const streamingKey = getStreamingSuggestionsKey(projectId);
  await mutate(streamingKey, [], { revalidate: false });
  try {
    const response = await apiClient.fetchRaw(
      `/api/ai/research-agent/bootstrapper/project/${projectId}/suggestions/regenerate`,
      { method: "POST" },
    );
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const chips: SuggestionItem[] = [];
    for await (const event of readNdjson<SuggestionStreamEvent>(
      response.body,
    )) {
      if (event.type === "error") {
        throw new Error(event.error);
      }
      if (event.type === "done") {
        await mutate(getResearchAgentMessagesKey(projectId));
        return;
      }
      if (event.type === "chip") {
        chips.push(event.chip);
        await mutate(streamingKey, [...chips], { revalidate: false });
      }
    }
    throw new Error("Stream ended before the suggestions were stored");
  } catch (error) {
    console.error("[research-phase] Failed to generate suggestions:", error);
  } finally {
    await mutate(streamingKey, null, { revalidate: false });
  }
};

/**
 * Build the next-step chips from the project's saved data, streaming them
 * into the chat as they arrive. On research completion the flag is set before
 * the project revalidates, so the chat never flashes the fallback chips in
 * between.
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
      const pass = runSuggestionsPass(projectId);
      await revalidateProject?.();
      await pass;
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
    SHARED_STATE_SWR_OPTIONS,
  );

  const { data: streamingSuggestions = null } = useSWR<SuggestionItem[] | null>(
    projectId ? getStreamingSuggestionsKey(projectId) : null,
    null,
    SHARED_STATE_SWR_OPTIONS,
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
    /** Chips of the pass in flight, in arrival order; null when none is streaming. */
    streamingSuggestions,
    regenerateSuggestions,
  };
};
