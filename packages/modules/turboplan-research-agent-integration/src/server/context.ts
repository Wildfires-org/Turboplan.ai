import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  isDocumentsPackageEnabled,
  isFieldsPackageEnabled,
  isProjectContextPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";

import type {
  ContextItem,
  ContextMessageData,
  DocumentItem,
  DocumentsMessageData,
  FieldItem,
  FieldsMessageData,
  MilestoneItem,
  MilestonesMessageData,
  TimelineItem,
  TimelineMessageData,
} from "../types";
import { ResearchAgentChatStatus, ResearchAgentMessageType } from "../types";
import {
  getResearchAgentChatByChatId,
  getResearchAgentMessagesByChatId,
} from "./repository";

const formatFields = (fields: FieldItem[]): string | undefined => {
  if (!fields.length) {
    return undefined;
  }
  const lines = fields.map((f) => `- **${f.label}**: ${f.value}`);
  return `## Key Project Fields\n${lines.join("\n")}`;
};

const formatMilestones = (milestones: MilestoneItem[]): string | undefined => {
  if (!milestones.length) {
    return undefined;
  }
  const lines = milestones.map(
    (m) => `- ${m.title} (${m.tasks?.length ?? 0} tasks)`,
  );
  return `## Proposed Milestones\n${lines.join("\n")}`;
};

const formatDocuments = (documents: DocumentItem[]): string | undefined => {
  if (!documents.length) {
    return undefined;
  }
  const lines = documents.map(
    (d) =>
      `- **${d.title}** (relevance: ${d.relevance}/100) — ${d.context} (Source: ${d.url})`,
  );
  return [
    "## Discovered Documents",
    "Each document title includes the official NEPA document type as a prefix (e.g. EIS, EA, ROD).",
    "Relevance (0-100) indicates how useful the document is for this project.",
    "Context explains why the document matters for project planning.\n",
    ...lines,
  ].join("\n");
};

const formatContext = (contextItems: ContextItem[]): string | undefined => {
  if (!contextItems.length) {
    return undefined;
  }
  const lines = contextItems.map(
    (c) =>
      `- **${c.label}**: ${c.content}${c.url ? ` (Source: ${c.url})` : ""}`,
  );
  return `## Research Context\n${lines.join("\n")}`;
};

const formatTimeline = (items: TimelineItem[]): string | undefined => {
  if (!items.length) {
    return undefined;
  }
  const lines = items.map((t) => {
    const dates = [t.startedAt, t.endedAt].filter(Boolean).join(" → ");
    const desc = t.description ? ` — ${t.description}` : "";
    return `- **${t.title}**${dates ? ` (${dates})` : ""}${desc}`;
  });
  return `## Project Timeline\n${lines.join("\n")}`;
};

export type ResearchAgentContextResult = {
  savedContext?: string;
  unsavedContext?: string;
  isActive: boolean;
  researchAgentStatus?: string;
};

/**
 * Load research agent results for a chat, split into saved and unsaved context.
 * When isResearchMode is true, also returns a researchAgentStatus string
 * (from prompt templates) indicating the agent's current state.
 *
 * Returns undefined only when there's nothing to report (no raChat and not in research mode).
 */
