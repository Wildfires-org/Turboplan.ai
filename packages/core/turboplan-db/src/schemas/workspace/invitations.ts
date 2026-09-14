import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";

// Type for task/milestone assignment stored in invitations
export type TaskAssignment = {
  taskId?: string;
  milestoneId?: string;
};

// Enum for entity types that can have invitations
export const invitationEntityTypeEnum = pgEnum("invitation_entity_type", [
  "organization",
  "office",
  "project",
]);

// Enum for invitation status
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

// Enum for invitation roles (same as entity roles)
export const invitationRoleEnum = pgEnum("invitation_role", [
  "owner",
  "editor",
  "viewer",
]);

// Invitations table for tracking pending user invitations
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // Secure token for invitation URL
    token: varchar("token", { length: 64 }).notNull().unique(),
    // Invitee email address
    email: varchar("email", { length: 255 }).notNull(),
    // Role to assign when invitation is accepted
    role: invitationRoleEnum("role").notNull().default("viewer"),
    // Target entity type (organization, office, or project)
    entityType: invitationEntityTypeEnum("entity_type").notNull(),
    // Target entity ID (polymorphic reference)
    entityId: uuid("entity_id").notNull(),
    // User who sent the invitation
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Invitation status
    status: invitationStatusEnum("status").notNull().default("pending"),
    // When the invitation expires
    expiresAt: timestamp("expires_at").notNull(),
    // Optional task/milestone assignment (for project invitations)
    taskAssignment: jsonb("task_assignment").$type<TaskAssignment>(),
    // Standard timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Index on token for fast lookups during acceptance
    tokenIdx: index("invitations_token_idx").on(table.token),
    // Index on entity for listing invitations per entity
    entityIdx: index("invitations_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    // Index on email for checking existing invitations
    emailIdx: index("invitations_email_idx").on(table.email),
    // Index on status for filtering pending invitations
    statusIdx: index("invitations_status_idx").on(table.status),
    // Index on invitedBy for user's sent invitations
    invitedByIdx: index("invitations_invited_by_idx").on(table.invitedBy),
  }),
);

export type Invitation = InferSelectModel<typeof invitations>;
export type NewInvitation = typeof invitations.$inferInsert;
