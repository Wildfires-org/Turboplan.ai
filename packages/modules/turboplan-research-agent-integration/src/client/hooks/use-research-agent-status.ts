"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import type { ResearchAgentStatus } from "../../types";

export function useResearchAgentStatus(projectId: string | null) {
  const { data: status, mutate } = useSWR<ResearchAgentStatus>(
    projectId
      ? `/api/ai/research-agent/bootstrapper/project/${projectId}/status`
      : null,
    fetcher,
    {
      refreshInterval: (latestData) =>
        latestData?.hasActiveRun
          ? getWebEnv().RESEARCH_AGENT_POLLING_INTERVAL
          : 0,
    },
  );

  return {
    status,
    isActive: status?.hasActiveRun || false,
    refresh: mutate,
  };
}
