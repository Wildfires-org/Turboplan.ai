import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const webhookRequestLog = pgTable(
  "webhook_request_log",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    requestBody: jsonb("request_body"),
    requestHeaders: jsonb("request_headers"),
    responseBody: jsonb("response_body"),
    responseStatus: integer("response_status").notNull(),
    runId: varchar("run_id", { length: 255 }),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("webhook_request_log_source_idx").on(table.source),
    index("webhook_request_log_run_id_idx").on(table.runId),
    index("webhook_request_log_created_at_idx").on(table.createdAt),
  ],
);

export type WebhookRequestLog = InferSelectModel<typeof webhookRequestLog>;
