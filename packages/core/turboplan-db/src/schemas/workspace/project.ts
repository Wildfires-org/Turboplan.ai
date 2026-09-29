import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { MAX_SLUG_LENGTH } from "../../constants";
import { generatedImages } from "../core/generated-images";
import { user } from "../core/user";
import { office } from "./office";
import { organization } from "./organization";

// TypeScript enum for runtime use
export enum ProjectStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
  COMPLETED = "completed",
}

// PostgreSQL enum for database (derived from TypeScript enum)
export const projectStatusEnum = pgEnum(
  "project_status",
  Object.values(ProjectStatus) as [string, ...string[]],
);

export enum OwnershipStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

/**
 * Ownership states that must never be exposed through a public read path
 * (catalog, public-gov read fallback, search). A SUBMITTED project is a citizen
 * application under review — it already sits in the target agency's office, so
 * showing it would present it under the agency's name. REJECTED is a legacy
 * terminal state (rejections now revert to DRAFT).
 *
 * DRAFT is deliberately NOT listed: it is the column default, so cataloger
 * templates and template-created staff projects are DRAFT too. Applicants
 * cannot make a DRAFT public themselves — the create/update routes only let
 * office staff set `isPublic` / `isTemplate`.
 */
export const PUBLICLY_HIDDEN_OWNERSHIP_STATUSES: OwnershipStatus[] = [
  OwnershipStatus.SUBMITTED,
  OwnershipStatus.REJECTED,
];

export const isOwnershipStatusPubliclyVisible = (status: string): boolean =>
  !PUBLICLY_HIDDEN_OWNERSHIP_STATUSES.includes(status as OwnershipStatus);

export const ownershipStatusEnum = pgEnum(
  "ownership_status",
  Object.values(OwnershipStatus) as [string, ...string[]],
);

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    slug: varchar("slug", { length: MAX_SLUG_LENGTH }).notNull(),
    slugHistory: json("slug_history").$type<string[]>().notNull().default([]),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    prompt: text("prompt"),
    coverImageId: uuid("cover_image_id").references(() => generatedImages.id, {
      onDelete: "set null",
    }),
    officeId: uuid("office_id")
      .notNull()
      .references(() => office.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    lastModifiedBy: uuid("last_modified_by").references(() => user.id),
    isTemplate: boolean("is_template").notNull().default(false),
    parentProjectId: uuid("parent_project_id").references(
      (): AnyPgColumn => project.id,
      { onDelete: "set null" },
    ),
    isPublic: boolean("is_public").notNull().default(false),
    status: projectStatusEnum("status").notNull().default("active"),
    ownershipStatus: ownershipStatusEnum("ownership_status")
      .notNull()
      .default("draft"),
    /**
     * Preferred submit-for-review target chosen at creation time (e.g. on the
     * landing page). The project is NOT submitted there at creation — these are
     * only a saved default the in-app Submit Application dialog pre-selects when
     * the citizen later submits. Cleared (set null) if the target org/office is
     * deleted.
     */
    intendedSubmissionOrganizationId: uuid(
      "intended_submission_organization_id",
    ).references(() => organization.id, { onDelete: "set null" }),
    intendedSubmissionOfficeId: uuid(
      "intended_submission_office_id",
    ).references(() => office.id, { onDelete: "set null" }),
    hiddenModules: json("hidden_modules")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Modules hidden from public/catalog view (non-logged-in users) */
    privateModules: json("private_modules")
      .$type<string[]>()
      .notNull()
      .default([]),
    moduleOrder: json("module_order").$type<string[]>().notNull().default([]),
    /** Per-module column assignment for the two-column project layout */
    moduleColumns: json("module_columns")
      .$type<Record<string, "main" | "sidebar">>()
      .notNull()
      .default({}),
    isResearchPhaseCompleted: boolean("is_research_phase_completed")
      .notNull()
      .default(false),
    /**
     * Stamped at self-service signup; cleared once the deferred setup (cover
     * image + research agent bootstrap) completes successfully. Non-null means
     * the setup still has to run — it is retried on every magic-link
     * verification until it succeeds.
     */
    selfServiceSetupPendingAt: timestamp("self_service_setup_pending_at"),
    /** Project timeline start date (defaults to creation date) */
    startDate: timestamp("start_date"),
    /** Project timeline end date (defaults to start_date + 180 days) */
    endDate: timestamp("end_date"),
    /** Soft deletion timestamp (null means active record) */
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    // Slug must be unique within an office
    uniqueIndex("project_office_slug_unique").on(table.officeId, table.slug),
    // Trigram indexes for flexible substring matching (e.g., "stor" matches "stork")
    index("project_name_trgm_idx").using(
      "gin",
      sql`${table.name} gin_trgm_ops`,
    ),
    index("project_description_trgm_idx").using(
      "gin",
      sql`coalesce(${table.description}, '') gin_trgm_ops`,
    ),
    // Supports the pending-setup sweep on every magic-link verification;
    // partial so it stays tiny (only rows still awaiting deferred setup).
    index("project_self_service_setup_pending_idx")
      .on(table.createdBy)
      .where(sql`${table.selfServiceSetupPendingAt} is not null`),
  ],
);

export type Project = InferSelectModel<typeof project>;
