import { eq, isNull, notInArray, or } from "drizzle-orm";
import Stripe from "stripe";

import {
  SubscriptionPlan,
  SubscriptionStatus,
  subscription,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import {
  allowancePlanKey,
  CATALOG,
  extraSeats,
  holdsLiveSubscription,
  LIVE_SUBSCRIPTION_STATUS_VALUES,
  overageLookupKey,
  type PaidPlanKey,
  PLANS,
  type PlanKey,
  planFromLookupKey,
  seatLookupKey,
} from "../types";
import { countBillableSeats, getSubscriptionByOrganizationId } from "./queries";
import { planSeatItemTransition, transitionChangesStripe } from "./seat-items";
import { classifyItems } from "./webhook-helpers";

/**
 * Serializes concurrent calls for the same key to one at a time — an async
 * mutex via promise chaining, scoped to this process (not a distributed
 * lock). Used to close the double-click/double-tab window on
 * {@link createCheckoutSession}: the DB + live-Stripe-list guards it already
 * runs are check-then-act, and holding a DB transaction across the Stripe
 * network call to close that atomically would trade a narrow, same-actor
 * risk for connection-pool exposure — this is the cheaper, safer fix for the
 * common case (same server instance). A cross-replica double-click remains a
 * documented residual, same as elsewhere in this module.
 */
const withOrgLock = (() => {
  const queues = new Map<string, Promise<unknown>>();
  return async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const previous = queues.get(key) ?? Promise.resolve();
    // Chain the caller's work behind whatever is already queued for this
    // key. The queued entry never rejects (rejection is swallowed here, not
    // in the caller's awaited `run`) so one failed call doesn't wedge the
    // queue for the next caller with the same key.
    const run = previous.then(fn, fn);
    const gate = run.then(
      () => undefined,
      () => undefined,
    );
    queues.set(key, gate);
    // Evict the key once the queue drains — if another caller chained after
    // us, the map holds their gate (not ours) and we leave it alone.
    gate.then(() => {
      if (queues.get(key) === gate) {
        queues.delete(key);
      }
    });
    return run;
  };
})();

/**
 * Domain error for billing flows. Carries a machine-readable `code` and the
 * HTTP `status` the router should map it to.
 */
export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

/**
 * Statuses that mean the org already has a live subscription, so a NEW Checkout
 * session must be blocked (Stripe does not dedupe subscriptions — a second
 * checkout would create a second subscription and double-bill the customer).
 * Such orgs manage their plan through the Customer Portal instead.
 */
const LIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] =
  LIVE_SUBSCRIPTION_STATUS_VALUES.map((status) => status as SubscriptionStatus);

/**
 * Compile-safe bridge from catalog plan ids to the DB enum: adding a catalog
 * plan without extending the pg enum becomes a type error here instead of a
 * runtime constraint violation.
 */
const PLAN_TO_DB_PLAN: Record<PaidPlanKey, SubscriptionPlan> = {
  pro: SubscriptionPlan.PRO,
  max: SubscriptionPlan.MAX,
};

/**
 * Statuses for which seat-quantity changes should be pushed to Stripe. We skip
 * canceled/incomplete subscriptions — there is no live item to reprice. This is
 * deliberately the SAME set as {@link LIVE_SUBSCRIPTION_STATUSES}: a live
 * subscription (including `unpaid` — its item still exists) must always track
 * the true billable-seat count, otherwise a dunning-recovery charge would bill
 * for seats no longer occupied.
 *
 * Exported so the nightly {@link reconcileSubscriptionSeats} job (reconciliation.ts)
 * scans the exact same set of subscriptions that the live seat-sync path repices.
 */
export const SEAT_SYNC_STATUSES: SubscriptionStatus[] =
  LIVE_SUBSCRIPTION_STATUSES;

let _stripe: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!_stripe) {
    const env = getApiEnv();
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
    });
  }
  return _stripe;
};

const PRICE_ID_CACHE_TTL_MS = 10 * 60 * 1000;
const priceIdCache = new Map<string, { id: string; fetchedAt: number }>();

/**
 * Resolves a Stripe price id from its canonical catalog lookup key. Lookup
 * keys are the stable contract between the catalog sync and runtime — price
 * ids change when a price is replaced, lookup keys transfer to the new price.
 * Cached in memory because price ids only change on catalog sync.
 */
