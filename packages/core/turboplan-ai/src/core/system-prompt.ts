import { getPrompt } from "../services/prompt-service";
import type { SystemPromptProps } from "../types";
import { ChatMode } from "../types";

/**
 * Compose the system prompt from three layers:
 *   1. Base Identity (always included)
 *   2. Mode Prompt (research-mode | full-mode)
 *   2.5. Feature Prompts (tasks, etc. — conditional on feature flags)
 *   3. Context Sections (project data, research, documents, tasks)
 *
 * Tool instructions are NOT part of the system prompt — they live in
 * tool descriptions (tool-descriptions.ts) passed via the SDK's tool() field.
 */
export const systemPrompt = async ({
  mode = ChatMode.Full,
  enabledFeatures,
  projectName,
  researchAgentStatus,
  projectContextData,
  projectFieldsContext,
  savedResearchContext,
  unsavedResearchContext,
  projectDocumentsContext,
  projectTasksContext,
}: SystemPromptProps) => {
  // Fetch base prompts in parallel
  const [basePrompt, modePrompt] = await Promise.all([
    getPrompt("base-identity", { projectName }),
    getPrompt(mode),
  ]);

  // Layer 2.5: feature-conditional prompts
  const featurePrompts: string[] = [];
  if (enabledFeatures?.tasks) {
    featurePrompts.push(await getPrompt("tasks-prompt-additions"));
  }

  const currentDate = `Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

  // Assemble layers
  const layers = [basePrompt, currentDate, modePrompt, ...featurePrompts];

  // Context sections in priority order
  const contextSections = [
    researchAgentStatus,
    projectContextData,
    projectFieldsContext,
    savedResearchContext,
    unsavedResearchContext,
    projectDocumentsContext,
    enabledFeatures?.tasks ? projectTasksContext : undefined,
  ].filter(Boolean);

  return [...layers, ...contextSections].join("\n\n");
};
