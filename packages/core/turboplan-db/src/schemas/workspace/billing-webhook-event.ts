import { type InferSelectModel } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Records processed Stripe webhook event ids so redelivered events can be
 * deduplicated. The `id` is the Stripe `evt_...` id.
 */
export const billingWebhookEvent = pgTable("billing_webhook_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

export type BillingWebhookEvent = InferSelectModel<typeof billingWebhookEvent>;
