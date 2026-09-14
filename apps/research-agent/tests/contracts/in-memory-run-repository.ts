import type { AgentRunStatus } from "@wildfires-org/turboplan-db";

import type {
  RunMessageRecord,
  RunRecord,
  RunRepository,
} from "../../src/runs/run-repository";

type CreateParams = {
  runId: string;
  prompt: string;
  status?: AgentRunStatus;
};

export function createInMemoryRunRepository(): RunRepository {
  const runs = new Map<string, RunRecord>();
  const messages = new Map<string, RunMessageRecord[]>();
  const logs = new Map<string, string[]>();

  return {
    async create(params: CreateParams): Promise<RunRecord> {
      const now = new Date();
      const row: RunRecord = {
        runId: params.runId,
        status: params.status ?? "created",
        prompt: params.prompt,
        resultJson: null,
        errorJson: null,
        createdAt: now,
        updatedAt: now,
      };
      runs.set(params.runId, row);
      return row;
    },

    async getByRunId(runId: string): Promise<RunRecord | null> {
      return runs.get(runId) ?? null;
    },

    async updateStatus(
      runId: string,
      status: AgentRunStatus,
      data?: {
        resultJson?: string;
        errorJson?: string;
      },
    ): Promise<RunRecord | null> {
      const existing = runs.get(runId);
      if (!existing) {
        return null;
      }

      const updated: RunRecord = {
        ...existing,
        status,
        resultJson: data?.resultJson ?? existing.resultJson ?? null,
        errorJson: data?.errorJson ?? existing.errorJson ?? null,
        updatedAt: new Date(),
      };
      runs.set(runId, updated);
      return updated;
    },

    async appendRunMessage(
      runId: string,
      role: string,
      content: string,
    ): Promise<RunMessageRecord> {
      const list = messages.get(runId) ?? [];
      const row: RunMessageRecord = {
        runId,
        role,
        content,
        sequenceNumber: list.length,
        createdAt: new Date(),
      };
      list.push(row);
      messages.set(runId, list);
      return row;
    },

    async listRunMessages(runId: string): Promise<RunMessageRecord[]> {
      const list = messages.get(runId) ?? [];
      return [...list].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    },

    async updateSandboxId(runId: string, sandboxId: string): Promise<void> {
      const existing = runs.get(runId);
      if (existing) {
        existing.sandboxId = sandboxId;
        existing.updatedAt = new Date();
      }
    },

    async findByStatuses(statuses: AgentRunStatus[]): Promise<RunRecord[]> {
      return [...runs.values()].filter((r) =>
        statuses.includes(r.status as AgentRunStatus),
      );
    },

    async appendLogs(runId: string, messages: string[]): Promise<void> {
      const existing = logs.get(runId) ?? [];
      existing.push(...messages);
      logs.set(runId, existing);
    },

    async listLogs(runId: string): Promise<string[]> {
      return [...(logs.get(runId) ?? [])];
    },

    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}
