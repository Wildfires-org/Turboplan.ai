import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { LibraryLetterhead } from "@wildfires-org/turboplan-workspace/types";

export const organizationLetterheadsKey = (organizationId: string) =>
  `/api/organizations/${organizationId}/letterheads`;

/** The organization's library of additional (partner/client) letterheads. */
export const useOrganizationLetterheads = (organizationId: string) => {
  const { data, error, isLoading, mutate } = useSWR<{
    letterheads: LibraryLetterhead[];
  }>(organizationLetterheadsKey(organizationId), fetcher);

  return {
    letterheads: data?.letterheads ?? [],
    error,
    isLoading,
    mutate,
  };
};
