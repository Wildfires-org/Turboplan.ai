"use client";

import { useCallback, useMemo } from "react";

import useSWR from "swr";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import {
  type TimelineDisplayEntry,
  transformTimelineRecord,
} from "@wildfires-org/turboplan-timeline-records/client";
import type { EnrichedTimelineRecord } from "@wildfires-org/turboplan-timeline-records/types";

const apiClient = new ApiClient();

type TimelineResponse = {
  records: EnrichedTimelineRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function useTimeline(projectId: string) {
  const url = `/api/projects/${projectId}/timeline?limit=50`;

  const { data, error, isLoading, mutate } = useSWR<TimelineResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 10_000,
    },
  );

  const entries: TimelineDisplayEntry[] = useMemo(() => {
    if (!data?.records) return [];
    return data.records.map(transformTimelineRecord);
  }, [data?.records]);

  const createEntry = useCallback(
    async (input: {
      title: string;
      description?: string;
      startedAt?: Date;
      endedAt?: Date;
    }) => {
      const { error: apiError } = await apiClient.post(
        `/api/projects/${projectId}/timeline`,
        {
          entityType: "project",
          entityId: projectId,
          action: "created",
          title: input.title,
          description: input.description,
          startedAt: input.startedAt?.toISOString(),
          endedAt: input.endedAt?.toISOString(),
        },
      );

      if (apiError) {
        throw new Error(apiError);
      }

      await mutate();
    },
    [projectId, mutate],
  );

  const deleteEntry = useCallback(
    async (recordId: string) => {
      const { error: apiError } = await apiClient.delete(
        `/api/projects/${projectId}/timeline/${recordId}`,
      );

      if (apiError) {
        throw new Error(apiError);
      }

      await mutate();
    },
    [projectId, mutate],
  );

  const toggleVisibility = useCallback(
    async (recordId: string) => {
      const { error: apiError } = await apiClient.patch(
        `/api/projects/${projectId}/timeline/${recordId}/visibility`,
      );

      if (apiError) {
        throw new Error(apiError);
      }

      await mutate();
    },
    [projectId, mutate],
  );

  return {
    entries,
    isLoading,
    error: error?.message ?? null,
    mutate,
    createEntry,
    deleteEntry,
    toggleVisibility,
  };
}
