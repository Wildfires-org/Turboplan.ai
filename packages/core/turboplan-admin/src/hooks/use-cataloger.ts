"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";

import type { CatalogerRunStatus } from "../types";

type CatalogerRunItem = {
  id: string;
  userId: string;
  message: string;
  externalRunId: string | null;
  status: CatalogerRunStatus;
  currentStep: string | null;
  entriesCount: number;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  userName: string | null;
};

type CatalogerEntryItem = {
  id: string;
  catalogerRunId: string;
  projectId: string | null;
  organizationId: string | null;
  officeId: string | null;
  name: string;
  createdAt: string;
  projectName: string | null;
  projectSlug: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  officeName: string | null;
  officeSlug: string | null;
};

type CatalogerRunsFilters = {
  status?: CatalogerRunStatus;
};

type CatalogerRunsResponse = {
  runs: CatalogerRunItem[];
};

type CatalogerRunDetailResponse = {
  run: CatalogerRunItem;
  entries: CatalogerEntryItem[];
};

const buildUrl = (filters: CatalogerRunsFilters): string => {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  const qs = params.toString();
  return `/api/admin/cataloger/runs${qs ? `?${qs}` : ""}`;
};

export const useCatalogerRuns = (filters: CatalogerRunsFilters = {}) => {
  const url = buildUrl(filters);
  const { data, error, isLoading, mutate } = useSWR<CatalogerRunsResponse>(
    url,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    runs: data?.runs || [],
    isLoading,
    error: error?.message || null,
    refreshRuns: mutate,
  };
};

export const useCatalogerRunDetail = (runId: string | null) => {
  const { data, error, isLoading } = useSWR<CatalogerRunDetailResponse>(
    runId ? `/api/admin/cataloger/runs/${runId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    run: data?.run || null,
    entries: data?.entries || [],
    isLoading,
    error: error?.message || null,
  };
};

export type { CatalogerRunItem, CatalogerEntryItem, CatalogerRunsFilters };
