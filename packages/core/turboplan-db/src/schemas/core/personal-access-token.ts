import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./user";

export const personalAccessToken = pgTable(
  "personal_access_token",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    actor: varchar("actor", { length: 100 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    tokenPrefix: varchar("token_prefix", { length: 12 }).notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pat_token_hash_idx").on(table.tokenHash),
    index("pat_user_id_idx").on(table.userId),
  ],
);

export type PersonalAccessToken = InferSelectModel<typeof personalAccessToken>;
