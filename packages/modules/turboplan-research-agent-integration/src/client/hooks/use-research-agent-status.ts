"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import type { ResearchAgentStatus } from "../../types";

interface UseResearchAgentStatusOptions {
  /**
   * Keep polling while no run record exists yet. Set when a run is expected to
   * start server-side (e.g. the first message of a project's initial chat),
   * so the UI picks it up without waiting for a focus revalidation.
   */
  awaitRunStart?: boolean;
}

export function useResearchAgentStatus(
  projectId: string | null,
  { awaitRunStart = false }: UseResearchAgentStatusOptions = {},
) {
  const { data: status, mutate } = useSWR<ResearchAgentStatus>(
    projectId
      ? `/api/ai/research-agent/bootstrapper/project/${projectId}/status`
      : null,
    fetcher,
    {
      refreshInterval: (latestData) =>
        latestData?.hasActiveRun || (awaitRunStart && !latestData?.runId)
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
