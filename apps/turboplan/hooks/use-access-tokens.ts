import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import {
  deleteFetcher,
  fetcher,
  postFetcher,
} from "@wildfires-org/turboplan-api-client";

const TOKENS_KEY = "/api/auth/tokens";

type AccessToken = {
  id: string;
  name: string;
  actor: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type CreateTokenResponse = {
  token: string;
  id: string;
  name: string;
  actor: string;
  prefix: string;
  expiresAt: string | null;
  createdAt: string;
};

type CreateTokenPayload = {
  name: string;
  actor: string;
  expiresAt?: string;
};

export const useAccessTokens = () => {
  const { data, error, isLoading, mutate } = useSWR<AccessToken[]>(
    TOKENS_KEY,
    fetcher,
  );

  return {
    tokens: data ?? [],
    isLoading,
    error: error?.message ?? null,
    mutate,
  };
};

export const useCreateToken = (onSuccess?: () => void) => {
  const { trigger, isMutating, data, error } = useSWRMutation<
    CreateTokenResponse,
    Error,
    string,
    CreateTokenPayload
  >(TOKENS_KEY, postFetcher, {
    onSuccess,
  });

  return {
    createToken: trigger,
    isCreating: isMutating,
    createdToken: data ?? null,
    error: error?.message ?? null,
  };
};

export const useRevokeToken = (onSuccess?: () => void) => {
  const { trigger, isMutating, error } = useSWRMutation(
    TOKENS_KEY,
    deleteFetcher,
    {
      onSuccess,
    },
  );

  return {
    revokeToken: trigger,
    isRevoking: isMutating,
    error: error?.message ?? null,
  };
};

export type { AccessToken, CreateTokenPayload, CreateTokenResponse };
