import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const agentRunStatusEnum = [
  "created",
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
] as const;

export type AgentRunStatus = (typeof agentRunStatusEnum)[number];

export const researchAgentRuns = pgTable("research_agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: text("run_id").notNull().unique(),
  status: text("status", { enum: agentRunStatusEnum })
    .notNull()
    .default("created"),
  prompt: text("prompt").notNull(),
  skill: text("skill"),
  resultJson: text("result_json"),
  errorJson: text("error_json"),
  sandboxId: text("sandbox_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const researchAgentRunMessages = pgTable("research_agent_run_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: text("run_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const researchAgentRunLogs = pgTable("research_agent_run_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: text("run_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const researchAgentMemories = pgTable("research_agent_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  keywords: text("keywords").array().notNull(),
  runId: text("run_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
