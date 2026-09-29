import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  max,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";

import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  chat,
  document,
  message,
  milestones as milestonesTable,
  projectField,
  type ResearchAgentChat,
  type ResearchAgentChatStatusType,
  type ResearchAgentMessage,
  researchAgentChat,
  researchAgentMessage,
  tasks as tasksTable,
} from "@wildfires-org/turboplan-db/schemas";
import type { Chat } from "@wildfires-org/turboplan-db/types";

import type {
  MilestoneSaveItem,
  MilestoneSaveLink,
  SuggestionsMessageData,
} from "../types";
import {
  ResearchAgentChatStatus,
  ResearchAgentMessageType,
  type ResearchAgentMessageTypeValue,
  TERMINAL_RESEARCH_AGENT_CHAT_STATUSES,
} from "../types";

async function withRepoError<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[research-agent] ${label}:`, error);
    throw error;
  }
}

// Chat/Project queries
export function getChatByProjectId(projectId: string): Promise<Chat | null> {
  return withRepoError("getChatByProjectId", async () => {
    const [chatRecord] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.projectId, projectId), eq(chat.isInitial, true)))
      .limit(1);
    return chatRecord ?? null;
  });
}

// Project field queries
export function getProjectFieldsByProjectId(
  projectId: string,
): Promise<{ name: string; values: string[] }[]> {
  return withRepoError("getProjectFieldsByProjectId", async () => {
    return db
      .select({
        name: projectField.name,
        values: projectField.values,
      })
      .from(projectField)
      .where(eq(projectField.projectId, projectId))
      .orderBy(asc(projectField.order));
  });
}

// Research agent chat queries
export function getResearchAgentChatByChatId(
  chatId: string,
): Promise<ResearchAgentChat | null> {
  return withRepoError("getResearchAgentChatByChatId", async () => {
    const [record] = await db
      .select()
      .from(researchAgentChat)
      .where(eq(researchAgentChat.chatId, chatId))
      .limit(1);
    return record ?? null;
  });
}

export function getActiveResearchAgentChatByChatId(
  chatId: string,
): Promise<ResearchAgentChat | null> {
  return withRepoError("getActiveResearchAgentChatByChatId", async () => {
    const [record] = await db
      .select()
      .from(researchAgentChat)
      .where(
        and(
          eq(researchAgentChat.chatId, chatId),
          inArray(researchAgentChat.status, [
            ResearchAgentChatStatus.INITIALIZING,
            ResearchAgentChatStatus.QUEUED,
            ResearchAgentChatStatus.RUNNING,
          ]),
        ),
      )
      .limit(1);
    return record ?? null;
  });
}

export function getResearchAgentChatByExternalId(
  externalRunId: string,
): Promise<ResearchAgentChat | null> {
  return withRepoError("getResearchAgentChatByExternalId", async () => {
    const [record] = await db
      .select()
      .from(researchAgentChat)
      .where(eq(researchAgentChat.externalRunId, externalRunId))
      .limit(1);
    return record ?? null;
  });
}

/**
 * Placeholder value the `webhook_secret` column defaulted to before it became
 * the sole authenticator for inbound webhooks. Never a valid secret.
 */
const LEGACY_WEBHOOK_SECRET = "legacy";

export type ResearchAgentChatWithProjectId = ResearchAgentChat & {
  projectId: string | null;
};

export function getResearchAgentChatByWebhookSecret(
  webhookSecret: string,
): Promise<ResearchAgentChatWithProjectId | null> {
  return withRepoError("getResearchAgentChatByWebhookSecret", async () => {
    const [record] = await db
      .select({
        id: researchAgentChat.id,
        chatId: researchAgentChat.chatId,
        externalRunId: researchAgentChat.externalRunId,
        webhookSecret: researchAgentChat.webhookSecret,
        status: researchAgentChat.status,
        currentStep: researchAgentChat.currentStep,
        lastForwardedAt: researchAgentChat.lastForwardedAt,
        createdAt: researchAgentChat.createdAt,
        updatedAt: researchAgentChat.updatedAt,
        projectId: chat.projectId,
      })
      .from(researchAgentChat)
      .innerJoin(chat, eq(researchAgentChat.chatId, chat.id))
      .where(
        and(
          eq(researchAgentChat.webhookSecret, webhookSecret),
          // Migration 0016 created this column with DEFAULT 'legacy'. Any row
          // never re-issued a real secret would otherwise let anyone on the
          // internet authenticate with `x-webhook-secret: legacy`. Migration
          // 0050 revokes those rows; this guard keeps them unauthenticable even
          // on a database where that backfill has not run.
          ne(researchAgentChat.webhookSecret, LEGACY_WEBHOOK_SECRET),
          // A finished run's secret must not authenticate forever: the agent
          // sandbox can leak it, and a leaked secret would otherwise keep
          // writing into the project chat. Retry rotates the secret.
          notInArray(
            researchAgentChat.status,
            TERMINAL_RESEARCH_AGENT_CHAT_STATUSES,
          ),
        ),
      )
      .limit(1);
    return record ?? null;
  });
}

export function createResearchAgentChat({
  chatId,
  externalRunId,
  webhookSecret,
}: {
  chatId: string;
  externalRunId?: string;
  webhookSecret: string;
}): Promise<ResearchAgentChat | null> {
  return withRepoError("createResearchAgentChat", async () => {
    const now = new Date();
    const [record] = await db
      .insert(researchAgentChat)
      .values({
        chatId,
        externalRunId,
        webhookSecret,
        status: ResearchAgentChatStatus.INITIALIZING,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: researchAgentChat.chatId })
      .returning();
    return record ?? null;
  });
}

export function resetResearchAgentChatForRetry({
  chatId,
  webhookSecret,
}: {
  chatId: string;
  webhookSecret: string;
}): Promise<ResearchAgentChat | null> {
  return withRepoError("resetResearchAgentChatForRetry", async () => {
    const [record] = await db
      .update(researchAgentChat)
      .set({
        webhookSecret,
        externalRunId: null,
        status: ResearchAgentChatStatus.INITIALIZING,
        currentStep: null,
        lastForwardedAt: null,
        // Reset createdAt so the UI elapsed timer measures THIS retry run,
        // not the original failed attempt.
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchAgentChat.chatId, chatId),
          inArray(researchAgentChat.status, [
            ResearchAgentChatStatus.FAILED,
            ResearchAgentChatStatus.CANCELLED,
          ]),
        ),
      )
      .returning();

    return record ?? null;
  });
}

export function updateResearchAgentChatStatus({
  chatId,
  status,
  currentStep,
}: {
  chatId: string;
  status: ResearchAgentChatStatusType;
  currentStep?: string;
}): Promise<ResearchAgentChat | null> {
  return withRepoError("updateResearchAgentChatStatus", async () => {
    const updateData: Partial<ResearchAgentChat> = {
      status,
      updatedAt: new Date(),
    };

    if (currentStep !== undefined) {
      updateData.currentStep = currentStep;
    }

    const [record] = await db
      .update(researchAgentChat)
      .set(updateData)
      .where(eq(researchAgentChat.chatId, chatId))
      .returning();

    return record ?? null;
  });
}

export function updateResearchAgentChatExternalId({
  chatId,
  externalRunId,
}: {
  chatId: string;
  externalRunId: string;
}): Promise<ResearchAgentChat | null> {
  return withRepoError("updateResearchAgentChatExternalId", async () => {
    const [record] = await db
      .update(researchAgentChat)
      .set({
        externalRunId,
        updatedAt: new Date(),
      })
      .where(eq(researchAgentChat.chatId, chatId))
      .returning();

    return record ?? null;
  });
}

export function updateResearchAgentChatByExternalId({
  externalRunId,
  status,
  currentStep,
}: {
  externalRunId: string;
  status?: ResearchAgentChatStatusType;
  currentStep?: string;
}): Promise<ResearchAgentChat | null> {
  return withRepoError("updateResearchAgentChatByExternalId", async () => {
    const updateData: Partial<ResearchAgentChat> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    if (currentStep !== undefined) {
      updateData.currentStep = currentStep;
    }

    const [record] = await db
      .update(researchAgentChat)
      .set(updateData)
      .where(
        and(
          eq(researchAgentChat.externalRunId, externalRunId),
          // Webhook-driven updates must never revive a finished run.
          notInArray(
            researchAgentChat.status,
            TERMINAL_RESEARCH_AGENT_CHAT_STATUSES,
          ),
        ),
      )
      .returning();

    return record ?? null;
  });
}

export function getNewChatMessagesSince(
  chatId: string,
  since: Date,
): Promise<{ id: string; role: string; parts: unknown; createdAt: Date }[]> {
  return withRepoError("getNewChatMessagesSince", async () => {
    return db
      .select({
        id: message.id,
        role: message.role,
        parts: message.parts,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(and(eq(message.chatId, chatId), gt(message.createdAt, since)))
      .orderBy(asc(message.createdAt));
  });
}

export function updateLastForwardedAt(
  chatId: string,
  lastForwardedAt: Date,
): Promise<void> {
  return withRepoError("updateLastForwardedAt", async () => {
    await db
      .update(researchAgentChat)
      .set({ lastForwardedAt })
      .where(eq(researchAgentChat.chatId, chatId));
  });
}

export function resetLastForwardedAtByChatId(chatId: string): Promise<void> {
  return withRepoError("resetLastForwardedAtByChatId", async () => {
    await db
      .update(researchAgentChat)
      .set({ lastForwardedAt: null })
      .where(eq(researchAgentChat.chatId, chatId));
  });
}

// Research agent message queries
export function createResearchAgentMessage({
  chatId,
  researchAgentChatId,
  type,
  data,
}: {
  chatId: string;
  researchAgentChatId: string;
  type: ResearchAgentMessageTypeValue;
  data: Record<string, unknown>;
}): Promise<ResearchAgentMessage> {
  return withRepoError("createResearchAgentMessage", async () => {
    const [record] = await db
      .insert(researchAgentMessage)
      .values({
        chatId,
        researchAgentChatId,
        type,
        data,
        createdAt: new Date(),
      })
      .returning();
    return record;
  });
}

export const upsertSuggestionsMessage = ({
  chatId,
  researchAgentChatId,
  data,
}: {
  chatId: string;
  researchAgentChatId: string;
  data: SuggestionsMessageData;
}): Promise<ResearchAgentMessage> => {
  return withRepoError("upsertSuggestionsMessage", async () => {
    return db.transaction(async (tx) => {
      await tx
        .delete(researchAgentMessage)
        .where(
          and(
            eq(researchAgentMessage.chatId, chatId),
            eq(researchAgentMessage.type, "suggestions"),
          ),
        );

      const [record] = await tx
        .insert(researchAgentMessage)
        .values({
          chatId,
          researchAgentChatId,
          type: "suggestions",
          data,
          createdAt: new Date(),
        })
        .returning();
      return record;
    });
  });
};

export function getResearchAgentMessagesByChatId(
  chatId: string,
): Promise<ResearchAgentMessage[]> {
  return withRepoError("getResearchAgentMessagesByChatId", async () => {
    return db
      .select()
      .from(researchAgentMessage)
      .where(eq(researchAgentMessage.chatId, chatId))
      .orderBy(researchAgentMessage.createdAt);
  });
}

export function getResearchAgentMessageById(
  messageId: string,
): Promise<ResearchAgentMessage | null> {
  return withRepoError("getResearchAgentMessageById", async () => {
    const [record] = await db
      .select()
      .from(researchAgentMessage)
      .where(eq(researchAgentMessage.id, messageId))
      .limit(1);
    return record ?? null;
  });
}

/**
 * Atomically appends an array of items into the current run's single message row
 * of the given type, creating the row on the first call. The agent sends a type
 * in multiple batches (e.g. one documents POST per reference project); they must
 * all land in one row because the panel renders only the latest row per type.
 *
 * Concurrency: a transaction-scoped advisory lock keyed on run + type serializes
 * overlapping webhook POSTs. Without it the read-modify-write below would lose
 * items — two concurrent batches both read the same row and the second
 * overwrites the first. Scoped by run (researchAgentChatId) so batches never
 * merge across runs; deduped by a stable key so retried POSTs don't duplicate.
 */
export function appendOrCreateRunArrayMessage<T>(params: {
  chatId: string;
  researchAgentChatId: string;
  type: ResearchAgentMessageTypeValue;
  key: string;
  items: T[];
  dedupeKey: (item: T) => string | null;
}): Promise<void> {
  const { chatId, researchAgentChatId, type, key, items, dedupeKey } = params;
  return withRepoError("appendOrCreateRunArrayMessage", async () => {
    await db.transaction(async (tx) => {
      // Serialize concurrent batches for this run+type; released at txn end.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${researchAgentChatId}:${type}`}))`,
      );

      const [existing] = await tx
        .select()
        .from(researchAgentMessage)
        .where(
          and(
            eq(researchAgentMessage.researchAgentChatId, researchAgentChatId),
            eq(researchAgentMessage.type, type),
          ),
        )
        .orderBy(desc(researchAgentMessage.createdAt))
        .limit(1);

      if (!existing) {
        await tx.insert(researchAgentMessage).values({
          chatId,
          researchAgentChatId,
          type,
          data: { [key]: items },
          createdAt: new Date(),
        });
        return;
      }

      const existingItems =
        ((existing.data as Record<string, unknown>)[key] as T[] | undefined) ??
        [];

      const seen = new Set<string>();
      for (const item of existingItems) {
        const dedupe = dedupeKey(item);
        if (dedupe !== null) {
          seen.add(dedupe);
        }
      }

      const merged = [...existingItems];
      for (const item of items) {
        const dedupe = dedupeKey(item);
        if (dedupe !== null && seen.has(dedupe)) {
          continue;
        }
        if (dedupe !== null) {
          seen.add(dedupe);
        }
        merged.push(item);
      }

      await updateResearchAgentMessageData(existing.id, { [key]: merged }, tx);
    });
  });
}

export function getResearchAgentMessageByIdAndProjectId(
  messageId: string,
  projectId: string,
): Promise<ResearchAgentMessage | null> {
  return withRepoError("getResearchAgentMessageByIdAndProjectId", async () => {
    const [record] = await db
      .select({ researchAgentMessage })
      .from(researchAgentMessage)
      .innerJoin(chat, eq(researchAgentMessage.chatId, chat.id))
      .where(
        and(
          eq(researchAgentMessage.id, messageId),
          eq(chat.projectId, projectId),
        ),
      )
      .limit(1);
    return record?.researchAgentMessage ?? null;
  });
}

export function updateResearchAgentMessageData(
  messageId: string,
  data: Record<string, unknown>,
  txOrDb: typeof db = db,
): Promise<ResearchAgentMessage | null> {
  return withRepoError("updateResearchAgentMessageData", async () => {
    const [record] = await txOrDb
      .update(researchAgentMessage)
      .set({ data })
      .where(eq(researchAgentMessage.id, messageId))
      .returning();
    return record ?? null;
  });
}

export function countProgressMessagesByChatId(chatId: string): Promise<number> {
  return withRepoError("countProgressMessagesByChatId", async () => {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchAgentMessage)
      .where(
        and(
          eq(researchAgentMessage.chatId, chatId),
          eq(researchAgentMessage.type, ResearchAgentMessageType.PROGRESS),
        ),
      );
    return result?.count ?? 0;
  });
}

// Save-to-project operations

export function insertProjectFields(
  projectId: string,
  fields: { label: string; value: string }[],
): Promise<void> {
  return withRepoError("insertProjectFields", async () => {
    await db.transaction(async (tx) => {
      const maxOrderResult = await tx
        .select({ maxOrder: max(projectField.order) })
        .from(projectField)
        .where(eq(projectField.projectId, projectId));

      let nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

      for (const field of fields) {
        await tx.insert(projectField).values({
          projectId,
          name: field.label.slice(0, 100),
          type: "text",
          order: nextOrder++,
          values: [field.value],
        });
      }
    });
  });
}

/**
 * Inserts (or reuses) research-agent milestones/tasks and returns artifact-to-project links.
 *
 * Behavior:
 * - reuses a single research-agent tasks document per project/title,
 * - resolves existing milestones/tasks by persisted project IDs first,
 * - falls back to case-insensitive title matching for backward compatibility,
 * - dedupes task inserts and returns mapping used to persist linkage in message data.
 */
export function insertMilestonesWithTasks(
  projectId: string,
  projectName: string,
  milestoneItems: MilestoneSaveItem[],
  userId: string,
): Promise<MilestoneSaveLink[]> {
  return withRepoError("insertMilestonesWithTasks", async () => {
    return db.transaction(async (tx) => {
      const savedLinks: MilestoneSaveLink[] = [];
      const researchDocumentTitle = `Research Agent - ${projectName}`;
      const [existingDocument] = await tx
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.title, researchDocumentTitle),
            eq(document.kind, "tasks"),
          ),
        )
        .limit(1);

      let documentId = existingDocument?.id;
      if (!documentId) {
        const [documentRecord] = await tx
          .insert(document)
          .values({
            title: researchDocumentTitle,
            kind: "tasks",
            userId,
            createdAt: new Date(),
          })
          .returning({ id: document.id });
        documentId = documentRecord.id;
      }
      if (!documentId) {
        throw new Error("Failed to resolve research-agent tasks document");
      }

      // Batch-fetch all milestones for this document in one query
      const allMilestoneRows = await tx
        .select({
          id: milestonesTable.id,
          title: milestonesTable.title,
          projectId: milestonesTable.projectId,
        })
        .from(milestonesTable)
        .where(eq(milestonesTable.documentId, documentId));

      const milestoneById = new Map(
        allMilestoneRows
          .filter((m) => m.projectId === projectId)
          .map((m) => [m.id, m]),
      );
      const milestoneByLowerTitle = new Map(
        allMilestoneRows.map((m) => [m.title.toLowerCase(), m.id]),
      );

      // Batch-fetch all tasks for those milestones in one query
      const milestoneIdList = allMilestoneRows.map((m) => m.id);
      const allTaskRows =
        milestoneIdList.length > 0
          ? await tx
              .select({
                id: tasksTable.id,
                title: tasksTable.title,
                milestoneId: tasksTable.milestoneId,
              })
              .from(tasksTable)
              .where(inArray(tasksTable.milestoneId, milestoneIdList))
          : [];

      // Build per-milestone task lookup maps
      const tasksByMilestone = new Map<
        string,
        { idSet: Set<string>; byTitle: Map<string, string> }
      >();
      for (const task of allTaskRows) {
        let entry = tasksByMilestone.get(task.milestoneId);
        if (!entry) {
          entry = { idSet: new Set(), byTitle: new Map() };
          tasksByMilestone.set(task.milestoneId, entry);
        }
        entry.idSet.add(task.id);
        entry.byTitle.set(task.title.trim().toLowerCase(), task.id);
      }

      for (const item of milestoneItems) {
        const now = new Date();
        let milestoneId: string | undefined;

        // Resolve by persisted project ID using in-memory map
        if (
          item.projectMilestoneId &&
          milestoneById.has(item.projectMilestoneId)
        ) {
          milestoneId = item.projectMilestoneId;
        }

        // Fallback: case-insensitive title match using in-memory map
        if (!milestoneId) {
          milestoneId = milestoneByLowerTitle.get(item.title.toLowerCase());
        }

        if (!milestoneId) {
          const [createdMilestone] = await tx
            .insert(milestonesTable)
            .values({
              title: item.title,
              startDate: item.startDate ? new Date(item.startDate) : now,
              dueDate: item.dueDate ? new Date(item.dueDate) : now,
              order: item.sourceIndex,
              documentId,
              projectId,
              userId,
            })
            .returning({ id: milestonesTable.id });
          milestoneId = createdMilestone.id;
          // Update maps for subsequent iterations
          milestoneById.set(milestoneId, {
            id: milestoneId,
            title: item.title,
            projectId,
          });
          milestoneByLowerTitle.set(item.title.toLowerCase(), milestoneId);
          tasksByMilestone.set(milestoneId, {
            idSet: new Set(),
            byTitle: new Map(),
          });
        }

        const taskLookup = tasksByMilestone.get(milestoneId) ?? {
          idSet: new Set<string>(),
          byTitle: new Map<string, string>(),
        };

        const taskLinks: MilestoneSaveLink["taskLinks"] = [];
        for (const task of item.tasks) {
          let taskId: string | undefined;
          if (task.projectTaskId && taskLookup.idSet.has(task.projectTaskId)) {
            taskId = task.projectTaskId;
          }

          const normalizedTitle = task.title.trim().toLowerCase();
          if (!taskId && taskLookup.byTitle.has(normalizedTitle)) {
            taskId = taskLookup.byTitle.get(normalizedTitle);
          }

          if (!taskId) {
            const [createdTask] = await tx
              .insert(tasksTable)
              .values({
                title: task.title,
                description: task.description,
                startDate: task.startDate ? new Date(task.startDate) : now,
                dueDate: task.dueDate ? new Date(task.dueDate) : now,
                dependencies: task.dependencies || [],
                order: task.sourceIndex,
                milestoneId,
                documentId,
                userId,
              })
              .returning({ id: tasksTable.id });
            taskId = createdTask.id;
            taskLookup.byTitle.set(normalizedTitle, taskId);
            taskLookup.idSet.add(taskId);
          }

          taskLinks.push({
            artifactId: task.artifactId,
            projectTaskId: taskId,
          });
        }

        savedLinks.push({
          artifactId: item.artifactId,
          projectMilestoneId: milestoneId,
          taskLinks,
        });
      }

      return savedLinks;
    });
  });
}

/**
 * Returns IDs that still exist in the milestones table.
 * Used by reconciliation to detect deleted linked milestones.
 */
export async function getExistingMilestoneIds(
  ids: string[],
  txOrDb: typeof db = db,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await txOrDb
    .select({ id: milestonesTable.id })
    .from(milestonesTable)
    .where(inArray(milestonesTable.id, ids));
  return new Set(rows.map((row) => row.id));
}

/**
 * Returns IDs that still exist in the tasks table.
 * Used by reconciliation to detect deleted linked tasks.
 */
export async function getExistingTaskIds(
  ids: string[],
  txOrDb: typeof db = db,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await txOrDb
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(inArray(tasksTable.id, ids));
  return new Set(rows.map((row) => row.id));
}
