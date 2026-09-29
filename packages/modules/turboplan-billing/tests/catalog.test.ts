import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCatalog } from "../scripts/catalog-schema";
import { readCatalogSource } from "../scripts/load-catalog";

/** Fresh mutable copy of the shipped catalog for mutation-based rejection tests. */
const loadCatalog = () => readCatalogSource();

const expectRejected = (
  mutate: (doc: ReturnType<typeof loadCatalog>) => void,
  messageFragment: string,
) => {
  const doc = loadCatalog();
  mutate(doc);
  assert.throws(
    () => validateCatalog(doc),
    (error: Error) => error.message.includes(messageFragment),
    `expected rejection mentioning: ${messageFragment}`,
  );
};

describe("pricing catalog schema", () => {
  it("accepts the shipped catalog", () => {
    const source = loadCatalog();
    const catalog = validateCatalog(source);
    // catalog/brand.yaml is fork-owned (`merge=ours`) and is meant to diverge
    // per deployment, so assert the declared brand round-trips through
    // validation instead of pinning an upstream-specific slug.
    assert.equal(typeof source.product, "string");
    assert.notEqual(source.product, "");
    assert.equal(catalog.product, source.product);
    assert.deepEqual(
      catalog.billing.plans.map((plan) => plan.id),
      ["starter", "pro", "max"],
    );
  });

  it("rejects a seat price on the free plan", () => {
    expectRejected((doc) => {
      doc.billing.plans[0].additional_seat_price_usd = 29;
    }, "additional_seat_price_usd: null");
  });

  it("rejects a null seat price on a paid plan (0 must be explicit)", () => {
    expectRejected((doc) => {
      doc.billing.plans[1].additional_seat_price_usd = null;
    }, "0 is allowed, null is not");
  });

  it("rejects a paid plan without overage pricing", () => {
    expectRejected((doc) => {
      doc.billing.plans[1].overage_usd_per_credit = null;
    }, "must declare overage_usd_per_credit");
  });

  it("rejects a paid plan without a lookup_key", () => {
    expectRejected((doc) => {
      delete doc.billing.plans[2].lookup_key;
    }, "must declare a lookup_key");
  });

  it("rejects a free plan without hard_stop", () => {
    expectRejected((doc) => {
      doc.billing.plans[0].hard_stop = false;
    }, "hard_stop: true");
  });

  it("rejects percent_off above 100", () => {
    expectRejected((doc) => {
      doc.billing.discount_programs[0].discount.percent_off = 150;
    }, "percent_off");
  });

  it("rejects unknown keys anywhere", () => {
    expectRejected((doc) => {
      doc.billing.plans[1].seat_bonus_credits = 5;
    }, "seat_bonus_credits");
  });

  it("rejects a discount program referencing a non-paid plan", () => {
    expectRejected((doc) => {
      doc.billing.discount_programs[0].plans = ["starter"];
    }, "not a declared paid plan");
  });

  it("rejects case-insensitively duplicated promotion codes", () => {
    expectRejected((doc) => {
      doc.billing.discount_programs[0].codes = ["STARTUP50", "STARTUP50"];
    }, "case-insensitively unique");
  });

  it("rejects repeating discounts without duration_in_months", () => {
    expectRejected((doc) => {
      delete doc.billing.discount_programs[0].discount.duration_in_months;
    }, "duration_in_months");
  });

  it("rejects duplicated plan lookup keys", () => {
    expectRejected((doc) => {
      doc.billing.plans[2].lookup_key = doc.billing.plans[1].lookup_key;
    }, "lookup_key values must be unique");
  });

  it("rejects non-ascending usage alert thresholds", () => {
    expectRejected((doc) => {
      doc.billing.usage_alert_thresholds = [90, 70];
    }, "strictly ascending");
  });

  it("rejects duplicated plan ids", () => {
    expectRejected((doc) => {
      doc.billing.plans[2].id = "pro";
      doc.billing.plans[2].lookup_key = "turboplan_pro2_monthly";
    }, "plan ids must be unique");
  });

  it("rejects a free plan with a monthly period", () => {
    expectRejected((doc) => {
      doc.billing.plans[0].period = "month";
    }, "period: forever");
  });

  it("rejects a free plan with a lookup_key", () => {
    expectRejected((doc) => {
      doc.billing.plans[0].lookup_key = "turboplan_starter_monthly";
    }, "must not declare a lookup_key");
  });

  it("rejects a free plan with overage pricing", () => {
    expectRejected((doc) => {
      doc.billing.plans[0].overage_usd_per_credit = 0.01;
    }, "overage_usd_per_credit: null");
  });

  it("rejects a paid plan with a forever period", () => {
    expectRejected((doc) => {
      doc.billing.plans[1].period = "forever";
    }, "period: month");
  });

  it("rejects duration_in_months on a non-repeating discount", () => {
    expectRejected((doc) => {
      doc.billing.discount_programs[0].discount.duration = "once";
    }, "duration_in_months");
  });

  it("rejects a malformed redeem_by date", () => {
    expectRejected((doc) => {
      doc.billing.discount_programs[0].eligibility.redeem_by = "31-12-2026";
    }, "YYYY-MM-DD");
  });

  it("rejects a catalog with no paid plan", () => {
    expectRejected((doc) => {
      doc.billing.plans = [doc.billing.plans[0]];
      doc.billing.discount_programs = [];
    }, "at least one paid plan");
  });
});
