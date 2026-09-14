import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";

import type {
  DesiredCoupon,
  DesiredPrice,
} from "../scripts/stripe-desired-state";
import {
  couponMatches,
  couponVersion,
  epochSeconds,
  priceMatches,
} from "../scripts/stripe-diff";

const productIdByCatalogKey = new Map([
  ["turboplan_plan_pro", "prod_pro"],
  ["turboplan_plan_max", "prod_max"],
  ["turboplan_credits", "prod_credits"],
]);

const licensedWant: DesiredPrice = {
  lookupKey: "turboplan_pro_monthly",
  productCatalogKey: "turboplan_plan_pro",
  currency: "usd",
  interval: "month",
  kind: "licensed",
  unitAmountCents: 9900,
};

const meteredWant: DesiredPrice = {
  lookupKey: "turboplan_pro_monthly_credit_overage",
  productCatalogKey: "turboplan_credits",
  currency: "usd",
  interval: "month",
  kind: "metered",
  unitAmountDecimalCents: "0.6",
};

const licensedActual = (over: Record<string, unknown> = {}): Stripe.Price =>
  ({
    active: true,
    product: "prod_pro",
    currency: "usd",
    unit_amount: 9900,
    unit_amount_decimal: null,
    recurring: { interval: "month", usage_type: "licensed" },
    ...over,
  }) as unknown as Stripe.Price;

const meteredActual = (over: Record<string, unknown> = {}): Stripe.Price =>
  ({
    active: true,
    product: "prod_credits",
    currency: "usd",
    unit_amount: null,
    unit_amount_decimal: { toString: () => "0.6" },
    recurring: { interval: "month", usage_type: "metered", meter: "mtr_1" },
    ...over,
  }) as unknown as Stripe.Price;

const context = { productIdByCatalogKey, meterId: "mtr_1" };

describe("priceMatches", () => {
  it("accepts an in-sync licensed price", () => {
    assert.equal(priceMatches(licensedActual(), licensedWant, context), true);
  });

  it("rejects amount drift", () => {
    assert.equal(
      priceMatches(
        licensedActual({ unit_amount: 12900 }),
        licensedWant,
        context,
      ),
      false,
    );
  });

  it("rejects a price on the wrong product", () => {
    assert.equal(
      priceMatches(
        licensedActual({ product: "prod_max" }),
        licensedWant,
        context,
      ),
      false,
    );
  });

  it("rejects an inactive price", () => {
    assert.equal(
      priceMatches(licensedActual({ active: false }), licensedWant, context),
      false,
    );
  });

  it("accepts an in-sync metered price (Decimal toString compare)", () => {
    assert.equal(priceMatches(meteredActual(), meteredWant, context), true);
  });

  it("treats numerically equal decimal strings as in sync", () => {
    assert.equal(
      priceMatches(
        meteredActual({ unit_amount_decimal: { toString: () => "0.60" } }),
        meteredWant,
        context,
      ),
      true,
    );
  });

  it("rejects a metered price on the wrong meter", () => {
    assert.equal(
      priceMatches(
        meteredActual({
          recurring: {
            interval: "month",
            usage_type: "metered",
            meter: "mtr_other",
          },
        }),
        meteredWant,
        context,
      ),
      false,
    );
  });
});

const wantCoupon: DesiredCoupon = {
  idPrefix: "turboplan-startups",
  name: "Startup discount",
  percentOff: 50,
  duration: "repeating",
  durationInMonths: 12,
  appliesToProductCatalogKeys: ["turboplan_plan_pro", "turboplan_plan_max"],
  maxRedemptions: 100,
  redeemBy: "2026-12-31",
};

const actualCoupon = (over: Record<string, unknown> = {}): Stripe.Coupon =>
  ({
    percent_off: 50,
    duration: "repeating",
    duration_in_months: 12,
    max_redemptions: 100,
    redeem_by: epochSeconds("2026-12-31"),
    applies_to: { products: ["prod_max", "prod_pro"] },
    ...over,
  }) as unknown as Stripe.Coupon;

describe("couponMatches", () => {
  it("accepts an in-sync coupon regardless of product order", () => {
    assert.equal(
      couponMatches(actualCoupon(), wantCoupon, { productIdByCatalogKey }),
      true,
    );
  });

  it("rejects percent drift", () => {
    assert.equal(
      couponMatches(actualCoupon({ percent_off: 40 }), wantCoupon, {
        productIdByCatalogKey,
      }),
      false,
    );
  });

  it("rejects a restriction-set mismatch", () => {
    assert.equal(
      couponMatches(
        actualCoupon({ applies_to: { products: ["prod_pro"] } }),
        wantCoupon,
        { productIdByCatalogKey },
      ),
      false,
    );
  });

  it("rejects when a desired product is unresolved (forces replace)", () => {
    assert.equal(
      couponMatches(actualCoupon(), wantCoupon, {
        productIdByCatalogKey: new Map([["turboplan_plan_pro", "prod_pro"]]),
      }),
      false,
    );
  });

  it("rejects redeem_by drift", () => {
    assert.equal(
      couponMatches(
        actualCoupon({ redeem_by: epochSeconds("2027-06-30") }),
        wantCoupon,
        { productIdByCatalogKey },
      ),
      false,
    );
  });
});

describe("couponVersion", () => {
  it("parses versions and rejects foreign prefixes", () => {
    assert.equal(
      couponVersion("turboplan-startups-v1", "turboplan-startups"),
      1,
    );
    assert.equal(
      couponVersion("turboplan-startups-v12", "turboplan-startups"),
      12,
    );
    assert.equal(
      couponVersion("turboplan-startups-eu-v1", "turboplan-startups"),
      0,
    );
    assert.equal(couponVersion("other", "turboplan-startups"), 0);
  });
});
