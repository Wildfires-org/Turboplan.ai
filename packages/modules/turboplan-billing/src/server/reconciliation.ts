import { and, eq, gt, inArray, isNotNull, isNull, lte } from "drizzle-orm";

import {
  billingCreditEvent,
  organization,
  type SubscriptionStatus,
  subscription,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { getMailService } from "@wildfires-org/turboplan-mail/server";

import { CATALOG, LIVE_SUBSCRIPTION_STATUS_VALUES } from "../types";
import { isDuplicateMeterEventError } from "./credits";
import {
  countBillableSeats,
  getOrganizationOwnerEmails,
  getSubscriptionByStripeSubscriptionId,
} from "./queries";
import {
  getStripe,
  reconcileSeatQuantityForSubscription,
  SEAT_SYNC_STATUSES,
} from "./stripe-service";

/**
 * Summary of a reconciliation run.
 * - `checked`: subscriptions examined (every live, seat-syncable row scanned).
 * - `corrected`: subscriptions where Stripe's live quantity actually differed
 *   from the recounted billable seats, so we pushed a quantity change.
 * - `failed`: subscriptions that threw during processing (Stripe/DB error) and
 *   were skipped so the run could continue.
 *
 * `checked` counts every row we attempted (so `failed` is a subset of it), while
 * `corrected` counts only the rows that needed a Stripe update.
 */
export type SeatReconciliationSummary = {
  checked: number;
  corrected: number;
  failed: number;
};

/**
 * Full-scan safety net for per-seat billing: recomputes EVERY organization's
 * billable-seat count and forces Stripe's subscription quantity (and the DB
 * `seats` mirror) back into agreement. This is the backstop for the optimistic
 * mirror written by {@link syncSubscriptionSeats}: if a
 * `customer.subscription.updated` webhook is lost, or a live seat-sync failed
 * silently, Stripe can drift from the true billable count in either direction
 * (permanent under- or over-billing). The live path short-circuits on
 * `seats === mirror` and so can never notice such drift; reconciliation ALWAYS
 * retrieves the live subscription from Stripe and compares against Stripe's
 * actual quantity, never the mirror.
 *
 * Invocation model: the PRIMARY per-org drift guard is
 * {@link reconcileSeatsForStripeSubscription}, driven by Stripe's
 * `invoice.upcoming` event so each org is verified right before it renews. This
 * full-scan is the ops escape hatch — invoked on demand via the secret-protected
 * `POST /api/billing/reconcile` endpoint (reconcile-router.ts), which an external
 * scheduler can also poll to keep the platform scheduler-agnostic. No
 * platform-specific cron drives it.
 *
 * Scope: every subscription row with a `stripeSubscriptionId` in a
 * {@link SEAT_SYNC_STATUSES} status — the exact set the live path repices.
 *
 * Isolation: each org is processed in its own try/catch, so a single Stripe or
 * DB failure increments `failed` and is logged but never aborts the run.
 *
 * No-op (returns a zeroed summary) when the billing package is disabled.
 */
export const reconcileSubscriptionSeats =
  async (): Promise<SeatReconciliationSummary> => {
    if (!isBillingPackageEnabled()) {
      console.log(
        "[billing] reconcileSubscriptionSeats: billing package disabled, skipping",
      );
      return { checked: 0, corrected: 0, failed: 0 };
    }

    // Load every live, seat-syncable subscription. We deliberately fetch ALL of
    // them (not just those whose mirror looks stale) because the mirror itself
    // is what we cannot trust — the whole point is to detect Stripe/mirror drift.
    const rows = await db
      .select({
        organizationId: subscription.organizationId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        seats: subscription.seats,
      })
      .from(subscription)
      .where(
        and(
          isNotNull(subscription.stripeSubscriptionId),
          inArray(subscription.status, SEAT_SYNC_STATUSES),
        ),
      );

    let checked = 0;
    let corrected = 0;
    let failed = 0;

    for (const row of rows) {
      // `stripeSubscriptionId` is guaranteed non-null by the query filter, but
      // the column type is nullable — narrow it for the typed Stripe call.
      const stripeSubscriptionId = row.stripeSubscriptionId;
      if (!stripeSubscriptionId) {
        continue;
      }

      checked += 1;

      try {
        const seats = await countBillableSeats(row.organizationId);
        const result = await reconcileSeatQuantityForSubscription({
          organizationId: row.organizationId,
          stripeSubscriptionId,
          seats,
          mirroredSeats: row.seats,
        });

        if (result.quantityChanged) {
          corrected += 1;
          console.log(
            `[billing] reconciled seats for organization ${row.organizationId}: ` +
              `extra-seat item ${result.previousExtraQuantity} -> ` +
              `${result.extraSeatQuantity} (billable ${seats}, mirror was ${row.seats})`,
          );
        }
      } catch (error) {
        failed += 1;
        console.error(
          `[billing] seat reconciliation failed for organization ${row.organizationId}:`,
          error,
        );
      }
    }

    console.log(
      `[billing] reconcileSubscriptionSeats complete: checked=${checked}, ` +
        `corrected=${corrected}, failed=${failed}`,
    );

    return { checked, corrected, failed };
  };

export type OverageSweepSummary = {
  checked: number;
  reported: number;
  failed: number;
};

/**
 * Safety net for metered overage: re-reports every ledger row whose overage
 * portion never reached the Stripe meter (`overage_credits > 0` with no
 * reported stamp — e.g. a meter-event POST failed inside consumeCredits).
 * The ledger id doubles as the meter event `identifier`; Stripe dedupes
 * identifiers only within a rolling ~24h window, so a duplicate rejection is
 * treated as delivered-and-stamped rather than retried past the window
 * (which would double-bill). Run the sweep at least daily.
 *
 * Runs from the same secret-protected reconcile endpoint as the seat scan.
 */
export const sweepUnreportedOverageEvents =
  async (): Promise<OverageSweepSummary> => {
    if (!isBillingPackageEnabled()) {
      return { checked: 0, reported: 0, failed: 0 };
    }

    // Rows whose org no longer has a live overage item/customer are filtered
    // in SQL — they are permanent audit traces and must not crowd real work
    // out of the batch window. Oldest first so backlog drains in order.
    const rows = await db
      .select({
        id: billingCreditEvent.id,
        overageCredits: billingCreditEvent.overageCredits,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeOverageItemId: subscription.stripeOverageItemId,
      })
      .from(billingCreditEvent)
      .innerJoin(
        subscription,
        eq(subscription.organizationId, billingCreditEvent.organizationId),
      )
      .where(
        and(
          gt(billingCreditEvent.overageCredits, 0),
          isNull(billingCreditEvent.stripeMeterReportedAt),
          isNotNull(subscription.stripeCustomerId),
          isNotNull(subscription.stripeOverageItemId),
        ),
      )
      .orderBy(billingCreditEvent.createdAt)
      .limit(500);

    let checked = 0;
    let reported = 0;
    let failed = 0;

    for (const row of rows) {
      checked += 1;
      if (!row.stripeCustomerId) {
        continue;
      }

      try {
        await getStripe().billing.meterEvents.create({
          event_name: CATALOG.billing.meter_event_name,
          identifier: row.id,
          payload: {
            stripe_customer_id: row.stripeCustomerId,
            value: String(row.overageCredits),
          },
        });
      } catch (error) {
        // Duplicate identifier = the original POST landed but its stamp write
        // failed. Retrying past Stripe's ~24h dedupe window would create a
        // SECOND event and double-bill — stamp instead.
        if (!isDuplicateMeterEventError(error)) {
          failed += 1;
          console.error(
            `[billing] overage sweep failed for ledger ${row.id}:`,
            error,
          );
          continue;
        }
      }
      await db
        .update(billingCreditEvent)
        .set({ stripeMeterReportedAt: new Date() })
        .where(eq(billingCreditEvent.id, row.id));
      reported += 1;
    }

    if (checked > 0) {
      console.log(
        `[billing] overage sweep: checked=${checked}, reported=${reported}, failed=${failed}`,
      );
    }

    return { checked, reported, failed };
  };

export type DiscountNoticeSummary = {
  checked: number;
  sent: number;
  failed: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure: which notice (30- or 7-day) is due for a discount ending at `endsAt`.
 * Returns the TIGHTER due notice plus every stamp that should be set — a
 * discount first observed 5 days before its end sends only the 7-day email
 * but stamps both, so the 30-day one can never fire late.
 */
export const dueDiscountNotice = ({
  endsAt,
  now,
  notice30SentAt,
  notice7SentAt,
}: {
  endsAt: Date;
  now: Date;
  notice30SentAt: Date | null;
  notice7SentAt: Date | null;
}): { send: 30 | 7; stamp: Array<30 | 7> } | null => {
  const msLeft = endsAt.getTime() - now.getTime();
  if (msLeft <= 0) {
    return null;
  }

  const within7 = msLeft <= 7 * DAY_MS;
  const within30 = msLeft <= 30 * DAY_MS;

  if (within7 && !notice7SentAt) {
    return { send: 7, stamp: notice30SentAt ? [7] : [30, 7] };
  }
  if (within30 && !within7 && !notice30SentAt) {
    return { send: 30, stamp: [30] };
  }
  return null;
};

/**
 * Doc §8: notify owners 30 and 7 days before the first full-price renewal.
 * Scans live subscriptions with a projected discount end, stamps the due
 * notice (conditional update = one winner across concurrent runs) and emails
 * org owners. Rides the same reconcile endpoint as the other sweeps.
 */
export const sweepDiscountEndingNotices =
  async (): Promise<DiscountNoticeSummary> => {
    if (!isBillingPackageEnabled()) {
      return { checked: 0, sent: 0, failed: 0 };
    }

    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * DAY_MS);

    const rows = await db
      .select({
        organizationId: subscription.organizationId,
        discountPercentOff: subscription.discountPercentOff,
        discountEndsAt: subscription.discountEndsAt,
        notice30SentAt: subscription.discountNotice30SentAt,
        notice7SentAt: subscription.discountNotice7SentAt,
        orgSlug: organization.slug,
        orgName: organization.name,
      })
      .from(subscription)
      .innerJoin(organization, eq(organization.id, subscription.organizationId))
      .where(
        and(
          isNotNull(subscription.discountEndsAt),
          lte(subscription.discountEndsAt, horizon),
          inArray(
            subscription.status,
            LIVE_SUBSCRIPTION_STATUS_VALUES as string[],
          ),
        ),
      );

    let checked = 0;
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      checked += 1;
      if (!row.discountEndsAt || !row.discountPercentOff) {
        continue;
      }

      const due = dueDiscountNotice({
        endsAt: row.discountEndsAt,
        now,
        notice30SentAt: row.notice30SentAt,
        notice7SentAt: row.notice7SentAt,
      });
      if (!due) {
        continue;
      }

      try {
        // Conditional stamp on the notice being SENT — one winner across
        // concurrent sweep runs.
        const sentColumn =
          due.send === 7
            ? subscription.discountNotice7SentAt
            : subscription.discountNotice30SentAt;
        const [winner] = await db
          .update(subscription)
          .set({
            ...(due.stamp.includes(30) ? { discountNotice30SentAt: now } : {}),
            ...(due.stamp.includes(7) ? { discountNotice7SentAt: now } : {}),
            updatedAt: now,
          })
          .where(
            and(
              eq(subscription.organizationId, row.organizationId),
              isNull(sentColumn),
            ),
          )
          .returning({ organizationId: subscription.organizationId });
        if (!winner) {
          continue;
        }

        const ownerEmails = await getOrganizationOwnerEmails(
          row.organizationId,
        );
        if (ownerEmails.length === 0) {
          continue;
        }

        const billingUrl = `${getApiEnv().TURBOPLAN_URL}/organizations/${row.orgSlug}/billing`;
        const endsAtLabel = row.discountEndsAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        });
        const daysLeft = Math.max(
          1,
          Math.ceil((row.discountEndsAt.getTime() - now.getTime()) / DAY_MS),
        );
        const mailService = getMailService();

        await Promise.all(
          ownerEmails.map((email) =>
            mailService
              .sendDiscountEndingEmail({
                to: email,
                orgName: row.orgName,
                percentOff: row.discountPercentOff ?? 0,
                daysLeft,
                endsAtLabel,
                billingUrl,
                recipientEmail: email,
              })
              .catch((error) => {
                console.error(
                  `[billing] discount-ending email to ${email} failed:`,
                  error,
                );
              }),
          ),
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `[billing] discount notice failed for organization ${row.organizationId}:`,
          error,
        );
      }
    }

    if (checked > 0) {
      console.log(
        `[billing] discount notices: checked=${checked}, sent=${sent}, failed=${failed}`,
      );
    }

    return { checked, sent, failed };
  };

