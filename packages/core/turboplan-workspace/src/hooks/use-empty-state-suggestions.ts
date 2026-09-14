"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { EmptyStateSuggestion } from "@wildfires-org/turboplan-db";

interface UseEmptyStateSuggestionsConfig {
  projectId: string;
  section: "tasks" | "documents";
  enabled?: boolean;
}

export function useEmptyStateSuggestions({
  projectId,
  section,
  enabled = true,
}: UseEmptyStateSuggestionsConfig) {
  const { data, error, isLoading } = useSWR<EmptyStateSuggestion[]>(
    enabled
      ? `/api/projects/${projectId}/empty-state-suggestions?section=${section}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  return {
    suggestions: data ?? [],
    isLoading,
    error,
  };
}
