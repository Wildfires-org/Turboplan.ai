"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";

import type { AdminStatusResponse } from "../types";

export function useAdminStatus() {
  const { data, error, isLoading } = useSWR<AdminStatusResponse>(
    "/api/admin-status",
    fetcher,
    {
      // Admin flags change only via the admin panel; one fetch per shell load.
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5 * 60_000,
    },
  );

  return {
    isAdmin: data?.isAdmin ?? false,
    isSuperAdmin: data?.isSuperAdmin ?? false,
    isLoading,
    error: error?.message || null,
  };
}
