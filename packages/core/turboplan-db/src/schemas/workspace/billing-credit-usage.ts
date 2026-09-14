import { type InferSelectModel, sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { organization } from "./organization";

/**
 * Per-organization credit consumption for one billing period — the hot row
 * incremented on every metered AI call. One row per (org, period); a new
 * period lazily creates a fresh row on first consumption, which is how the
 * monthly reset works (no cron).
 *
 * The credit ALLOWANCE is never stored here: it is always computed live from
 * the pricing catalog plus the subscription's extra-seat count, so mid-period
 * seat changes take effect immediately.
 */
export const billingCreditUsage = pgTable(
  "billing_credit_usage",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    creditsUsed: integer("credits_used").notNull().default(0),
    // Dedupe stamps for the usage alerts — set at most once per period when
    // consumption crosses the catalog's alert thresholds.
    alert70SentAt: timestamp("alert70_sent_at"),
    alert90SentAt: timestamp("alert90_sent_at"),
    alert100SentAt: timestamp("alert100_sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("billing_credit_usage_org_period_unique").on(
      table.organizationId,
      table.periodStart,
    ),
    check(
      "billing_credit_usage_credits_used_non_negative",
      sql`${table.creditsUsed} >= 0`,
    ),
  ],
);

export type BillingCreditUsage = InferSelectModel<typeof billingCreditUsage>;
