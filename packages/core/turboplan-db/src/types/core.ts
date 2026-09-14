/**
 * Core entity types - client-safe
 *
 * Re-exports types from database schemas using `export type` syntax,
 * which only imports type information without runtime Drizzle code.
 */

// =============================================================================
// Re-export types from schemas (client-safe via `export type`)
// =============================================================================

export type { Chat } from "../schemas/core/chat";
export type { Document } from "../schemas/core/document";
export type { GeneratedImage } from "../schemas/core/generated-images";
export type { DBMessage } from "../schemas/core/message";
export type { Profile } from "../schemas/core/profile";
export { UserRole } from "../schemas/core/profile";
export type {
  Prompt,
  PromptCategory,
  PromptVersion,
} from "../schemas/core/prompt";
export type { Suggestion } from "../schemas/core/suggestion";
export type { User } from "../schemas/core/user";
// Module types
export type { ProjectContext } from "../schemas/modules/project-context";

// =============================================================================
// Re-export constants (these have no Drizzle dependencies)
// =============================================================================

export { PROMPT_CATEGORIES, PromptCategoryKey } from "../schemas/core/prompt";

// =============================================================================
// Additional types not in schemas
// =============================================================================

/**
 * Document kind type - derived from the schema enum values
 */
export type DocumentKind = "text" | "tasks" | "map";
