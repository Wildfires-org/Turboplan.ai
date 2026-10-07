"use client";

import { useCallback } from "react";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import type { ResearchAgentStatus } from "../../types";
import { getStatusRefreshInterval } from "../utils";

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
  // Memoized: SWR restarts its poll timer whenever refreshInterval changes, so
  // a new function on every render would keep postponing the next poll.
  const refreshInterval = useCallback(
    (latestData?: ResearchAgentStatus) =>
      getStatusRefreshInterval(latestData, {
        awaitRunStart,
        pollingInterval: getWebEnv().RESEARCH_AGENT_POLLING_INTERVAL,
      }),
    [awaitRunStart],
  );

  const { data: status, mutate } = useSWR<ResearchAgentStatus>(
    projectId
      ? `/api/ai/research-agent/bootstrapper/project/${projectId}/status`
      : null,
    fetcher,
    // Without a key there is nothing to poll; skip the idle timer.
    { refreshInterval: projectId ? refreshInterval : 0 },
  );

  return {
    status,
    isActive: status?.hasActiveRun || false,
    refresh: mutate,
  };
}
