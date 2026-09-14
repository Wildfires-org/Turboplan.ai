/**
 * Test utilities for billing E2E tests.
 *
 * Billing has no Stripe webhook delivery in the e2e environment, so these
 * helpers lean on the fact that the app writes the DB optimistically and
 * computes seat/roster counts live from the membership tables. We seed a REAL
 * Stripe test-mode subscription (base_plus_seats: base item + metered overage
 * item, extra-seat item only beyond the included count), mirror it into the
 * DB, then drive the UI and assert against both the DB and the Stripe API.
 *
 * Prices are resolved by LOOKUP KEY from the synced catalog (see the billing
 * package's sync:stripe script) — no per-price env vars.
 *
 * Env: reads Stripe config straight from `process.env` (never `getApiEnv()`, so
 * the helper's own Stripe client is decoupled from the full billing-env
 * validation). The suite skips cleanly when these are unset — see
 * {@link isBillingE2EConfigured}.
 */

import { and, eq, ne } from "drizzle-orm";
import Stripe from "stripe";

import {
  extraSeats,
  type PaidPlanKey,
  PLANS,
  seatLookupKey,
} from "@wildfires-org/turboplan-billing/types";
import {
  organizationUsers,
  type Subscription,
  subscription,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  assignOrganizationOwner,
  createOrganization,
  createOrganizationUser,
  OrganizationType,
} from "@wildfires-org/turboplan-workspace/server";

import { createTestUserWithMagicLink } from "./test-auth";

/** Stripe test card payment method — required since plans have no trial. */
const TEST_PAYMENT_METHOD = "pm_card_visa";

const isTruthy = (value: string | undefined): boolean =>
  value === "true" || value === "1";

let _stripe: Stripe | null = null;

/** Key prefixes that identify Stripe TEST-mode keys (secret or restricted). */
const TEST_KEY_PREFIXES = ["sk_test_", "rk_test_"];

const isTestModeKey = (key: string | undefined): boolean =>
  !!key && TEST_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));

/**
 * Whether the billing suite has everything it needs to run: the billing
 * package enabled AND a Stripe TEST-MODE key whose account has the catalog
 * synced (prices are resolved by lookup key at runtime). CI without Stripe
 * keys — or with a non-test key — returns false so the suite `test.skip()`s
 * cleanly instead of failing (the client below additionally hard-refuses
 * non-test keys as a second line of defense).
 */
export const isBillingE2EConfigured = (): boolean => {
  const billingEnabled =
    isTruthy(process.env.IS_BILLING_PACKAGE_ENABLED) ||
    isTruthy(process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED);

  return billingEnabled && isTestModeKey(process.env.STRIPE_SECRET_KEY);
};

/**
 * Lazily-built Stripe client from `STRIPE_SECRET_KEY`. Only call when configured.
 *
 * Hard-refuses non-test keys: this suite creates and cancels real subscriptions,
 * so running it against a LIVE key would write junk objects (and potential
 * charges) onto the production Stripe account. Every Stripe call in the billing
 * e2e helpers goes through this client, so the guard covers the whole suite.
 */
export const getStripeClient = (): Stripe => {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY as string;
    if (!TEST_KEY_PREFIXES.some((prefix) => secretKey.startsWith(prefix))) {
      throw new Error(
        "Billing e2e refused to run: STRIPE_SECRET_KEY is not a TEST-mode key " +
          "(expected sk_test_/rk_test_ prefix). This suite creates and cancels " +
          "real Stripe subscriptions — never point it at a live account.",
      );
    }
    // API version pinned to match the app's billing service (stripe-service.ts).
    _stripe = new Stripe(secretKey, {
      apiVersion: "2026-05-27.dahlia",
    });
  }
  return _stripe;
};

const priceIdCache = new Map<string, string>();

/**
 * Resolve a price id by its lookup key (the catalog's stable identifier).
 * Throws when the key is missing — that means the Stripe test account has not
 * had the catalog synced (`pnpm --filter @wildfires-org/turboplan-billing
 * sync:stripe -- --apply`).
 */
export const resolvePriceIdByLookupKey = async (
  lookupKey: string,
): Promise<string> => {
  const cached = priceIdCache.get(lookupKey);
  if (cached) {
    return cached;
  }

  const prices = await getStripeClient().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error(
      `No active Stripe price with lookup key "${lookupKey}". Sync the ` +
        "catalog to this test account first: pnpm --filter " +
        "@wildfires-org/turboplan-billing sync:stripe -- --apply",
    );
  }

  priceIdCache.set(lookupKey, price.id);
  return price.id;
};

