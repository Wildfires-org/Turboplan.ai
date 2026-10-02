import {
  type ProgressMessageData,
  type ResearchAgentMessage,
  ResearchAgentMessageType,
  type ResearchAgentStatus,
} from "../types";

/**
 * The step the current run is on. Status and messages are polled separately,
 * so whichever was written last wins: the run's latest progress message, or
 * the status when it is newer (the `/start` phase writes status-only steps
 * before any progress exists).
 */
export const getActiveStep = (
  status: ResearchAgentStatus | undefined,
  progressMessages: ResearchAgentMessage[],
): string | undefined => {
  if (!status) {
    return undefined;
  }

  const latestProgress = progressMessages
    .filter(
      (msg) =>
        msg.type === ResearchAgentMessageType.PROGRESS &&
        msg.researchAgentChatId === status.runId,
    )
    .reduce<ResearchAgentMessage | undefined>(
      (latest, msg) =>
        !latest || Date.parse(msg.createdAt) > Date.parse(latest.createdAt)
          ? msg
          : latest,
      undefined,
    );

  if (!latestProgress) {
    return status.currentStep;
  }

  if (
    !status.currentStep ||
    !status.updatedAt ||
    Date.parse(latestProgress.createdAt) > Date.parse(status.updatedAt)
  ) {
    return (latestProgress.data as ProgressMessageData).step;
  }

  return status.currentStep;
};
