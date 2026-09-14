/**
 * Seed script to populate prompts from hardcoded values.
 *
 * Run with: pnpm seed:prompts
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// INIT_CWD is set by pnpm to the directory where the command was invoked.
// This lets us find the .env.local file regardless of which package cwd pnpm uses.
const root = process.env.INIT_CWD || process.cwd();
config({ path: resolve(root, "apps/turboplan/.env.local") });

// Dynamic imports: env must be loaded before these modules resolve (they trigger env validation)
const { closeDB, getDB } = await import(
  "@wildfires-org/turboplan-db/db-client"
);
const {
  createPrompt,
  createPromptVersion,
  deleteAllPrompts,
  getPromptByName,
  markHardcodedVersions,
} = await import("@wildfires-org/turboplan-db/queries");
const { getActivePromptVersion } = await import(
  "@wildfires-org/turboplan-db/utils"
);
const {
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
  toolDescGetContents,
  toolDescGenerateQuickResponses,
  toolDescReadProjectDocuments,
  toolDescRequestSuggestions,
  toolDescUpdateDocument,
  toolDescUpdateProjectContext,
  toolDescUpdateProjectFields,
  toolDescUpdateProjectFieldsProactive,
  toolDescWebSearch,
  updateDocumentCodeTemplate,
  updateDocumentSheetTemplate,
  updateDocumentTextTemplate,
  validatePromptSystemPrompt,
} = await import("../prompts");
const { generateTitlesSystemPrompt, generateTitlesUserPrompt } = await import(
  "../prompts/generate-titles"
);

import type { PromptCategory } from "@wildfires-org/turboplan-db";
import { PromptCategoryKey as C } from "@wildfires-org/turboplan-db";

interface PromptSeed {
  name: string;
  title: string;
  description: string;
  content: string;
  category: PromptCategory;
}

/**
 * Prompt seed data mapping name to content.
 */
