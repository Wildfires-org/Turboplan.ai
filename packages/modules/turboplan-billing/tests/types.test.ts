import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowancePlanKey,
  CATALOG,
  classifyLookupKey,
  creditAllowance,
  creditsFromCostUsd,
  creditsFromUsage,
  extractOpenRouterCost,
  extraSeats,
  monthlyBase,
  overageLookupKey,
  PLAN_ORDER,
  PLANS,
  planFromLookupKey,
  planHasHardStop,
  planHasOverage,
  seatLookupKey,
} from "../src/types";

describe("catalog-derived plan model", () => {
  it("derives PLAN_ORDER and PLANS from the catalog", () => {
    assert.deepEqual(PLAN_ORDER, ["starter", "pro", "max"]);
    assert.equal(PLANS.pro.price_usd, 99);
    assert.equal(PLANS.max.included_seats, 10);
    assert.equal(PLANS.starter.additional_seat_price_usd, null);
  });
});

describe("extraSeats", () => {
  it("bills nothing at or below the included count", () => {
    assert.equal(extraSeats(1, "pro"), 0);
    assert.equal(extraSeats(5, "pro"), 0);
    assert.equal(extraSeats(10, "max"), 0);
    assert.equal(extraSeats(3, "starter"), 0);
    assert.equal(extraSeats(0, "pro"), 0);
  });

  it("bills only seats beyond the included count", () => {
    assert.equal(extraSeats(6, "pro"), 1);
    assert.equal(extraSeats(7, "pro"), 2);
    assert.equal(extraSeats(11, "max"), 1);
    assert.equal(extraSeats(4, "starter"), 1);
  });
});

describe("creditAllowance", () => {
  it("returns the base pool with no extra seats", () => {
    assert.equal(creditAllowance("starter", 0), 5000);
    assert.equal(creditAllowance("pro", 0), 30000);
    assert.equal(creditAllowance("max", 0), 75000);
  });

  it("adds the per-seat grant for each extra seat", () => {
    assert.equal(creditAllowance("pro", 2), 40000);
    assert.equal(creditAllowance("max", 1), 82500);
  });

  it("adds nothing for starter, whose per-seat grant is zero", () => {
    assert.equal(creditAllowance("starter", 5), 5000);
  });
});

describe("plan attribute helpers", () => {
  it("exposes workspace base prices", () => {
    assert.deepEqual(
      PLAN_ORDER.map((plan) => monthlyBase(plan)),
      [0, 99, 199],
    );
  });

  it("flags overage availability per plan", () => {
    assert.equal(planHasOverage("starter"), false);
    assert.equal(planHasOverage("pro"), true);
    assert.equal(planHasOverage("max"), true);
  });
});

// catalog/brand.yaml is fork-owned (`merge=ours`) and names live Stripe
// objects, so the brand prefix of every lookup key differs per deployment.
// Take the base keys from the catalog and assert the STRUCTURE the runtime
// must build on top of them: the literal suffixes, plan and kind.
const PRO_BASE_KEY = PLANS.pro.lookup_key;
const MAX_BASE_KEY = PLANS.max.lookup_key;

describe("lookup keys", () => {
  it("derives deterministic seat and overage keys", () => {
    assert.equal(seatLookupKey("pro"), `${PRO_BASE_KEY}_additional_seat`);
    assert.equal(overageLookupKey("max"), `${MAX_BASE_KEY}_credit_overage`);
  });

  it("classifies every key kind and rejects foreign keys", () => {
    assert.deepEqual(classifyLookupKey(PRO_BASE_KEY), {
      plan: "pro",
      kind: "base",
    });
    assert.deepEqual(classifyLookupKey(`${MAX_BASE_KEY}_additional_seat`), {
      plan: "max",
      kind: "seat",
    });
    assert.deepEqual(classifyLookupKey(`${PRO_BASE_KEY}_credit_overage`), {
      plan: "pro",
      kind: "overage",
    });
    assert.equal(classifyLookupKey("someone_elses_price"), null);
  });

  it("resolves plans from base keys only", () => {
    assert.equal(planFromLookupKey(MAX_BASE_KEY), "max");
    assert.equal(planFromLookupKey(`${PRO_BASE_KEY}_additional_seat`), null);
    assert.equal(planFromLookupKey("unknown"), null);
  });
});

describe("allowancePlanKey", () => {
  it("passes catalog plans through", () => {
    assert.equal(allowancePlanKey("pro"), "pro");
    assert.equal(allowancePlanKey("max"), "max");
    assert.equal(allowancePlanKey("starter"), "starter");
  });

  it("treats grandfather comps as max", () => {
    assert.equal(allowancePlanKey("grandfather"), "max");
  });

  it("falls back to starter for null or unknown values", () => {
    assert.equal(allowancePlanKey(null), "starter");
    assert.equal(allowancePlanKey("legacy_business"), "starter");
  });
});

describe("planHasHardStop", () => {
  it("hard-stops only the free plan", () => {
    assert.equal(planHasHardStop("starter"), true);
    assert.equal(planHasHardStop("pro"), false);
    assert.equal(planHasHardStop("max"), false);
  });
});

describe("creditsFromCostUsd", () => {
  it("converts cost at credits_per_usd and rounds up", () => {
    assert.equal(CATALOG.billing.credits_per_usd, 1000);
    assert.equal(creditsFromCostUsd(0.03), 30);
    assert.equal(creditsFromCostUsd(0.0301), 31);
    assert.equal(creditsFromCostUsd(1), 1000);
  });

  it("floors every metered call at 1 credit", () => {
    assert.equal(creditsFromCostUsd(0.0000001), 1);
  });

  it("charges the minimum when cost is missing or invalid", () => {
    assert.equal(creditsFromCostUsd(0), 1);
    assert.equal(creditsFromCostUsd(-5), 1);
    assert.equal(creditsFromCostUsd(Number.NaN), 1);
    assert.equal(creditsFromCostUsd(Number.POSITIVE_INFINITY), 1);
  });
});

describe("extractOpenRouterCost", () => {
  it("reads the usage-accounting cost", () => {
    assert.equal(
      extractOpenRouterCost({ openrouter: { usage: { cost: 0.0123 } } }),
      0.0123,
    );
  });

  it("returns undefined for missing, zero or malformed metadata", () => {
    assert.equal(extractOpenRouterCost(undefined), undefined);
    assert.equal(extractOpenRouterCost({}), undefined);
    assert.equal(
      extractOpenRouterCost({ openrouter: { usage: { cost: 0 } } }),
      undefined,
    );
    assert.equal(
      extractOpenRouterCost({ openrouter: { usage: {} } }),
      undefined,
    );
  });
});

describe("creditsFromUsage", () => {
  it("prefers the exact provider cost", () => {
    assert.equal(creditsFromUsage({ costUsd: 0.05, totalTokens: 999999 }), 50);
  });

  it("falls back to the token estimate when cost is missing", () => {
    // 100k tokens × $20/M = $2 → 2000 credits.
    assert.equal(creditsFromUsage({ totalTokens: 100_000 }), 2000);
  });

  it("floors at 1 credit when both signals are missing or zero", () => {
    assert.equal(creditsFromUsage({}), 1);
    assert.equal(creditsFromUsage({ costUsd: 0, totalTokens: 0 }), 1);
  });
});
