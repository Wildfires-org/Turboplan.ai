/**
 * Research status prompts — always injected into context.
 *
 * Each template shows both the Research Agent status and the Research Phase status,
 * so the AI can clearly understand the current state.
 */

export const researchStatusStarting = `## CURRENT RESEARCH STATUS

Research Agent: STARTING — just launched, no results yet
Research Phase: NOT YET COMPLETED

The Research Agent was just launched and is beginning its analysis. No results yet.
Continue with web research and clarifying questions while it works.`;

export const researchStatusRunning = `## CURRENT RESEARCH STATUS

Research Agent: RUNNING — still analyzing the project
Research Phase: NOT YET COMPLETED

The Research Agent is still analyzing this project. Partial results may appear in the context below.
Continue asking clarifying questions while it works.`;

export const researchStatusCompleted = `## CURRENT RESEARCH STATUS

Research Agent: COMPLETED — analysis finished, results are ready
Research Phase: NOT YET COMPLETED — user has not clicked "Complete research"

The Research Agent has finished. Your priority now is to encourage the user to:
1. Review the research findings
2. Save the relevant ones to the project
3. Complete the research phase to unlock document creation tools

Continue answering clarifying questions if the user engages, but always remind them
about the pending research review.`;

export const researchStatusDone = `## CURRENT RESEARCH STATUS

Research Agent: COMPLETED
Research Phase: COMPLETED — user has reviewed and saved findings

All research is done. Focus on helping the user create environmental documents and project deliverables
using the gathered context.`;
