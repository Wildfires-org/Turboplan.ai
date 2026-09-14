"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, putFetcher } from "@wildfires-org/turboplan-api-client";

import type { ModelKey, ModelValues } from "../types";

type AiModelsConfig = Record<ModelKey, ModelValues>;

interface AiModelsResponse {
  config: AiModelsConfig;
}

type UpdateAiModelsPayload = {
  primaryModel: string | null;
  liteModel: string | null;
  imagePrimaryModel: string | null;
  imageLiteModel: string | null;
};

export type AvailableModel = {
  id: string;
  name: string;
};

type AvailableModelsResponse = {
  language: AvailableModel[];
  image: AvailableModel[];
};

const AI_MODELS_KEY = "/api/admin/ai-models";
const AVAILABLE_MODELS_KEY = "/api/admin/ai-models/available";

/**
 * Hook for fetching available AI models from OpenRouter (via proxy endpoint).
 * Cached client-side by SWR with 1-hour deduplication.
 */
export function useAvailableModels() {
  const { data, error, isLoading } = useSWR<AvailableModelsResponse>(
    AVAILABLE_MODELS_KEY,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 60 * 1000, // 1 hour
    },
  );

  return {
    languageModels: data?.language ?? [],
    imageModels: data?.image ?? [],
    isLoading,
    error: error?.message || null,
  };
}

/**
 * Hook for fetching the current AI model configuration.
 */
export function useAiModels() {
  const { data, error, isLoading, mutate } = useSWR<AiModelsResponse>(
    AI_MODELS_KEY,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    config: data?.config ?? null,
    isLoading,
    error: error?.message || null,
    refreshConfig: mutate,
  };
}

/**
 * Mutation hook for updating AI model configuration.
 */
export function useUpdateAiModels() {
  return useSWRMutation<AiModelsResponse, Error, string, UpdateAiModelsPayload>(
    AI_MODELS_KEY,
    putFetcher,
  );
}
