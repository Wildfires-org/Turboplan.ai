import type Stripe from "stripe";

import type { DesiredCoupon, DesiredPrice } from "./stripe-desired-state";

/**
 * Pure diff predicates for the Stripe catalog sync. Extracted from the sync
 * script so the create-vs-replace decisions are unit-testable: a false
 * negative churns a replacement price/coupon version on every run, a false
 * positive silently leaves drift.
 */

export const epochSeconds = (dateYmd: string): number =>
  Math.floor(Date.parse(`${dateYmd}T23:59:59Z`) / 1000);

/** Version number from `<prefix>-vN` coupon ids; 0 when not a version id. */
export const couponVersion = (couponId: string, prefix: string): number => {
  const match = couponId.match(
    new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}-v(\\d+)$`),
  );
  return match ? Number(match[1]) : 0;
};

export const priceMatches = (
  actual: Stripe.Price,
  want: DesiredPrice,
  context: {
    productIdByCatalogKey: ReadonlyMap<string, string>;
    meterId: string | undefined;
  },
): boolean => {
  const productId = context.productIdByCatalogKey.get(want.productCatalogKey);
  const sameProduct =
    productId !== undefined &&
    (typeof actual.product === "string"
      ? actual.product
      : actual.product.id) === productId;
  const base =
    actual.active &&
    sameProduct &&
    actual.currency === want.currency &&
    actual.recurring?.interval === want.interval;
  if (!base) {
    return false;
  }
  if (want.kind === "licensed") {
    return (
      actual.recurring?.usage_type === "licensed" &&
      actual.unit_amount === want.unitAmountCents
    );
  }
  return (
    actual.recurring?.usage_type === "metered" &&
    actual.recurring?.meter === context.meterId &&
    actual.unit_amount_decimal !== null &&
    Number(actual.unit_amount_decimal.toString()) ===
      Number(want.unitAmountDecimalCents)
  );
};

export const couponMatches = (
  actual: Stripe.Coupon,
  want: DesiredCoupon,
  context: { productIdByCatalogKey: ReadonlyMap<string, string> },
): boolean => {
  const wantProductIds = want.appliesToProductCatalogKeys
    .map((key) => context.productIdByCatalogKey.get(key))
    .filter((id): id is string => id !== undefined)
    .sort();
  const actualProductIds = [...(actual.applies_to?.products ?? [])].sort();
  return (
    actual.percent_off === want.percentOff &&
    actual.duration === want.duration &&
    (actual.duration_in_months ?? undefined) ===
      (want.durationInMonths ?? undefined) &&
    (actual.max_redemptions ?? undefined) ===
      (want.maxRedemptions ?? undefined) &&
    (actual.redeem_by ?? undefined) ===
      (want.redeemBy ? epochSeconds(want.redeemBy) : undefined) &&
    JSON.stringify(wantProductIds) === JSON.stringify(actualProductIds) &&
    wantProductIds.length === want.appliesToProductCatalogKeys.length
  );
};
