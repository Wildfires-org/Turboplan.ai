import { CATALOG } from "../generated/catalog";

/**
 * All plan data derives from the canonical pricing catalog
 * (catalog/pricing.yaml → src/generated/catalog.ts). This entry must stay
 * client-safe: pure data and types, no env access, no server imports.
 */

export { CATALOG };
export type Catalog = typeof CATALOG;
export type CatalogPlan = Catalog["billing"]["plans"][number];
export type PlanKey = CatalogPlan["id"];

/** Paid plans carry a Stripe lookup_key; the free plan has none. */
export type PaidPlanKey = Extract<CatalogPlan, { lookup_key: string }>["id"];

type PlanById = { [K in PlanKey]: Extract<CatalogPlan, { id: K }> };

export const PLAN_ORDER: readonly PlanKey[] = CATALOG.billing.plans.map(
  (plan) => plan.id,
);

export const PLANS = Object.fromEntries(
  CATALOG.billing.plans.map((plan) => [plan.id, plan]),
) as PlanById;

/**
 * Pure catalog math shared by checkout, seat sync, webhook projection, credit
 * metering, the Stripe sync script, and every pricing UI. The formulas are the
 * public contract: extra seats bill only beyond the included count, and each
 * extra seat adds its plan's credit grant to the shared workspace pool.
 */

export const SEAT_LOOKUP_SUFFIX = "_additional_seat";
export const OVERAGE_LOOKUP_SUFFIX = "_credit_overage";

export const extraSeats = (billableSeats: number, plan: PlanKey): number => {
  return Math.max(billableSeats - PLANS[plan].included_seats, 0);
};

export const creditAllowance = (
  plan: PlanKey,
  extraSeatCount: number,
): number => {
  const config = PLANS[plan];
  return (
    config.limits.credits + extraSeatCount * config.additional_seat_credits
  );
};

export const monthlyBase = (plan: PlanKey): number => {
  return PLANS[plan].price_usd;
};

export const planHasOverage = (plan: PlanKey): boolean => {
  return PLANS[plan].overage_usd_per_credit !== null;
};

/** True when the plan hard-stops usage at its credit allowance (free plan). */
export const planHasHardStop = (plan: PlanKey): boolean => {
  const config = PLANS[plan];
  return "hard_stop" in config && config.hard_stop === true;
};

export const seatLookupKey = (plan: PaidPlanKey): string => {
  return `${PLANS[plan].lookup_key}${SEAT_LOOKUP_SUFFIX}`;
};

export const overageLookupKey = (plan: PaidPlanKey): string => {
  return `${PLANS[plan].lookup_key}${OVERAGE_LOOKUP_SUFFIX}`;
};

export const PAID_PLAN_KEYS = PLAN_ORDER.filter(
  (plan): plan is PaidPlanKey => "lookup_key" in PLANS[plan],
);

/**
 * Plan whose catalog limits/allowances apply to a subscription row. The
 * legacy `grandfather` comp plan is not in the catalog — treat it as `max`.
 */
export const allowancePlanKey = (plan: string | null): PlanKey => {
  if (plan && (PLAN_ORDER as string[]).includes(plan)) {
    return plan as PlanKey;
  }
  if (plan === "grandfather") {
    return "max";
  }
  return "starter";
};

export type LookupKeyRole = {
  plan: PaidPlanKey;
  kind: "base" | "seat" | "overage";
};

/**
 * Classify any Stripe price lookup_key produced by this catalog. Returns null
 * for foreign keys so webhook projection can ignore prices we do not own.
 */
export const classifyLookupKey = (lookupKey: string): LookupKeyRole | null => {
  for (const plan of PAID_PLAN_KEYS) {
    const base = PLANS[plan].lookup_key;
    if (lookupKey === base) {
      return { plan, kind: "base" };
    }
    if (lookupKey === `${base}${SEAT_LOOKUP_SUFFIX}`) {
      return { plan, kind: "seat" };
    }
    if (lookupKey === `${base}${OVERAGE_LOOKUP_SUFFIX}`) {
      return { plan, kind: "overage" };
    }
  }
  return null;
};

