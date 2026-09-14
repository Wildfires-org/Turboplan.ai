import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  holdsLiveSubscription,
  LIVE_SUBSCRIPTION_STATUS_VALUES,
} from "../src/types";

/**
 * Regression cover for the onboarding deadlock.
 *
 * The plan step is shown when `hasChosenPlan` is false, and "Skip"/Starter is
 * refused when `activateStarterPlan`'s guard says the org already subscribes.
 * When those two disagree, onboarding demands a choice it then refuses — the
 * user is stuck with no way out of the UI.
 *
 * Both now derive from `holdsLiveSubscription`, so these tests pin the shape of
 * that single definition.
 */
describe("holdsLiveSubscription", () => {
  it("is true for every status that blocks the free plan", () => {
    for (const status of LIVE_SUBSCRIPTION_STATUS_VALUES) {
      assert.equal(
        holdsLiveSubscription({ stripeSubscriptionId: "sub_1", status }),
        true,
        `expected status "${status}" to count as a live subscription`,
      );
    }
  });

  it("ignores `plan`: a starter row with a live subscription still counts", () => {
    // An interrupted checkout leaves exactly this row — plan never advanced
    // past starter, but Stripe is already trialing. The old gate keyed off
    // `plan === starter` and returned false here, which opened the deadlock.
    assert.equal(
      holdsLiveSubscription({
        stripeSubscriptionId: "sub_1TlSuE",
        status: "trialing",
      }),
      true,
    );
  });

  it("is true while dunning, which the old gate treated as not-subscribed", () => {
    assert.equal(
      holdsLiveSubscription({
        stripeSubscriptionId: "sub_1",
        status: "past_due",
      }),
      true,
    );
    assert.equal(
      holdsLiveSubscription({
        stripeSubscriptionId: "sub_1",
        status: "unpaid",
      }),
      true,
    );
  });

  it("is false without a Stripe subscription id", () => {
    // The free Starter plan is stored as an ACTIVE row with no Stripe link.
    assert.equal(
      holdsLiveSubscription({ stripeSubscriptionId: null, status: "active" }),
      false,
    );
    assert.equal(holdsLiveSubscription({ status: "active" }), false);
  });

  it("is false for ended subscriptions, so a later upgrade can start fresh", () => {
    for (const status of ["canceled", "incomplete", "incomplete_expired"]) {
      assert.equal(
        holdsLiveSubscription({ stripeSubscriptionId: "sub_1", status }),
        false,
        `expected status "${status}" not to count as live`,
      );
    }
  });

  it("is false for an absent row", () => {
    assert.equal(holdsLiveSubscription(null), false);
    assert.equal(holdsLiveSubscription(undefined), false);
  });
});
