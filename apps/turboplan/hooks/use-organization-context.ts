"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, putFetcher } from "@wildfires-org/turboplan-api-client";

import type { OrganizationContextPrompt } from "@/types/organization-context";

type SavePromptArg = { prompt: string };

export const getOrganizationContextKey = (organizationId: string) =>
  `/api/organizations/${organizationId}/context`;

/**
 * An organization's standing AI prompt: read it, and save it (owner/editor).
 * Saving writes the trimmed prompt the API returns into the cache.
 */
export const useOrganizationContext = (organizationId: string) => {
  const key = getOrganizationContextKey(organizationId);

  const { data, error, isLoading } = useSWR<OrganizationContextPrompt>(
    key,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { trigger, isMutating } = useSWRMutation<
    OrganizationContextPrompt,
    Error,
    string,
    SavePromptArg
  >(key, putFetcher, { populateCache: true, revalidate: true });

  const savePrompt = (prompt: string) => trigger({ prompt });

  return {
    prompt: data?.prompt ?? "",
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    error: (error as Error | undefined) ?? null,
    savePrompt,
    isSaving: isMutating,
  };
};
