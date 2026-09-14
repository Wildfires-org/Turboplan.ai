"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { OwnershipStatus } from "@wildfires-org/turboplan-db/types";

// Row shape returned by GET /api/projects/user/submissions. Each row carries the
// project's CURRENT location (currentOrganizationSlug / currentOfficeSlug), which
// after the submit-time move points at the gov office (while submitted/accepted)
// and reverts to the citizen office after a rejection.
export interface UserSubmission {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  projectDescription: string | null;
  ownershipStatus: OwnershipStatus;
  targetOrganizationName: string;
  currentOrganizationSlug: string;
  currentOfficeSlug: string;
  coverImageUrl: string | null;
  creatorEmail: string | null;
  creatorFirstName: string | null;
  creatorLastName: string | null;
  createdAt: string;
  submittedAt: string;
}

export function useUserSubmissions() {
  const { data, error, isLoading } = useSWR<UserSubmission[]>(
    "/api/projects/user/submissions",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  );

  return {
    submissions: data ?? [],
    isLoading,
    error,
  };
}
