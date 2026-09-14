/**
 * Prompt service for TurboPlan
 *
 * Handles fetching prompts from database (when USE_EXTERNAL_PROMPTS is enabled)
 * or falling back to hardcoded prompts from the codebase.
 */

import { getPromptByName } from "@wildfires-org/turboplan-db/queries";
import { getActivePromptVersion } from "@wildfires-org/turboplan-db/utils";
import { isExternalPromptsEnabled } from "@wildfires-org/turboplan-env";

import { parsePromptVariables, type VariableContext } from "../core/variables";
import {
  baseIdentityPrompt,
  codePrompt,
  commentAutoResponderPrompt,
  emptyStateSuggestionsTemplate,
  fullModePrompt,
  researchAgentForwardMessagesTemplate,
  researchAgentNoResultsContextTemplate,
  researchAgentSavedContextTemplate,
  researchAgentStartPromptTemplate,
  researchAgentUnsavedContextTemplate,
  researchModePrompt,
  researchStatusCompleted,
  researchStatusDone,
  researchStatusRunning,
  researchStatusStarting,
  sheetPrompt,
  tasksPromptAdditions,
  textDocumentPrompt,
  toolDescCreateDocument,
  toolDescCreateDocumentFooter,
  toolDescCreateDocumentMap,
  toolDescCreateDocumentTasks,
  toolDescGenerateQuickResponses,
  toolDescGetContents,
  toolDescReadProjectDocuments,
  toolDescRequestSuggestions,
  toolDescResearchNotes,
  toolDescUpdateDocument,
  toolDescUpdateProjectContext,
  toolDescUpdateProjectFields,
  toolDescUpdateProjectFieldsProactive,
  toolDescWebSearch,
  updateDocumentCodeTemplate,
  updateDocumentSheetTemplate,
  updateDocumentTextTemplate,
} from "../prompts";
import { enhancePromptSystemPrompt } from "../prompts/enhance-prompt";
import {
  generateTitlesSystemPrompt,
  generateTitlesUserPrompt,
} from "../prompts/generate-titles";
import { validatePromptSystemPrompt } from "../prompts/validate-prompt";

/**
 * Mapping of prompt names to their hardcoded values.
 */
const HARDCODED_PROMPTS = {
  // Layer 1: Base Identity
  "base-identity": baseIdentityPrompt,
  // Layer 2: Mode Prompts
  "research-mode": researchModePrompt,
  "full-mode": fullModePrompt,
  // Layer 2.5: Feature Prompts
  "tasks-prompt-additions": tasksPromptAdditions,
  // Tool Descriptions (for Vercel AI SDK tool() description field)
  "tool-desc-create-document": toolDescCreateDocument,
  "tool-desc-create-document-tasks": toolDescCreateDocumentTasks,
  "tool-desc-create-document-map": toolDescCreateDocumentMap,
  "tool-desc-create-document-footer": toolDescCreateDocumentFooter,
  "tool-desc-update-document": toolDescUpdateDocument,
  "tool-desc-request-suggestions": toolDescRequestSuggestions,
  "tool-desc-generate-quick-responses": toolDescGenerateQuickResponses,
  "tool-desc-web-search": toolDescWebSearch,
  "tool-desc-get-contents": toolDescGetContents,
  "tool-desc-read-project-documents": toolDescReadProjectDocuments,
  "tool-desc-update-project-context": toolDescUpdateProjectContext,
  "tool-desc-update-project-fields": toolDescUpdateProjectFields,
  "tool-desc-update-project-fields-proactive":
    toolDescUpdateProjectFieldsProactive,
  "tool-desc-research-notes": toolDescResearchNotes,
  // Artifact creation prompts
  code: codePrompt,
  sheet: sheetPrompt,
  "text-document": textDocumentPrompt,
  // UI / suggestions
  "empty-state-suggestions": emptyStateSuggestionsTemplate,
  // Document update templates
  "update-document-text": updateDocumentTextTemplate,
  "update-document-code": updateDocumentCodeTemplate,
  "update-document-sheet": updateDocumentSheetTemplate,
  // Title generation
  "generate-titles-system": generateTitlesSystemPrompt,
  "generate-titles-user": generateTitlesUserPrompt,
  // Project
  "project-comment-auto-responder": commentAutoResponderPrompt,
  // Research agent
  "research-agent-start-prompt": researchAgentStartPromptTemplate,
  "research-agent-no-results-context": researchAgentNoResultsContextTemplate,
  "research-agent-saved-context": researchAgentSavedContextTemplate,
  "research-agent-unsaved-context": researchAgentUnsavedContextTemplate,
  "research-agent-forward-messages": researchAgentForwardMessagesTemplate,
  // Research agent status
  "research-status-starting": researchStatusStarting,
  "research-status-running": researchStatusRunning,
  "research-status-completed": researchStatusCompleted,
  "research-status-done": researchStatusDone,
  // Project
  "project-create-prompt": validatePromptSystemPrompt,
  "project-enhance-prompt": enhancePromptSystemPrompt,
} as const satisfies Record<string, string>;

export type PromptName = keyof typeof HARDCODED_PROMPTS;

/**
 * Get a prompt by name.
 *
 * When USE_EXTERNAL_PROMPTS is enabled:
 * - Fetches from database
 * - Falls back to hardcoded if not found
 *
 * When USE_EXTERNAL_PROMPTS is disabled:
 * - Returns hardcoded prompt directly
 *
 * @param name - The prompt name (e.g., "regular-prompt")
 * @param context - Optional variable context for replacement
 * @returns The prompt content with variables replaced
 */
export async function getPrompt(
  name: PromptName,
  context?: VariableContext,
): Promise<string> {
  let content: string;

  try {
    if (isExternalPromptsEnabled()) {
      // Try to fetch from database
      const dbPrompt = await getPromptByName(name);

      if (dbPrompt) {
        const activeVersion = getActivePromptVersion(dbPrompt.versions);
        if (activeVersion) {
          content = activeVersion.content;
        } else {
          // No active version, fall back to hardcoded
          content = getHardcodedPrompt(name);
        }
      } else {
        // Prompt not in database, fall back to hardcoded
        content = getHardcodedPrompt(name);
      }
    } else {
      // External prompts disabled, use hardcoded
      content = getHardcodedPrompt(name);
    }
  } catch (error) {
    // On any error, fall back to hardcoded
    console.error(`Error fetching prompt "${name}" from database:`, error);
    content = getHardcodedPrompt(name);
  }

  // Parse variables if context is provided
  if (context) {
    content = parsePromptVariables(content, context);
  }

  return content;
}

/**
 * Get a hardcoded prompt by name.
 * Throws an error if the prompt doesn't exist.
 */
function getHardcodedPrompt(name: PromptName): string {
  const prompt = HARDCODED_PROMPTS[name];

  if (prompt === undefined) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  return prompt;
}

/**
 * Get all available prompt names.
 */
export function getAvailablePromptNames(): PromptName[] {
  return Object.keys(HARDCODED_PROMPTS) as PromptName[];
}