export const getResearchAgentContextForChat = async (
  chatId: string,
  options?: { isResearchMode?: boolean },
): Promise<ResearchAgentContextResult | undefined> => {
  const isResearchMode = options?.isResearchMode ?? false;
  const raChat = await getResearchAgentChatByChatId(chatId);

  if (!raChat) {
    // No research agent record — only relevant if we're in research mode (agent just launched)
    if (isResearchMode) {
      return {
        isActive: true,
        researchAgentStatus: await getPrompt("research-status-starting"),
      };
    }
    return undefined;
  }

  if (raChat.status === ResearchAgentChatStatus.FAILED) {
    return undefined;
  }

  const isActive =
    raChat.status === ResearchAgentChatStatus.INITIALIZING ||
    raChat.status === ResearchAgentChatStatus.QUEUED ||
    raChat.status === ResearchAgentChatStatus.RUNNING;

  const messages = await getResearchAgentMessagesByChatId(chatId);
  const savedSections: string[] = [];
  const unsavedSections: string[] = [];

  for (const msg of messages) {
    switch (msg.type) {
      case ResearchAgentMessageType.PROGRESS:
        continue;
      case ResearchAgentMessageType.FIELDS: {
        if (!isFieldsPackageEnabled()) {
          break;
        }
        const { fields } = msg.data as FieldsMessageData;
        const saved = fields.filter((f) => f.saved);
        const unsaved = fields.filter((f) => !f.saved);
        const savedSection = formatFields(saved);
        const unsavedSection = formatFields(unsaved);
        if (savedSection) {
          savedSections.push(savedSection);
        }
        if (unsavedSection) {
          unsavedSections.push(unsavedSection);
        }
        break;
      }
      case ResearchAgentMessageType.MILESTONES: {
        if (!isTasksPackageEnabled()) {
          break;
        }
        const { milestones } = msg.data as MilestonesMessageData;
        const saved = milestones.filter((m) => m.saved);
        const unsaved = milestones.filter((m) => !m.saved);
        const savedSection = formatMilestones(saved);
        const unsavedSection = formatMilestones(unsaved);
        if (savedSection) {
          savedSections.push(savedSection);
        }
        if (unsavedSection) {
          unsavedSections.push(unsavedSection);
        }
        break;
      }
      case ResearchAgentMessageType.DOCUMENTS: {
        if (!isDocumentsPackageEnabled()) {
          break;
        }
        const { documents } = msg.data as DocumentsMessageData;
        const saved = documents.filter((d) => d.saved);
        const unsaved = documents.filter((d) => !d.saved);
        const savedSection = formatDocuments(saved);
        const unsavedSection = formatDocuments(unsaved);
        if (savedSection) {
          savedSections.push(savedSection);
        }
        if (unsavedSection) {
          unsavedSections.push(unsavedSection);
        }
        break;
      }
      case ResearchAgentMessageType.CONTEXT: {
        if (!isProjectContextPackageEnabled()) {
          break;
        }
        const { context } = msg.data as ContextMessageData;
        const saved = context.filter((c) => c.saved);
        const unsaved = context.filter((c) => !c.saved);
        const savedSection = formatContext(saved);
        const unsavedSection = formatContext(unsaved);
        if (savedSection) {
          savedSections.push(savedSection);
        }
        if (unsavedSection) {
          unsavedSections.push(unsavedSection);
        }
        break;
      }
      case ResearchAgentMessageType.TIMELINE: {
        if (!isTimelineRecordsPackageEnabled()) {
          break;
        }
        const { timeline } = msg.data as TimelineMessageData;
        const saved = timeline.filter((t) => t.saved);
        const unsaved = timeline.filter((t) => !t.saved);
        const savedSection = formatTimeline(saved);
        const unsavedSection = formatTimeline(unsaved);
        if (savedSection) {
          savedSections.push(savedSection);
        }
        if (unsavedSection) {
          unsavedSections.push(unsavedSection);
        }
        break;
      }
    }
  }

  // Derive status string from prompt templates (always included)
  let researchAgentStatus: string;
  if (isActive) {
    researchAgentStatus = await getPrompt("research-status-running");
  } else if (isResearchMode) {
    researchAgentStatus = await getPrompt("research-status-completed");
  } else {
    researchAgentStatus = await getPrompt("research-status-done");
  }

  // If agent is still running and there are no results yet, return early with no-results context as unsaved
  if (isActive && savedSections.length === 0 && unsavedSections.length === 0) {
    const noResultsContext = await getPrompt(
      "research-agent-no-results-context",
    );
    return {
      unsavedContext: noResultsContext,
      isActive: true,
      researchAgentStatus,
    };
  }

  // If no results at all and agent is done, return with just status
  if (savedSections.length === 0 && unsavedSections.length === 0) {
    return {
      isActive: false,
      researchAgentStatus,
    };
  }

  // Build saved and unsaved context strings using templates
  const [savedContext, unsavedContext] = await Promise.all([
    savedSections.length > 0
      ? getPrompt("research-agent-saved-context", {
          sections: savedSections.join("\n\n"),
        })
      : Promise.resolve(undefined),
    unsavedSections.length > 0
      ? getPrompt("research-agent-unsaved-context", {
          sections: unsavedSections.join("\n\n"),
        })
      : Promise.resolve(undefined),
  ]);

  return {
    savedContext,
    unsavedContext,
    isActive,
    researchAgentStatus,
  };
};
