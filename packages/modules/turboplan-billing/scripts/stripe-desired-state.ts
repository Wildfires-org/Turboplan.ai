import { OVERAGE_LOOKUP_SUFFIX, SEAT_LOOKUP_SUFFIX } from "../src/types/index";
import type { PricingCatalog } from "./catalog-schema";

/**
 * Pure mapping from the validated pricing catalog to the DESIRED Stripe
 * state. No Stripe SDK, no network — the sync script (sync-stripe-catalog.ts)
 * fetches actuals and diffs against this. Keeping the mapping pure makes the
 * whole catalog→Stripe contract snapshot-testable.
 *
 * Identity model:
 * - products are found by `metadata.catalog_key`;
 * - prices are found by lookup key (the stable contract — replacement prices
 *   transfer the lookup key);
 * - the meter is found by event name;
 * - coupons are immutable in Stripe, so the desired coupon carries a stable
 *   `idPrefix` and the sync owns versioning (`<prefix>-v1`, `-v2`, …);
 * - promotion codes are found by their customer-facing code.
 */

export type DesiredProduct = {
  /** Stable identity stored in product metadata. */
  catalogKey: string;
  name: string;
  description?: string;
};

export type DesiredPrice = {
  lookupKey: string;
  productCatalogKey: string;
  currency: "usd";
  interval: "month";
} & (
  | { kind: "licensed"; unitAmountCents: number }
  | { kind: "metered"; unitAmountDecimalCents: string }
);

export type DesiredMeter = {
  eventName: string;
  /** sum aggregation over payload.value, customer via stripe_customer_id. */
  aggregationFormula: "sum";
};

export type DesiredCoupon = {
  /** Version-less identity; the sync appends -vN and handles drift. */
  idPrefix: string;
  name: string;
  percentOff: number;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
  /** Restriction set — base plan products ONLY (seats/overage stay list). */
  appliesToProductCatalogKeys: string[];
  maxRedemptions?: number;
  /** YYYY-MM-DD (validated by the catalog schema). */
  redeemBy?: string;
};

export type DesiredPromotionCode = {
  code: string;
  couponIdPrefix: string;
};

export type DesiredStripeState = {
  products: DesiredProduct[];
  prices: DesiredPrice[];
  meter: DesiredMeter;
  coupons: DesiredCoupon[];
  promotionCodes: DesiredPromotionCode[];
};

// Keyed by the catalog's `product` value, which is Stripe identity and stays
// "turboplan" (renaming it orphans the live prices and meter). Only the
// customer-facing display name rebrands.
const DISPLAY_NAMES: Record<string, string> = {
  turboplan: "TurboPlan",
};

export const displayName = (product: string): string =>
  DISPLAY_NAMES[product] ?? product;

/** $X.YZ → integer cents, safe against float artifacts. */
const usdToCents = (usd: number): number => Math.round(usd * 100);

/**
 * $/credit → fractional cents/credit as Stripe's `unit_amount_decimal`
 * string (e.g. 0.006 USD → "0.6"). Rounded to 6 decimal places of a cent to
 * kill float artifacts (0.006 * 100 === 0.6000000000000001 in JS).
 */
const usdToDecimalCentsString = (usd: number): string =>
  (Math.round(usd * 1e8) / 1e6).toString();

export const buildDesiredStripeState = (
  catalog: PricingCatalog,
): DesiredStripeState => {
  const { product } = catalog;
  const brand = displayName(product);

  const paidPlans = catalog.billing.plans.filter(
    (plan): plan is typeof plan & { lookup_key: string } =>
      plan.price_usd > 0 && plan.lookup_key !== undefined,
  );

  const products: DesiredProduct[] = [
    ...paidPlans.map((plan) => ({
      catalogKey: `${product}_plan_${plan.id}`,
      name: `${brand} ${plan.name}`,
      description: plan.headline,
    })),
    // Separate products for seats and credits so the startup coupon's
    // `applies_to.products` restriction to base plans leaves them at list
    // price without any extra switch.
    {
      catalogKey: `${product}_additional_seat`,
      name: `${brand} Additional Seat`,
      description: "Billable seat beyond the plan's included count.",
    },
    {
      catalogKey: `${product}_credits`,
      name: `${brand} Credits`,
      description: "Metered credit overage beyond the plan's monthly pool.",
    },
  ];

  const prices: DesiredPrice[] = paidPlans.flatMap((plan): DesiredPrice[] => {
    const planPrices: DesiredPrice[] = [
      {
        lookupKey: plan.lookup_key,
        productCatalogKey: `${product}_plan_${plan.id}`,
        currency: "usd",
        interval: "month",
        kind: "licensed",
        unitAmountCents: usdToCents(plan.price_usd),
      },
    ];
    if (plan.additional_seat_price_usd !== null) {
      planPrices.push({
        lookupKey: `${plan.lookup_key}${SEAT_LOOKUP_SUFFIX}`,
        productCatalogKey: `${product}_additional_seat`,
        currency: "usd",
        interval: "month",
        kind: "licensed",
        unitAmountCents: usdToCents(plan.additional_seat_price_usd),
      });
    }
    if (plan.overage_usd_per_credit !== null) {
      planPrices.push({
        lookupKey: `${plan.lookup_key}${OVERAGE_LOOKUP_SUFFIX}`,
        productCatalogKey: `${product}_credits`,
        currency: "usd",
        interval: "month",
        kind: "metered",
        unitAmountDecimalCents: usdToDecimalCentsString(
          plan.overage_usd_per_credit,
        ),
      });
    }
    return planPrices;
  });

  const coupons: DesiredCoupon[] = catalog.billing.discount_programs.map(
    (program) => ({
      idPrefix: `${product}-${program.id}`,
      name: program.name,
      percentOff: program.discount.percent_off,
      duration: program.discount.duration,
      ...(program.discount.duration_in_months !== undefined
        ? { durationInMonths: program.discount.duration_in_months }
        : {}),
      appliesToProductCatalogKeys: program.plans.map(
        (planId) => `${product}_plan_${planId}`,
      ),
      ...(program.eligibility.max_redemptions !== undefined
        ? { maxRedemptions: program.eligibility.max_redemptions }
        : {}),
      ...(program.eligibility.redeem_by !== undefined
        ? { redeemBy: program.eligibility.redeem_by }
        : {}),
    }),
  );

  const promotionCodes: DesiredPromotionCode[] =
    catalog.billing.discount_programs.flatMap((program) =>
      program.codes.map((code) => ({
        code,
        couponIdPrefix: `${product}-${program.id}`,
      })),
    );

  return {
    products,
    prices,
    meter: {
      eventName: catalog.billing.meter_event_name,
      aggregationFormula: "sum",
    },
    coupons,
    promotionCodes,
  };
};
