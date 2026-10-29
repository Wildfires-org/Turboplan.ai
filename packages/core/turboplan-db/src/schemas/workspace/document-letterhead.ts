import type { InferSelectModel } from "drizzle-orm";
import {
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
 * The letterhead a chat document uses. No row means the default (office → org)
 * letterhead; a row with a null `letterheadId` means none. `documentId` has no
 * FK because `document` has a composite (id, createdAt) primary key. Deleting
 * the library letterhead deletes the row, so the document falls back to the
 * default.
 */
export const documentLetterheadSelection = pgTable(
  "document_letterhead_selection",
  {
    documentId: uuid("document_id").primaryKey(),
    letterheadId: uuid("letterhead_id").references(
      () => documentLetterhead.id,
      { onDelete: "cascade" },
    ),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
);

export type DocumentLetterheadRow = InferSelectModel<typeof documentLetterhead>;
export type NewDocumentLetterheadRow = typeof documentLetterhead.$inferInsert;
export type DocumentLetterheadSelectionRow = InferSelectModel<
  typeof documentLetterheadSelection
>;
