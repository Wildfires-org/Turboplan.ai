"use client";

import useSWRMutation from "swr/mutation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

const apiClient = new ApiClient();

async function deleteTemplateFetcher(url: string) {
  const { data, error } = await apiClient.delete(url);

  if (error) {
    throw new Error(error || "Failed to delete template");
  }

  return data;
}

export function useDeleteTemplate(templateId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/projects/${templateId}`,
    deleteTemplateFetcher,
  );

  return {
    deleteTemplate: trigger,
    isDeleting: isMutating,
    error,
  };
}
