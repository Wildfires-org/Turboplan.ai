import {
  ResearchAgentChatStatus,
  type ResearchAgentChatStatusType,
} from "../../types";

/** How a run ended, as the agent reports it with its final progress message. */
export const RESEARCH_AGENT_RUN_OUTCOMES = [
  "completed",
  "failed",
  "cancelled",
] as const;

export type ResearchAgentRunOutcome =
  (typeof RESEARCH_AGENT_RUN_OUTCOMES)[number];

/**
 * Run status to store for a progress webhook. Without an outcome it is ordinary
 * progress (and agents that predate the field never send one). Cancelled maps
 * to failed, as in reconcileExternalStatus. Kept free of DB imports so it can
 * be unit-tested in isolation.
 */
export const getProgressRunStatus = (
  outcome: ResearchAgentRunOutcome | undefined,
): ResearchAgentChatStatusType => {
  if (outcome === "completed") {
    return ResearchAgentChatStatus.COMPLETED;
  }
  if (outcome === "failed" || outcome === "cancelled") {
    return ResearchAgentChatStatus.FAILED;
  }
  return ResearchAgentChatStatus.RUNNING;
};
