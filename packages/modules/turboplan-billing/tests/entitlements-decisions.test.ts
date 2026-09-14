import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideSeatAvailability,
  isActiveBillingRow,
  planFromSubscriptionRow,
} from "../src/server/entitlements";

describe("planFromSubscriptionRow", () => {
  it("resolves live paid rows to their plan", () => {
    assert.equal(
      planFromSubscriptionRow({ status: "active", plan: "pro" }),
      "pro",
    );
    assert.equal(
      planFromSubscriptionRow({ status: "trialing", plan: "max" }),
      "max",
    );
  });

  it("keeps paid allowances during dunning — limits must not snap to starter", () => {
    assert.equal(
      planFromSubscriptionRow({ status: "past_due", plan: "pro" }),
      "pro",
    );
    assert.equal(
      planFromSubscriptionRow({ status: "unpaid", plan: "max" }),
      "max",
    );
  });

  it("treats grandfather comps as max", () => {
    assert.equal(
      planFromSubscriptionRow({ status: "active", plan: "grandfather" }),
      "max",
    );
  });

  it("resolves everything else to starter", () => {
    assert.equal(planFromSubscriptionRow(undefined), "starter");
    assert.equal(planFromSubscriptionRow(null), "starter");
    assert.equal(
      planFromSubscriptionRow({ status: "active", plan: "starter" }),
      "starter",
    );
    assert.equal(
      planFromSubscriptionRow({ status: "canceled", plan: "pro" }),
      "starter",
    );
    assert.equal(
      planFromSubscriptionRow({ status: "incomplete", plan: "pro" }),
      "starter",
    );
    assert.equal(
      planFromSubscriptionRow({ status: "incomplete_expired", plan: "max" }),
      "starter",
    );
    assert.equal(
      planFromSubscriptionRow({ status: "active", plan: null }),
      "starter",
    );
  });
});

describe("isActiveBillingRow", () => {
  it("is true only for active/trialing PAID rows", () => {
    assert.equal(isActiveBillingRow({ status: "active", plan: "pro" }), true);
    assert.equal(isActiveBillingRow({ status: "trialing", plan: "max" }), true);
    assert.equal(
      isActiveBillingRow({ status: "active", plan: "grandfather" }),
      true,
    );
  });

  it("is false for starter rows, dunning, terminal states and no row", () => {
    assert.equal(
      isActiveBillingRow({ status: "active", plan: "starter" }),
      false,
    );
    assert.equal(
      isActiveBillingRow({ status: "past_due", plan: "pro" }),
      false,
    );
    assert.equal(
      isActiveBillingRow({ status: "canceled", plan: "pro" }),
      false,
    );
    assert.equal(isActiveBillingRow(undefined), false);
    assert.equal(isActiveBillingRow(null), false);
  });
});

describe("decideSeatAvailability", () => {
  it("allows filling starter up to the included count", () => {
    assert.equal(
      decideSeatAvailability({
        plan: "starter",
        billableSeats: 2,
        addedBillableSeats: 1,
      }).allowed,
      true,
    );
  });

  it("blocks the seat beyond the included count", () => {
    const decision = decideSeatAvailability({
      plan: "starter",
      billableSeats: 3,
      addedBillableSeats: 1,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "SEAT_LIMIT_REACHED");
    assert.equal(decision.includedSeats, 3);
  });

  it("blocks batch adds that would cross the cap", () => {
    assert.equal(
      decideSeatAvailability({
        plan: "starter",
        billableSeats: 2,
        addedBillableSeats: 2,
      }).allowed,
      false,
    );
  });
});
