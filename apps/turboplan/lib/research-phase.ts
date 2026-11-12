import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

/**
 * Whether a project is still waiting on its research run. Only true while the
 * research agent is on: with it off no run ever starts or completes, so the
 * research panel, the single-chat rule and the locked AI suggestions must not
 * wait for one.
 */
export function isResearchPhasePending(project: {
  isResearchPhaseCompleted: boolean;
}): boolean {
  return isResearchAgentPackageEnabled() && !project.isResearchPhaseCompleted;
}
