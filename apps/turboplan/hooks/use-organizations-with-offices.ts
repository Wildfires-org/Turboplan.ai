import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { OrganizationWithOffices } from "@wildfires-org/turboplan-workspace/types";

export function useOrganizationsWithOffices() {
  const { data, error, isLoading, mutate } = useSWR<OrganizationWithOffices[]>(
    "/api/organizations/with-offices",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    organizations: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
