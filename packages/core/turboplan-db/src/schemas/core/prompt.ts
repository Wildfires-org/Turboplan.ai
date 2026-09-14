import type { InferSelectModel } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Enum-like constant for prompt category keys.
 * Use this instead of raw strings: `PromptCategoryKey.ProjectChat`
 */
export const PromptCategoryKey = {
  ProjectChat: "project-chat",
  Project: "project",
  Artifacts: "artifacts",
  ResearchAgent: "research-agent",
  Tasks: "tasks",
  Tools: "tools",
  Other: "other",
} as const;

export type PromptCategory =
  (typeof PromptCategoryKey)[keyof typeof PromptCategoryKey];

/**
 * Prompt category metadata (label + description) keyed by PromptCategory.
 * The UI and seed code should derive from this object.
 */
export const PROMPT_CATEGORIES: Record<
  PromptCategory,
  { label: string; description: string }
> = {
  [PromptCategoryKey.ProjectChat]: {
    label: "Project Chat",
    description: "Core assistant behavior, onboarding, and chat suggestions",
  },
  [PromptCategoryKey.Artifacts]: {
    label: "Artifacts",
    description: "Document, code, and spreadsheet creation and updates",
  },
  [PromptCategoryKey.ResearchAgent]: {
    label: "Research Agent",
    description: "Deep analysis prompts and context injection",
  },
  [PromptCategoryKey.Project]: {
    label: "Project",
    description: "Project creation, validation, and comment handling",
  },
  [PromptCategoryKey.Tasks]: {
    label: "Tasks",
    description: "Task management and project planning",
  },
  [PromptCategoryKey.Tools]: {
    label: "Tools",
    description: "Tool descriptions passed to the AI SDK for tool calling",
  },
  [PromptCategoryKey.Other]: {
    label: "Other",
    description: "Title generation and miscellaneous prompts",
  },
};

/**
 * Represents a single version of a prompt stored in the versions JSONB array.
 */
export interface PromptVersion {
  version: number;
  content: string;
  notes: string | null;
  isActive: boolean;
  isHardcoded?: boolean;
  createdAt: string; // ISO date string
  createdBy: string | null; // References User.id from the user table, null for system-seeded prompts
}

/**
 * Prompt table for storing AI prompts with version history.
 *
 * The `versions` JSONB column contains an array of PromptVersion objects,
 * allowing full version history with rollback capability.
 */
export const prompt = pgTable("prompt", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 })
    .$type<PromptCategory>()
    .notNull()
    .default(PromptCategoryKey.Other),
  versions: jsonb("versions").$type<PromptVersion[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Prompt = InferSelectModel<typeof prompt>;
