"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import {
  deleteFetcher,
  fetcher,
  putFetcher,
} from "@wildfires-org/turboplan-api-client";

type OrgSigningConfig = {
  id: string;
  organizationId: string;
  documensoApiUrl: string;
  documensoApiKey: string; // masked, e.g. "****abcd"
  documensoWebhookSecret: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ConfigResponse = {
  config: OrgSigningConfig | null;
};

export const useOrgSigningConfig = (orgId: string | undefined) => {
  const { data, isLoading, mutate } = useSWR<ConfigResponse>(
    orgId ? `/api/organizations/${orgId}/signing-config` : null,
    fetcher,
  );

  return {
    config: data?.config ?? null,
    isLoading,
    mutate,
  };
};

type UpdatePayload = {
  documensoApiUrl: string;
  documensoApiKey: string;
  documensoWebhookSecret?: string;
  isEnabled?: boolean;
};

export const useUpdateOrgSigningConfig = (orgId: string) => {
  const { trigger, isMutating } = useSWRMutation<
    ConfigResponse,
    Error,
    string,
    UpdatePayload
  >(`/api/organizations/${orgId}/signing-config`, putFetcher);

  return {
    updateConfig: trigger,
    isUpdating: isMutating,
  };
};

export const useDeleteOrgSigningConfig = (orgId: string) => {
  const { trigger, isMutating } = useSWRMutation(
    `/api/organizations/${orgId}/signing-config`,
    deleteFetcher,
  );

  return {
    deleteConfig: trigger,
    isDeleting: isMutating,
  };
};
