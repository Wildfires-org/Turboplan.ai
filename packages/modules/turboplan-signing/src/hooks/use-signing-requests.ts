"use client";

import { useCallback } from "react";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, postFetcher } from "@wildfires-org/turboplan-api-client";

import type {
  SigningMode,
  SigningRecipientRole,
  SigningRequest,
} from "../types";

export type SigningRequestWithProject = SigningRequest & {
  projectName: string;
  projectSlug: string;
  officeSlug: string;
  orgSlug: string;
};

export const useSigningRequests = (projectId: string | undefined) => {
  const { data, error, isLoading, mutate } = useSWR<{
    signingRequests: SigningRequest[];
  }>(
    projectId ? `/api/signing-requests?projectId=${projectId}` : null,
    fetcher,
  );

  return {
    signingRequests: data?.signingRequests ?? [],
    error,
    isLoading,
    mutate,
  };
};

type MySigningRequest = {
  id: string;
  title: string;
  status: string;
  signingUrl: string | null;
};

type MySigningRequestResponse = {
  signingRequest: MySigningRequest | null;
};

export const useMySigningRequest = (documentId: string | undefined) => {
  const { data, isLoading } = useSWR<MySigningRequestResponse>(
    documentId ? `/api/signing-requests/for-document/${documentId}` : null,
    fetcher,
    { refreshInterval: 30000 },
  );

  return {
    signingRequest: data?.signingRequest ?? null,
    isLoading,
  };
};

export type CreateRecipientInput = {
  userId: string;
  role: SigningRecipientRole;
};

export type CreateSigningRequestPayload = {
  documentId: string;
  projectId: string;
  // Recipients other than the requester, in desired signing order (sequential).
  recipients: CreateRecipientInput[];
  signingMode: SigningMode;
  requesterSigns: "first" | "last" | "no";
  title?: string;
};

// Returned when the requester signs first: an in-session token for the embedded
// modal so they can sign immediately without leaving the page.
export type InlineSign = {
  signingToken: string;
  signingRequestId: string;
  host: string;
};

export type CreateSigningRequestResponse = {
  signingRequest: SigningRequest;
  inline: InlineSign | null;
};

export const useCreateSigningRequest = (
  onSuccess?: (response: CreateSigningRequestResponse) => void,
) => {
  const { trigger, isMutating, error } = useSWRMutation<
    CreateSigningRequestResponse,
    Error,
    string,
    CreateSigningRequestPayload
  >("/api/signing-requests", postFetcher, { onSuccess });

  return {
    createSigningRequest: trigger,
    isCreating: isMutating,
    error: error?.message ?? null,
  };
};

export type SignTokenResponse = {
  signingToken: string;
  signingRequestId: string;
  host: string;
};

// Imperatively mints the current user's in-session signing token for an existing
// request (GET /:id/sign-token). Used to open the embedded modal for a recipient
// signing a request someone else created. Throws if it isn't the user's turn.
export const useSignToken = () => {
  const getSignToken = useCallback(
    (signingRequestId: string) =>
      fetcher<SignTokenResponse>(
        `/api/signing-requests/${signingRequestId}/sign-token`,
      ),
    [],
  );

  return { getSignToken };
};

type CompleteSigningPayload = {
  signingRequestId: string;
};

type CompleteSigningResponse = {
  signingRequest: SigningRequest;
  // Set when the caller signed but other signers remain — their signature is
  // recorded and the document will seal once everyone signs.
  pending?: boolean;
};

export const useCompleteSigningRequest = () => {
  const { trigger, isMutating, error } = useSWRMutation<
    CompleteSigningResponse,
    Error,
    string,
    CompleteSigningPayload
  >("/api/signing-requests/complete", postFetcher);

  return {
    completeSigningRequest: trigger,
    isCompleting: isMutating,
    error: error?.message ?? null,
  };
};

type CancelSigningPayload = {
  signingRequestId: string;
};

export const useCancelSigningRequest = () => {
  const { trigger, isMutating } = useSWRMutation<
    { signingRequest: SigningRequest },
    Error,
    string,
    CancelSigningPayload
  >("/api/signing-requests/cancel", postFetcher);

  return {
    cancelSigningRequest: trigger,
    isCancelling: isMutating,
  };
};

export const useMyPendingSignatures = (organizationId?: string) => {
  const { data, error, isLoading, mutate } = useSWR<{
    signingRequests: SigningRequestWithProject[];
  }>(
    organizationId
      ? `/api/signing-requests/my-pending?organizationId=${organizationId}`
      : "/api/signing-requests/my-pending",
    fetcher,
    { refreshInterval: 30000 },
  );

  return {
    signingRequests: data?.signingRequests ?? [],
    error,
    isLoading,
    mutate,
  };
};
