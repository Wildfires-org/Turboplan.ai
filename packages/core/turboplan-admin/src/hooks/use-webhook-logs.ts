"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, postFetcher } from "@wildfires-org/turboplan-api-client";

type WebhookLog = {
  id: string;
  source: string;
  path: string;
  method: string;
  responseStatus: number;
  runId: string | null;
  durationMs: number;
  createdAt: string;
};

type WebhookLogDetail = WebhookLog & {
  requestBody: unknown;
  requestHeaders: unknown;
  responseBody: unknown;
};

type WebhookLogsResponse = {
  logs: WebhookLog[];
};

type WebhookLogsFilters = {
  source?: "bootstrapper" | "cataloger";
};

const buildUrl = (filters: WebhookLogsFilters): string => {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  const qs = params.toString();
  return `/api/admin/webhook-logs${qs ? `?${qs}` : ""}`;
};

export const useWebhookLogs = (filters: WebhookLogsFilters = {}) => {
  const url = buildUrl(filters);
  const { data, error, isLoading, mutate } = useSWR<WebhookLogsResponse>(
    url,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { trigger: deleteWebhookLogs, isMutating: isDeleting } = useSWRMutation(
    "/api/admin/webhook-logs/delete",
    postFetcher<{ ids: string[] }>,
  );

  return {
    logs: data?.logs || [],
    isLoading,
    isDeleting,
    error: error?.message || null,
    refreshLogs: mutate,
    deleteWebhookLogs,
  };
};

export const useWebhookLogDetail = (id: string | null) => {
  const { data, error, isLoading } = useSWR<{ log: WebhookLogDetail }>(
    id ? `/api/admin/webhook-logs/${id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    log: data?.log || null,
    isLoading,
    error: error?.message || null,
  };
};

export type { WebhookLog, WebhookLogDetail, WebhookLogsFilters };
