import assert from "node:assert";
import { describe, it } from "node:test";
import type Stripe from "stripe";

import {
  SubscriptionPlan,
  SubscriptionStatus,
} from "@wildfires-org/turboplan-db";

import {
  mapSubscription,
  subscriptionIdFromInvoice,
} from "../src/server/webhook-helpers";
import { PLANS } from "../src/types";

// catalog/brand.yaml is fork-owned, so every lookup key carries a
// per-deployment brand prefix. Derive the fixture keys from the catalog the
// runtime reads, keeping the seat/overage suffixes explicit.
const PRO_BASE_KEY = PLANS.pro.lookup_key;
const PRO_SEAT_KEY = `${PRO_BASE_KEY}_additional_seat`;
const PRO_OVERAGE_KEY = `${PRO_BASE_KEY}_credit_overage`;
const MAX_BASE_KEY = PLANS.max.lookup_key;

type ItemOverrides = {
  id?: string;
  quantity?: number;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  lookupKey?: string | null;
};

const item = (over: ItemOverrides = {}) => ({
  id: over.id ?? "si_default",
  quantity: over.quantity,
  current_period_start: over.currentPeriodStart ?? null,
  current_period_end: over.currentPeriodEnd ?? null,
  price: {
    id: "price_default",
    lookup_key: over.lookupKey === undefined ? PRO_BASE_KEY : over.lookupKey,
  },
});

type SubOverrides = {
  id?: string;
  metadata?: Record<string, string>;
  customer?: string | { id: string };
  status?: string;
  trialEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  items?: unknown[];
  discounts?: unknown[];
};

const makeSub = (over: SubOverrides = {}): Stripe.Subscription => {
  return {
    id: over.id ?? "sub_test",
    metadata:
      over.metadata === undefined ? { organizationId: "org_1" } : over.metadata,
    customer: over.customer ?? "cus_default",
    status: over.status ?? "active",
    trial_end: over.trialEnd ?? null,
    cancel_at_period_end: over.cancelAtPeriodEnd ?? false,
    items: { data: over.items ?? [item({ quantity: 1 })] },
    discounts: over.discounts ?? [],
  } as unknown as Stripe.Subscription;
};

// Runs `fn` with console.warn silenced so expected warnings don't clutter the
// test output.
const withSilencedWarn = (fn: () => void) => {
  const original = console.warn;
  console.warn = () => {};
  try {
    fn();
  } finally {
    console.warn = original;
  }
};