const PROMPT_SEEDS: PromptSeed[] = [
  {
    name: "base-identity",
    title: "Base Identity Prompt",
    description: "Core assistant identity and rules (Layer 1)",
    content: baseIdentityPrompt,
    category: C.ProjectChat,
  },
  {
    name: "research-mode",
    title: "Research Mode Prompt",
    description: "Behavior prompt for research & clarify phase (Layer 2)",
    content: researchModePrompt,
    category: C.ProjectChat,
  },
  {
    name: "full-mode",
    title: "Full Mode Prompt",
    description: "Behavior prompt for full mode after research phase (Layer 2)",
    content: fullModePrompt,
    category: C.ProjectChat,
  },
  {
    name: "tool-desc-create-document",
    title: "Tool Description: Create Document",
    description:
      "Description for createDocument tool (base, without tasks/map sections)",
    content: toolDescCreateDocument,
    category: C.Tools,
  },
  {
    name: "tool-desc-create-document-tasks",
    title: "Tool Description: Create Document — Tasks",
    description:
      "Tasks section appended to createDocument description when tasks enabled",
    content: toolDescCreateDocumentTasks,
    category: C.Tools,
  },
  {
    name: "tool-desc-create-document-map",
    title: "Tool Description: Create Document — Map",
    description:
      "Map section appended to createDocument description when map enabled",
    content: toolDescCreateDocumentMap,
    category: C.Tools,
  },
  {
    name: "tool-desc-create-document-footer",
    title: "Tool Description: Create Document — Footer",
    description:
      "Footer appended to createDocument description after all sections",
    content: toolDescCreateDocumentFooter,
    category: C.Tools,
  },
  {
    name: "tool-desc-update-document",
    title: "Tool Description: Update Document",
    description: "Description for updateDocument tool",
    content: toolDescUpdateDocument,
    category: C.Tools,
  },
  {
    name: "tool-desc-request-suggestions",
    title: "Tool Description: Request Suggestions",
    description: "Description for requestSuggestions tool",
    content: toolDescRequestSuggestions,
    category: C.Tools,
  },
  {
    name: "tool-desc-generate-quick-responses",
    title: "Tool Description: Quick Responses",
    description: "Description for generateQuickResponses tool",
    content: toolDescGenerateQuickResponses,
    category: C.Tools,
  },
  {
    name: "tool-desc-web-search",
    title: "Tool Description: Web Search",
    description: "Description for webSearch tool",
    content: toolDescWebSearch,
    category: C.Tools,
  },
  {
    name: "tool-desc-get-contents",
    title: "Tool Description: Get Contents",
    description: "Description for getContents tool",
    content: toolDescGetContents,
    category: C.Tools,
  },
  {
    name: "tool-desc-read-project-documents",
    title: "Tool Description: Read Project Documents",
    description: "Description for readProjectDocuments tool",
    content: toolDescReadProjectDocuments,
    category: C.Tools,
  },
  {
    name: "tool-desc-update-project-context",
    title: "Tool Description: Update Project Context",
    description: "Description for updateProjectContext tool",
    content: toolDescUpdateProjectContext,
    category: C.Tools,
  },
  {
    name: "tool-desc-update-project-fields",
    title: "Tool Description: Update Project Fields",
    description: "Description for updateProjectFields tool",
    content: toolDescUpdateProjectFields,
    category: C.Tools,
  },
  {
    name: "tool-desc-update-project-fields-proactive",
    title: "Tool Description: Update Project Fields — Proactive",
    description:
      "Proactive field-creation addendum for updateProjectFields (brought-in projects)",
    content: toolDescUpdateProjectFieldsProactive,
    category: C.Tools,
  },
  {
    name: "empty-state-suggestions",
    title: "Empty State Suggestions Prompt",
    description:
      "Generates personalized suggestion pills for empty project states. Uses {{section}}, {{projectName}}, {{projectDescription}} variables.",
    content: emptyStateSuggestionsTemplate,
    category: C.ProjectChat,
  },
  {
    name: "code",
    title: "Code Generation Prompt",
    description: "Instructions for generating code snippets",
    content: codePrompt,
    category: C.Artifacts,
  },
  {
    name: "sheet",
    title: "Spreadsheet Prompt",
    description: "Instructions for creating spreadsheets",
    content: sheetPrompt,
    category: C.Artifacts,
  },
  {
    name: "text-document",
    title: "Text Document Prompt",
    description: "Instructions for creating text documents",
    content: textDocumentPrompt,
    category: C.Artifacts,
  },
  {
    name: "update-document-text",
    title: "Update Text Document Prompt",
    description:
      "Instructions for updating text documents. Uses {{currentContent}} variable.",
    content: updateDocumentTextTemplate,
    category: C.Artifacts,
  },
  {
    name: "update-document-code",
    title: "Update Code Document Prompt",
    description:
      "Instructions for updating code snippets. Uses {{currentContent}} variable.",
    content: updateDocumentCodeTemplate,
    category: C.Artifacts,
  },
  {
    name: "update-document-sheet",
    title: "Update Spreadsheet Prompt",
    description:
      "Instructions for updating spreadsheets. Uses {{currentContent}} variable.",
    content: updateDocumentSheetTemplate,
    category: C.Artifacts,
  },

  {
    name: "research-agent-start-prompt",
    title: "Research Agent Start Prompt",
    description:
      "Prompt sent to research agent to start analysis. Uses {{projectName}}, {{projectDescription}}, {{projectFields}}, {{projectContext}}, {{projectDocuments}}, {{recentConversation}} variables.",
    content: researchAgentStartPromptTemplate,
    category: C.ResearchAgent,
  },
  {
    name: "research-agent-no-results-context",
    title: "Research Agent No Results Context",
    description:
      "Injected into chat system prompt when analysis is running with no results yet.",
    content: researchAgentNoResultsContextTemplate,
    category: C.ResearchAgent,
  },
  {
    name: "research-agent-saved-context",
    title: "Research Agent Saved Context",
    description:
      "Injected into chat system prompt for user-confirmed research findings. Uses {{sections}} variable.",
    content: researchAgentSavedContextTemplate,
    category: C.ResearchAgent,
  },
  {
    name: "research-agent-unsaved-context",
    title: "Research Agent Unsaved Context",
    description:
      "Injected into chat system prompt for unconfirmed AI-generated findings. Uses {{sections}} variable.",
    content: researchAgentUnsavedContextTemplate,
    category: C.ResearchAgent,
  },
  {
    name: "research-agent-forward-messages",
    title: "Research Agent Forward Messages",
    description:
      "Sent to the running research agent when forwarding new chat messages. Uses {{messages}} variable.",
    content: researchAgentForwardMessagesTemplate,
    category: C.ResearchAgent,
  },
  {
    name: "research-status-starting",
    title: "Research Status: Starting",
    description:
      "Status indicator when the Research Agent was just launched. Shows both agent and phase status.",
    content: researchStatusStarting,
    category: C.ResearchAgent,
  },
  {
    name: "research-status-running",
    title: "Research Status: Running",
    description:
      "Status indicator when the Research Agent is actively analyzing. Shows both agent and phase status.",
    content: researchStatusRunning,
    category: C.ResearchAgent,
  },
  {
    name: "research-status-completed",
    title: "Research Status: Completed",
    description:
      "Status indicator when the Research Agent finished but user hasn't completed research review yet.",
    content: researchStatusCompleted,
    category: C.ResearchAgent,
  },
  {
    name: "research-status-done",
    title: "Research Status: Done",
    description:
      "Status indicator when both the Research Agent and research phase are complete.",
    content: researchStatusDone,
    category: C.ResearchAgent,
  },

  {
    name: "tasks-prompt-additions",
    title: "Tasks Prompt Additions",
    description: "Additional rules when tasks feature is enabled",
    content: tasksPromptAdditions,
    category: C.Tasks,
  },

  {
    name: "project-comment-auto-responder",
    title: "Project Comment Auto-Responder Prompt",
    description:
      "Generates automated acknowledgment replies to public project comments.",
    content: commentAutoResponderPrompt,
    category: C.Project,
  },
  {
    name: "project-create-prompt",
    title: "Project Create Prompt",
    description:
      "Rejects placeholder/gibberish project descriptions. Reports unmentioned areas (description, location, existing conditions) as advisory hints for the enhance action.",
    content: validatePromptSystemPrompt,
    category: C.Project,
  },

  {
    name: "generate-titles-system",
    title: "Generate Titles System Prompt",
    description: "System prompt for generating project and office titles",
    content: generateTitlesSystemPrompt,
    category: C.Other,
  },
  {
    name: "generate-titles-user",
    title: "Generate Titles User Prompt",
    description:
      "User prompt for generating titles. Uses {{description}} variable.",
    content: generateTitlesUserPrompt,
    category: C.Other,
  },
];

