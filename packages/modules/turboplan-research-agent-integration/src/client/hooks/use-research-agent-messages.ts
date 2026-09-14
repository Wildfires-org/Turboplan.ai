"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import type { ResearchAgentMessage } from "../../types";

type MessagesResponse = {
  messages: ResearchAgentMessage[];
};

export function useResearchAgentMessages(
  projectId: string | null,
  isActive: boolean,
) {
  const { data, mutate, isLoading } = useSWR<MessagesResponse>(
    projectId
      ? `/api/ai/research-agent/bootstrapper/project/${projectId}/messages`
      : null,
    fetcher,
    {
      refreshInterval: isActive
        ? getWebEnv().RESEARCH_AGENT_POLLING_INTERVAL
        : 0,
    },
  );

  return {
    messages: data?.messages ?? [],
    isLoading,
    refresh: mutate,
  };
}