export const resolvePriceIdByLookupKey = async (
  lookupKey: string,
): Promise<string> => {
  const cached = priceIdCache.get(lookupKey);
  if (cached && Date.now() - cached.fetchedAt < PRICE_ID_CACHE_TTL_MS) {
    return cached.id;
  }

  const prices = await getStripe().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new BillingError(
      `No active Stripe price with lookup key "${lookupKey}". Run the catalog sync (sync:stripe).`,
      "PRICE_NOT_FOUND",
      500,
    );
  }

  priceIdCache.set(lookupKey, { id: price.id, fetchedAt: Date.now() });
  return price.id;
};

export const getOrCreateStripeCustomer = async ({
  organizationId,
  email,
  name,
}: {
  organizationId: string;
  email?: string;
  name?: string;
}): Promise<string> => {
  // Fast path: the customer is already recorded.
  const existing = await getSubscriptionByOrganizationId(organizationId);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  // Create with an org-scoped idempotency key so concurrent first-time checkouts
  // converge on EXACTLY ONE Stripe customer: Stripe returns the same customer
  // for repeated requests carrying the same key, so this read-then-create is no
  // longer racy. This deliberately replaces the previous transaction-scoped
  // advisory lock — holding a DB connection across the Stripe round-trip
  // serialized callers on the connection pool under concurrent first checkouts.
  const customer = await getStripe().customers.create(
    {
      email,
      name,
      metadata: { organizationId },
    },
    { idempotencyKey: `stripe-customer:${organizationId}` },
  );

  await db
    .insert(subscription)
    .values({ organizationId, stripeCustomerId: customer.id })
    .onConflictDoUpdate({
      target: subscription.organizationId,
      set: { stripeCustomerId: customer.id, updatedAt: new Date() },
    });

  return customer.id;
};

/** Stripe subscription statuses that can still charge the customer. */
const CHARGEABLE_STRIPE_STATUSES: readonly Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
];

/**
 * Stripe-side double-billing guard. The DB mirror lags the webhook, so a
 * checkout completed moments ago (or a concurrent checkout that just
 * finished) may not be persisted yet — the DB-row guards alone leave a
 * check-then-act window in which a second checkout or a Starter activation
 * could orphan a live paid subscription. When the org already has a Stripe
 * customer, ask Stripe directly whether any subscription can still charge.
 * One API call, and both callers are rare operations.
 */
const assertNoChargeableStripeSubscription = async (
  stripeCustomerId: string | null | undefined,
  message: string,
): Promise<void> => {
  if (!stripeCustomerId) {
    return;
  }
  const subs = await getStripe().subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });
  const chargeable = subs.data.some((sub) =>
    CHARGEABLE_STRIPE_STATUSES.includes(sub.status),
  );
  if (chargeable) {
    throw new BillingError(message, "ALREADY_SUBSCRIBED", 409);
  }
};

