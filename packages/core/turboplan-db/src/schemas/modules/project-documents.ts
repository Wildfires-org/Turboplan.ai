import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { project } from "../workspace/project";

/**
 * Where a project document originated.
 * - "upload": added manually by a user (or created in a chat and uploaded)
 * - "research": surfaced and saved by the research agent
 */
export type ProjectDocumentSource = "upload" | "research";

/**
 * Project documents table
 * Stores metadata for documents uploaded to projects (PDFs, DOCX, etc.)
 */
export const projectDocument = pgTable(
  "project_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Sanitized filename used for storage (may include timestamp/hash) */
    filename: varchar("filename", { length: 255 }).notNull(),
    /** Original filename as uploaded by the user */
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    /** MIME type of the file */
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    /** File size in bytes */
    size: bigint("size", { mode: "number" }).notNull(),
    /** Storage URL */
    url: text("url").notNull(),
    /**
     * Origin of the document. "upload" for manual/chat uploads (shown on the
     * Documents page), "research" for research-agent results (shown on the
     * Context page). See {@link ProjectDocumentSource}.
     */
    source: varchar("source", { length: 20 }).notNull().default("upload"),
    /** Relevance score 0-100 (from research agent) */
    relevance: integer("relevance"),
    /** Contextual explanation of why this document matters */
    context: text("context"),
    /** Folder/group name for organizing documents (e.g., source project name) */
    folder: varchar("folder", { length: 255 }),
    /** Description of the folder group (e.g., NEPA review type) */
    folderDescription: varchar("folder_description", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("project_document_project_id_idx").on(table.projectId),
    userIdIdx: index("project_document_user_id_idx").on(table.userId),
  }),
);

// Types
export type ProjectDocument = InferSelectModel<typeof projectDocument>;
export type NewProjectDocument = typeof projectDocument.$inferInsert;
