import { randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { generateObject, getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  meterAiCall,
  resolveBillingOrgForProject,
} from "@wildfires-org/turboplan-billing/server";
import { chat, type DBMessage } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  createProjectDocument,
  getProjectDocumentExtractionByIds,
  getProjectDocumentsByProjectId,
} from "@wildfires-org/turboplan-db/queries";
import type { ResearchAgentMessage as DbResearchAgentMessage } from "@wildfires-org/turboplan-db/schemas";
import {
  getProjectContextByProjectId,
  insertProjectContext,
} from "@wildfires-org/turboplan-project-context/server";
import { createTimelineRecordOrThrow } from "@wildfires-org/turboplan-timeline-records/server";
import { uploadFile } from "@wildfires-org/turboplan-upload/server";
import {
  isPrivateHost,
  isPrivateIpAddress,
} from "@wildfires-org/turboplan-utils/ssrf";
import { getProjectById } from "@wildfires-org/turboplan-workspace/server";

import { isPreviewableDocumentUrl } from "../../document-preview-utils";
import {
  type ContextItem,
  DEFAULT_SUGGESTION_TEMPLATES,
  type DocumentItem,
  type FieldItem,
  type MilestoneItem,
  type MilestoneSaveItem,
  type MilestonesMessageData,
  type MilestoneTaskSelection,
  ResearchAgentChatStatus,
  ResearchAgentMessageType,
  type SuggestionItem,
  type TaskItem,
  type TimelineItem,
} from "../../types";
import {
  buildSafeDocumentFilename,
  readBodyWithLimit,
  resolveDocumentMimeType,
} from "../document-utils";
import { getResearchAgentClient } from "../external-client";
import {
  getExistingMilestoneIds,
  getExistingTaskIds,
  getNewChatMessagesSince,
  getProjectFieldsByProjectId,
  getResearchAgentMessageByIdAndProjectId,
  insertMilestonesWithTasks,
  insertProjectFields,
  updateLastForwardedAt,
  updateResearchAgentChatExternalId,
  updateResearchAgentChatStatus,
  updateResearchAgentMessageData,
  upsertSuggestionsMessage,
} from "../repository";

// ---------------------------------------------------------------------------
// Format chat messages for research agent context
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 20;
// Conversation is largely redundant once uploaded docs/context are included, so
// it gets a smaller share of the overall start-prompt budget.
const MAX_CONVERSATION_CHARS = 2000;

type MessagePart = { type: string; text?: string };

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return (parts as MessagePart[])
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("\n");
}

export function formatChatMessagesForResearchAgent(
  messages: DBMessage[],
): string {
  const recent = messages.slice(-MAX_MESSAGES);
  const lines: string[] = [];
  let totalChars = 0;

  for (const msg of recent) {
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const text = extractTextFromParts(msg.parts).trim();
    if (!text) continue;

    const line = `${msg.role === "user" ? "User" : "Assistant"}: ${text}`;
    // Skip over-budget messages instead of breaking, so a single long message
    // doesn't silently drop every later message from the conversation context.
    if (totalChars + line.length > MAX_CONVERSATION_CHARS) continue;
    lines.push(line);
    totalChars += line.length;
  }

  return lines.join("\n\n");
}

// ---------------------------------------------------------------------------
// Gather additional project context for the research agent start prompt
// ---------------------------------------------------------------------------

// Per-section character budgets. Their sum plus template overhead and
// sanitizePromptValue expansion is kept comfortably under MAX_START_PROMPT_CHARS
// so the assembled start prompt clears the external service's hard 10k limit.
const MAX_FIELDS_CHARS = 800;
const MAX_CONTEXT_CHARS = 1800;
const MAX_DOCUMENTS = 5;
const MAX_DOCUMENTS_TOTAL_CHARS = 3600;

const TRUNCATION_MARKER = "\n[truncated]";

/**
 * Slice `value` so the returned string never exceeds `maxChars`. When content is
 * cut, a trailing `[truncated]` marker is appended (and still counted against
 * the budget), so the result length is always `<= maxChars`.
 */
const capValueToBudget = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= TRUNCATION_MARKER.length) {
    return value.slice(0, Math.max(0, maxChars));
  }
  return `${value.slice(0, maxChars - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`;
};

/**
 * Format the project's custom fields as `- Name: value1, value2` lines.
 * Fields with no non-empty values are skipped. Never throws — any failure
 * degrades to "N/A" so it can't fail or delay the research run.
 */
