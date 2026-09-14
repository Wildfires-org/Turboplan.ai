import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCatalog } from "../scripts/catalog-schema";
import { readCatalogSource } from "../scripts/load-catalog";
import { buildDesiredStripeState } from "../scripts/stripe-desired-state";

const catalog = validateCatalog(readCatalogSource());
const state = buildDesiredStripeState(catalog);

describe("buildDesiredStripeState (shipped catalog)", () => {
  it("declares one product per paid plan plus seat and credits products", () => {
    assert.deepEqual(state.products.map((p) => p.catalogKey).sort(), [
      "turboplan_additional_seat",
      "turboplan_credits",
      "turboplan_plan_max",
      "turboplan_plan_pro",
    ]);
    const seat = state.products.find(
      (p) => p.catalogKey === "turboplan_additional_seat",
    );
    assert.equal(seat?.name, "TurboPlan Additional Seat");
  });

  it("derives exactly the six prices with runtime-matching lookup keys", () => {
    assert.deepEqual(state.prices.map((p) => p.lookupKey).sort(), [
      "turboplan_max_monthly",
      "turboplan_max_monthly_additional_seat",
      "turboplan_max_monthly_credit_overage",
      "turboplan_pro_monthly",
      "turboplan_pro_monthly_additional_seat",
      "turboplan_pro_monthly_credit_overage",
    ]);
  });

  it("prices base plans as licensed monthly workspace prices", () => {
    const pro = state.prices.find(
      (p) => p.lookupKey === "turboplan_pro_monthly",
    );
    assert.deepEqual(pro, {
      lookupKey: "turboplan_pro_monthly",
      productCatalogKey: "turboplan_plan_pro",
      currency: "usd",
      interval: "month",
      kind: "licensed",
      unitAmountCents: 9900,
    });
    const max = state.prices.find(
      (p) => p.lookupKey === "turboplan_max_monthly",
    );
    assert.equal(max?.kind === "licensed" && max.unitAmountCents, 19900);
  });

  it("prices extra seats at $29 on the shared seat product", () => {
    for (const plan of ["pro", "max"]) {
      const seat = state.prices.find(
        (p) => p.lookupKey === `turboplan_${plan}_monthly_additional_seat`,
      );
      assert.equal(seat?.productCatalogKey, "turboplan_additional_seat");
      assert.equal(seat?.kind === "licensed" && seat.unitAmountCents, 2900);
    }
  });

  it("prices overage as fractional-cent metered decimals without float junk", () => {
    const pro = state.prices.find(
      (p) => p.lookupKey === "turboplan_pro_monthly_credit_overage",
    );
    assert.equal(pro?.kind === "metered" && pro.unitAmountDecimalCents, "0.6");
    const max = state.prices.find(
      (p) => p.lookupKey === "turboplan_max_monthly_credit_overage",
    );
    assert.equal(max?.kind === "metered" && max.unitAmountDecimalCents, "0.5");
    assert.equal(pro?.productCatalogKey, "turboplan_credits");
  });

  it("declares the credits meter", () => {
    assert.deepEqual(state.meter, {
      eventName: "turboplan_credits",
      aggregationFormula: "sum",
    });
  });

  it("restricts the startup coupon to the base plan products only", () => {
    assert.equal(state.coupons.length, 1);
    const coupon = state.coupons[0];
    assert.equal(coupon.idPrefix, "turboplan-startups");
    assert.equal(coupon.percentOff, 50);
    assert.equal(coupon.duration, "repeating");
    assert.equal(coupon.durationInMonths, 12);
    assert.deepEqual(coupon.appliesToProductCatalogKeys.sort(), [
      "turboplan_plan_max",
      "turboplan_plan_pro",
    ]);
    assert.equal(coupon.maxRedemptions, 100);
    assert.equal(coupon.redeemBy, "2026-12-31");
  });

  it("derives one promotion code per catalog code", () => {
    assert.deepEqual(state.promotionCodes, [
      { code: "STARTUP50", couponIdPrefix: "turboplan-startups" },
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
      "turboplan_plan_pro",
    ]);
  });

  it("changing a price flows straight through", () => {
    const doc = readCatalogSource();
    doc.billing.plans[1].price_usd = 129;
    const varied = buildDesiredStripeState(validateCatalog(doc));
    const pro = varied.prices.find(
      (p) => p.lookupKey === "turboplan_pro_monthly",
    );
    assert.equal(pro?.kind === "licensed" && pro.unitAmountCents, 12900);
  });
});
