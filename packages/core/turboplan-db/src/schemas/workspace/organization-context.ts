import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { organization } from "./organization";

/**
 * Lifecycle of an organization document's text extraction. Same values as
 * `PROJECT_DOCUMENT_EXTRACTION_STATUSES`, so one extraction loop can serve both
 * tables.
 * - "pending": not extracted yet (the default for every new row)
 * - "done": text was extracted and stored in `extractedText`
 * - "failed": extraction was attempted and errored; see `extractionError`
 * - "unsupported": the file type carries no extractable text
 */
export const ORGANIZATION_DOCUMENT_EXTRACTION_STATUSES = [
  "pending",
  "done",
  "failed",
  "unsupported",
] as const;

export type OrganizationDocumentExtractionStatus =
  (typeof ORGANIZATION_DOCUMENT_EXTRACTION_STATUSES)[number];

/**
 * Standing AI context for an organization (1:1 with organization). The prompt
 * is written by org owners/editors and reaches every chat and research run in
 * the organization's projects.
 */
export const organizationContext = pgTable("organization_context", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull().default(""),
  updatedBy: uuid("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Reference documents attached to an organization (PDF, DOCX, ...). Mirrors the
 * upload and extraction columns of `project_document`, plus an AI key-facts
 * `summary` and an `isPinned` flag that puts the document first in the context
 * budget.
 */
export const organizationDocument = pgTable(
  "organization_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Sanitized filename used for storage (may include timestamp/hash) */
    filename: varchar("filename", { length: 255 }).notNull(),
    /** Original filename as uploaded by the user; also the display name */
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    /** MIME type of the file */
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    /** File size in bytes */
    size: bigint("size", { mode: "number" }).notNull(),
    /** Storage URL */
    url: text("url").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Pinned documents are summarized into the AI context before the rest */
    isPinned: boolean("is_pinned").notNull().default(false),
    /**
     * Plain text extracted from the file, capped by the extractor (<= 40k
     * chars). Null until extraction runs — and after a failed or unsupported
     * extraction. Queries returning lists of documents should select columns
     * explicitly and leave this one out.
     */
    extractedText: text("extracted_text"),
    /** See {@link OrganizationDocumentExtractionStatus}. */
    extractionStatus: varchar("extraction_status", { length: 20 })
      .$type<OrganizationDocumentExtractionStatus>()
      .notNull()
      .default("pending"),
    /** Reason the extraction failed or why the file type is unsupported */
    extractionError: text("extraction_error"),
    /** When `extractedText` was last written (set only on a "done" status) */
    extractedAt: timestamp("extracted_at"),
    /** Short AI "key facts" summary of `extractedText`; null until produced */
    summary: text("summary"),
    /** When `summary` was last written */
    summarizedAt: timestamp("summarized_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("organization_document_organization_id_idx").on(table.organizationId),
    /** Lets the extraction worker find pending rows without a full scan */
    index("organization_document_extraction_status_idx").on(
      table.extractionStatus,
    ),
  ],
);

// Types
export type OrganizationContext = InferSelectModel<typeof organizationContext>;
export type NewOrganizationContext = typeof organizationContext.$inferInsert;
export type OrganizationDocument = InferSelectModel<
  typeof organizationDocument
>;
export type NewOrganizationDocument = typeof organizationDocument.$inferInsert;
