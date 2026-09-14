import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { chat } from "./chat";
import { user } from "./user";

export const document = pgTable(
  "document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("created_at").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("kind", {
      enum: ["text", "tasks", "map"],
    })
      .notNull()
      .default("text"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    chatId: uuid("chat_id").references(() => chat.id, { onDelete: "set null" }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
      chatIdIdx: index("document_chat_id_idx").on(table.chatId),
    };
  },
);

export type Document = InferSelectModel<typeof document>;
