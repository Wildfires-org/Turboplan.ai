"use client";

import useSWRMutation from "swr/mutation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

const apiClient = new ApiClient();

async function softDeleteProjectFetcher(url: string) {
  const { data, error } = await apiClient.patch(url);

  if (error) {
    throw new Error(error || "Failed to delete project");
  }

  return data;
}

export function useSoftDeleteProject(projectId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/projects/${projectId}/soft-delete`,
    softDeleteProjectFetcher,
  );

  return {
    softDeleteProject: trigger,
    isDeleting: isMutating,
    error,
  };
}
