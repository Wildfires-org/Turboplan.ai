import { type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { projectDocument } from "../modules/project-documents";
import type { StoredLetterheadGrid } from "./letterhead-analysis";
import { organization } from "./organization";
import { organizationDocument } from "./organization-context";

/**
 * Additional letterheads an organization keeps besides its default office/org
 * one (e.g. a partner or client agency's), each with its own logo. A chat
 * document opts into one through `document_letterhead_selection`.
 */
export const documentLetterhead = pgTable(
  "document_letterhead",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Admin-written "when to use this letterhead", shown to the chat model.
    description: text("description").notNull().default(""),
    layout: varchar("layout", {
      enum: ["columns", "split", "centered", "banner"],
    })
      .notNull()
      .default("split"),
    lines: text("lines").notNull().default(""),
    contact: text("contact").notNull().default(""),
    logoUrl: text("logo_url"),
    color: varchar("color", { length: 7 }),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_letterhead_organization_id_idx").on(table.organizationId),
  ],
);

/**
 * The letterhead a chat document uses:
 * - no row → the default (office → org) letterhead;
 * - `letterheadId` null, `useOwn` false → none;
 * - `letterheadId` null, `useOwn` true → the document's own copy
 *   (`document_own_letterhead`);
 * - `letterheadId` set → that library letterhead (`useOwn` is false).
 *
 * `documentId` has no FK because `document` has a composite (id, createdAt)
 * primary key. Deleting the library letterhead deletes the row, so the
 * document falls back to the default.
 */
export const documentLetterheadSelection = pgTable(
  "document_letterhead_selection",
  {
    documentId: uuid("document_id").primaryKey(),
    letterheadId: uuid("letterhead_id").references(
      () => documentLetterhead.id,
      { onDelete: "cascade" },
    ),
    useOwn: boolean("use_own").notNull().default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    check(
      "document_letterhead_selection_use_own_without_letterhead",
      sql`NOT ${table.useOwn} OR ${table.letterheadId} IS NULL`,
    ),
  ],
);

/**
 * A chat document's own copy of the letterhead of the reference it was
 * drafted from, editable per document. A separate table rather than columns
 * on `document_letterhead_selection`: that row is deleted when the document
 * goes back to the default and cascade-deleted with a library letterhead, and
 * the copy must survive both so the user can switch back to it.
 *
 * `documentId` has no FK because `document` has a composite (id, createdAt)
 * primary key. The reference ids are informational and cleared when the
 * reference is deleted; `referenceFilename` keeps naming the source.
 */
export const documentOwnLetterhead = pgTable(
  "document_own_letterhead",
  {
    documentId: uuid("document_id").primaryKey(),
    letterhead: jsonb("letterhead").$type<StoredLetterheadGrid>().notNull(),
    referenceFilename: text("reference_filename").notNull(),
    referenceProjectDocumentId: uuid("reference_project_document_id"),
    referenceOrganizationDocumentId: uuid("reference_organization_document_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // FKs named explicitly: the generated names exceed Postgres's 63-character
    // identifier limit and would be truncated in the database.
    foreignKey({
      name: "document_own_letterhead_reference_project_document_fk",
      columns: [table.referenceProjectDocumentId],
      foreignColumns: [projectDocument.id],
    }).onDelete("set null"),
    foreignKey({
      name: "document_own_letterhead_reference_organization_document_fk",
      columns: [table.referenceOrganizationDocumentId],
      foreignColumns: [organizationDocument.id],
    }).onDelete("set null"),
    // Serve ON DELETE SET NULL: without them every reference document delete
    // scans this table. Partial: each copy sets at most one of the two ids.
    index("document_own_letterhead_reference_project_document_idx")
      .on(table.referenceProjectDocumentId)
      .where(sql`${table.referenceProjectDocumentId} IS NOT NULL`),
    index("document_own_letterhead_reference_organization_document_idx")
      .on(table.referenceOrganizationDocumentId)
      .where(sql`${table.referenceOrganizationDocumentId} IS NOT NULL`),
    // A copy comes from one reference: a project or an organization document.
    check(
      "document_own_letterhead_single_reference",
      sql`num_nonnulls(${table.referenceProjectDocumentId}, ${table.referenceOrganizationDocumentId}) <= 1`,
    ),
  ],
);

export type DocumentLetterheadRow = InferSelectModel<typeof documentLetterhead>;
export type NewDocumentLetterheadRow = typeof documentLetterhead.$inferInsert;
export type DocumentLetterheadSelectionRow = InferSelectModel<
  typeof documentLetterheadSelection
>;
export type DocumentOwnLetterheadRow = InferSelectModel<
  typeof documentOwnLetterhead
>;
export type NewDocumentOwnLetterheadRow =
  typeof documentOwnLetterhead.$inferInsert;
