import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { project } from "../workspace/project";

// Comments table
export const comment = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    parentCommentId: uuid("parent_comment_id"),
    content: text("content").notNull(),
    // Default private: an insert that omits the flag must not be world-visible.
    // The app layer already defaults false; this aligns the DB with it.
    isPublic: boolean("is_public").notNull().default(false),
    // Mark comment as AI-generated auto-response
    isAutoResponse: boolean("is_auto_response").notNull().default(false),
    // Track who should see this private auto-response (original commenter)
    targetUserId: uuid("target_user_id").references(() => user.id),
    // Display name for auto-responses (e.g., "Office Name Responder")
    autoResponderName: text("auto_responder_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("comment_project_id_idx").on(table.projectId),
    parentCommentIdIdx: index("comment_parent_comment_id_idx").on(
      table.parentCommentId,
    ),
  }),
);

// Self-referencing foreign key for replies (added separately to avoid circular reference)
// Note: parentCommentId references comment.id for one-level replies

// Relations
export const commentRelations = relations(comment, ({ one, many }) => ({
  project: one(project, {
    fields: [comment.projectId],
    references: [project.id],
  }),
  user: one(user, {
    fields: [comment.userId],
    references: [user.id],
  }),
  parentComment: one(comment, {
    fields: [comment.parentCommentId],
    references: [comment.id],
    relationName: "commentReplies",
  }),
  replies: many(comment, {
    relationName: "commentReplies",
  }),
}));

// Types
export type Comment = InferSelectModel<typeof comment>;
export type NewComment = typeof comment.$inferInsert;