async function gatherProjectFieldsForResearchAgent(
  projectId: string,
): Promise<string> {
  try {
    const fields = await getProjectFieldsByProjectId(projectId);
    const lines = fields
      .map((field) => {
        const values = (field.values ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
        if (values.length === 0) {
          return null;
        }
        return `- ${field.name}: ${values.join(", ")}`;
      })
      .filter((line): line is string => line !== null);

    return lines.length > 0
      ? capValueToBudget(lines.join("\n"), MAX_FIELDS_CHARS)
      : "N/A";
  } catch (error) {
    console.error(
      "[bootstrapper] Failed to gather project fields for research agent:",
      error,
    );
    return "N/A";
  }
}

/**
 * Format saved project context entries as `## <label>\n<content>` blocks,
 * capping the total at {@link MAX_CONTEXT_CHARS}. Never throws — any failure
 * degrades to "N/A" so it can't fail or delay the research run.
 */
async function gatherProjectContextForResearchAgent(
  projectId: string,
): Promise<string> {
  try {
    const entries = await getProjectContextByProjectId(projectId);
    const blocks: string[] = [];
    let totalChars = 0;

    for (const entry of entries) {
      const content = (entry.content ?? "").trim();
      if (!content) {
        continue;
      }

      const block = `## ${entry.label}\n${content}`;
      if (totalChars + block.length > MAX_CONTEXT_CHARS) {
        const remaining = MAX_CONTEXT_CHARS - totalChars;
        if (remaining > 0) {
          blocks.push(`${block.slice(0, remaining)}\n[truncated]`);
        }
        break;
      }
      blocks.push(block);
      totalChars += block.length;
    }

    return blocks.length > 0 ? blocks.join("\n\n") : "N/A";
  } catch (error) {
    console.error(
      "[bootstrapper] Failed to gather project context for research agent:",
      error,
    );
    return "N/A";
  }
}

/**
 * Format the newest uploaded project documents as `## <originalFilename>\n<text>`
 * blocks, capping the total at {@link MAX_DOCUMENTS_TOTAL_CHARS}.
 *
 * Text is NOT extracted here — it is read from `extracted_text` on the document
 * row, written asynchronously by the research-agent service's extraction pass.
 * Documents whose extraction has not finished (or failed, or is unsupported)
 * are skipped and logged; nothing is downloaded or parsed on this Worker.
 * Never throws — any failure degrades to "N/A" so it can't fail or delay the
 * research run.
 */
async function gatherProjectDocumentsForResearchAgent(
  projectId: string,
): Promise<string> {
  try {
    const documents = await getProjectDocumentsByProjectId(projectId, "upload");
    if (documents.length === 0) {
      return "N/A";
    }

    // Documents are returned newest-first; take the most recent few.
    const recentDocuments = documents.slice(0, MAX_DOCUMENTS);
    const extractions = await getProjectDocumentExtractionByIds(
      recentDocuments.map((doc) => doc.id),
    );
    const extractionById = new Map(
      extractions.map((extraction) => [extraction.id, extraction]),
    );

    const blocks: string[] = [];
    let totalChars = 0;

    for (const doc of recentDocuments) {
      if (totalChars >= MAX_DOCUMENTS_TOTAL_CHARS) {
        break;
      }

      const extraction = extractionById.get(doc.id);
      if (!extraction || extraction.extractionStatus !== "done") {
        console.error(
          `[bootstrapper] Skipping document "${doc.originalFilename}" (${doc.id}) for research agent: extraction ${extraction?.extractionStatus ?? "missing"}${extraction?.extractionError ? ` (${extraction.extractionError})` : ""}`,
        );
        continue;
      }

      const text = (extraction.extractedText ?? "").trim();
      if (!text) {
        continue;
      }

      const header = `## ${doc.originalFilename}\n`;
      const remaining = MAX_DOCUMENTS_TOTAL_CHARS - totalChars - header.length;
      if (remaining <= 0) {
        break;
      }

      const isTruncated = text.length > remaining;
      const body = isTruncated
        ? `${text.slice(0, remaining)}\n[truncated]`
        : text;
      const block = `${header}${body}`;
      blocks.push(block);
      totalChars += block.length;
    }

    return blocks.length > 0 ? blocks.join("\n\n") : "N/A";
  } catch (error) {
    console.error(
      "[bootstrapper] Failed to gather project documents for research agent:",
      error,
    );
    return "N/A";
  }
}

// ---------------------------------------------------------------------------
// Start external service
// ---------------------------------------------------------------------------

// Neutralize closing-tag sequences so untrusted text cannot break out of the
// <user-data> wrapper tags in the research-agent start prompt.
const sanitizePromptValue = (value: string): string =>
  value.replace(/<\//g, "&lt;/");

// Mirrors the external research-agent service's hard limit: it rejects any start
// request whose `prompt` exceeds 10,000 characters (server-side, not
// configurable from this repo). All per-section caps and the final guard below
// exist to keep the assembled prompt under this ceiling.
const MAX_START_PROMPT_CHARS = 10_000;
const MAX_NAME_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 800;

export const startResearchAgent = async ({
  chatId,
  projectId,
  projectName,
  projectDescription,
  chatMessages,
  webhookSecret,
}: {
  chatId: string;
  projectId: string;
  projectName: string;
  projectDescription: string | null;
  chatMessages?: DBMessage[];
  webhookSecret: string;
}): Promise<void> => {
  try {
    const client = getResearchAgentClient();

    await updateResearchAgentChatStatus({
      chatId,
      status: ResearchAgentChatStatus.INITIALIZING,
      currentStep: "Loading project context...",
    });

    const conversationContext = chatMessages?.length
      ? formatChatMessagesForResearchAgent(chatMessages)
      : "";

    await updateResearchAgentChatStatus({
      chatId,
      status: ResearchAgentChatStatus.INITIALIZING,
      currentStep: "Preparing research prompt...",
    });

    // Gather DB-backed project data in parallel. Each gatherer degrades to
    // "N/A" on failure and never throws, so this can't fail or delay the run.
    const [projectFields, projectContext, projectDocuments] = await Promise.all(
      [
        gatherProjectFieldsForResearchAgent(projectId),
        gatherProjectContextForResearchAgent(projectId),
        gatherProjectDocumentsForResearchAgent(projectId),
      ],
    );

    // Apply per-section budgets, then sanitize at the choke point. (Fields,
    // context, documents and conversation are already capped by their gatherers;
    // name and description are capped here.)
    const cappedName = projectName.slice(0, MAX_NAME_CHARS);
    const cappedDescription = capValueToBudget(
      projectDescription ?? "N/A",
      MAX_DESCRIPTION_CHARS,
    );
    const cappedConversation = conversationContext || "N/A";

    const buildStartPrompt = (
      documentsValue: string,
      conversationValue: string,
    ): Promise<string> =>
      getPrompt("research-agent-start-prompt", {
        projectName: sanitizePromptValue(cappedName),
        projectDescription: sanitizePromptValue(cappedDescription),
        projectFields: sanitizePromptValue(projectFields),
        projectContext: sanitizePromptValue(projectContext),
        projectDocuments: sanitizePromptValue(documentsValue),
        recentConversation: sanitizePromptValue(conversationValue),
      });

    let documentsValue = projectDocuments;
    let conversationValue = cappedConversation;
    let prompt = await buildStartPrompt(documentsValue, conversationValue);

    // Belt-and-braces: per-section caps keep us under budget, but template
    // overhead and sanitize expansion can still push the assembled prompt over
    // the external service's hard limit. Trim the lowest-signal sections
    // (documents first, then conversation) by the current overage and re-check
    // after every rebuild — sanitize expansion means one raw-char trim can
    // undershoot, so a single pass is not guaranteed to fit. Never blindly
    // slice the assembled prompt — that would cut closing tags and the
    // trailing instruction. Four attempts empty both trimmable sections.
    for (
      let attempt = 0;
      prompt.length > MAX_START_PROMPT_CHARS && attempt < 4;
      attempt++
    ) {
      const overage = prompt.length - MAX_START_PROMPT_CHARS;
      if (documentsValue.length > 0) {
        documentsValue = capValueToBudget(
          documentsValue,
          Math.max(0, documentsValue.length - overage),
        );
      } else {
        conversationValue = capValueToBudget(
          conversationValue,
          Math.max(0, conversationValue.length - overage),
        );
      }
      console.warn(
        `[bootstrapper] Start prompt ${prompt.length} chars exceeds limit ${MAX_START_PROMPT_CHARS}; trimming (documents ${documentsValue.length}, conversation ${conversationValue.length} chars) and rebuilding.`,
      );
      prompt = await buildStartPrompt(documentsValue, conversationValue);
    }
    if (prompt.length > MAX_START_PROMPT_CHARS) {
      console.error(
        `[bootstrapper] Start prompt still ${prompt.length} chars over the ${MAX_START_PROMPT_CHARS} limit after trimming all trimmable sections; the external service may reject it.`,
      );
    }

    await updateResearchAgentChatStatus({
      chatId,
      status: ResearchAgentChatStatus.INITIALIZING,
      currentStep: "Connecting to research service...",
    });

    const { data, error } = await client.startRun({
      prompt,
      skill: "project-bootstrapper",
      projectId,
      webhookSecret,
    });

    if (error || !data) {
      console.error("[bootstrapper] Failed to start external service:", error);
      await updateResearchAgentChatStatus({
        chatId,
        status: ResearchAgentChatStatus.FAILED,
        currentStep: "Failed to start research agent service",
      });
      return;
    }

    await updateResearchAgentChatExternalId({
      chatId,
      externalRunId: data.runId,
    });
    await updateResearchAgentChatStatus({
      chatId,
      status: ResearchAgentChatStatus.RUNNING,
      currentStep: `Researching "${projectName}"...`,
    });
  } catch (error) {
    console.error(
      "[bootstrapper] Unexpected error starting external service:",
      error,
    );
    await updateResearchAgentChatStatus({
      chatId,
      status: ResearchAgentChatStatus.FAILED,
      currentStep: "Failed to start research agent service",
    }).catch((e) =>
      console.error("[bootstrapper] Failed to update status to FAILED:", e),
    );
  }
};

// ---------------------------------------------------------------------------
// Reconcile external status
// ---------------------------------------------------------------------------

/**
 * If the external agent finished but our DB still shows "active",
 * reconcile the DB and return the updated status/step.
 * Returns null when no reconciliation was needed.
 */
export async function reconcileExternalStatus(
  chatId: string,
  externalRunId: string,
): Promise<{ status: string; currentStep: string } | null> {
  try {
    const client = getResearchAgentClient();
    const { data: externalStatus } = await client.getRunStatus(externalRunId);

    if (!externalStatus) return null;

    const isExternalDone =
      externalStatus.status === "completed" ||
      externalStatus.status === "failed" ||
      externalStatus.status === "cancelled";

    if (!isExternalDone) return null;

    const reconciledStatus =
      externalStatus.status === "completed"
        ? ResearchAgentChatStatus.COMPLETED
        : ResearchAgentChatStatus.FAILED;

    const reconciledStep =
      externalStatus.status === "completed"
        ? "Analysis complete"
        : `Agent ${externalStatus.status}: ${externalStatus.lastError ?? "unknown error"}`;

    await updateResearchAgentChatStatus({
      chatId,
      status: reconciledStatus,
      currentStep: reconciledStep,
    });

    return { status: reconciledStatus, currentStep: reconciledStep };
  } catch (error) {
    console.error(
      "[bootstrapper-fallback] Failed to check external status:",
      error,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forward new chat messages to research agent during runtime (called from status poll)
// ---------------------------------------------------------------------------

/**
 * Query chat messages newer than the `lastForwardedAt` cursor, forward them
 * to the active research agent run via `add-context`, and advance the cursor.
 * Called from the status endpoint on each poll while the research agent is active.
 */
export async function forwardNewMessagesToResearchAgent(
  chatId: string,
  externalRunId: string,
  lastForwardedAt: Date | null,
): Promise<void> {
  try {
    const since = lastForwardedAt ?? new Date(0);
    const newMessages = await getNewChatMessagesSince(chatId, since);
    if (newMessages.length === 0) return;

    const lines = newMessages
      // Only forward USER messages. Forwarding assistant messages echoes the
      // chat AI's replies — and the agent's own progress that surfaces in chat —
      // back into the live run, so the agent keeps "responding to itself" and
      // burns extra turns as it finishes. The agent only needs new user input.
      .filter((m) => m.role === "user")
      .map((m) => {
        const text = extractTextFromParts(m.parts).trim();
        return text ? `User: ${text}` : null;
      })
      .filter(Boolean);

    if (lines.length === 0) return;

    const client = getResearchAgentClient();
    const { error } = await client.addContext(
      externalRunId,
      await getPrompt("research-agent-forward-messages", {
        messages: lines.join("\n\n"),
      }),
    );

    if (error) {
      console.error(
        `[bootstrapper] Failed to forward messages to research agent for chat ${chatId}:`,
        error,
      );
      return;
    }

    // Advance cursor to the latest message's createdAt
    const latestAt = newMessages[newMessages.length - 1].createdAt;
    await updateLastForwardedAt(chatId, latestAt);
  } catch (error) {
    console.error(
      "[bootstrapper] Unexpected error forwarding messages to research agent:",
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// Shared save-to-project validation
// ---------------------------------------------------------------------------

type ValidatedSaveRequest<T> = {
  items: T[];
  indicesToSave: number[];
  data: Record<string, unknown>;
  projectName: string;
};

/**
 * Look up the message, verify its type, verify the project exists,
 * and filter to valid unsaved indices. Throws if anything is invalid.
 */
async function validateAndFilterSaveRequest<T extends { saved: boolean }>(
  messageId: string,
  expectedType: string,
  projectId: string,
  itemIndices: number[],
  dataKey: string,
): Promise<ValidatedSaveRequest<T>> {
  const message = await getResearchAgentMessageByIdAndProjectId(
    messageId,
    projectId,
  );
  if (!message) throw new SaveError("Message not found", 404);
  if (message.type !== expectedType) {
    throw new SaveError(`Message is not a ${expectedType} message`, 400);
  }

  const project = await getProjectById(projectId);
  if (!project) throw new SaveError("Project not found", 404);

  const data = message.data as Record<string, unknown>;
  const items = data[dataKey] as T[];

  const indicesToSave = itemIndices.filter(
    (i) => i >= 0 && i < items.length && !items[i].saved,
  );
  if (indicesToSave.length === 0) {
    throw new SaveError("No unsaved items to save", 400);
  }

  return { items, indicesToSave, data, projectName: project.name };
}

export class SaveError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

function ensureMilestoneArtifactIds(milestones: MilestoneItem[]): boolean {
  let changed = false;
  for (const milestone of milestones) {
    if (!milestone.artifactId) {
      milestone.artifactId = randomUUID();
      changed = true;
    }
    for (const task of milestone.tasks) {
      if (!task.artifactId) {
        task.artifactId = randomUUID();
        changed = true;
      }
    }
  }
  return changed;
}

function normalizeTaskSavedState(task: TaskItem): boolean {
  if (task.projectTaskId && !task.saved) {
    task.saved = true;
    return true;
  }
  return false;
}

/**
 * Reconciles persisted milestone/task "saved" links against the current tasks DB.
 *
 * For each milestones message:
 * - ensures artifact IDs exist (backfill for older messages),
 * - clears broken `projectMilestoneId` / `projectTaskId` links when rows were deleted,
 * - recomputes `saved` flags from surviving links,
 * - persists the normalized payload only when changes are detected.
 *
 * A per-chat throttle guard skips the expensive DB reconciliation if it ran
 * within the last {@link RECONCILE_THROTTLE_MS} milliseconds.
 */

const RECONCILE_THROTTLE_MS = 30_000;
const lastReconciledAt = new Map<string, number>();

export async function reconcileSavedMilestonesInMessages(
  messages: DbResearchAgentMessage[],
): Promise<DbResearchAgentMessage[]> {
  const milestoneMessages = messages.filter(
    (message) => message.type === ResearchAgentMessageType.MILESTONES,
  );
  if (milestoneMessages.length === 0) {
    return messages;
  }

  // Throttle: skip reconciliation if it ran recently for this chat
  const chatId = milestoneMessages[0].chatId;
  const now = Date.now();
  const lastRun = lastReconciledAt.get(chatId);
  if (lastRun && now - lastRun < RECONCILE_THROTTLE_MS) {
    return messages;
  }

  const milestoneIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const message of milestoneMessages) {
    const data = (message.data as MilestonesMessageData) ?? { milestones: [] };
    for (const milestone of data.milestones ?? []) {
      if (milestone.projectMilestoneId) {
        milestoneIds.add(milestone.projectMilestoneId);
      }
      for (const task of milestone.tasks ?? []) {
        if (task.projectTaskId) {
          taskIds.add(task.projectTaskId);
        }
      }
    }
  }

  const nextMessages = await db.transaction(async (tx) => {
    const [existingMilestoneIds, existingTaskIds] = await Promise.all([
      getExistingMilestoneIds([...milestoneIds], tx),
      getExistingTaskIds([...taskIds], tx),
    ]);

    const txMessages = [...messages];
    for (const [index, message] of txMessages.entries()) {
      if (message.type !== ResearchAgentMessageType.MILESTONES) continue;

      const currentData = (message.data as MilestonesMessageData) ?? {
        milestones: [],
      };
      const nextMilestones = (currentData.milestones ?? []).map(
        (milestone) => ({
          ...milestone,
          tasks: (milestone.tasks ?? []).map((task) => ({ ...task })),
        }),
      );

      let changed = false;
      changed = ensureMilestoneArtifactIds(nextMilestones) || changed;

      for (const milestone of nextMilestones) {
        if (
          milestone.projectMilestoneId &&
          !existingMilestoneIds.has(milestone.projectMilestoneId)
        ) {
          milestone.projectMilestoneId = undefined;
          milestone.saved = false;
          changed = true;
        }

        for (const task of milestone.tasks) {
          if (task.projectTaskId && !existingTaskIds.has(task.projectTaskId)) {
            task.projectTaskId = undefined;
            if (task.saved) {
              task.saved = false;
            }
            changed = true;
            continue;
          }

          changed = normalizeTaskSavedState(task) || changed;
        }

        const hasLinkedState =
          Boolean(milestone.projectMilestoneId) ||
          milestone.tasks.some((task) => Boolean(task.projectTaskId));
        if (hasLinkedState) {
          const milestoneShouldBeSaved =
            milestone.tasks.length > 0 &&
            milestone.tasks.every((task) => Boolean(task.projectTaskId));
          if (milestone.saved !== milestoneShouldBeSaved) {
            milestone.saved = milestoneShouldBeSaved;
            changed = true;
          }
        }
      }

      if (changed) {
        const nextData = { ...currentData, milestones: nextMilestones };
        await updateResearchAgentMessageData(
          message.id,
          nextData as Record<string, unknown>,
          tx,
        );
        txMessages[index] = { ...message, data: nextData };
      }
    }

    return txMessages;
  });

  lastReconciledAt.set(chatId, Date.now());
  return nextMessages;
}

// ---------------------------------------------------------------------------
// Resolve document preview URL (on-demand blob upload)
// ---------------------------------------------------------------------------

const MAX_DOCUMENT_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "host.docker.internal",
  "gateway.docker.internal",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);
const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".lan",
  ".home",
  ".corp",
];

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) =>
    normalized.endsWith(suffix),
  );
}

export async function isSafeExternalUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  // The shared classifier covers IP literals (incl. IPv4-mapped, NAT64 and
  // 6to4 IPv6 forms); the local list adds internal-looking hostnames.
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || isBlockedHostname(hostname) || isPrivateHost(hostname)) {
    return false;
  }

  if (isIP(hostname.replace(/^\[|\]$/g, "")) !== 0) {
    return true;
  }

  try {
    const resolved = await dnsLookup(hostname, { all: true, verbatim: true });
    if (resolved.length === 0) {
      return false;
    }
    return resolved.every((entry) => !isPrivateIpAddress(entry.address));
  } catch {
    return false;
  }
}

