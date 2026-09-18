import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCatalog } from "../scripts/catalog-schema";
import { readCatalogSource } from "../scripts/load-catalog";
import {
  buildDesiredStripeState,
  displayName,
} from "../scripts/stripe-desired-state";

const catalog = validateCatalog(readCatalogSource());
const state = buildDesiredStripeState(catalog);

// catalog/brand.yaml is fork-owned (`merge=ours`) and names live Stripe
// objects, so `product` and the plan lookup keys differ per deployment. Derive
// the expectations from the catalog the builder was fed, so these tests still
// pin the catalog -> Stripe key structure without pinning one brand.
const { product } = catalog;

const lookupKeyOf = (planId: string): string => {
  const plan = catalog.billing.plans.find(
    (candidate) => candidate.id === planId,
  );
  if (plan?.lookup_key === undefined) {
    throw new Error(`catalog plan "${planId}" declares no lookup_key`);
  }
  return plan.lookup_key;
};

const PRO_BASE_KEY = lookupKeyOf("pro");
const MAX_BASE_KEY = lookupKeyOf("max");
const SEAT_PRODUCT_KEY = `${product}_additional_seat`;
const CREDITS_PRODUCT_KEY = `${product}_credits`;
const PRO_PRODUCT_KEY = `${product}_plan_pro`;
const MAX_PRODUCT_KEY = `${product}_plan_max`;
const STARTUP_COUPON_PREFIX = `${product}-startups`;

describe("buildDesiredStripeState (shipped catalog)", () => {
  it("declares one product per paid plan plus seat and credits products", () => {
    assert.deepEqual(
      state.products.map((p) => p.catalogKey).sort(),
      [
        SEAT_PRODUCT_KEY,
        CREDITS_PRODUCT_KEY,
        MAX_PRODUCT_KEY,
        PRO_PRODUCT_KEY,
      ].sort(),
    );
    const seat = state.products.find((p) => p.catalogKey === SEAT_PRODUCT_KEY);
    // A product with no DISPLAY_NAMES entry falls back to its raw slug, which
    // would ship a lowercase name to Stripe. Assert the fork registered one.
    assert.notEqual(
      displayName(product),
      product,
      `add "${product}" to DISPLAY_NAMES in scripts/stripe-desired-state.ts`,
    );
    assert.equal(seat?.name, `${displayName(product)} Additional Seat`);
  });

  it("derives exactly the six prices with runtime-matching lookup keys", () => {
    assert.deepEqual(
      state.prices.map((p) => p.lookupKey).sort(),
      [
        MAX_BASE_KEY,
        `${MAX_BASE_KEY}_additional_seat`,
        `${MAX_BASE_KEY}_credit_overage`,
        PRO_BASE_KEY,
        `${PRO_BASE_KEY}_additional_seat`,
        `${PRO_BASE_KEY}_credit_overage`,
      ].sort(),
    );
  });

  it("prices base plans as licensed monthly workspace prices", () => {
    const pro = state.prices.find((p) => p.lookupKey === PRO_BASE_KEY);
    assert.deepEqual(pro, {
      lookupKey: PRO_BASE_KEY,
      productCatalogKey: PRO_PRODUCT_KEY,
      currency: "usd",
      interval: "month",
      kind: "licensed",
      unitAmountCents: 9900,
    });
    const max = state.prices.find((p) => p.lookupKey === MAX_BASE_KEY);
    assert.equal(max?.kind === "licensed" && max.unitAmountCents, 19900);
  });

  it("prices extra seats at $29 on the shared seat product", () => {
    for (const baseKey of [PRO_BASE_KEY, MAX_BASE_KEY]) {
      const seat = state.prices.find(
        (p) => p.lookupKey === `${baseKey}_additional_seat`,
      );
      assert.equal(seat?.productCatalogKey, SEAT_PRODUCT_KEY);
      assert.equal(seat?.kind === "licensed" && seat.unitAmountCents, 2900);
    }
  });

  it("prices overage as fractional-cent metered decimals without float junk", () => {
    const pro = state.prices.find(
      (p) => p.lookupKey === `${PRO_BASE_KEY}_credit_overage`,
    );
    assert.equal(pro?.kind === "metered" && pro.unitAmountDecimalCents, "0.6");
    const max = state.prices.find(
      (p) => p.lookupKey === `${MAX_BASE_KEY}_credit_overage`,
    );
    assert.equal(max?.kind === "metered" && max.unitAmountDecimalCents, "0.5");
    assert.equal(pro?.productCatalogKey, CREDITS_PRODUCT_KEY);
  });

  it("declares the credits meter", () => {
    assert.deepEqual(state.meter, {
      eventName: catalog.billing.meter_event_name,
      aggregationFormula: "sum",
    });
  });

  it("restricts the startup coupon to the base plan products only", () => {
    assert.equal(state.coupons.length, 1);
    const coupon = state.coupons[0];
    assert.equal(coupon.idPrefix, STARTUP_COUPON_PREFIX);
    assert.equal(coupon.percentOff, 50);
    assert.equal(coupon.duration, "repeating");
    assert.equal(coupon.durationInMonths, 12);
    assert.deepEqual(
      coupon.appliesToProductCatalogKeys.sort(),
      [MAX_PRODUCT_KEY, PRO_PRODUCT_KEY].sort(),
    );
    assert.equal(coupon.maxRedemptions, 100);
    assert.equal(coupon.redeemBy, "2026-12-31");
  });

  it("derives one promotion code per catalog code", () => {
    assert.deepEqual(state.promotionCodes, [
      { code: "STARTUP50", couponIdPrefix: STARTUP_COUPON_PREFIX },
    ]);
  });

  it("declares no Stripe objects for the free plan", () => {
    const starterRefs = [
      ...state.products.map((p) => p.catalogKey),
      ...state.prices.map((p) => p.lookupKey),
    ].filter((key) => key.includes("starter"));
    assert.deepEqual(starterRefs, []);
  });
});

describe("buildDesiredStripeState (catalog variations)", () => {
  it("narrowing the discount program plans narrows the coupon restriction", () => {
    const doc = readCatalogSource();
    doc.billing.discount_programs[0].plans = ["pro"];
    const varied = buildDesiredStripeState(validateCatalog(doc));
    assert.deepEqual(varied.coupons[0].appliesToProductCatalogKeys, [
      PRO_PRODUCT_KEY,
    ]);
  });

  it("changing a price flows straight through", () => {
    const doc = readCatalogSource();
    doc.billing.plans[1].price_usd = 129;
    const varied = buildDesiredStripeState(validateCatalog(doc));
    const pro = varied.prices.find((p) => p.lookupKey === PRO_BASE_KEY);
    assert.equal(pro?.kind === "licensed" && pro.unitAmountCents, 12900);
  });
});
