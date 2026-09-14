import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { chat } from "../core/chat";

export const ResearchAgentChatStatus = {
  INITIALIZING: "initializing",
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type ResearchAgentChatStatusType =
  (typeof ResearchAgentChatStatus)[keyof typeof ResearchAgentChatStatus];

export const researchAgentChat = pgTable(
  "research_agent_chat",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" })
      .unique(),
    externalRunId: varchar("external_run_id", { length: 255 }),
    // No DB default on purpose: a shared default value would be a well-known
    // credential, and this column is the sole authenticator for inbound
    // research-agent webhooks. Every insert must supply its own random secret.
    webhookSecret: varchar("webhook_secret", { length: 128 }).notNull(),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(ResearchAgentChatStatus.QUEUED),
    currentStep: text("current_step"),
    lastForwardedAt: timestamp("last_forwarded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("research_agent_chat_webhook_secret_idx").on(table.webhookSecret),
  ],
);

export type ResearchAgentChat = InferSelectModel<typeof researchAgentChat>;

export const researchAgentMessage = pgTable("research_agent_message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  researchAgentChatId: uuid("research_agent_chat_id")
    .notNull()
    .references(() => researchAgentChat.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ResearchAgentMessage = InferSelectModel<
  typeof researchAgentMessage
>;