describe("mapSubscription", () => {
  it("returns null when the subscription has no organizationId in metadata", () => {
    withSilencedWarn(() => {
      const result = mapSubscription(makeSub({ metadata: { plan: "pro" } }));
      assert.strictEqual(result, null);
    });
  });

  it("still maps when metadata is present (baseline happy path)", () => {
    const result = mapSubscription(makeSub());
    assert.strictEqual(result?.organizationId, "org_1");
    assert.strictEqual(result?.stripeSubscriptionId, "sub_test");
  });

  describe("status mapping", () => {
    const statusOf = (status: string) =>
      mapSubscription(makeSub({ status }))?.status;

    it("maps known Stripe statuses to the DB enum", () => {
      assert.strictEqual(statusOf("active"), SubscriptionStatus.ACTIVE);
      assert.strictEqual(statusOf("trialing"), SubscriptionStatus.TRIALING);
      assert.strictEqual(statusOf("canceled"), SubscriptionStatus.CANCELED);
      assert.strictEqual(statusOf("unpaid"), SubscriptionStatus.UNPAID);
    });

    it("falls Stripe's 'paused' status through to PAST_DUE (no PAUSED enum)", () => {
      assert.strictEqual(statusOf("paused"), SubscriptionStatus.PAST_DUE);
    });

    it("falls an unknown status through to PAST_DUE", () => {
      assert.strictEqual(
        statusOf("some_future_status"),
        SubscriptionStatus.PAST_DUE,
      );
    });
  });

  describe("seats (included + extra-seat item quantity)", () => {
    it("mirrors included seats when there is no extra-seat item", () => {
      const result = mapSubscription(
        makeSub({ items: [item({ quantity: 1 })] }),
      );
      // Pro includes 5 seats; base quantity is always 1 in the new model.
      assert.strictEqual(result?.seats, 5);
    });

    it("adds the extra-seat item quantity to the included count", () => {
      const result = mapSubscription(
        makeSub({
          items: [
            item({ id: "si_base", quantity: 1 }),
            item({
              id: "si_seat",
              quantity: 3,
              lookupKey: PRO_SEAT_KEY,
            }),
          ],
        }),
      );
      assert.strictEqual(result?.seats, 8);
    });

    it("uses Max's included count for a max base item", () => {
      const result = mapSubscription(
        makeSub({
          items: [item({ quantity: 1, lookupKey: MAX_BASE_KEY })],
        }),
      );
      assert.strictEqual(result?.seats, 10);
    });

    it("falls back to the raw first-item quantity for foreign subscriptions", () => {
      const result = mapSubscription(
        makeSub({
          items: [item({ quantity: 4, lookupKey: "someone_elses_key" })],
        }),
      );
      assert.strictEqual(result?.seats, 4);
    });

    it("defaults seats to 1 when there are no items and no known plan", () => {
      const result = mapSubscription(makeSub({ items: [] }));
      assert.strictEqual(result?.seats, 1);
    });
  });

  describe("subscription item id capture", () => {
    it("captures base, seat and overage item ids by lookup key", () => {
      const result = mapSubscription(
        makeSub({
          items: [
            item({ id: "si_base", quantity: 1 }),
            item({
              id: "si_seat",
              quantity: 2,
              lookupKey: PRO_SEAT_KEY,
            }),
            item({
              id: "si_overage",
              lookupKey: PRO_OVERAGE_KEY,
            }),
          ],
        }),
      );
      assert.strictEqual(result?.stripeBaseItemId, "si_base");
      assert.strictEqual(result?.stripeSeatItemId, "si_seat");
      assert.strictEqual(result?.stripeOverageItemId, "si_overage");
    });

    it("leaves absent items null", () => {
      const result = mapSubscription(
        makeSub({ items: [item({ id: "si_base", quantity: 1 })] }),
      );
      assert.strictEqual(result?.stripeBaseItemId, "si_base");
      assert.strictEqual(result?.stripeSeatItemId, null);
      assert.strictEqual(result?.stripeOverageItemId, null);
    });
  });

  describe("billing period (read from the base item on the 2026 API)", () => {
    const startUnix = 1890777600; // 2029-12-01T00:00:00Z
    const endUnix = 1893456000; // 2030-01-01T00:00:00Z

    it("converts the base item's period bounds to Dates", () => {
      const result = mapSubscription(
        makeSub({
          items: [
            item({
              quantity: 1,
              currentPeriodStart: startUnix,
              currentPeriodEnd: endUnix,
            }),
          ],
        }),
      );
      assert.deepStrictEqual(
        result?.currentPeriodStart,
        new Date(startUnix * 1000),
      );
      assert.deepStrictEqual(
        result?.currentPeriodEnd,
        new Date(endUnix * 1000),
      );
    });

    it("anchors on the base item even when another item comes first", () => {
      const result = mapSubscription(
        makeSub({
          items: [
            item({
              id: "si_seat",
              quantity: 2,
              lookupKey: PRO_SEAT_KEY,
              currentPeriodEnd: 1,
            }),
            item({
              id: "si_base",
              quantity: 1,
              currentPeriodEnd: endUnix,
            }),
          ],
        }),
      );
      assert.deepStrictEqual(
        result?.currentPeriodEnd,
        new Date(endUnix * 1000),
      );
    });

    it("is null when the item has no period bounds", () => {
      const result = mapSubscription(makeSub({ items: [item()] }));
      assert.strictEqual(result?.currentPeriodStart, null);
      assert.strictEqual(result?.currentPeriodEnd, null);
    });
  });

  describe("discount projection", () => {
    it("captures percent_off and end from an expanded discount", () => {
      const endUnix = 1924992000; // 2031-01-01T00:00:00Z
      const result = mapSubscription(
        makeSub({
          discounts: [
            { source: { coupon: { percent_off: 50 } }, end: endUnix },
          ],
        }),
      );
      assert.strictEqual(result?.discountPercentOff, 50);
      assert.deepStrictEqual(result?.discountEndsAt, new Date(endUnix * 1000));
    });

    it("skips unexpanded string discount refs", () => {
      const result = mapSubscription(makeSub({ discounts: ["di_123"] }));
      assert.strictEqual(result?.discountPercentOff, null);
      assert.strictEqual(result?.discountEndsAt, null);
    });

    it("skips discounts whose coupon is an unexpanded string id", () => {
      const result = mapSubscription(
        makeSub({ discounts: [{ source: { coupon: "coupon_id" } }] }),
      );
      assert.strictEqual(result?.discountPercentOff, null);
    });

    it("ignores amount-off coupons (no percent_off)", () => {
      const result = mapSubscription(
        makeSub({ discounts: [{ source: { coupon: { amount_off: 500 } } }] }),
      );
      assert.strictEqual(result?.discountPercentOff, null);
    });

    it("is null when there is no discount", () => {
      const result = mapSubscription(makeSub());
      assert.strictEqual(result?.discountPercentOff, null);
      assert.strictEqual(result?.discountEndsAt, null);
    });
  });

  describe("trialEnd", () => {
    it("converts trial_end (unix seconds) to a Date", () => {
      const unix = 1704067200; // 2024-01-01T00:00:00Z
      const result = mapSubscription(makeSub({ trialEnd: unix }));
      assert.deepStrictEqual(result?.trialEnd, new Date(unix * 1000));
    });

    it("is null when trial_end is absent", () => {
      const result = mapSubscription(makeSub({ trialEnd: null }));
      assert.strictEqual(result?.trialEnd, null);
    });
  });

  describe("cancelAtPeriodEnd passthrough", () => {
    it("passes true through", () => {
      const result = mapSubscription(makeSub({ cancelAtPeriodEnd: true }));
      assert.strictEqual(result?.cancelAtPeriodEnd, true);
    });

    it("passes false through", () => {
      const result = mapSubscription(makeSub({ cancelAtPeriodEnd: false }));
      assert.strictEqual(result?.cancelAtPeriodEnd, false);
    });
  });

  describe("stripeCustomerId", () => {
    it("resolves from a string customer", () => {
      const result = mapSubscription(makeSub({ customer: "cus_str" }));
      assert.strictEqual(result?.stripeCustomerId, "cus_str");
    });

    it("resolves from an expanded customer object", () => {
      const result = mapSubscription(makeSub({ customer: { id: "cus_obj" } }));
      assert.strictEqual(result?.stripeCustomerId, "cus_obj");
    });
  });

  describe("plan resolution precedence", () => {
    it("prefers a valid metadata.plan over the base item's lookup key", () => {
      const result = mapSubscription(
        makeSub({
          metadata: { organizationId: "org_1", plan: "max" },
          items: [item({ quantity: 1, lookupKey: PRO_BASE_KEY })],
        }),
      );
      assert.strictEqual(result?.plan, SubscriptionPlan.MAX);
    });

    it("falls back to the base item's lookup key when metadata.plan is absent", () => {
      const result = mapSubscription(
        makeSub({
          metadata: { organizationId: "org_1" },
          items: [item({ quantity: 1, lookupKey: PRO_BASE_KEY })],
        }),
      );
      assert.strictEqual(result?.plan, SubscriptionPlan.PRO);
    });

    it("ignores an invalid metadata.plan and falls back to the lookup key", () => {
      const result = mapSubscription(
        makeSub({
          metadata: { organizationId: "org_1", plan: "enterprise" },
          items: [item({ quantity: 1, lookupKey: MAX_BASE_KEY })],
        }),
      );
      assert.strictEqual(result?.plan, SubscriptionPlan.MAX);
    });

    it("is null when neither metadata.plan nor any lookup key resolves", () => {
      const result = mapSubscription(
        makeSub({
          metadata: { organizationId: "org_1" },
          items: [item({ quantity: 1, lookupKey: "someone_elses_key" })],
        }),
      );
      assert.strictEqual(result?.plan, null);
    });
  });
});

describe("subscriptionIdFromInvoice", () => {
  const invoiceOf = (parent: unknown): Stripe.Invoice =>
    ({ parent }) as unknown as Stripe.Invoice;

  it("returns the id from a string subscription ref", () => {
    const invoice = invoiceOf({
      subscription_details: { subscription: "sub_123" },
    });
    assert.strictEqual(subscriptionIdFromInvoice(invoice), "sub_123");
  });

  it("returns the id from an expanded subscription object ref", () => {
    const invoice = invoiceOf({
      subscription_details: { subscription: { id: "sub_obj" } },
    });
    assert.strictEqual(subscriptionIdFromInvoice(invoice), "sub_obj");
  });

  it("returns undefined when the invoice has no parent", () => {
    const invoice = invoiceOf(undefined);
    assert.strictEqual(subscriptionIdFromInvoice(invoice), undefined);
  });

  it("returns undefined when subscription_details carries no subscription", () => {
    const invoice = invoiceOf({ subscription_details: {} });
    assert.strictEqual(subscriptionIdFromInvoice(invoice), undefined);
  });
});
