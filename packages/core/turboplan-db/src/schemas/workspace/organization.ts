import { type InferSelectModel, sql } from "drizzle-orm";
import {
  index,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { MAX_SLUG_LENGTH } from "../../constants";
import { generatedImages } from "../core/generated-images";
import { user } from "../core/user";

// TypeScript enums for runtime use
export enum OrganizationType {
  PERSONAL = "personal",
  BUSINESS = "business",
  NONPROFIT = "nonprofit",
  GOVERNMENT = "government",
  DEMO = "demo",
  INTERNAL = "internal",
  // Environmental consulting firms (e.g. Jacobs, AECOM). Publicly cataloged the
  // same way government organizations are, and their staff are auto-detected via
  // email domains — but they are NOT project-submission/review targets.
  ENVIRONMENTAL_PLANNER = "environmental_planner",
}

/**
 * Organization types that are surfaced in the public catalog and are readable by
 * any authenticated user (not just members). Government agencies and
 * environmental-planning firms are both listed this way. This is a
 * LISTING/READ-only widening — it must NOT be used to gate project
 * submission/review flows, which remain government-only.
 */
export const PUBLICLY_LISTED_ORG_TYPES: OrganizationType[] = [
  OrganizationType.GOVERNMENT,
  OrganizationType.ENVIRONMENTAL_PLANNER,
];

export enum OrganizationStatus {
  ACTIVE = "active",
  DRAFT = "draft",
  ARCHIVED = "archived",
}

// PostgreSQL enums for database (derived from TypeScript enums)
export const organizationTypeEnum = pgEnum(
  "organization_type",
  Object.values(OrganizationType) as [string, ...string[]],
);

export const organizationStatusEnum = pgEnum(
  "organization_status",
  Object.values(OrganizationStatus) as [string, ...string[]],
);

export const organization = pgTable(
  "organization",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    slug: varchar("slug", { length: MAX_SLUG_LENGTH }).notNull().unique(),
    slugHistory: json("slug_history").$type<string[]>().notNull().default([]),
    // Email domains (e.g. ["usda.gov"]) that qualify a user as a government
    // worker for this organization. Used to detect gov eligibility at signup.
    emailDomains: json("email_domains").$type<string[]>().notNull().default([]),
    name: varchar("name", { length: 255 }).notNull(),
    shortName: varchar("short_name", { length: 20 }),
    description: text("description"),
    coverImageId: uuid("cover_image_id").references(() => generatedImages.id, {
      onDelete: "set null",
    }),
    country: varchar("country", { length: 100 }),
    type: organizationTypeEnum("type").notNull().default("personal"),
    status: organizationStatusEnum("status").notNull().default("active"),
    logoUrl: text("logo_url"),
    documentLogoUrl: text("document_logo_url"),
    documentFooterText: text("document_footer_text"),
    documentFooterNote: text("document_footer_note"),
    documentFooterLogoUrl: text("document_footer_logo_url"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    // Trigram indexes for flexible substring matching (e.g., "stor" matches "stork")
    index("organization_name_trgm_idx").using(
      "gin",
      sql`${table.name} gin_trgm_ops`,
    ),
    index("organization_short_name_trgm_idx").using(
      "gin",
      sql`coalesce(${table.shortName}, '') gin_trgm_ops`,
    ),
    index("organization_description_trgm_idx").using(
      "gin",
      sql`coalesce(${table.description}, '') gin_trgm_ops`,
    ),
  ],
);

export type Organization = InferSelectModel<typeof organization>;