/** Base-plan lookup only; seat/overage keys resolve via classifyLookupKey. */
export const planFromLookupKey = (lookupKey: string): PaidPlanKey | null => {
  const role = classifyLookupKey(lookupKey);
  return role?.kind === "base" ? role.plan : null;
};

/**
 * Convert an observed provider cost into credits. Minimum 1 credit per
 * metered call; non-finite or non-positive costs also charge the minimum so a
 * missing provider cost can never make usage free.
 */
export const creditsFromCostUsd = (costUsd: number): number => {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(costUsd * CATALOG.billing.credits_per_usd));
};

/**
 * Conservative blended fallback rate for calls where the provider omitted the
 * exact cost (some models/BYOK setups): $20 per million tokens — above the
 * output rate of the priciest configured model, so a missing cost is never
 * cheaper than a reported one even for output-heavy calls.
 */
const FALLBACK_USD_PER_MILLION_TOKENS = 20;

/**
 * Credits for one metered call: exact provider cost when present, otherwise
 * the token-count fallback, otherwise the 1-credit floor.
 */
/**
 * Pure: the exact provider cost from AI SDK provider metadata, when the
 * OpenRouter usage-accounting field is present.
 */
export const extractOpenRouterCost = (
  providerMetadata: unknown,
): number | undefined => {
  const cost = (
    providerMetadata as
      | { openrouter?: { usage?: { cost?: number } } }
      | undefined
  )?.openrouter?.usage?.cost;
  return typeof cost === "number" && Number.isFinite(cost) && cost > 0
    ? cost
    : undefined;
};

export const creditsFromUsage = ({
  costUsd,
  totalTokens,
}: {
  costUsd?: number;
  totalTokens?: number;
}): number => {
  if (typeof costUsd === "number" && Number.isFinite(costUsd) && costUsd > 0) {
    return creditsFromCostUsd(costUsd);
  }
  if (typeof totalTokens === "number" && totalTokens > 0) {
    return creditsFromCostUsd(
      (totalTokens / 1_000_000) * FALLBACK_USD_PER_MILLION_TOKENS,
    );
  }
  return 1;
};

/**
 * Canonical status lists shared by server and client so the domain facts live in
 * ONE place (client copies previously drifted from the server enums). Values
 * mirror the `SubscriptionStatus` DB enum's string values — this package's types
 * entry must stay client-safe, so it cannot import the enum itself.
 */

/**
 * Statuses in which the org holds a LIVE subscription: it must not start a
 * second checkout, its seat quantity is kept in sync, and "Cancel plan" is
 * meaningful.
 */
export const LIVE_SUBSCRIPTION_STATUS_VALUES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
];

/**
 * Whether a subscription row holds a live Stripe subscription.
 *
 * THE single definition of "already subscribed". Both the onboarding gate
 * (`hasChosenPlan`) and the free-plan guard (`activateStarterPlan`) must use
 * it: when they disagree, onboarding shows a plan step that the guard then
 * refuses to complete, trapping the user with no way out of the UI.
 *
 * Deliberately independent of `plan`: a row can read `starter` while still
 * carrying a live Stripe subscription (an interrupted checkout leaves exactly
 * that), and such a row is still "subscribed" for both decisions.
 */
export const holdsLiveSubscription = (
  row:
    | { stripeSubscriptionId?: string | null; status?: string | null }
    | null
    | undefined,
): boolean => {
  if (!row?.stripeSubscriptionId || !row.status) {
    return false;
  }
  return LIVE_SUBSCRIPTION_STATUS_VALUES.includes(row.status);
};

/**
 * Dunning statuses: Stripe is retrying the charge (`past_due`) or has exhausted
 * retries (`unpaid`). Either way the fix is the same — update the payment
 * method.
 */
export const PAYMENT_FAILED_STATUS_VALUES: readonly string[] = [
  "past_due",
  "unpaid",
];
