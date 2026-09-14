import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organization } from "./organization";

export const organizationSigningConfig = pgTable(
  "organization_signing_config",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    documensoApiUrl: varchar("documenso_api_url", { length: 500 }).notNull(),
    documensoApiKey: text("documenso_api_key").notNull(),
    documensoWebhookSecret: text("documenso_webhook_secret"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type OrganizationSigningConfig = InferSelectModel<
  typeof organizationSigningConfig
>;
export type NewOrganizationSigningConfig =
  typeof organizationSigningConfig.$inferInsert;
