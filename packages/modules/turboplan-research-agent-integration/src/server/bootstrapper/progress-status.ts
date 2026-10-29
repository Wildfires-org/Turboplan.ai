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

/**
 * Whether a progress webhook should ask the agent how the run stands. Without
 * an outcome the message is either mid-run progress or the final message of an
 * agent that predates the field. The agent persists its run status before it
 * sends that final message, so asking then finishes the run at once; mid-run
 * the agent still reports running and nothing changes. With an outcome the
 * webhook already knows the answer.
 */
export const shouldReconcileOnProgress = (
  outcome: ResearchAgentRunOutcome | undefined,
): boolean => {
  return outcome === undefined;
};
