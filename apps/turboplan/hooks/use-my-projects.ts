import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { UserProject } from "@wildfires-org/turboplan-workspace/types";

export function useMyProjects() {
  const { data, error, isLoading, mutate } = useSWR<UserProject[]>(
    "/api/projects/my",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  );

  return {
    projects: data ?? [],
    isLoading: isLoading || data === undefined,
    error: error?.message ?? null,
    refreshProjects: mutate,
  };
}
