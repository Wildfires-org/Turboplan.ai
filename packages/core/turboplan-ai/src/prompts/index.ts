/**
 * Prompt text and templates for TurboPlan
 *
 * Pure prompt content — no business logic. Logic lives in ../core/.
 * Organized into layers: base identity, mode prompts, tool prompts, context.
 */

import type { ArtifactKind } from "../types";
import {
  updateDocumentCodeTemplate,
  updateDocumentSheetTemplate,
  updateDocumentTextTemplate,
} from "./artifacts";

// Artifact prompts
// textDocumentPrompt alias (re-exported via artifacts.ts from nepa-document.ts)
export {
  codePrompt,
  sheetPrompt,
  textDocumentPrompt,
  updateDocumentCodeTemplate,
  updateDocumentSheetTemplate,
  updateDocumentTextTemplate,
} from "./artifacts";
// Other exports
export { commentAutoResponderPrompt } from "./auto-responder";
// Layer 1: Base Identity
export { baseIdentityPrompt } from "./base-identity";
export { fullModePrompt } from "./full-mode";
// Generate titles
export {
  generateTitlesSystemPrompt,
  generateTitlesUserPrompt,
} from "./generate-titles";
export {
  researchAgentForwardMessagesTemplate,
  researchAgentNoResultsContextTemplate,
  researchAgentSavedContextTemplate,
  researchAgentStartPromptTemplate,
  researchAgentUnsavedContextTemplate,
} from "./research-agent";
// Layer 2: Mode Prompts
export { researchModePrompt } from "./research-mode";
export {
  researchStatusCompleted,
  researchStatusDone,
  researchStatusRunning,
  researchStatusStarting,
} from "./research-status";
// Suggestion templates
export { emptyStateSuggestionsTemplate } from "./suggestions";
// Layer 2.5: Feature Prompts
export { tasksPromptAdditions } from "./tasks";
// Tool Descriptions (brief, for Vercel AI SDK tool() description field)
export {
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
} from "./tool-descriptions";
// Validate prompt
export { validatePromptSystemPrompt } from "./validate-prompt";

/**
 * Document update prompt generator for different artifact types
 * @deprecated Use updateDocument*Template with getPrompt() instead
 */
export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind,
) =>
  type === "text"
    ? updateDocumentTextTemplate.replace(
        /\{\{currentContent\}\}/g,
        currentContent || "",
      )
    : type === "code"
      ? updateDocumentCodeTemplate.replace(
          /\{\{currentContent\}\}/g,
          currentContent || "",
        )
      : type === "sheet"
        ? updateDocumentSheetTemplate.replace(
            /\{\{currentContent\}\}/g,
            currentContent || "",
          )
        : "";
