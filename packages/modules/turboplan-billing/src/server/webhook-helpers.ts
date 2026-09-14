import type Stripe from "stripe";

import {
  type SubscriptionPlan,
  SubscriptionStatus,
} from "@wildfires-org/turboplan-db";

import {
  classifyLookupKey,
  PLAN_ORDER,
  PLANS,
  type PlanKey,
  planFromLookupKey,
} from "../types";
import type { SubscriptionSyncInput } from "./queries";

// Map every Stripe subscription status to our DB enum. Stripe has a "paused"
// status that our enum does not model — fall it through to PAST_DUE.
export const STATUS_MAP: Record<
  Stripe.Subscription.Status,
  SubscriptionStatus
> = {
  active: SubscriptionStatus.ACTIVE,
  past_due: SubscriptionStatus.PAST_DUE,
  unpaid: SubscriptionStatus.UNPAID,
  canceled: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  trialing: SubscriptionStatus.TRIALING,
  paused: SubscriptionStatus.PAST_DUE, // no PAUSED in our enum
};

export const isPlanKey = (value: unknown): value is PlanKey => {
  return typeof value === "string" && PLAN_ORDER.includes(value as PlanKey);
};

export type ClassifiedItems = {
  base?: Stripe.SubscriptionItem;
  seat?: Stripe.SubscriptionItem;
  overage?: Stripe.SubscriptionItem;
};

/**
 * Buckets a subscription's items by their catalog lookup key. Items whose
 * price carries no catalog lookup key (foreign or legacy prices) are ignored.
 * First item per kind wins; duplicates (possible after raced updates) are
 * invisible here — seat sync heals them via planSeatItemTransition, which
 * inspects the FULL item list. Shared with the seat-sync path, which needs
 * the same base/seat/overage view of a live subscription.
 */
export const classifyItems = (sub: Stripe.Subscription): ClassifiedItems => {
  const classified: ClassifiedItems = {};
  for (const item of sub.items.data) {
    const lookupKey = item.price.lookup_key;
    const role = lookupKey ? classifyLookupKey(lookupKey) : null;
    if (role && !classified[role.kind]) {
      classified[role.kind] = item;
    }
  }
  return classified;
};

/**
 * Maps a Stripe subscription onto our DB sync input, or null when it carries
 * no `organizationId` (unmappable). Pure: reads only the passed subscription
 * plus the generated catalog — no env, no Stripe, no db.
 *
 * Plan precedence: a valid `metadata.plan` wins; otherwise the base item's
 * catalog lookup key; otherwise null.
 */
export const mapSubscription = (
  sub: Stripe.Subscription,
): SubscriptionSyncInput | null => {
  const organizationId = sub.metadata?.organizationId;
  if (!organizationId) {
    console.warn(
      `[stripe-webhook] subscription ${sub.id} has no organizationId in metadata; cannot map`,
    );
    return null;
  }

  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const status = STATUS_MAP[sub.status] ?? SubscriptionStatus.PAST_DUE;

  const items = classifyItems(sub);

  const metadataPlan = sub.metadata?.plan;
  const baseLookupKey = items.base?.price.lookup_key;
  const planKey: PlanKey | null = isPlanKey(metadataPlan)
    ? metadataPlan
    : baseLookupKey
      ? planFromLookupKey(baseLookupKey)
      : null;

  // Seats mirror = included seats + extra-seat item quantity. When the plan
  // is unknown to the catalog (foreign/legacy subscription), fall back to the
  // raw first-item quantity like the old single-item model.
  const seats = planKey
    ? PLANS[planKey].included_seats + (items.seat?.quantity ?? 0)
    : (items.base?.quantity ?? sub.items.data[0]?.quantity ?? 1);

  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  // In the 2026 API version, the billing period lives on each subscription
  // ITEM, not on the Subscription object itself. Anchor on the base item.
  const anchorItem = items.base ?? sub.items.data[0];
  const currentPeriodStart = anchorItem?.current_period_start
    ? new Date(anchorItem.current_period_start * 1000)
    : null;
  const currentPeriodEnd = anchorItem?.current_period_end
    ? new Date(anchorItem.current_period_end * 1000)
    : null;

  // Discount projection (display only). Requires the subscription to be
  // retrieved with `expand: ["discounts.source.coupon"]` — unexpanded string
  // entries are skipped rather than fetched, keeping this mapper pure. On the
  // 2026 API the coupon hangs off `discount.source.coupon`.
  const discount =
    sub.discounts
      ?.map((entry) => {
        if (typeof entry === "string") {
          return null;
        }
        const coupon = entry.source?.coupon;
        if (!coupon || typeof coupon === "string") {
          return null;
        }
        if (coupon.percent_off == null) {
          return null;
        }
        return { percentOff: coupon.percent_off, end: entry.end };
      })
      .find((entry) => entry !== null) ?? null;

  return {
    organizationId,
    stripeCustomerId,
    stripeSubscriptionId: sub.id,
    status,
    // PlanKey string values are identical to SubscriptionPlan enum members.
    plan: planKey as SubscriptionPlan | null,
    seats,
    stripeBaseItemId: items.base?.id ?? null,
    stripeSeatItemId: items.seat?.id ?? null,
    stripeOverageItemId: items.overage?.id ?? null,
    trialEnd,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    discountPercentOff: discount ? Math.round(discount.percentOff) : null,
    discountEndsAt: discount?.end ? new Date(discount.end * 1000) : null,
  };
};

/**
 * Resolves the subscription id referenced by an invoice.
 *
 * On API version 2026-05-27.dahlia (basil lineage) the ref is NOT
 * `invoice.subscription`; it lives under
 * `invoice.parent.subscription_details.subscription` as a string or expanded
 * object. Returns undefined for a one-off invoice with no subscription ref.
 */
export const subscriptionIdFromInvoice = (
  invoice: Stripe.Invoice,
): string | undefined => {
  const subRef = invoice.parent?.subscription_details?.subscription;
  return typeof subRef === "string" ? subRef : subRef?.id;
};
