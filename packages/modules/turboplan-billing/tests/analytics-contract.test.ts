import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  type BillingAnalyticsEvent,
  buildCheckoutStartedEvent,
  configureBillingAnalytics,
} from "../src/server/analytics";
import { createSubscriptionAnalyticsEmitter } from "../src/server/webhook";

/**
 * Billing funnel identity contract: checkout_started (router side) is keyed by
 * the USER, so it joins the person funnel that precedes it; the subscription
 * events (webhook side) are keyed by the ORGANIZATION, because Stripe gives the
 * webhook no user context. Both sides carry `organization_id` in properties —
 * that is the join key — and subscription events must also carry a joinable
 * subscription_id. These tests pin the two-sided contract, not either side's
 * internals.
 */
describe("billing funnel identity contract", () => {
  const ORG_ID = "org_123";
  const USER_ID = "user_1";
  const SUBSCRIPTION_ID = "sub_456";

  let captured: BillingAnalyticsEvent[] = [];

  beforeEach(() => {
    captured = [];
    configureBillingAnalytics((event) => {
      captured.push(event);
    });
  });

  afterEach(() => {
    // Reset to a no-op so other test files never see this capture handler.
    configureBillingAnalytics(() => {});
    mock.restoreAll();
  });

  it("checkout_started is keyed by the user, not the organization", async () => {
    const checkout = buildCheckoutStartedEvent(ORG_ID, USER_ID, "pro");

    // A real PostHog person, so this event joins signup/onboarding.
    assert.equal(checkout.distinctId, USER_ID);
    assert.notEqual(checkout.distinctId, ORG_ID);
    // The org attribution stays available as a property.
    assert.equal(checkout.properties?.organization_id, ORG_ID);
    assert.equal(checkout.properties?.user_id, USER_ID);
  });

  it("checkout_started and subscription events share the organization_id join key", async () => {
    const emit = createSubscriptionAnalyticsEmitter(async () => ({
      organizationId: ORG_ID,
    }));

    const checkout = buildCheckoutStartedEvent(ORG_ID, USER_ID, "pro");
    await emit("subscription_activated", SUBSCRIPTION_ID);
    await emit("subscription_canceled", SUBSCRIPTION_ID);
    // Dunning event — fired from invoice.payment_failed on the first attempt.
    await emit("payment_failed", SUBSCRIPTION_ID);

    assert.equal(captured.length, 3);
    assert.deepEqual(
      captured.map((event) => event.event),
      ["subscription_activated", "subscription_canceled", "payment_failed"],
    );
    for (const event of captured) {
      // Webhook side has no user context — org-keyed by design.
      assert.equal(event.distinctId, ORG_ID);
      // Property-level join key shared with checkout_started.
      assert.equal(
        event.properties?.organization_id,
        checkout.properties?.organization_id,
      );
      // Joinable subscription identity on the webhook side.
      assert.equal(event.properties?.subscription_id, SUBSCRIPTION_ID);
    }
  });

  it("successful lookup emits no unattributed marker", async () => {
    const emit = createSubscriptionAnalyticsEmitter(async () => ({
      organizationId: ORG_ID,
    }));

    await emit("subscription_activated", SUBSCRIPTION_ID);

    assert.equal(captured.length, 1);
    assert.equal(captured[0].distinctId, ORG_ID);
    assert.equal("unattributed" in (captured[0].properties ?? {}), false);
  });

  it("null lookup emits system distinct id with unattributed: true", async () => {
    const emit = createSubscriptionAnalyticsEmitter(async () => null);

    await emit("subscription_canceled", SUBSCRIPTION_ID);

    assert.equal(captured.length, 1);
    assert.equal(captured[0].distinctId, "system");
    assert.equal(captured[0].properties?.unattributed, true);
    assert.equal(captured[0].properties?.subscription_id, SUBSCRIPTION_ID);
    assert.equal(captured[0].properties?.organization_id, undefined);
  });

  it("failed lookup logs the Stripe id and emits unattributed system event", async () => {
    const consoleError = mock.method(console, "error", () => {});
    const emit = createSubscriptionAnalyticsEmitter(async () => {
      throw new Error("db unavailable");
    });

    await emit("payment_failed", SUBSCRIPTION_ID);

    assert.equal(captured.length, 1);
    assert.equal(captured[0].distinctId, "system");
    assert.equal(captured[0].properties?.unattributed, true);
    assert.equal(consoleError.mock.callCount(), 1);
    const [message] = consoleError.mock.calls[0].arguments;
    assert.match(String(message), new RegExp(SUBSCRIPTION_ID));
  });
});