export interface BillingTestOrg {
  id: string;
  slug: string;
  name: string;
}

/**
 * Create a dedicated organization owned by `ownerId`. Owner (not viewer) so the
 * user has MANAGE_MEMBERS — the permission every billing mutation gates on.
 */
export const createBillingTestOrg = async (params: {
  ownerId: string;
  name: string;
}): Promise<BillingTestOrg> => {
  const org = await createOrganization({
    name: params.name,
    description: "Organization for billing E2E testing",
    type: OrganizationType.BUSINESS,
    createdBy: params.ownerId,
  });

  await assignOrganizationOwner(params.ownerId, org.id);

  return { id: org.id, slug: org.slug, name: org.name };
};

export interface SeededSubscription {
  customerId: string;
  subscriptionId: string;
}

/**
 * Seed a real Stripe TEST-MODE Pro subscription for `organizationId` and
 * mirror it into the DB `subscription` row (organizationId is the unique key).
 *
 * base_plus_seats: base item (qty 1) + metered credit-overage item. No
 * extra-seat item — the org starts within the included seat count. Plans have
 * no trial, so the standard test card is attached as the default payment
 * method before creating the subscription.
 */
export const seedProSubscription = async (params: {
  organizationId: string;
  email: string;
  name: string;
}): Promise<SeededSubscription> => {
  const stripe = getStripeClient();
  const plan: PaidPlanKey = "pro";
  const planConfig = PLANS[plan];

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: { organizationId: params.organizationId },
  });

  const paymentMethod = await stripe.paymentMethods.attach(
    TEST_PAYMENT_METHOD,
    { customer: customer.id },
  );
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });

  const [basePriceId, overagePriceId] = await Promise.all([
    resolvePriceIdByLookupKey(planConfig.lookup_key),
    resolvePriceIdByLookupKey(`${planConfig.lookup_key}_credit_overage`),
  ]);

  const stripeSub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      { price: basePriceId, quantity: 1 },
      { price: overagePriceId }, // metered — no quantity
    ],
    default_payment_method: paymentMethod.id,
    metadata: { organizationId: params.organizationId, plan },
  });

  const baseItem = stripeSub.items.data.find(
    (item) => item.price.id === basePriceId,
  );
  const overageItem = stripeSub.items.data.find(
    (item) => item.price.id === overagePriceId,
  );
  const currentPeriodStart = baseItem?.current_period_start
    ? new Date(baseItem.current_period_start * 1000)
    : null;
  const currentPeriodEnd = baseItem?.current_period_end
    ? new Date(baseItem.current_period_end * 1000)
    : null;

  // Mirror the Stripe subscription into the DB, exactly as the webhook would:
  // seats = included + extra (no seat item here → included).
  const now = new Date();
  const mirrored = {
    stripeCustomerId: customer.id,
    stripeSubscriptionId: stripeSub.id,
    stripeBaseItemId: baseItem?.id ?? null,
    stripeSeatItemId: null,
    stripeOverageItemId: overageItem?.id ?? null,
    status: "active" as const,
    plan,
    seats: planConfig.included_seats,
    trialEnd: null,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    planChosenAt: now,
    updatedAt: now,
  };

  await db
    .insert(subscription)
    .values({ organizationId: params.organizationId, ...mirrored })
    .onConflictDoUpdate({
      target: subscription.organizationId,
      set: mirrored,
    });

  return { customerId: customer.id, subscriptionId: stripeSub.id };
};

export interface AddedEditor {
  userId: string;
  email: string;
}

/**
 * Add an existing (or freshly-created) user to `organizationId` as an EDITOR and
 * bring the seat state in line — mirroring exactly what the app's add-member
 * endpoint does (`addMembership` + seat sync). Non-viewer members are billable;
 * only members beyond the plan's included count create/bump the Stripe
 * extra-seat item.
 */
export const addOrganizationEditor = async (params: {
  organizationId: string;
  email: string;
}): Promise<AddedEditor> => {
  const { user } = await createTestUserWithMagicLink(params.email);

  await createOrganizationUser({
    userId: user.id,
    organizationId: params.organizationId,
    role: "editor",
  });

  await syncSeatsToStripe(params.organizationId);

  return { userId: user.id, email: user.email };
};

/**
 * Reproduce the server's base_plus_seats seat sync for the controlled test org
 * (which only ever holds org-level memberships): compute billable members,
 * derive the desired EXTRA-seat quantity beyond the plan's included count, and
 * apply the item transition (create / update / delete) on the Stripe
 * subscription; mirror `seats = included + extra` onto the DB row.
 */