export const createCheckoutSession = async (params: {
  organizationId: string;
  plan: PlanKey;
  email?: string;
  name?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> =>
  // Same-process double-click/double-tab guard: serializes concurrent
  // checkout attempts for the same org so the second one observes the
  // first's DB write before running its own guards, instead of racing them.
  withOrgLock(`checkout:${params.organizationId}`, () =>
    createCheckoutSessionUnlocked(params),
  );

const createCheckoutSessionUnlocked = async ({
  organizationId,
  plan,
  email,
  name,
  successUrl,
  cancelUrl,
}: {
  organizationId: string;
  plan: PlanKey;
  email?: string;
  name?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> => {
  const planConfig = PLANS[plan];
  if (!("lookup_key" in planConfig)) {
    throw new BillingError(
      "The free plan has no checkout — it is activated directly.",
      "STARTER_IS_FREE",
      400,
    );
  }
  const paidPlan = planConfig.id;

  const existing = await getSubscriptionByOrganizationId(organizationId);

  // Guard against double-billing: an org with a live subscription must change
  // its plan via the Customer Portal, not by starting a second Checkout.
  if (
    existing?.stripeSubscriptionId &&
    LIVE_SUBSCRIPTION_STATUSES.includes(existing.status as SubscriptionStatus)
  ) {
    throw new BillingError(
      "This organization already has an active subscription. Switch plans with change-plan or manage it from the billing portal.",
      "ALREADY_SUBSCRIBED",
      409,
    );
  }
  // Second line of defense against the pre-webhook window (a just-completed
  // or concurrent checkout not yet mirrored into the DB row).
  await assertNoChargeableStripeSubscription(
    existing?.stripeCustomerId,
    "This organization already has an active subscription. Switch plans with change-plan or manage it from the billing portal.",
  );

  const customerId = await getOrCreateStripeCustomer({
    organizationId,
    email,
    name,
  });

  // One trial per org: only offer the free trial if this org has never
  // consumed one. Otherwise the subscription starts charging immediately.
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    {
      metadata: { organizationId, plan },
    };
  if (CATALOG.billing.trial_days > 0 && !existing?.trialUsedAt) {
    subscriptionData.trial_period_days = CATALOG.billing.trial_days;
  }

  // base_plus_seats cart: the base price covers the included seats at a flat
  // workspace price; only billable members beyond the included count add an
  // extra-seat item; the metered overage item carries no quantity — Stripe
  // bills it from reported meter events.
  const billableSeats = await countBillableSeats(organizationId);
  const extraSeatCount = extraSeats(billableSeats, plan);

  const [basePriceId, seatPriceId, overagePriceId] = await Promise.all([
    resolvePriceIdByLookupKey(planConfig.lookup_key),
    extraSeatCount > 0
      ? resolvePriceIdByLookupKey(seatLookupKey(paidPlan))
      : Promise.resolve(null),
    resolvePriceIdByLookupKey(overageLookupKey(paidPlan)),
  ]);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: basePriceId, quantity: 1 },
  ];
  if (seatPriceId && extraSeatCount > 0) {
    lineItems.push({ price: seatPriceId, quantity: extraSeatCount });
  }
  lineItems.push({ price: overagePriceId });

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: organizationId,
    line_items: lineItems,
    subscription_data: subscriptionData,
    payment_method_collection: "always",
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout session URL");
  }

  return session.url;
};

/**
 * Switches a live subscription between paid plans (Pro ↔ Max) in ONE
 * `subscriptions.update` call that swaps all three items: base price,
 * extra-seat price (with the extra quantity recomputed against the new plan's
 * included count) and the metered overage price.
 *
 * This endpoint exists because the Stripe Customer Portal cannot remap a
 * three-item base_plus_seats cart — portal plan switches must stay disabled
 * in its configuration (portal handles payment method, invoices and cancel
 * only).
 *
 * Proration: upgrades use `create_prorations` — Stripe creates pending
 * proration line items that are COLLECTED ON THE NEXT INVOICE (not charged
 * immediately). Downgrades use `none` so no credit is minted — the lower
 * price applies from the next cycle. Swapping the metered overage price
 * re-rates ALL usage accumulated this period at the new plan's overage rate;
 * accepted (bounded to one period's overage).
 *
 * The DB row is optimistically updated (plan, seats, item ids); the
 * `customer.subscription.updated` webhook re-projects the full state
 * (discounts, period) with its deep expand and stays authoritative.
 */
export const changeSubscriptionPlan = async (
  organizationId: string,
  newPlan: PaidPlanKey,
): Promise<void> => {
  const existing = await getSubscriptionByOrganizationId(organizationId);
  if (
    !existing?.stripeSubscriptionId ||
    !LIVE_SUBSCRIPTION_STATUSES.includes(existing.status as SubscriptionStatus)
  ) {
    throw new BillingError(
      "This organization has no active subscription to change. Choose a plan from checkout instead.",
      "NO_ACTIVE_SUBSCRIPTION",
      400,
    );
  }
  if (existing.plan === newPlan) {
    throw new BillingError(
      "The organization is already on this plan.",
      "SAME_PLAN",
      400,
    );
  }

  const stripeSub = await getStripe().subscriptions.retrieve(
    existing.stripeSubscriptionId,
  );
  const items = classifyItems(stripeSub);
  const currentBaseKey = items.base?.price.lookup_key;
  const currentPlan = currentBaseKey ? planFromLookupKey(currentBaseKey) : null;
  if (!items.base || !currentPlan) {
    throw new BillingError(
      "This subscription does not use the current pricing catalog and cannot be switched automatically.",
      "UNSUPPORTED_SUBSCRIPTION",
      409,
    );
  }

  const billableSeats = await countBillableSeats(organizationId);

  // Seat-item handling (reprice to the new plan's seat price, requantify,
  // delete at zero, heal duplicate items from raced updates) comes from the
  // shared pure planner.
  const seatTransition = planSeatItemTransition({
    items: stripeSub.items.data,
    plan: newPlan,
    billableSeats,
  });

  const [newBasePriceId, newOveragePriceId] = await Promise.all([
    resolvePriceIdByLookupKey(PLANS[newPlan].lookup_key),
    resolvePriceIdByLookupKey(overageLookupKey(newPlan)),
  ]);

  const itemUpdates: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: items.base.id, price: newBasePriceId },
  ];
  if (items.overage) {
    itemUpdates.push({ id: items.overage.id, price: newOveragePriceId });
  } else {
    itemUpdates.push({ price: newOveragePriceId });
  }

  const seatAction = seatTransition.action;
  if (seatAction.type === "create") {
    itemUpdates.push({
      price: await resolvePriceIdByLookupKey(seatAction.priceLookupKey),
      quantity: seatAction.quantity,
    });
  } else if (seatAction.type === "update") {
    itemUpdates.push({
      id: seatAction.itemId,
      quantity: seatAction.quantity,
      // The plan switch always moves the seat item onto the new plan's seat
      // price, whether or not the planner flagged a reprice.
      price: await resolvePriceIdByLookupKey(seatLookupKey(newPlan)),
    });
  } else if (seatAction.type === "delete") {
    itemUpdates.push({ id: seatAction.itemId, deleted: true });
  }
  for (const id of seatTransition.removeItemIds) {
    itemUpdates.push({ id, deleted: true });
  }

  const isUpgrade = PLANS[newPlan].price_usd > PLANS[currentPlan].price_usd;

  const updated = await getStripe().subscriptions.update(
    existing.stripeSubscriptionId,
    {
      items: itemUpdates,
      proration_behavior: isUpgrade ? "create_prorations" : "none",
      metadata: { organizationId, plan: newPlan },
    },
  );

  // Optimistic mirror (provisioned seats = included + extra, matching the
  // webhook projection); the customer.subscription.updated webhook re-projects
  // the full state and remains authoritative.
  const updatedItems = classifyItems(updated);
  await db
    .update(subscription)
    .set({
      plan: PLAN_TO_DB_PLAN[newPlan],
      seats:
        PLANS[newPlan].included_seats + seatTransition.desiredExtraQuantity,
      stripeBaseItemId: updatedItems.base?.id ?? null,
      stripeSeatItemId: updatedItems.seat?.id ?? null,
      stripeOverageItemId: updatedItems.overage?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, organizationId));
};

