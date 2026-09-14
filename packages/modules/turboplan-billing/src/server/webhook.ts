import { Hono } from "hono";
import type Stripe from "stripe";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import { emitBillingAnalytics } from "./analytics";
import { sendPaymentFailedEmail } from "./dunning";
import {
  claimWebhookEvent,
  getSubscriptionByStripeSubscriptionId,
  releaseWebhookEvent,
  upsertSubscriptionFromStripe,
} from "./queries";
import { reconcileSeatsForStripeSubscription } from "./reconciliation";
import { getStripe } from "./stripe-service";
import { mapSubscription, subscriptionIdFromInvoice } from "./webhook-helpers";

const syncSubscriptionById = async (subscriptionId: string): Promise<void> => {
  // Stripe does not guarantee webhook delivery order — an older subscription
  // event can arrive after a newer one. Always re-fetch so we persist the
  // subscription's CURRENT state rather than a possibly-stale event payload.
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["discounts.source.coupon"],
  });
  const input = mapSubscription(sub);
  if (!input) {
    return;
  }
  await upsertSubscriptionFromStripe(input);
};

export type SubscriptionAnalyticsEventName =
  | "subscription_activated"
  | "subscription_canceled"
  | "payment_failed";

/**
 * Builds the webhook-side half of the billing funnel: subscription events
 * keyed by the owning organization (same key as checkout_started — see
 * buildCheckoutStartedEvent) and joinable via subscription_id. The
 * subscription lookup is injected so the identity contract is testable
 * without Stripe or a database (tests/analytics-contract.test.ts).
 */
export const createSubscriptionAnalyticsEmitter = (
  lookupSubscription: (
    stripeSubscriptionId: string,
  ) => Promise<{ organizationId: string } | null | undefined>,
) => {
  return async (
    eventName: SubscriptionAnalyticsEventName,
    stripeSubscriptionId: string,
  ): Promise<void> => {
    const row = await lookupSubscription(stripeSubscriptionId).catch(
      (error) => {
        console.error(
          `[stripe-webhook] subscription lookup failed for ${stripeSubscriptionId}:`,
          error,
        );
        return null;
      },
    );
    emitBillingAnalytics({
      distinctId: row?.organizationId ?? "system",
      event: eventName,
      properties: {
        subscription_id: stripeSubscriptionId,
        organization_id: row?.organizationId,
        // Explicit marker: "system" rows are lookup failures, not a real
        // billing entity — keeps them filterable instead of silently
        // blending into org-keyed funnel data.
        ...(row ? {} : { unattributed: true }),
      },
    });
  };
};

export const stripeWebhookRouter = new Hono();