/**
 * Reconciles a SINGLE subscription's Stripe seat quantity against the true
 * billable-seat count. This is the primary drift guard, driven by Stripe's
 * `invoice.upcoming` webhook so each org is checked right before it renews —
 * a per-org replacement for the removed full-scan cron.
 *
 * No-op unless the subscription row exists and its status is seat-syncable
 * ({@link SEAT_SYNC_STATUSES}); otherwise there is no live Stripe item to
 * reprice. Like the full scan, it ALWAYS retrieves the live subscription from
 * Stripe (never trusts the DB mirror) and logs when it actually corrects a
 * drifted quantity.
 *
 * The caller (the `invoice.upcoming` webhook handler) already runs only when the
 * billing package is enabled, so this does not re-check the feature flag.
 */
export const reconcileSeatsForStripeSubscription = async (
  stripeSubscriptionId: string,
): Promise<void> => {
  const existing =
    await getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!existing?.stripeSubscriptionId) {
    return;
  }
  if (!SEAT_SYNC_STATUSES.includes(existing.status as SubscriptionStatus)) {
    return;
  }

  const seats = await countBillableSeats(existing.organizationId);
  const result = await reconcileSeatQuantityForSubscription({
    organizationId: existing.organizationId,
    stripeSubscriptionId: existing.stripeSubscriptionId,
    seats,
    mirroredSeats: existing.seats,
  });

  if (result.quantityChanged) {
    console.log(
      `[billing] reconciled seats for organization ${existing.organizationId}: ` +
        `extra-seat item ${result.previousExtraQuantity} -> ` +
        `${result.extraSeatQuantity} (billable ${seats}, mirror was ${existing.seats})`,
    );
  }
};