export async function fetchWithValidatedRedirect(
  rawUrl: string,
  logPrefix: string,
): Promise<Response | null> {
  const initialResponse = await fetch(rawUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  if (initialResponse.status < 300 || initialResponse.status >= 400) {
    return initialResponse;
  }

  const location = initialResponse.headers.get("location");
  if (!location) {
    console.error(
      `[${logPrefix}] Blocking redirect for ${rawUrl}: missing location header`,
    );
    return null;
  }

  let redirectUrl: string;
  try {
    redirectUrl = new URL(location, rawUrl).toString();
  } catch {
    console.error(
      `[${logPrefix}] Blocking redirect for ${rawUrl}: invalid location ${location}`,
    );
    return null;
  }

  if (!(await isSafeExternalUrl(redirectUrl))) {
    console.error(
      `[${logPrefix}] Blocking unsafe redirect target: ${redirectUrl}`,
    );
    return null;
  }

  return fetch(redirectUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
}

// ---------------------------------------------------------------------------
// Download an external document into public blob storage
// ---------------------------------------------------------------------------

type StoredDocument = {
  url: string;
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
};

/**
 * Fetch an untrusted document URL and store it under `keyPrefix`. Only
 * allowlisted document MIME types are stored, and the stored type is the
 * allowlisted one — never the upstream header. The key's last segment is a
 * sanitised filename behind a random infix. Returns null (after logging) when
 * the document is unsafe, unreachable, too large or of an unsupported type.
 */
export async function downloadDocumentToStorage(
  doc: { url: string; title: string },
  keyPrefix: string,
  logPrefix: string,
): Promise<StoredDocument | null> {
  if (!(await isSafeExternalUrl(doc.url))) {
    console.error(`[${logPrefix}] Skipping unsafe URL: ${doc.url}`);
    return null;
  }

  const response = await fetchWithValidatedRedirect(doc.url, logPrefix);
  if (!response) {
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    console.error(
      `[${logPrefix}] Failed to fetch ${doc.url}: ${response.status}`,
    );
    return null;
  }

  const body = await readBodyWithLimit(response, MAX_DOCUMENT_DOWNLOAD_SIZE);
  if (!body) {
    console.error(`[${logPrefix}] Skipping ${doc.url}: exceeds 50MB limit`);
    return null;
  }

  const upstreamType = response.headers.get("content-type");
  const mimeType = resolveDocumentMimeType(upstreamType, body);
  if (!mimeType) {
    console.error(
      `[${logPrefix}] Skipping ${doc.url}: unsupported content type ${upstreamType}`,
    );
    return null;
  }

  const originalFilename = buildSafeDocumentFilename(
    doc.url,
    doc.title,
    mimeType,
  );
  const storedFilename = `${Date.now()}-${randomUUID()}-${originalFilename}`;
  const { url } = await uploadFile(
    `${keyPrefix}/${storedFilename}`,
    body,
    mimeType,
  );

  return {
    url,
    storedFilename,
    originalFilename,
    mimeType,
    size: body.byteLength,
  };
}

// The `uploads/{userId}/` prefix is what blob ownership checks rely on.
const researchAgentKeyPrefix = (userId: string, projectId: string) =>
  `uploads/${userId}/research-agent/${projectId}`;

// ---------------------------------------------------------------------------
// Cache a single document to blob storage (on-demand backfill)
// ---------------------------------------------------------------------------

export async function resolveDocumentPreviewUrl(
  messageId: string,
  documentIndex: number,
  documents: DocumentItem[],
  projectId: string,
  userId: string,
): Promise<{ blobUrl: string | null }> {
  const doc = documents[documentIndex];
  if (!doc) {
    return { blobUrl: null };
  }

  if (!isPreviewableDocumentUrl(doc.url)) {
    return { blobUrl: null };
  }

  try {
    const stored = await downloadDocumentToStorage(
      doc,
      researchAgentKeyPrefix(userId, projectId),
      "resolve-preview",
    );
    if (!stored) {
      return { blobUrl: null };
    }

    const blobUrl = stored.url;
    // Update the message data with the new blobUrl
    const updatedDocs = [...documents];
    updatedDocs[documentIndex] = { ...updatedDocs[documentIndex], blobUrl };
    await updateResearchAgentMessageData(messageId, {
      documents: updatedDocs,
    });

    return { blobUrl };
  } catch (err) {
    console.error(
      `[resolve-preview] Failed to cache document at index ${documentIndex}:`,
      err,
    );
    return { blobUrl: null };
  }
}

// ---------------------------------------------------------------------------
// Save fields
// ---------------------------------------------------------------------------

export async function saveFieldsToProject(
  messageId: string,
  projectId: string,
  itemIndices: number[],
) {
  const {
    items: fields,
    indicesToSave,
    data,
  } = await validateAndFilterSaveRequest<FieldItem>(
    messageId,
    ResearchAgentMessageType.FIELDS,
    projectId,
    itemIndices,
    "fields",
  );

  const fieldsToInsert = indicesToSave.map((idx) => fields[idx]);
  await insertProjectFields(projectId, fieldsToInsert);

  // Mark items as saved
  for (const idx of indicesToSave) {
    fields[idx].saved = true;
  }
  await updateResearchAgentMessageData(messageId, { ...data, fields });

  return { success: true, savedCount: indicesToSave.length };
}

// ---------------------------------------------------------------------------
// Save context
// ---------------------------------------------------------------------------

export async function saveContextToProject(
  messageId: string,
  projectId: string,
  itemIndices: number[],
  userId?: string,
) {
  const {
    items: contextItems,
    indicesToSave,
    data,
  } = await validateAndFilterSaveRequest<ContextItem>(
    messageId,
    ResearchAgentMessageType.CONTEXT,
    projectId,
    itemIndices,
    "context",
  );

  const itemsToInsert = indicesToSave.map((idx) => contextItems[idx]);
  await insertProjectContext(projectId, itemsToInsert, userId);

  // Mark items as saved
  for (const idx of indicesToSave) {
    contextItems[idx].saved = true;
  }
  await updateResearchAgentMessageData(messageId, {
    ...data,
    context: contextItems,
  });

  return { success: true, savedCount: indicesToSave.length };
}

// ---------------------------------------------------------------------------
// Save documents
// ---------------------------------------------------------------------------

export async function saveDocumentsToProject(
  messageId: string,
  projectId: string,
  itemIndices: number[],
  userId: string,
) {
  const {
    items: documents,
    indicesToSave,
    data,
  } = await validateAndFilterSaveRequest<DocumentItem>(
    messageId,
    ResearchAgentMessageType.DOCUMENTS,
    projectId,
    itemIndices,
    "documents",
  );

  const savedIndices: number[] = [];
  const skipped: string[] = [];
  for (const idx of indicesToSave) {
    const doc = documents[idx];
    try {
      // Non-downloadable document (e.g. HTML page) — save as link reference only.
      if (!isPreviewableDocumentUrl(doc.url)) {
        await createProjectDocument({
          projectId,
          userId,
          filename: doc.title,
          originalFilename: doc.title,
          mimeType: "text/html",
          size: 0,
          url: doc.url,
          source: "research",
          relevance: doc.relevance,
          context: doc.context,
          folder: doc.folder,
          folderDescription: doc.folderDescription,
        });
        savedIndices.push(idx);
        continue;
      }

      // If the document was already cached to blob storage during preview,
      // reuse the existing blobUrl and skip re-download + re-upload.
      if (doc.blobUrl) {
        const headResponse = await fetch(doc.blobUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(30_000),
        });
        if (!headResponse.ok) {
          console.error(
            `[save-documents] HEAD request failed for cached blob ${doc.blobUrl}: ${headResponse.status}`,
          );
          skipped.push(doc.title);
          continue;
        }

        // Blobs cached before the MIME allowlist may carry an upstream type.
        const upstreamType = headResponse.headers.get("content-type");
        const mimeType = resolveDocumentMimeType(
          upstreamType,
          new Uint8Array(),
        );
        if (!mimeType) {
          console.error(
            `[save-documents] Skipping cached blob ${doc.blobUrl}: unsupported content type ${upstreamType}`,
          );
          skipped.push(doc.title);
          continue;
        }
        const size = Number(headResponse.headers.get("content-length") || 0);

        const originalFilename = buildSafeDocumentFilename(
          doc.url,
          doc.title,
          mimeType,
        );

        await createProjectDocument({
          projectId,
          userId,
          filename: doc.blobUrl.split("/").pop() || originalFilename,
          originalFilename,
          mimeType,
          size,
          url: doc.blobUrl,
          source: "research",
          relevance: doc.relevance,
          context: doc.context,
          folder: doc.folder,
          folderDescription: doc.folderDescription,
        });

        savedIndices.push(idx);
        continue;
      }

      // No cached blob — download from the original URL and upload to blob storage.
      const stored = await downloadDocumentToStorage(
        doc,
        researchAgentKeyPrefix(userId, projectId),
        "save-documents",
      );
      if (!stored) {
        skipped.push(doc.title);
        continue;
      }

      await createProjectDocument({
        projectId,
        userId,
        filename: stored.storedFilename,
        originalFilename: stored.originalFilename,
        mimeType: stored.mimeType,
        size: stored.size,
        url: stored.url,
        source: "research",
        relevance: doc.relevance,
        context: doc.context,
        folder: doc.folder,
        folderDescription: doc.folderDescription,
      });

      // Write blobUrl back so future preview won't re-upload
      doc.blobUrl = stored.url;

      savedIndices.push(idx);
    } catch (err) {
      console.error(
        `[save-documents] Failed to save document at index ${idx}:`,
        err,
      );
    }
  }

  if (savedIndices.length === 0) {
    throw new SaveError("Failed to save any documents", 500);
  }

  for (const idx of savedIndices) {
    documents[idx].saved = true;
  }
  await updateResearchAgentMessageData(messageId, { ...data, documents });

  return {
    success: true,
    savedCount: savedIndices.length,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// Save milestones
// ---------------------------------------------------------------------------

/**
 * Saves selected milestone tasks to project tasks and persists bidirectional links.
 *
 * This function:
 * - validates the milestones message + project context,
 * - builds a filtered selection of unsaved tasks,
 * - inserts/upserts into project milestones/tasks via repository,
 * - stores `projectMilestoneId` / `projectTaskId` links back on artifact items,
 * - derives milestone/task `saved` state from those links.
 */
export async function saveMilestonesToProject(
  messageId: string,
  projectId: string,
  selections: MilestoneTaskSelection[],
  userId: string,
) {
  const message = await getResearchAgentMessageByIdAndProjectId(
    messageId,
    projectId,
  );
  if (!message) throw new SaveError("Message not found", 404);
  if (message.type !== ResearchAgentMessageType.MILESTONES) {
    throw new SaveError("Message is not a milestones message", 400);
  }

  const project = await getProjectById(projectId);
  if (!project) throw new SaveError("Project not found", 404);

  const data = message.data as Record<string, unknown>;
  const milestoneItems = (data.milestones as MilestoneItem[]) ?? [];
  const idsChanged = ensureMilestoneArtifactIds(milestoneItems);
  const milestonesToInsert: MilestoneSaveItem[] = [];
  const selectedTaskIndicesByMilestone = new Map<number, Set<number>>();

  for (const selection of selections) {
    const { milestoneIndex, taskIndices } = selection;
    const milestone = milestoneItems[milestoneIndex];
    if (
      milestoneIndex < 0 ||
      milestoneIndex >= milestoneItems.length ||
      !milestone
    ) {
      continue;
    }

    const validTaskIndices = [...new Set(taskIndices)].filter(
      (taskIndex) =>
        taskIndex >= 0 &&
        taskIndex < milestone.tasks.length &&
        !milestone.tasks[taskIndex]?.projectTaskId,
    );

    if (validTaskIndices.length === 0) {
      continue;
    }

    const taskSet =
      selectedTaskIndicesByMilestone.get(milestoneIndex) ?? new Set();
    for (const taskIndex of validTaskIndices) {
      taskSet.add(taskIndex);
    }
    selectedTaskIndicesByMilestone.set(milestoneIndex, taskSet);
  }

  for (const [milestoneIndex, taskIndexSet] of selectedTaskIndicesByMilestone) {
    const milestone = milestoneItems[milestoneIndex];
    const validTaskIndices = [...taskIndexSet].sort((a, b) => a - b);
    if (validTaskIndices.length === 0) {
      continue;
    }

    const selectedTasks = validTaskIndices.map((taskIndex) => {
      const task = milestone.tasks[taskIndex];
      return {
        ...task,
        artifactId: task.artifactId!,
        sourceIndex: taskIndex,
      };
    });
    milestonesToInsert.push({
      artifactId: milestone.artifactId!,
      title: milestone.title,
      startDate: milestone.startDate,
      dueDate: milestone.dueDate,
      projectMilestoneId: milestone.projectMilestoneId,
      sourceIndex: milestoneIndex,
      tasks: selectedTasks,
    });
  }

  if (milestonesToInsert.length === 0) {
    if (idsChanged) {
      await updateResearchAgentMessageData(messageId, {
        ...data,
        milestones: milestoneItems,
      });
    }
    throw new SaveError("No unsaved items to save", 400);
  }

  const saveLinks = await insertMilestonesWithTasks(
    projectId,
    project.name,
    milestonesToInsert,
    userId,
  );

  const milestoneByArtifactId = new Map(
    milestoneItems.map((milestone) => [milestone.artifactId, milestone]),
  );

  for (const link of saveLinks) {
    const milestone = milestoneByArtifactId.get(link.artifactId);
    if (!milestone) continue;

    milestone.projectMilestoneId = link.projectMilestoneId;

    const taskByArtifactId = new Map(
      milestone.tasks.map((task) => [task.artifactId, task]),
    );
    for (const taskLink of link.taskLinks) {
      const task = taskByArtifactId.get(taskLink.artifactId);
      if (!task) continue;
      task.projectTaskId = taskLink.projectTaskId;
      task.saved = true;
    }

    milestone.saved = milestone.tasks.every((task) =>
      Boolean(task.projectTaskId),
    );
  }
  await updateResearchAgentMessageData(messageId, {
    ...data,
    milestones: milestoneItems,
  });

  return {
    success: true,
    savedCount: saveLinks.reduce(
      (acc, milestoneLink) => acc + milestoneLink.taskLinks.length,
      0,
    ),
  };
}

// ---------------------------------------------------------------------------
// Save timeline
// ---------------------------------------------------------------------------

export async function saveTimelineToProject(
  messageId: string,
  projectId: string,
  itemIndices: number[],
  userId: string,
) {
  const {
    items: timeline,
    indicesToSave,
    data,
  } = await validateAndFilterSaveRequest<TimelineItem>(
    messageId,
    ResearchAgentMessageType.TIMELINE,
    projectId,
    itemIndices,
    "timeline",
  );

  const project = await getProjectById(projectId);
  if (!project) {
    throw new SaveError("Project not found", 404);
  }

  const results = await Promise.allSettled(
    indicesToSave.map((idx) => {
      const item = timeline[idx];
      return createTimelineRecordOrThrow({
        projectId,
        userId,
        entityType: "project",
        entityId: projectId,
        entityName: project.name,
        action: "created",
        title: item.title,
        description: item.description,
        isPublic: true, // because all research agent findings are public
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        resourceUrls: item.resourceUrls,
        metadata: item.metadata,
      });
    }),
  );

  // Partial success: only mark items whose DB insert actually succeeded
  // as saved. Failures are logged so the UI count doesn't lie to the user.
  let savedCount = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      timeline[indicesToSave[i]].saved = true;
      savedCount++;
      return;
    }
    console.error(
      "[saveTimelineToProject] Failed to insert timeline record:",
      result.reason,
    );
  });

  await updateResearchAgentMessageData(messageId, { ...data, timeline });

  return { success: true, savedCount };
}

