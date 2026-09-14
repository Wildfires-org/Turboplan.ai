/**
 * Server-side AI service functions
 * Export standalone service functions that can be used in any backend context
 */

export { isExternalPromptsEnabled } from "@wildfires-org/turboplan-env";

export {
  type AutoGenerationResult,
  autoGenerateProjectCoverImage,
} from "./services/image-generation-service";
export {
  getAvailablePromptNames,
  getPrompt,
  type PromptName,
} from "./services/prompt-service";