async function clearPrompts() {
  if (process.env.CI_SEED_DELETE_ALL_PROMPTS_BEFORE_SEEDING !== "true") {
    return;
  }

  console.log("🗑️  Clearing all existing prompts...\n");
  const deleted = await deleteAllPrompts();
  console.log(`🗑️  Deleted ${deleted} prompt(s)\n`);
}

async function seedPrompts() {
  console.log("🌱 Starting prompt seed...\n");

  // Ensure DB is initialized
  getDB();

  let created = 0;
  let refreshed = 0;
  let skipped = 0;

  for (const seed of PROMPT_SEEDS) {
    try {
      const existing = await getPromptByName(seed.name);

      if (existing) {
        const activeVersion = getActivePromptVersion(existing.versions);
        const isSeedOwned =
          !activeVersion ||
          activeVersion.isHardcoded ||
          activeVersion.createdBy === null;

        if (!isSeedOwned) {
          console.log(
            `⏭️  Skipped: ${seed.name} (active version is user-edited)`,
          );
          skipped++;
          continue;
        }

        if (activeVersion?.content === seed.content) {
          console.log(`⏭️  Skipped: ${seed.name} (up to date)`);
          skipped++;
          continue;
        }

        // Hardcoded content changed in code — publish it as a new seed-owned
        // version so DBs with USE_EXTERNAL_PROMPTS=true pick it up.
        await createPromptVersion({
          name: seed.name,
          content: seed.content,
          notes: "Refreshed from hardcoded seed",
          userId: null,
        });
        console.log(`🔄 Refreshed: ${seed.name}`);
        refreshed++;
        continue;
      }

      await createPrompt({
        name: seed.name,
        title: seed.title,
        description: seed.description,
        content: seed.content,
        category: seed.category,
        userId: null, // System-seeded prompts have no associated user
        isHardcoded: true,
      });

      console.log(`✅ Created: ${seed.name}`);
      created++;
    } catch (error) {
      console.error(`❌ Failed to seed ${seed.name}:`, error);
    }
  }

  console.log(
    `\n🌱 Seed complete: ${created} created, ${refreshed} refreshed, ${skipped} skipped`,
  );
}

/**
 * Mark existing seed-created versions with isHardcoded: true.
 * Handles databases seeded before the isHardcoded field was introduced.
 */
async function markExistingSeededVersions() {
  console.log("\n🏷️  Marking existing seeded versions...\n");

  let marked = 0;

  for (const seed of PROMPT_SEEDS) {
    try {
      const wasUpdated = await markHardcodedVersions(seed.name);
      if (wasUpdated) {
        console.log(`🏷️  Marked: ${seed.name}`);
        marked++;
      }
    } catch (error) {
      console.error(`❌ Failed to mark ${seed.name}:`, error);
    }
  }

  console.log(`\n🏷️  Done: ${marked} prompt(s) had versions marked as seeded`);
}

// Run the seed + migration
clearPrompts()
  .then(() => seedPrompts())
  .then(() => markExistingSeededVersions())
  .then(() => {
    console.log("\n✨ Done!");
    return closeDB();
  })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
