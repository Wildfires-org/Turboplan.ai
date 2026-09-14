import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { project } from "../workspace/project";

export const signingRequestStatusEnum = pgEnum("signing_request_status", [
  "draft",
  "pending",
  "completed",
  "rejected",
  "cancelled",
]);

// Parallel: every recipient may sign at once. Sequential: recipients are gated
// by `order`, only the current step is invited and the next is released on sign.
export const signingModeEnum = pgEnum("signing_mode", [
  "parallel",
  "sequential",
]);

export type SigningRecipientRole = "signer" | "cc";

// Three orthogonal status axes copied from Documenso. A single flat enum can't
// tell "invited but ignoring" from "looking but stalling" from "not their turn
// yet" — three axes can, and that drives the list UI and the sequential gate.
export type RecipientSendStatus = "not_sent" | "sent";
export type RecipientReadStatus = "not_opened" | "opened";
export type RecipientSigningStatus = "not_signed" | "signed" | "rejected";

export type SigningRecipientRow = {
  userId: string;
  email: string;
  name: string;
  role: SigningRecipientRole;
  // 1-based signing step. Ties share a step and act simultaneously. Canonical
  // sort everywhere is (order asc, then userId asc).
  order: number;
  sendStatus: RecipientSendStatus;
  readStatus: RecipientReadStatus;
  signingStatus: RecipientSigningStatus;
  signedAt?: string;
  viewedAt?: string;
  rejectionReason?: string;
  signingUrl?: string;
};

export const signingRequest = pgTable(
  "signing_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No FK to `document`: that table is versioned with a composite PK
    // (id, createdAt), so a single-column reference to document.id has no
    // matching unique constraint. Enforced at the app layer instead. Mirrors
    // the same limitation noted in the tasks schema.
    documentId: uuid("document_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    envelopeId: varchar("envelope_id", { length: 255 }),
    status: signingRequestStatusEnum("status").notNull().default("draft"),
    signingMode: signingModeEnum("signing_mode").notNull().default("parallel"),
    title: varchar("title", { length: 500 }).notNull(),
    recipients: jsonb("recipients").$type<SigningRecipientRow[]>().notNull(),
    signedDocumentUrl: text("signed_document_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("signing_request_project_id_idx").on(table.projectId),
    documentIdIdx: index("signing_request_document_id_idx").on(
      table.documentId,
    ),
    envelopeIdIdx: index("signing_request_envelope_id_idx").on(
      table.envelopeId,
    ),
    userIdIdx: index("signing_request_user_id_idx").on(table.userId),
  }),
);

export type SigningRequestRow = InferSelectModel<typeof signingRequest>;
export type NewSigningRequest = typeof signingRequest.$inferInsert;
