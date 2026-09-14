import { type InferSelectModel, sql } from "drizzle-orm";
import {
  index,
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
import { organization } from "./organization";

export enum OfficeStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
}

// PostgreSQL enums for database (derived from TypeScript enums)
export const officeStatusEnum = pgEnum(
  "office_status",
  Object.values(OfficeStatus) as [string, ...string[]],
);

export const office = pgTable(
  "office",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    slug: varchar("slug", { length: MAX_SLUG_LENGTH }).notNull(),
    slugHistory: json("slug_history").$type<string[]>().notNull().default([]),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    coverImageId: uuid("cover_image_id").references(() => generatedImages.id, {
      onDelete: "set null",
    }),
    status: officeStatusEnum("status").notNull().default("active"),
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
    // Slug must be unique within an organization
    uniqueIndex("office_org_slug_unique").on(table.organizationId, table.slug),
    // Trigram indexes for flexible substring matching (e.g., "stor" matches "stork")
    index("office_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
    index("office_description_trgm_idx").using(
      "gin",
      sql`coalesce(${table.description}, '') gin_trgm_ops`,
    ),
  ],
);

export type Office = InferSelectModel<typeof office>;
