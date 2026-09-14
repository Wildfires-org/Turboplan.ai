"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { Prompt } from "@wildfires-org/turboplan-db/types";

interface PromptsResponse {
  prompts: Prompt[];
}

interface PromptResponse {
  prompt: Prompt;
}

interface VariablesResponse {
  variables: Array<{
    name: string;
    description: string;
    isProtected: boolean;
  }>;
}

const promptsFetcher = async (url: string): Promise<Prompt[]> => {
  const response = await fetcher<PromptsResponse>(url);
  return response.prompts;
};

const promptFetcher = async (url: string): Promise<Prompt> => {
  const response = await fetcher<PromptResponse>(url);
  return response.prompt;
};

/**
 * Hook for fetching all prompts.
 */
export function usePrompts() {
  const {
    data: prompts,
    error,
    isLoading,
    mutate,
  } = useSWR<Prompt[]>("/api/admin/prompts", promptsFetcher, {
    revalidateOnFocus: false,
  });

  return {
    prompts: prompts || [],
    isLoading,
    error: error?.message || null,
    refreshPrompts: mutate,
  };
}

/**
 * Hook for fetching a single prompt with all versions.
 */
export function usePrompt(name: string) {
  const {
    data: prompt,
    error,
    isLoading,
    mutate,
  } = useSWR<Prompt>(
    name ? `/api/admin/prompts/${name}` : null,
    promptFetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    prompt: prompt || null,
    isLoading,
    error: error?.message || null,
    refreshPrompt: mutate,
  };
}

/**
 * Hook for fetching available prompt variables (all).
 */
export function usePromptVariables() {
  const { data, error, isLoading } = useSWR<VariablesResponse>(
    "/api/admin/prompts/variables",
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    variables: data?.variables || [],
    isLoading,
    error: error?.message || null,
  };
}

/**
 * Hook for fetching variables applicable to a specific prompt.
 */
export function usePromptVariablesFor(promptName: string | null) {
  const { data, error, isLoading } = useSWR<VariablesResponse>(
    promptName ? `/api/admin/prompts/variables/${promptName}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    variables: data?.variables || [],
    isLoading,
    error: error?.message || null,
  };
}
