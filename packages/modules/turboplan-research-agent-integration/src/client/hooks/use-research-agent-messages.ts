"use client";

import { useEffect, useRef } from "react";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import type { ResearchAgentMessage } from "../../types";

type MessagesResponse = {
  messages: ResearchAgentMessage[];
};

export const getResearchAgentMessagesKey = (projectId: string) =>
  `/api/ai/research-agent/bootstrapper/project/${projectId}/messages`;

export function useResearchAgentMessages(
  projectId: string | null,
  isActive: boolean,
) {
  const { data, mutate, isLoading } = useSWR<MessagesResponse>(
    projectId ? getResearchAgentMessagesKey(projectId) : null,
    fetcher,
    {
      refreshInterval: isActive
        ? getWebEnv().RESEARCH_AGENT_POLLING_INTERVAL
        : 0,
    },
  );

  // Polling stops as soon as the status reports the run finished, which can be
  // before this poll saw the last results, so fetch once more when it ends.
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      mutate();
    }
    wasActiveRef.current = isActive;
  }, [isActive, mutate]);

  return {
    messages: data?.messages ?? [],
    isLoading,
    refresh: mutate,
  };
}
