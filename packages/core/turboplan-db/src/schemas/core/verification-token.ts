import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./user";

export const verificationToken = pgTable(
  "verification_token",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(), // hashed token
    type: varchar("type", { length: 20 }).notNull(), // 'email_verification' | 'login'
    expires: timestamp("expires").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.token] }),
    // Index for efficient cleanup of expired tokens
    index("verification_token_expires_idx").on(table.expires),
  ],
);

export type VerificationToken = InferSelectModel<typeof verificationToken>;
