"use client";

import useSWRMutation from "swr/mutation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

const apiClient = new ApiClient();

async function createTemplateFetcher(
  url: string,
  { arg }: { arg?: { name?: string; description?: string } },
) {
  const { data, error } = await apiClient.post(url, arg ?? {});

  if (error) {
    throw new Error(error || "Failed to create template");
  }

  return data;
}

export function useCreateTemplate(projectId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/projects/${projectId}/create-template`,
    createTemplateFetcher,
  );

  return {
    createTemplate: trigger,
    isCreating: isMutating,
    error,
  };
}