/**
 * Activates the free Starter plan — no Stripe objects involved. Upserts the
 * subscription row as an ACTIVE starter plan and stamps `plan_chosen_at` so
 * the onboarding plan step never re-prompts (picking Starter and pressing
 * Skip both land here).
 *
 * Refuses to touch an org holding a live paid subscription — that downgrade
 * path is cancel-at-period-end via POST /api/billing/cancel. For orgs whose
 * paid subscription already ended (canceled/incomplete), all Stripe
 * subscription linkage is cleared so a later upgrade can start a fresh
 * checkout; the Stripe customer id and trial consumption are preserved.
 */
export const activateStarterPlan = async (
  organizationId: string,
): Promise<void> => {
  const existing = await getSubscriptionByOrganizationId(organizationId);
  // Shared with hasChosenPlan — see holdsLiveSubscription. Keeping these two
  // in one definition is what stops onboarding from demanding a plan choice
  // that this function then refuses.
  if (holdsLiveSubscription(existing)) {
    throw new BillingError(
      "This organization has an active paid subscription. Cancel it before switching to the free plan.",
      "ALREADY_SUBSCRIBED",
      409,
    );
  }
  // Grandfather comps have no Stripe subscription, so the guard above cannot
  // catch them — without this check an owner could silently downgrade a comp
  // to Starter and lose the comped allowance.
  if (existing?.plan === SubscriptionPlan.GRANDFATHER) {
    throw new BillingError(
      "This organization is on a complimentary plan. Contact support to change it.",
      "COMP_PLAN",
      409,
    );
  }
  // The DB guard above only sees what the webhook has already mirrored. A
  // checkout completed moments ago (second tab, back button) would be
  // silently ORPHANED here: the starter upsert nulls stripeSubscriptionId,
  // Stripe keeps billing, and nothing references the subscription anymore.
  // Ask Stripe directly before overwriting.
  await assertNoChargeableStripeSubscription(
    existing?.stripeCustomerId,
    "This organization has an active paid subscription. Cancel it before switching to the free plan.",
  );

  const seats = await countBillableSeats(organizationId);
  const now = new Date();
  const starterState = {
    plan: SubscriptionPlan.STARTER,
    status: SubscriptionStatus.ACTIVE,
    seats,
    stripeSubscriptionId: null,
    stripeBaseItemId: null,
    stripeSeatItemId: null,
    stripeOverageItemId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    discountPercentOff: null,
    discountEndsAt: null,
    discountNotice30SentAt: null,
    discountNotice7SentAt: null,
    planChosenAt: now,
  };

  // The guards above only see what's already committed — a checkout that
  // completes in the moment between them and this write would otherwise be
  // silently clobbered (this upsert would null out its stripeSubscriptionId
  // and orphan a subscription Stripe keeps billing). Re-assert the same
  // "no live paid subscription" condition atomically in the UPDATE's WHERE,
  // so a subscription that lands in that window makes this a no-op instead
  // of an overwrite. `onConflictDoUpdate` always inserts on a fresh row, so
  // the guard only needs to gate the update path.
  await db
    .insert(subscription)
    .values({ organizationId, ...starterState })
    .onConflictDoUpdate({
      target: subscription.organizationId,
      set: { ...starterState, updatedAt: now },
      where: or(
        isNull(subscription.stripeSubscriptionId),
        notInArray(subscription.status, LIVE_SUBSCRIPTION_STATUSES),
      ),
    });
};

