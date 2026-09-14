import Stripe from "stripe";

import { validateCatalog } from "./catalog-schema";
import { readCatalogSource } from "./load-catalog";
import {
  buildDesiredStripeState,
  type DesiredPrice,
  displayName,
} from "./stripe-desired-state";
import {
  couponMatches,
  couponVersion,
  epochSeconds,
  priceMatches,
} from "./stripe-diff";

/**
 * Reconciles Stripe against catalog/pricing.yaml + catalog/brand.yaml.
 *
 *   pnpm --filter @wildfires-org/turboplan-billing sync:stripe            # dry run
 *   pnpm --filter @wildfires-org/turboplan-billing sync:stripe -- --apply
 *
 * Contract (docs/plans/billing-v2.md §9):
 * - dry run prints the diff and exits non-zero while drift exists, so
 *   `sync → sync --apply → sync` must end with a clean zero-drift run;
 * - a subscribed price is NEVER mutated — immutable drift creates a
 *   replacement price and transfers the lookup key, deactivating the old one
 *   (existing subscriptions keep billing the deactivated price — deliberate
 *   grandfathering; a crash between create and deactivate leaves an orphan
 *   active price without a lookup key — harmless, visible in the dashboard);
 * - coupons are immutable — drift creates `<prefix>-vN+1` and moves the
 *   promotion codes; nothing in Stripe is ever deleted;
 * - unknown catalog-tagged objects are REPORTED, never touched;
 * - refuses live keys unless --live is passed explicitly.
 */

const APPLY = process.argv.includes("--apply");
const ALLOW_LIVE = process.argv.includes("--live");

type PlannedAction = {
  action: "create" | "update" | "replace" | "deactivate" | "report";
  object: string;
  identity: string;
  detail: string;
};

const planned: PlannedAction[] = [];
const note = (entry: PlannedAction) => {
  planned.push(entry);
  const marker = entry.action === "report" ? "!" : APPLY ? "✓" : "→";
  console.log(
    `${marker} ${entry.action.toUpperCase().padEnd(10)} ${entry.object.padEnd(9)} ${entry.identity}  ${entry.detail}`,
  );
};

const getStripe = (): Stripe => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set.");
    process.exit(1);
  }
  const isTestKey = key.startsWith("sk_test_") || key.startsWith("rk_test_");
  if (!isTestKey && !ALLOW_LIVE) {
    console.error(
      "Refusing to run against a LIVE Stripe key without --live. " +
        "Production rollout requires the separately reviewed live process.",
    );
    process.exit(1);
  }
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
};