stripeWebhookRouter.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  // Read the raw body — Stripe signature verification needs the unparsed
  // payload. Never call c.req.json() on this route.
  const body = await c.req.text();
  const env = getApiEnv();

  let event: Stripe.Event;
  try {
    // Async verifier: this server deploys to Cloudflare, where Node's sync
    // crypto is unavailable.
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("[stripe-webhook] signature verification failed:", error);
    return c.json({ error: "Invalid signature" }, 400);
  }

  // Idempotency: Stripe may redeliver the same event — including CONCURRENT
  // duplicate deliveries. Claim the event id atomically BEFORE processing so
  // exactly one delivery runs the handler; the claim is released below if the
  // handler fails, so Stripe's retry reprocesses it.
  if (!(await claimWebhookEvent(event.id, event.type))) {
    return c.json({ received: true, deduplicated: true });
  }

  // Resolve the owning organization from the already-synced subscription row
  // so activation/churn events join with checkout_started per organization.
  const emitSubscriptionAnalytics = createSubscriptionAnalyticsEmitter(
    getSubscriptionByStripeSubscriptionId,
  );

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionById(event.data.object.id);
        if (event.type === "customer.subscription.created") {
          await emitSubscriptionAnalytics(
            "subscription_activated",
            event.data.object.id,
          );
        }
        if (event.type === "customer.subscription.deleted") {
          await emitSubscriptionAnalytics(
            "subscription_canceled",
            event.data.object.id,
          );
        }
        break;
      }

      case "checkout.session.completed": {
        // Belt-and-suspenders: sync the row immediately on redirect rather than
        // waiting for the subscription.* event.
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId);
          // The cart's extra-seat quantity was computed when the session was
          // CREATED; Checkout sessions live up to 24h, so members added or
          // removed in between would otherwise stay mis-billed until the next
          // membership mutation or invoice.upcoming (~a month).
          await reconcileSeatsForStripeSubscription(subscriptionId);
        }
        break;
      }

      case "invoice.paid": {
        // Belt-and-suspenders against a missed customer.subscription.updated:
        // a paid invoice flips the subscription's status (e.g. out of PAST_DUE),
        // so re-sync from the referenced subscription.
        //
        // On API version 2026-05-27.dahlia (basil lineage) the invoice's
        // subscription ref is NOT `invoice.subscription`; it lives under
        // `invoice.parent.subscription_details.subscription` (string or object).
        const invoice = event.data.object;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        // One-off invoice with no subscription ref → nothing to reconcile.
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId);
        }
        break;
      }

      case "invoice.upcoming": {
        // Stripe fires invoice.upcoming a few days before each subscription
        // renewal (lead time configured in Dashboard → Billing → Automatic; it
        // is NOT sent for collection_method=send_invoice, which we do not use).
        // We reconcile THIS subscription's Stripe seat quantity against the true
        // billable-seat count right before money moves — a per-org drift safety
        // net that replaces a full-scan cron and keeps the platform
        // scheduler-agnostic.
        //
        // The upcoming invoice is a PREVIEW object and may lack an `id`, but the
        // EVENT carries an id, so the webhook-event ledger dedup above still
        // works. If the subscription ref is missing (e.g. a preview with no
        // subscription), there is nothing to reconcile → no-op.
        const invoice = event.data.object;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          await reconcileSeatsForStripeSubscription(subscriptionId);
        }
        break;
      }

      case "invoice.payment_failed": {
        // Belt-and-suspenders against a missed customer.subscription.updated:
        // a failed invoice flips the subscription's status (e.g. into PAST_DUE),
        // so re-sync from the referenced subscription first (see invoice.paid for
        // where the subscription ref lives on this API version).
        const invoice = event.data.object;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        // One-off invoice with no subscription ref → nothing to reconcile.
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId);

          // Dunning: notify org owners, but only ONCE per invoice. Stripe fires
          // invoice.payment_failed on every automatic retry, so we gate on
          // `attempt_count === 1` (the initial failure) — later retries carry a
          // higher count and are silently skipped. Fire-and-forget: a mail
          // failure must never fail the webhook (which would make Stripe retry
          // the whole event), so we swallow and log any error here.
          if (invoice.attempt_count === 1) {
            await emitSubscriptionAnalytics("payment_failed", subscriptionId);
            try {
              await sendPaymentFailedEmail(subscriptionId);
            } catch (error) {
              console.error(
                "[stripe-webhook] payment-failed dunning email failed:",
                error,
              );
            }
          }
        }
        break;
      }

      default: {
        // Acknowledge unhandled events so Stripe stops retrying.
        break;
      }
    }
  } catch (error) {
    console.error(`[stripe-webhook] handler failed for ${event.type}:`, error);
    // Release the claim so Stripe's retry reprocesses instead of being
    // deduplicated. If the release itself fails (e.g. the DB is down — likely
    // the same reason the handler failed), the event would be deduplicated on
    // retry and effectively lost: log it loudly for a manual replay via
    // `stripe events resend <id>`.
    try {
      await releaseWebhookEvent(event.id);
    } catch (releaseError) {
      console.error(
        `[stripe-webhook] FAILED TO RELEASE claim for ${event.id} (${event.type}) — event will be deduplicated on retry; replay manually with: stripe events resend ${event.id}`,
        releaseError,
      );
    }
    // Return 500 so Stripe retries the delivery.
    return c.json({ error: "Handler failed" }, 500);
  }

  return c.json({ received: true });
});
