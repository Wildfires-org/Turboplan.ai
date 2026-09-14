import { and, eq, sql } from "drizzle-orm";

import {
  billingCreditEvent,
  billingCreditUsage,
  type Subscription,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import {
  CATALOG,
  creditAllowance,
  extraSeats,
  type PlanKey,
  planHasHardStop,
  planHasOverage,
} from "../types";
import { planFromSubscriptionRow } from "./entitlements";
import { getSubscriptionByOrganizationId } from "./queries";

export {
  resolveBillingOrgForProject,
  resolveBillingOrgForUser,
} from "./queries";

import { BillingError, getStripe } from "./stripe-service";
import { maybeSendUsageAlerts } from "./usage-alerts";

/**
 * Credit metering. Every metered AI call flows through here:
 *
 *   gate:    assertCreditsAvailable(orgId)   — BEFORE the model call
 *   record:  consumeCredits({...})           — AFTER, with observed cost
 *
 * The gate is check-then-act by design: one in-flight request can overrun a
 * hard-stopped plan slightly; the next request is blocked. Accepted.
 *
 * Periods are lazy — the first consumption in a new period upserts a fresh
 * usage row keyed on (org, period_start); no cron resets anything.
 */

export class CreditsExhaustedError extends BillingError {
  constructor(message: string) {
    super(message, "CREDITS_EXHAUSTED", 402);
    this.name = "CreditsExhaustedError";
  }
}

export type CreditSource =
  | "chat"
  | "document"
  | "suggestion"
  | "title"
  | "prompt_tools"
  | "image"
  | "research_agent"
  | "research_cataloger"
  | "tasks"
  | "auto_responder";

export type CreditPeriod = { start: Date; end: Date };

/**
 * Pure: the credit period governing `now` for this subscription row. Paid
 * orgs anchor on the Stripe billing period; free/anchorless orgs use UTC
 * calendar months.
 *
 * Known lag window: right after a paid period rolls over, until the
 * subscription webhook refreshes the anchor, consumption lands in a
 * calendar-month row that neither period ever re-examines (under-billing
 * bounded by webhook latency). Accepted — fixing it would put a Stripe
 * round-trip on the hot metering path.
 */
export const computeCreditPeriod = (
  row:
    | Pick<Subscription, "currentPeriodStart" | "currentPeriodEnd">
    | undefined,
  now: Date = new Date(),
): CreditPeriod => {
  if (
    row?.currentPeriodStart &&
    row.currentPeriodEnd &&
    row.currentPeriodStart <= now &&
    now < row.currentPeriodEnd
  ) {
    return { start: row.currentPeriodStart, end: row.currentPeriodEnd };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start, end };
};

/**
 * Pure: the portion of `amount` that falls beyond the allowance. Frozen at
 * observation time — a seat added later enlarges the pool for FUTURE calls
 * but already-reported overage is never clawed back (and a removed seat never
 * bills past in-pool usage retroactively). Deliberate one-way ratchet.
 */
export const computeOverageDelta = ({
  usedAfter,
  allowance,
  amount,
  hasOverage,
}: {
  usedAfter: number;
  allowance: number;
  amount: number;
  hasOverage: boolean;
}): number => {
  if (!hasOverage) {
    return 0;
  }
  return Math.min(Math.max(usedAfter - allowance, 0), amount);
};

type OrgCreditContext = {
  plan: PlanKey;
  allowance: number;
  period: CreditPeriod;
  subscription: Subscription | undefined;
};

const getOrgCreditContext = async (
  organizationId: string,
): Promise<OrgCreditContext> => {
  const subscription = await getSubscriptionByOrganizationId(organizationId);
  const plan = planFromSubscriptionRow(subscription ?? null);
  // The seats mirror stores provisioned seats (included + extra), so the
  // extra-seat credit grant derives directly from it.
  const extraSeatCount = extraSeats(subscription?.seats ?? 0, plan);
  return {
    plan,
    allowance: creditAllowance(plan, extraSeatCount),
    period: computeCreditPeriod(subscription),
    subscription,
  };
};

export type CreditUsageSummary = {
  plan: PlanKey;
  creditsUsed: number;
  allowance: number;
  hardStop: boolean;
  periodStart: Date;
  periodEnd: Date;
};

export const getCreditUsage = async (
  organizationId: string,
): Promise<CreditUsageSummary> => {
  const context = await getOrgCreditContext(organizationId);
  const row = await db.query.billingCreditUsage.findFirst({
    where: and(
      eq(billingCreditUsage.organizationId, organizationId),
      eq(billingCreditUsage.periodStart, context.period.start),
    ),
    columns: { creditsUsed: true },
  });

  return {
    plan: context.plan,
    creditsUsed: row?.creditsUsed ?? 0,
    allowance: context.allowance,
    hardStop: planHasHardStop(context.plan),
    periodStart: context.period.start,
    periodEnd: context.period.end,
  };
};

/**
 * Pure: whether the gate must block further usage. `pendingAmount` is the
 * known cost of the call about to run (flat-cost sources only — chat/document/
 * etc. don't know their cost ahead of time and pass 0, the default). Blocking
 * on `creditsUsed + pendingAmount >= allowance` reserves headroom for that
 * call instead of only catching an already-exhausted pool, so a known-cost
 * action can't land the org meaningfully past its hard stop in one shot.
 */
export const shouldBlockUsage = (
  usage: Pick<CreditUsageSummary, "hardStop" | "creditsUsed" | "allowance">,
  pendingAmount = 0,
): boolean =>
  usage.hardStop && usage.creditsUsed + pendingAmount >= usage.allowance;

/**
 * Gate a metered AI call. Throws CreditsExhaustedError (402) when the org's
 * plan hard-stops at its allowance and the pool is used up. Plans with
 * metered overage never block — usage beyond the allowance bills per credit.
 * No-op when the billing package is disabled.
 *
 * `amount` reserves headroom for a known flat-cost call (e.g. research agent,
 * image generation) so it can't land the org meaningfully past a hard stop in
 * one shot — see {@link shouldBlockUsage}. Omit for unbounded-cost sources
 * (chat, document, etc.), which fall back to the plain already-exhausted check.
 */
export const assertCreditsAvailable = async (
  organizationId: string,
  amount = 0,
): Promise<void> => {
  if (!isBillingPackageEnabled()) {
    return;
  }

  if (shouldBlockUsage(await getCreditUsage(organizationId), amount)) {
    throw new CreditsExhaustedError(
      amount > 0
        ? `This action requires ${amount} credits, more than the organization's remaining monthly allowance. Upgrade to a paid plan for a larger pool and metered overage.`
        : "This organization has used its monthly credits. Upgrade to a paid plan for a larger pool and metered overage.",
    );
  }
};

export type ConsumeCreditsResult = {
  creditsUsed: number;
  allowance: number;
  overageDelta: number;
};

/**
 * Record consumed credits: atomically increments the per-period counter,
 * appends a ledger row, and reports any overage portion to the Stripe billing
 * meter (ledger id = meter event identifier → redelivery-idempotent). Meter
 * reporting is best-effort; unreported rows are swept by reconciliation.
 *
 * Returns zeros without writing when billing is disabled or amount < 1.
 */
export const consumeCredits = async (params: {
  organizationId: string;
  userId?: string;
  amount: number;
  source: CreditSource;
  model?: string;
  costUsd?: number;
  metadata?: Record<string, unknown>;
}): Promise<ConsumeCreditsResult> => {
  if (!isBillingPackageEnabled() || params.amount < 1) {
    return { creditsUsed: 0, allowance: 0, overageDelta: 0 };
  }

  const { organizationId, amount } = params;
  const context = await getOrgCreditContext(organizationId);

  // Counter and ledger commit together: a partial write would either inflate
  // the pool with no audit trail or lose the overage to the sweep forever
  // (the sweep can only find LEDGER rows). Meter reporting stays outside the
  // transaction — it is best-effort and swept.
  const { creditsUsed, overageDelta, ledgerId } = await db.transaction(
    async (tx) => {
      const [usageRow] = await tx
        .insert(billingCreditUsage)
        .values({
          organizationId,
          periodStart: context.period.start,
          periodEnd: context.period.end,
          creditsUsed: amount,
        })
        .onConflictDoUpdate({
          target: [
            billingCreditUsage.organizationId,
            billingCreditUsage.periodStart,
          ],
          set: {
            creditsUsed: sql`${billingCreditUsage.creditsUsed} + ${amount}`,
            updatedAt: new Date(),
          },
        })
        .returning({ creditsUsed: billingCreditUsage.creditsUsed });

      const usedAfter = usageRow?.creditsUsed ?? amount;
      const delta = computeOverageDelta({
        usedAfter,
        allowance: context.allowance,
        amount,
        hasOverage: planHasOverage(context.plan),
      });

      const [ledgerRow] = await tx
        .insert(billingCreditEvent)
        .values({
          organizationId,
          userId: params.userId ?? null,
          amount,
          source: params.source,
          model: params.model ?? null,
          costUsd: params.costUsd !== undefined ? String(params.costUsd) : null,
          overageCredits: delta,
          metadata: params.metadata ?? null,
        })
        .returning({ id: billingCreditEvent.id });

      return {
        creditsUsed: usedAfter,
        overageDelta: delta,
        ledgerId: ledgerRow?.id ?? null,
      };
    },
  );

  if (
    overageDelta > 0 &&
    ledgerId &&
    context.subscription?.stripeOverageItemId &&
    context.subscription.stripeCustomerId
  ) {
    // Fire-and-forget: the Stripe POST must not sit on the request path (it
    // ran inline in chat streams before). Redelivery-idempotent and swept by
    // reconciliation, so a dropped report self-heals.
    void reportOverageToMeter({
      ledgerId,
      stripeCustomerId: context.subscription.stripeCustomerId,
      overageDelta,
    });
  }

  // Fire-and-forget: alert stamping/emails must never delay or fail the
  // metered request. On Workers a reaped isolate can drop one alert — that
  // crossing is then LOST for the period (crossedThresholds only fires on the
  // consumption that crosses the cutoff); usage-alerts.ts documents this as
  // an accepted loss of at most one alert.
  void maybeSendUsageAlerts({
    organizationId,
    periodStart: context.period.start,
    usedBefore: creditsUsed - amount,
    usedAfter: creditsUsed,
    allowance: context.allowance,
    plan: context.plan,
  }).catch((error) => {
    console.error(
      `[billing] usage alert dispatch failed for organization ${organizationId}:`,
      error,
    );
  });

  return { creditsUsed, allowance: context.allowance, overageDelta };
};

/**
 * Stripe rejects a meter event whose `identifier` was already used within a
 * rolling ~24h window. For us that rejection IS success — the event landed on
 * a previous attempt whose stamp write failed — so callers must stamp the row
 * instead of retrying (a retry after the window expires would create a second
 * event and double-bill).
 */
export const isDuplicateMeterEventError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  const statusCode =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : null;
  // Structured `param` is the stable signal; the message match is a fallback
  // in case Stripe stops populating param. Misclassifying a real duplicate as
  // a failure would leave the row unstamped and retried past the ~24h dedupe
  // window — a double-bill — so match generously on 400s.
  const param =
    "param" in error && typeof error.param === "string" ? error.param : "";
  return (
    statusCode === 400 &&
    (param === "identifier" || message.includes("identifier"))
  );
};

/**
 * Best-effort meter event. Failures are logged and left for the
 * reconciliation sweep (rows with overage_credits > 0 and no reported stamp).
 * A duplicate-identifier rejection stamps the row as reported — see
 * {@link isDuplicateMeterEventError}.
 */
const reportOverageToMeter = async ({
  ledgerId,
  stripeCustomerId,
  overageDelta,
}: {
  ledgerId: string;
  stripeCustomerId: string;
  overageDelta: number;
}): Promise<void> => {
  try {
    await getStripe().billing.meterEvents.create({
      event_name: CATALOG.billing.meter_event_name,
      identifier: ledgerId,
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: String(overageDelta),
      },
    });
  } catch (error) {
    if (!isDuplicateMeterEventError(error)) {
      console.error(
        `[billing] meter event failed for ledger ${ledgerId} (will be swept by reconcile):`,
        error,
      );
      return;
    }
  }
  await db
    .update(billingCreditEvent)
    .set({ stripeMeterReportedAt: new Date() })
    .where(eq(billingCreditEvent.id, ledgerId))
    .catch((error: unknown) => {
      console.error(
        `[billing] meter stamp failed for ledger ${ledgerId} (sweep will resolve):`,
        error,
      );
    });
};