const main = async () => {
  const stripe = getStripe();
  const catalog = validateCatalog(readCatalogSource());
  const desired = buildDesiredStripeState(catalog);
  // Fixed key, deliberately NOT derived from catalog.product: deriving it from
  // the brandable product name would make every rebrand orphan all previously
  // synced Stripe objects (they'd be skipped as untagged instead of reported).
  const metadataKey = "catalog_key";
  // Products synced before the key became brand-independent carry the old
  // `<product>_catalog_key` tag. They are recognised here and, under APPLY,
  // re-tagged so the next run finds them by the fixed key. Drop this list once
  // every Stripe account this repo syncs against has been re-tagged.
  const legacyMetadataKeys = ["eplan_catalog_key"];

  console.log(
    `Catalog sync for "${catalog.product}" (${APPLY ? "APPLY" : "dry run"})\n`,
  );

  // ---------------------------------------------------------------- products
  // Full pagination everywhere: a catalog product beyond page one would
  // otherwise be re-created as a duplicate under APPLY.
  const actualProductList: Stripe.Product[] = [];
  await stripe.products
    .list({ active: true, limit: 100 })
    .autoPagingEach((product) => {
      actualProductList.push(product);
    });
  const productIdByCatalogKey = new Map<string, string>();

  for (const product of actualProductList) {
    const legacyKey = product.metadata?.[metadataKey]
      ? undefined
      : legacyMetadataKeys.find((key) => product.metadata?.[key]);
    const catalogKey = legacyKey
      ? product.metadata[legacyKey]
      : product.metadata?.[metadataKey];
    if (!catalogKey) {
      continue;
    }
    if (!desired.products.some((p) => p.catalogKey === catalogKey)) {
      note({
        action: "report",
        object: "product",
        identity: catalogKey,
        detail: `UNKNOWN catalog-tagged product ${product.id} — not in the catalog; not touched`,
      });
      continue;
    }
    if (legacyKey) {
      note({
        action: "update",
        object: "product",
        identity: catalogKey,
        detail: `re-tag ${product.id}: metadata.${legacyKey} → metadata.${metadataKey}`,
      });
      if (APPLY) {
        await stripe.products.update(product.id, {
          metadata: { [metadataKey]: catalogKey },
        });
      }
    }
    productIdByCatalogKey.set(catalogKey, product.id);
  }

  for (const desiredProduct of desired.products) {
    const existingId = productIdByCatalogKey.get(desiredProduct.catalogKey);
    if (!existingId) {
      note({
        action: "create",
        object: "product",
        identity: desiredProduct.catalogKey,
        detail: desiredProduct.name,
      });
      if (APPLY) {
        const created = await stripe.products.create({
          name: desiredProduct.name,
          description: desiredProduct.description,
          metadata: { [metadataKey]: desiredProduct.catalogKey },
        });
        productIdByCatalogKey.set(desiredProduct.catalogKey, created.id);
      }
      continue;
    }

    const actual = actualProductList.find((p) => p.id === existingId);
    const drifted =
      actual &&
      (actual.name !== desiredProduct.name ||
        (actual.description ?? undefined) !==
          (desiredProduct.description ?? undefined));
    if (drifted) {
      note({
        action: "update",
        object: "product",
        identity: desiredProduct.catalogKey,
        detail: `name/description → "${desiredProduct.name}"`,
      });
      if (APPLY) {
        await stripe.products.update(existingId, {
          name: desiredProduct.name,
          description: desiredProduct.description,
        });
      }
    }
  }

  // ------------------------------------------------------------------ meter
  const meters = await stripe.billing.meters.list({
    status: "active",
    limit: 100,
  });
  let meter = meters.data.find((m) => m.event_name === desired.meter.eventName);
  if (!meter) {
    note({
      action: "create",
      object: "meter",
      identity: desired.meter.eventName,
      detail: "sum(value) by stripe_customer_id",
    });
    if (APPLY) {
      meter = await stripe.billing.meters.create({
        display_name: `${displayName(catalog.product)} credits`,
        event_name: desired.meter.eventName,
        default_aggregation: { formula: "sum" },
        customer_mapping: {
          event_payload_key: "stripe_customer_id",
          type: "by_id",
        },
        value_settings: { event_payload_key: "value" },
      });
    }
  } else if (
    meter.default_aggregation?.formula !== "sum" ||
    meter.customer_mapping?.event_payload_key !== "stripe_customer_id" ||
    meter.value_settings?.event_payload_key !== "value"
  ) {
    note({
      action: "report",
      object: "meter",
      identity: desired.meter.eventName,
      detail:
        "meter configuration drifted (aggregation/mapping) — meters are not auto-replaced; resolve manually",
    });
  }

  // ----------------------------------------------------------------- prices
  const lookupKeys = desired.prices.map((p) => p.lookupKey);
  // prices.list accepts at most 10 lookup_keys per call — chunk so a catalog
  // with more paid plans keeps working.
  const priceByLookupKey = new Map<string | null, Stripe.Price>();
  for (let i = 0; i < lookupKeys.length; i += 10) {
    const page = await stripe.prices.list({
      lookup_keys: lookupKeys.slice(i, i + 10),
      limit: 100,
    });
    for (const price of page.data) {
      priceByLookupKey.set(price.lookup_key, price);
    }
  }

  const requireMeterId = (): string => {
    if (!meter) {
      throw new Error(
        "Meter unresolved before metered price — apply order bug",
      );
    }
    return meter.id;
  };

  const createPriceParams = (
    want: DesiredPrice,
    transferLookupKey: boolean,
  ): Stripe.PriceCreateParams => {
    const productId = productIdByCatalogKey.get(want.productCatalogKey);
    if (!productId) {
      throw new Error(
        `Product ${want.productCatalogKey} unresolved — apply order bug`,
      );
    }
    return {
      product: productId,
      currency: want.currency,
      lookup_key: want.lookupKey,
      ...(transferLookupKey ? { transfer_lookup_key: true } : {}),
      ...(want.kind === "licensed"
        ? {
            unit_amount: want.unitAmountCents,
            recurring: { interval: want.interval, usage_type: "licensed" },
          }
        : {
            unit_amount_decimal: Stripe.Decimal.from(
              want.unitAmountDecimalCents,
            ),
            recurring: {
              interval: want.interval,
              usage_type: "metered" as const,
              meter: requireMeterId(),
            },
          }),
    };
  };

  for (const want of desired.prices) {
    const actual = priceByLookupKey.get(want.lookupKey);
    if (!actual) {
      note({
        action: "create",
        object: "price",
        identity: want.lookupKey,
        detail:
          want.kind === "licensed"
            ? `licensed $${(want.unitAmountCents / 100).toFixed(2)}/mo`
            : `metered ${want.unitAmountDecimalCents}¢/credit`,
      });
      if (APPLY) {
        await stripe.prices.create(createPriceParams(want, false));
      }
      continue;
    }

    const matches = priceMatches(actual, want, {
      productIdByCatalogKey,
      meterId: meter?.id,
    });
    if (!matches) {
      note({
        action: "replace",
        object: "price",
        identity: want.lookupKey,
        detail: `immutable drift on ${actual.id} — new price takes over the lookup key; old price deactivated (never mutated)`,
      });
      if (APPLY) {
        await stripe.prices.create(createPriceParams(want, true));
        await stripe.prices.update(actual.id, { active: false });
      }
    }
  }

  // Unknown catalog-prefixed prices (active, our prefix, not desired).
  await stripe.prices
    .list({ active: true, limit: 100 })
    .autoPagingEach((price) => {
      if (
        price.lookup_key?.startsWith(`${catalog.product}_`) &&
        !lookupKeys.includes(price.lookup_key)
      ) {
        note({
          action: "report",
          object: "price",
          identity: price.lookup_key,
          detail: `UNKNOWN catalog-prefixed price ${price.id} — not in the catalog; not touched`,
        });
      }
    });

  // ---------------------------------------------------------------- coupons
  // applies_to is only returned when expanded — without this every synced
  // coupon looks restriction-less and false-drifts into a new version.
  const actualCoupons: Stripe.Coupon[] = [];
  await stripe.coupons
    .list({ limit: 100, expand: ["data.applies_to"] })
    .autoPagingEach((coupon) => {
      actualCoupons.push(coupon);
    });
  const couponIdByPrefix = new Map<string, string>();

  for (const want of desired.coupons) {
    const versions = actualCoupons
      .filter((c) => couponVersion(c.id, want.idPrefix) > 0)
      .sort(
        (a, b) =>
          couponVersion(b.id, want.idPrefix) -
          couponVersion(a.id, want.idPrefix),
      );
    const latest = versions[0];

    if (latest && couponMatches(latest, want, { productIdByCatalogKey })) {
      couponIdByPrefix.set(want.idPrefix, latest.id);
      continue;
    }

    const nextVersion = latest
      ? couponVersion(latest.id, want.idPrefix) + 1
      : 1;
    const nextId = `${want.idPrefix}-v${nextVersion}`;
    note({
      action: latest ? "replace" : "create",
      object: "coupon",
      identity: nextId,
      detail: `${want.percentOff}% off, ${want.duration}${want.durationInMonths ? ` ${want.durationInMonths}mo` : ""}, base products only${latest ? ` (supersedes ${latest.id})` : ""}`,
    });
    couponIdByPrefix.set(want.idPrefix, nextId);
    if (APPLY) {
      const productIds = want.appliesToProductCatalogKeys
        .map((key) => productIdByCatalogKey.get(key))
        .filter((id): id is string => id !== undefined);
      await stripe.coupons.create({
        id: nextId,
        name: want.name,
        percent_off: want.percentOff,
        duration: want.duration,
        ...(want.durationInMonths !== undefined
          ? { duration_in_months: want.durationInMonths }
          : {}),
        applies_to: { products: productIds },
        ...(want.maxRedemptions !== undefined
          ? { max_redemptions: want.maxRedemptions }
          : {}),
        ...(want.redeemBy !== undefined
          ? { redeem_by: epochSeconds(want.redeemBy) }
          : {}),
      });
    }
  }

  // -------------------------------------------------------- promotion codes
  for (const want of desired.promotionCodes) {
    const targetCouponId = couponIdByPrefix.get(want.couponIdPrefix);
    const existing = await stripe.promotionCodes.list({
      code: want.code,
      limit: 10,
    });
    const active = existing.data.filter((pc) => pc.active);
    const couponIdOf = (pc: Stripe.PromotionCode): string | null => {
      const coupon = pc.promotion?.coupon;
      if (!coupon) {
        return null;
      }
      return typeof coupon === "string" ? coupon : coupon.id;
    };
    const onTarget = active.find((pc) => couponIdOf(pc) === targetCouponId);
    const strays = active.filter((pc) => pc !== onTarget);

    for (const stray of strays) {
      note({
        action: "deactivate",
        object: "promo",
        identity: want.code,
        detail: `active code points at stale coupon ${couponIdOf(stray) ?? "(unknown)"}`,
      });
      if (APPLY) {
        await stripe.promotionCodes.update(stray.id, { active: false });
      }
    }

    if (!onTarget && targetCouponId) {
      note({
        action: "create",
        object: "promo",
        identity: want.code,
        detail: `→ coupon ${targetCouponId}`,
      });
      if (APPLY) {
        await stripe.promotionCodes.create({
          promotion: { type: "coupon", coupon: targetCouponId },
          code: want.code,
        });
      }
    }
  }

  // ----------------------------------------------------------------- result
  const changes = planned.filter((p) => p.action !== "report");
  const reports = planned.filter((p) => p.action === "report");
  console.log(
    `\n${APPLY ? "Applied" : "Pending"}: ${changes.length} change(s), ${reports.length} report(s).`,
  );
  if (!APPLY && changes.length > 0) {
    console.log("Dry run with drift — run again with --apply.");
    process.exit(1);
  }
  if (changes.length === 0) {
    console.log("Zero drift. Stripe matches the catalog.");
  }
};

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