// ---------------------------------------------------------------------------
// Generate suggestions from milestones (fire-and-forget)
// ---------------------------------------------------------------------------

const suggestionItemSchema = z.object({
  label: z
    .string()
    .describe(
      "Short action chip label, 2-5 words, e.g. 'Draft Scoping Letter'",
    ),
  content: z
    .string()
    .describe(
      "Short imperative sentence to send as chat message, max 10-15 words, e.g. 'Draft a scoping letter for the project'",
    ),
  emoji: z
    .string()
    .describe(
      "Single emoji representing the action, e.g. '📝' for drafting, '🔍' for analysis, '📊' for reports",
    ),
});

/** chat → project → org, for attributing the local chip generation. */
const resolveBillingOrgForProjectByChatId = async (
  chatId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ projectId: chat.projectId })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);
  if (!row?.projectId) {
    return null;
  }
  return resolveBillingOrgForProject(row.projectId);
};

export const generateSuggestionsFromMilestones = async ({
  chatId,
  researchAgentChatId,
  milestones,
  projectName,
}: {
  chatId: string;
  researchAgentChatId: string;
  milestones: MilestoneItem[];
  projectName: string;
}): Promise<void> => {
  try {
    const result = await generateObject({
      model: await getModel("lite"),
      system: `You generate short action chip suggestions for a project chat UI. Rules:
- label: 2-5 words, imperative verb phrase (e.g. "Draft Scoping Letter", "Write Purpose Statement")
- content: single short imperative sentence, max 15 words (e.g. "Draft a scoping letter for the project")
- emoji: single emoji that best represents the action. Every suggestion MUST have a unique emoji — no duplicates. Avoid 📝, 📋, 📄, ⚖️, and 📅 (already used by fixed suggestions). Use varied, descriptive emojis (e.g. "🔍" for analysis, "📊" for reports, "🗺️" for mapping, "🌲" for forestry, "📐" for planning, "🏗️" for construction, "🦅" for wildlife, "💧" for water/watershed).
- NO questions. NO explanations. Just direct action requests.
- Order by workflow priority: what needs to happen first comes first.
- Cover diverse deliverables: consultation letters, resource analyses, surveys, monitoring plans, contracts, and other documents relevant to the milestones.
- Focus on document creation, planning, and key deliverables from the milestones.`,
      prompt: `Project: ${projectName}\n\nMilestones and tasks:\n${milestones.map((m) => `- ${m.title}\n${m.tasks.map((t) => `  - ${t.title}`).join("\n")}`).join("\n")}\n\nGenerate 5-8 action chip suggestions. Do NOT generate suggestions for scoping letters, proposed actions, purpose & need, decision memos, or project schedules — those are already included separately.`,
      output: "array",
      schema: suggestionItemSchema,
    });

    // Consume-only: the run itself was flat-charged at start; this local
    // chip generation is an extra lite call attributed to the same project.
    const chipBillingOrgId = await resolveBillingOrgForProjectByChatId(chatId);
    await meterAiCall({
      billing: chipBillingOrgId ? { organizationId: chipBillingOrgId } : null,
      source: "research_agent",
      usage: result.usage,
      providerMetadata: result.providerMetadata,
      metadata: { tool: "suggestionChips", researchAgentChatId },
    });

    const generated = result.object as SuggestionItem[];

    const fixedSuggestions: SuggestionItem[] = DEFAULT_SUGGESTION_TEMPLATES.map(
      (t) => ({
        label: t.label,
        content: t.contentTemplate.replace("{projectName}", projectName),
        emoji: t.emoji,
      }),
    );

    const dynamicSuggestions: SuggestionItem[] = generated
      .slice(0, 8)
      .map((s) => ({
        label: s.label,
        content: s.content,
        emoji: s.emoji,
      }));

    const suggestions = [...fixedSuggestions, ...dynamicSuggestions];

    await upsertSuggestionsMessage({
      chatId,
      researchAgentChatId,
      data: { suggestions },
    });
  } catch (error) {
    console.error(
      "[bootstrapper] Failed to generate suggestions from milestones:",
      error,
    );
  }
};
