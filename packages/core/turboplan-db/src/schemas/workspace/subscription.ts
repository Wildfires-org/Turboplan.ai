import { type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organization } from "./organization";

export enum SubscriptionStatus {
  TRIALING = "trialing",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  CANCELED = "canceled",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
  UNPAID = "unpaid",
}

export enum SubscriptionPlan {
  STARTER = "starter",
  PRO = "pro",
  MAX = "max",
  GRANDFATHER = "grandfather",
}

export const subscriptionStatusEnum = pgEnum(
  "subscription_status",
  Object.values(SubscriptionStatus) as [string, ...string[]],
);

export const subscriptionPlanEnum = pgEnum(
  "subscription_plan",
  Object.values(SubscriptionPlan) as [string, ...string[]],
);

export const subscription = pgTable(
  "subscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    // Subscription item ids for the base_plus_seats model: base plan item,
    // extra-seat item (null while extra seats = 0) and metered credit-overage
    // item (null on the free plan, which has no Stripe subscription at all).
    stripeBaseItemId: varchar("stripe_base_item_id", { length: 255 }),
    stripeSeatItemId: varchar("stripe_seat_item_id", { length: 255 }),
    stripeOverageItemId: varchar("stripe_overage_item_id", { length: 255 }),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    plan: subscriptionPlanEnum("plan"),
    // Total billable seats (included + extra), mirrored from the seat counter.
    seats: integer("seats").notNull().default(1),
    trialEnd: timestamp("trial_end"),
    trialUsedAt: timestamp("trial_used_at"),
    // Credit-period anchor for paid orgs; free orgs use UTC calendar months.
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    // Stamped when the org explicitly picked a plan (including choosing or
    // skipping into the free plan during onboarding) — gates the plan step.
    planChosenAt: timestamp("plan_chosen_at"),
    // Projection of the Stripe discount on the subscription (display only —
    // Stripe remains the source of truth for what is actually charged).
    discountPercentOff: integer("discount_percent_off"),
    discountEndsAt: timestamp("discount_ends_at"),
    // Dedupe stamps for the "discount ending" owner notifications (30/7 days
    // before the first full-price renewal).
    discountNotice30SentAt: timestamp("discount_notice_30_sent_at"),
    discountNotice7SentAt: timestamp("discount_notice_7_sent_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("subscription_seats_non_negative", sql`${table.seats} >= 0`),
    check(
      "subscription_discount_percent_range",
      sql`${table.discountPercentOff} IS NULL OR (${table.discountPercentOff} >= 0 AND ${table.discountPercentOff} <= 100)`,
    ),
  ],
);

export type Subscription = InferSelectModel<typeof subscription>;
