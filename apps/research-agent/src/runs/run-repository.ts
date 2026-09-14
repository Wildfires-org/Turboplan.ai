/**
 * Run repository for persisting agent runs to database.
 */

import { eq, inArray, max, sql } from "drizzle-orm";

import {
  type AgentRunStatus,
  researchAgentRunLogs,
  researchAgentRunMessages,
  researchAgentRuns,
} from "@wildfires-org/turboplan-db";
import { type DbInstance, getDB } from "@wildfires-org/turboplan-db/db-client";

import type { AgentSkill } from "./types";

export type RunRecord = {
  runId: string;
  status: AgentRunStatus;
  prompt: string;
  resultJson?: string | null;
  errorJson?: string | null;
  sandboxId?: string | null;
  skill?: AgentSkill | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RunMessageRecord = {
  runId: string;
  role: string;
  content: string;
  sequenceNumber: number;
  createdAt: Date;
};

export type RunRepository = {
  create(params: {
    runId: string;
    prompt: string;
    status?: AgentRunStatus;
    skill?: AgentSkill;
  }): Promise<RunRecord>;
  getByRunId(runId: string): Promise<RunRecord | null>;
  updateStatus(
    runId: string,
    status: AgentRunStatus,
    data?: { resultJson?: string; errorJson?: string },
  ): Promise<RunRecord | null>;
  appendRunMessage(
    runId: string,
    role: string,
    content: string,
  ): Promise<RunMessageRecord>;
  listRunMessages(runId: string): Promise<RunMessageRecord[]>;
  updateSandboxId(runId: string, sandboxId: string): Promise<void>;
  findByStatuses(statuses: AgentRunStatus[]): Promise<RunRecord[]>;
  appendLogs(runId: string, messages: string[]): Promise<void>;
  listLogs(runId: string): Promise<string[]>;
  healthCheck(): Promise<boolean>;
};

export function createRunRepository(db: DbInstance = getDB()): RunRepository {
  return {
    async create({
      runId,
      prompt,
      status = "created",
      skill,
    }: {
      runId: string;
      prompt: string;
      status?: AgentRunStatus;
      skill?: AgentSkill;
    }) {
      const [row] = await db
        .insert(researchAgentRuns)
        .values({
          runId,
          prompt,
          status,
          skill,
        })
        .returning();

      if (!row) throw new Error("Failed to create run record");
      return row as RunRecord;
    },

    async getByRunId(runId: string) {
      const [row] = await db
        .select()
        .from(researchAgentRuns)
        .where(eq(researchAgentRuns.runId, runId))
        .limit(1);
      return (row as RunRecord) ?? null;
    },

    async updateStatus(runId, status, data) {
      const updates: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };
      if (data?.resultJson != null) updates.resultJson = data.resultJson;
      if (data?.errorJson != null) updates.errorJson = data.errorJson;

      const [row] = await db
        .update(researchAgentRuns)
        .set(updates as Record<string, string | Date>)
        .where(eq(researchAgentRuns.runId, runId))
        .returning();

      return (row as RunRecord) ?? null;
    },

    async updateSandboxId(runId: string, sandboxId: string) {
      await db
        .update(researchAgentRuns)
        .set({ sandboxId, updatedAt: new Date() })
        .where(eq(researchAgentRuns.runId, runId));
    },

    async findByStatuses(statuses: AgentRunStatus[]) {
      if (statuses.length === 0) return [];
      const rows = await db
        .select()
        .from(researchAgentRuns)
        .where(inArray(researchAgentRuns.status, statuses));
      return rows as RunRecord[];
    },

    async appendRunMessage(runId: string, role: string, content: string) {
      // Atomic sequenceNumber: single INSERT with a subquery that reads the current
      // max and increments it, avoiding a separate SELECT + INSERT race.
      const [row] = await db
        .insert(researchAgentRunMessages)
        .values({
          runId,
          role,
          content,
          sequenceNumber: sql<number>`coalesce((select ${max(researchAgentRunMessages.sequenceNumber)} from ${researchAgentRunMessages} where ${researchAgentRunMessages.runId} = ${runId}), -1) + 1`,
        })
        .returning();

      if (!row) throw new Error("Failed to append run message");
      return row as RunMessageRecord;
    },

    async listRunMessages(runId: string) {
      const rows = await db
        .select()
        .from(researchAgentRunMessages)
        .where(eq(researchAgentRunMessages.runId, runId))
        .orderBy(researchAgentRunMessages.sequenceNumber);
      return rows as RunMessageRecord[];
    },

    async appendLogs(runId: string, messages: string[]) {
      if (messages.length === 0) return;
      await db.insert(researchAgentRunLogs).values(
        messages.map((message) => ({
          runId,
          message,
        })),
      );
    },

    async listLogs(runId: string) {
      const rows = await db
        .select({ message: researchAgentRunLogs.message })
        .from(researchAgentRunLogs)
        .where(eq(researchAgentRunLogs.runId, runId))
        .orderBy(researchAgentRunLogs.createdAt);
      return rows.map((r) => r.message);
    },

    async healthCheck() {
      try {
        await db.select().from(researchAgentRuns).limit(1);
        return true;
      } catch {
        return false;
      }
    },
  };
}