const syncSeatsToStripe = async (organizationId: string): Promise<void> => {
  const billable = await countNonViewerOrgMembers(organizationId);

  const row = await getDbSubscription(organizationId);
  if (!row?.stripeSubscriptionId) {
    return;
  }

  const plan: PaidPlanKey = "pro";
  const desiredExtra = extraSeats(billable, plan);
  const includedSeats = PLANS[plan].included_seats;

  const stripe = getStripeClient();
  const stripeSub = await stripe.subscriptions.retrieve(
    row.stripeSubscriptionId,
  );
  const seatKey = seatLookupKey(plan);
  const seatItem = stripeSub.items.data.find(
    (item) => item.price.lookup_key === seatKey,
  );
  const currentExtra = seatItem?.quantity ?? 0;

  let seatItemId = seatItem?.id ?? null;
  if (desiredExtra !== currentExtra) {
    if (!seatItem && desiredExtra > 0) {
      const seatPriceId = await resolvePriceIdByLookupKey(seatKey);
      const updated = await stripe.subscriptions.update(
        row.stripeSubscriptionId,
        {
          items: [{ price: seatPriceId, quantity: desiredExtra }],
          proration_behavior: "none",
        },
      );
      seatItemId =
        updated.items.data.find((item) => item.price.lookup_key === seatKey)
          ?.id ?? null;
    } else if (seatItem && desiredExtra > 0) {
      await stripe.subscriptions.update(row.stripeSubscriptionId, {
        items: [{ id: seatItem.id, quantity: desiredExtra }],
        proration_behavior: "none",
      });
    } else if (seatItem && desiredExtra === 0) {
      await stripe.subscriptions.update(row.stripeSubscriptionId, {
        items: [{ id: seatItem.id, deleted: true }],
        proration_behavior: "none",
      });
      seatItemId = null;
    }
  }

  await db
    .update(subscription)
    .set({
      seats: includedSeats + desiredExtra,
      stripeSeatItemId: seatItemId,
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, organizationId));
};

/** Count of distinct non-viewer (billable) direct org members. */
const countNonViewerOrgMembers = async (
  organizationId: string,
): Promise<number> => {
  const rows = await db
    .select({ userId: organizationUsers.userId })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        ne(organizationUsers.role, "viewer"),
      ),
    );
  return Math.max(1, rows.length);
};

/** Read the DB `subscription` row for an org (the app's optimistic mirror). */
export const getDbSubscription = async (
  organizationId: string,
): Promise<Subscription | undefined> => {
  return db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
  });
};

/** Retrieve the live Stripe subscription. */
export const getStripeSubscription = async (
  subscriptionId: string,
): Promise<Stripe.Subscription> => {
  return getStripeClient().subscriptions.retrieve(subscriptionId);
};

/**
 * Quantity of the EXTRA-seat item on the Stripe subscription — 0 when the
 * item does not exist (billable members within the included count).
 */
export const getStripeExtraSeatQuantity = async (
  subscriptionId: string,
  plan: PaidPlanKey = "pro",
): Promise<number> => {
  const stripeSub = await getStripeSubscription(subscriptionId);
  const seatItem = stripeSub.items.data.find(
    (item) => item.price.lookup_key === seatLookupKey(plan),
  );
  return seatItem?.quantity ?? 0;
};

/** A user's direct org-membership role, or null if they hold none. */
export const getOrgMembershipRole = async (
  organizationId: string,
  userId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ role: organizationUsers.role })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
};

/**
 * Best-effort teardown: cancel the Stripe subscription and delete the Stripe
 * customer so test-mode objects do not accumulate across runs. The DB itself is
 * cleared by the e2e global teardown, so we only remove the local subscription
 * row to keep a re-run within the same DB clean.
 */
export const cleanupBillingTest = async (params: {
  subscriptionId?: string;
  customerId?: string;
  organizationId?: string;
}): Promise<void> => {
  const stripe = getStripeClient();

  if (params.subscriptionId) {
    try {
      await stripe.subscriptions.cancel(params.subscriptionId);
    } catch {
      // Already canceled or gone — ignore.
    }
  }

  if (params.customerId) {
    try {
      await stripe.customers.del(params.customerId);
    } catch {
      // Already deleted — ignore.
    }
  }

  if (params.organizationId) {
    try {
      await db
        .delete(subscription)
        .where(eq(subscription.organizationId, params.organizationId));
    } catch {
      // DB may already be torn down — ignore.
    }
  }
};
