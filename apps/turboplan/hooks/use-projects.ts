import { useCallback } from "react";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type {
  ProjectSearchParams,
  ProjectWithCoverImage,
} from "@wildfires-org/turboplan-workspace/types";

interface UseProjectsOptions {
  organizationSlug: string;
  officeSlug: string;
  filters?: ProjectSearchParams;
}

const projectsFetcher = async (
  url: string,
): Promise<ProjectWithCoverImage[]> => {
  try {
    return await fetcher<ProjectWithCoverImage[]>(url);
  } catch (error: unknown) {
    const e = error as { status?: number; info?: string; message?: string };

    if (e.status === 401) {
      throw new Error("Unauthorized");
    }

    if (e.status === 403 || e.status === 404) {
      throw new Error("Access denied or resource not found");
    }

    throw new Error(e.info || e.message || "Failed to fetch projects");
  }
};

export function useProjects({
  organizationSlug,
  officeSlug,
  filters,
}: UseProjectsOptions) {
  const buildUrl = useCallback(
    (filters?: ProjectSearchParams) => {
      const searchParams = new URLSearchParams();
      searchParams.set("organizationSlug", organizationSlug);
      searchParams.set("officeSlug", officeSlug);

      if (filters?.status) searchParams.set("status", filters.status);
      if (typeof filters?.isTemplate === "boolean") {
        searchParams.set("isTemplate", filters.isTemplate.toString());
      }
      if (filters?.offset !== undefined) {
        searchParams.set("offset", filters.offset.toString());
      }
      if (filters?.limit !== undefined) {
        searchParams.set("limit", filters.limit.toString());
      }
      if (filters?.sortBy) searchParams.set("sortBy", filters.sortBy);
      if (filters?.sortOrder) searchParams.set("sortOrder", filters.sortOrder);
      if (filters?.createdBy) searchParams.set("createdBy", filters.createdBy);

      return `/api/projects?${searchParams.toString()}`;
    },
    [organizationSlug, officeSlug],
  );

  const url = buildUrl(filters);

  const {
    data: projects,
    error,
    isLoading,
    mutate,
  } = useSWR<ProjectWithCoverImage[]>(url, projectsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 0,
  });

  const fetchProjects = useCallback(
    async (filters?: ProjectSearchParams) => {
      const filterUrl = buildUrl(filters);
      return mutate(projectsFetcher(filterUrl));
    },
    [buildUrl, mutate],
  );

  const refreshProjects = useCallback(() => {
    return mutate();
  }, [mutate]);

  // Parse error for status information
  const errorMessage = error?.message || null;
  const isUnauthorized = errorMessage === "Unauthorized";
  const hasAccessError = errorMessage === "Access denied or resource not found";

  // Consider "loading" if SWR is loading OR if we haven't received any data yet
  const isInitialLoading = isLoading || projects === undefined;

  return {
    projects: projects ?? [],
    isLoading: isInitialLoading,
    error: errorMessage,
    errorStatus: isUnauthorized ? 401 : hasAccessError ? 403 : null,
    isUnauthorized,
    hasAccessError,
    fetchProjects,
    refreshProjects,
  };
}
