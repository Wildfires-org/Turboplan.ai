import { type InferSelectModel, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { organization } from "./organization";

/**
 * Append-only ledger of every credit consumption. The per-period counter in
 * `billing_credit_usage` answers "how much this period"; this table answers
 * "what exactly was charged, by whom, for which job, at what provider cost".
 *
 * `overage_credits` is the portion of `amount` that exceeded the period
 * allowance; rows with a positive value are reported to the Stripe billing
 * meter (ledger id = meter event identifier, making redelivery idempotent)
 * and stamped with `stripe_meter_reported_at`. Unreported rows are swept by
 * reconciliation.
 */
export const billingCreditEvent = pgTable(
  "billing_credit_event",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Ledger rows outlive their author: user deletion nulls, not deletes.
    userId: uuid("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(),
    source: varchar("source", { length: 50 }).notNull(),
    model: varchar("model", { length: 255 }),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    overageCredits: integer("overage_credits").notNull().default(0),
    stripeMeterReportedAt: timestamp("stripe_meter_reported_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("billing_credit_event_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    check(
      "billing_credit_event_amount_non_negative",
      sql`${table.amount} >= 0`,
    ),
    check(
      "billing_credit_event_overage_non_negative",
      sql`${table.overageCredits} >= 0`,
    ),
  ],
);

export type BillingCreditEvent = InferSelectModel<typeof billingCreditEvent>;
