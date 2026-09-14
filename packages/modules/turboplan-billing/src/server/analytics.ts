/**
 * Injection point for product analytics — mirrors the timeline-records
 * recorder pattern so this package stays free of PostHog dependencies.
 * The host app wires a handler at bootstrap; unset handler → no-op.
 */

export type BillingAnalyticsEvent = {
  distinctId: string;
  event:
    | "checkout_started"
    | "subscription_activated"
    | "subscription_canceled"
    | "payment_failed";
  properties?: Record<string, unknown>;
};

let handler: ((event: BillingAnalyticsEvent) => void) | undefined;

export const configureBillingAnalytics = (
  onEvent: (event: BillingAnalyticsEvent) => void,
) => {
  handler = onEvent;
};

/** Fire-and-forget — analytics can never break a billing operation. */
export const emitBillingAnalytics = (event: BillingAnalyticsEvent) => {
  try {
    handler?.(event);
  } catch (error) {
    console.error("[billing-analytics] handler failed:", error);
  }
};

/**
 * Billing funnel identity contract.
 *
 * checkout_started is keyed by the USER who started it — that is a real
 * PostHog person, so it joins the signup/onboarding funnel that precedes it.
 * The webhook-side subscription events have no user context (Stripe only tells
 * us the subscription), so they stay keyed by the organization. `organization_id`
 * is carried in the PROPERTIES of both sides, which is what the billing funnel
 * joins on. Build checkout events through this helper (and subscription events
 * through createSubscriptionAnalyticsEmitter in webhook.ts) — the contract test
 * in tests/analytics-contract.test.ts pins the shared join key.
 */
export const buildCheckoutStartedEvent = (
  organizationId: string,
  userId: string,
  plan: string,
): BillingAnalyticsEvent => {
  return {
    distinctId: userId,
    event: "checkout_started",
    properties: {
      organization_id: organizationId,
      user_id: userId,
      plan,
    },
  };
};
