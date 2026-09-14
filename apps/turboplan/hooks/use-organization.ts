"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { Organization } from "@wildfires-org/turboplan-db/types";

interface ApiError {
  status: number;
  message: string;
  info?: string;
}

const fetcherWithErrorDetails = async (url: string) => {
  try {
    return await fetcher<Organization>(url);
  } catch (error: unknown) {
    const err = error as { status?: number; info?: string; message?: string };
    const apiError: ApiError = {
      status: err.status || 500,
      message: err.info || err.message || "Unknown error",
      info: err.info,
    };
    throw apiError;
  }
};

export function useUserOrganizations() {
  const { data, error, isLoading, mutate } = useSWR<Organization[]>(
    "/api/organizations",
    fetcher,
    {
      // Sidebar-level list: membership changes are rare and mutated explicitly
      // after invites/leaves, so skip focus revalidation and share one fetch
      // across the whole shell for a minute.
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    organizations: data || [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useUserOrganization(organizationId?: string) {
  const { data, error, isLoading, mutate } = useSWR<Organization>(
    organizationId ? `/api/organizations/${organizationId}` : null,
    fetcherWithErrorDetails,
  );

  const apiError = error as ApiError | undefined;
  const isUnauthorized = apiError?.status === 401;
  const isForbidden = apiError?.status === 403;
  const isNotFound = apiError?.status === 404;
  const hasAccessError = isForbidden || isNotFound;

  return {
    organization: data,
    isLoading,
    isError: !!error,
    error: apiError,
    isUnauthorized,
    isForbidden,
    isNotFound,
    hasAccessError,
    mutate,
  };
}