export const createPortalSession = async ({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<string> => {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
};

/**
 * Outcome of {@link applySeatItems}: whether any Stripe change was pushed, the
 * extra-seat quantity Stripe held BEFORE the update (0 = no seat item yet,
 * null = subscription skipped because it carries no catalog base item), and
 * the desired extra-seat quantity after. Callers use this to report drift.
 */
export type SeatQuantityApplyResult = {
  /** True when a subscription item change was actually pushed to Stripe. */
  quantityChanged: boolean;
  /** Extra-seat quantity before the update; null when the sync was skipped. */
  previousExtraQuantity: number | null;
  /** Desired extra-seat quantity (billable − included, floored at 0). */
  extraSeatQuantity: number;
};

/**
 * Shared core of both the live seat-sync path ({@link syncSubscriptionSeats})
 * and reconciliation ({@link reconcileSubscriptionSeats}): retrieve → classify
 * items → (maybe) update the EXTRA-SEAT item → reconcile the DB mirror.
 *
 * base_plus_seats model: the base item always has quantity 1; only billable
 * members beyond the plan's included count are billed via the extra-seat item.
 * Transitions:
 * - no seat item, extra > 0 → add the item (`create_prorations`: the customer
 *   is charged for the added seat mid-period);
 * - seat item, extra = 0 → delete the item with `proration_behavior: "none"`
 *   (a removed seat must not mint an immediate credit — abuse vector: add a
 *   seat, use it, remove it, pocket the credit);
 * - quantity change → update, proration decided by
 *   {@link prorationBehaviorForSeatChange} (increase prorates, decrease none).
 *
 * IMPORTANT: this ALWAYS retrieves the live subscription from Stripe and
 * compares against Stripe's actual items — it never trusts the DB `seats`
 * mirror to decide whether a reprice is needed. The caller that wants a cheap
 * early-out (sync) does its own `seats === mirror` short-circuit BEFORE
 * calling in; reconcile calls in unconditionally to catch drift.
 *
 * Subscriptions without a catalog base item (foreign/legacy prices) are
 * skipped with a warning — reconciliation surfaces them instead of mixing
 * catalog seat prices into an unknown cart.
 *
 * Mirror write: whenever the DB mirror differs from `billableSeats` or an item
 * change happened (the seat item id may have changed). The webhook remains
 * authoritative and confirms/overwrites.
 */
const applySeatItems = async (
  organizationId: string,
  stripeSubscriptionId: string,
  billableSeats: number,
  existingMirror: number,
): Promise<SeatQuantityApplyResult> => {
  const stripeSub =
    await getStripe().subscriptions.retrieve(stripeSubscriptionId);
  const items = classifyItems(stripeSub);

  const baseLookupKey = items.base?.price.lookup_key;
  const plan = baseLookupKey ? planFromLookupKey(baseLookupKey) : null;
  if (!plan) {
    console.warn(
      `[billing] seat sync skipped for organization ${organizationId}: ` +
        `subscription ${stripeSubscriptionId} carries no catalog base item`,
    );
    return {
      quantityChanged: false,
      previousExtraQuantity: null,
      extraSeatQuantity: 0,
    };
  }

  const transition = planSeatItemTransition({
    items: stripeSub.items.data,
    plan,
    billableSeats,
  });

  let updatedSub: Stripe.Subscription | null = null;
  if (transitionChangesStripe(transition)) {
    const itemUpdates: Stripe.SubscriptionUpdateParams.Item[] =
      transition.removeItemIds.map((id) => ({ id, deleted: true }));

    const { action } = transition;
    if (action.type === "create") {
      itemUpdates.push({
        price: await resolvePriceIdByLookupKey(action.priceLookupKey),
        quantity: action.quantity,
      });
    } else if (action.type === "update") {
      itemUpdates.push({
        id: action.itemId,
        quantity: action.quantity,
        ...(action.repriceLookupKey
          ? { price: await resolvePriceIdByLookupKey(action.repriceLookupKey) }
          : {}),
      });
    } else if (action.type === "delete") {
      itemUpdates.push({ id: action.itemId, deleted: true });
    }

    updatedSub = await getStripe().subscriptions.update(stripeSubscriptionId, {
      items: itemUpdates,
      proration_behavior: transition.prorationBehavior,
    });
  }

  const quantityChanged = updatedSub !== null;
  const liveSeatItemId = updatedSub
    ? (classifyItems(updatedSub).seat?.id ?? null)
    : (items.seat?.id ?? null);

  // Mirror semantics: seats = provisioned seats (included + extra) — the SAME
  // formula the webhook projection writes, so the two writers can never
  // ping-pong the row between different meanings.
  const mirrorSeats =
    PLANS[plan].included_seats + transition.desiredExtraQuantity;
  if (existingMirror !== mirrorSeats || quantityChanged) {
    await db
      .update(subscription)
      .set({
        seats: mirrorSeats,
        stripeSeatItemId: liveSeatItemId,
        updatedAt: new Date(),
      })
      .where(eq(subscription.organizationId, organizationId));
  }

  return {
    quantityChanged,
    previousExtraQuantity: transition.previousExtraQuantity,
    extraSeatQuantity: transition.desiredExtraQuantity,
  };
};

/**
 * Keeps the subscription's EXTRA-SEAT item in sync with the org's billable
 * member count after membership changes (base_plus_seats: only members beyond
 * the plan's included count bill; the base item stays at quantity 1).
 *
 * No-op when billing is disabled, the org has no live subscription, or the
 * derived extra-seat quantity already matches the mirror. Transition and
 * proration rules live in {@link planSeatItemTransition}.
 *
 * After talking to Stripe we optimistically mirror the provisioned seats
 * (included + extra) onto the subscription row. The
 * `customer.subscription.updated` webhook stays authoritative and will
 * confirm/overwrite, but writing here means the DB never lags Stripe if that
 * webhook is lost — which would otherwise let the short-circuit below skip a
 * real reprice and leave Stripe stuck on the wrong quantity (permanent
 * under/over-billing).
 */
export const syncSubscriptionSeats = async (
  organizationId: string,
): Promise<void> => {
  if (!isBillingPackageEnabled()) {
    return;
  }

  const existing = await getSubscriptionByOrganizationId(organizationId);
  if (!existing?.stripeSubscriptionId) {
    return;
  }
  if (!SEAT_SYNC_STATUSES.includes(existing.status as SubscriptionStatus)) {
    return;
  }

  const billableSeats = await countBillableSeats(organizationId);

  // Cheap short-circuit on the EXTRA quantity: the mirror stores provisioned
  // seats (included + extra), so compare derived extras rather than raw
  // counts — membership churn below the included count must not trigger a
  // Stripe round-trip (200-600ms) on every mutation. Reconciliation
  // deliberately does NOT take this short-circuit; it always retrieves from
  // Stripe to catch mirror/Stripe drift.
  const plan = allowancePlanKey(existing.plan);
  const desiredExtra = extraSeats(billableSeats, plan);
  const mirrorExtra = Math.max(existing.seats - PLANS[plan].included_seats, 0);
  if (desiredExtra === mirrorExtra) {
    return;
  }

  await applySeatItems(
    organizationId,
    existing.stripeSubscriptionId,
    billableSeats,
    existing.seats,
  );
};

/**
 * Reconciles ONE subscription's seat quantity against Stripe, always retrieving
 * the live subscription (never trusting the DB `seats` mirror). Exposed for the
 * nightly {@link reconcileSubscriptionSeats} job; unlike
 * {@link syncSubscriptionSeats} it has no `seats === mirror` short-circuit — that
 * short-circuit would defeat drift detection.
 *
 * Assumes the caller has already established that the subscription is live and
 * seat-syncable (has a `stripeSubscriptionId` in a {@link SEAT_SYNC_STATUSES}
 * status), so it does NOT re-check billing-enabled/status here.
 */
export const reconcileSeatQuantityForSubscription = async (params: {
  organizationId: string;
  stripeSubscriptionId: string;
  seats: number;
  mirroredSeats: number;
}): Promise<SeatQuantityApplyResult> => {
  return applySeatItems(
    params.organizationId,
    params.stripeSubscriptionId,
    params.seats,
    params.mirroredSeats,
  );
};

/**
 * Seat-sync wrapper that never throws. A Stripe outage must not fail the
 * membership mutation that triggered the sync; we log and swallow instead.
 */
export const syncSubscriptionSeatsSafe = async (
  organizationId: string,
): Promise<void> => {
  try {
    await syncSubscriptionSeats(organizationId);
  } catch (error) {
    console.error(
      `[billing] seat sync failed for organization ${organizationId}:`,
      error,
    );
  }
};

/**
 * Schedules the org's subscription to cancel at the end of the current billing
 * period. We never cancel immediately — the customer keeps access (and their
 * seats) until the period they already paid for runs out.
 *
 * Throws {@link BillingError} `NO_ACTIVE_SUBSCRIPTION` (400) when the org has no
 * live subscription, or `ALREADY_CANCELING` (409) when a cancellation is already
 * pending. Optimistically mirrors `cancelAtPeriodEnd` onto the row; the webhook
 * confirms. Returns the period end so the caller can tell the user when access
 * lapses — on this API version it lives on the subscription ITEM.
 */
export const cancelSubscriptionAtPeriodEnd = async (
  organizationId: string,
): Promise<{ cancelAtPeriodEnd: true; currentPeriodEnd: Date | null }> => {
  const existing = await getSubscriptionByOrganizationId(organizationId);
  if (
    !existing?.stripeSubscriptionId ||
    !LIVE_SUBSCRIPTION_STATUSES.includes(existing.status as SubscriptionStatus)
  ) {
    throw new BillingError(
      "This organization has no active subscription to cancel.",
      "NO_ACTIVE_SUBSCRIPTION",
      400,
    );
  }
  if (existing.cancelAtPeriodEnd) {
    throw new BillingError(
      "This subscription is already scheduled to cancel at period end.",
      "ALREADY_CANCELING",
      409,
    );
  }

  const stripeSub = await getStripe().subscriptions.update(
    existing.stripeSubscriptionId,
    { cancel_at_period_end: true },
  );

  // Prefer the fresh period end off the updated Stripe item; fall back to the
  // mirrored value if Stripe omits it.
  const periodEndUnix = stripeSub.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000)
    : (existing.currentPeriodEnd ?? null);

  await db
    .update(subscription)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscription.organizationId, organizationId));

  return { cancelAtPeriodEnd: true, currentPeriodEnd };
};

/**
 * Clears a pending period-end cancellation, keeping the subscription active.
 *
 * Throws {@link BillingError} `NOT_CANCELING` (400) when the org has no live
 * subscription or is not actually scheduled to cancel. Optimistically mirrors
 * `cancelAtPeriodEnd: false` onto the row; the webhook confirms.
 */
export const resumeSubscription = async (
  organizationId: string,
): Promise<{ cancelAtPeriodEnd: false }> => {
  const existing = await getSubscriptionByOrganizationId(organizationId);
  if (
    !existing?.stripeSubscriptionId ||
    !LIVE_SUBSCRIPTION_STATUSES.includes(
      existing.status as SubscriptionStatus,
    ) ||
    !existing.cancelAtPeriodEnd
  ) {
    throw new BillingError(
      "This subscription is not scheduled to cancel.",
      "NOT_CANCELING",
      400,
    );
  }

  await getStripe().subscriptions.update(existing.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await db
    .update(subscription)
    .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscription.organizationId, organizationId));

  return { cancelAtPeriodEnd: false };
};
