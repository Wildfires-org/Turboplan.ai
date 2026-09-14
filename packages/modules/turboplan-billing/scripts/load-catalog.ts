import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/**
 * Reads the catalog source files and merges them into the single document
 * that `pricingCatalogSchema` validates.
 *
 * - `catalog/pricing.yaml` — plans, seats, credits, discounts. Flows
 *   upstream → fork on every merge.
 * - `catalog/brand.yaml` — `product` and `meter_event_name`, the two values
 *   that name live Stripe objects. Fork-owned (`merge=ours`), so an upstream
 *   merge can never rename a fork's Stripe identity out from under it.
 *
 * The split is enforced: pricing.yaml declaring either brand key is an error,
 * otherwise a fork's override would be silently shadowed.
 */

const catalogDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "catalog",
);

export const PRICING_YAML_PATH = join(catalogDir, "pricing.yaml");
export const BRAND_YAML_PATH = join(catalogDir, "brand.yaml");

const BRAND_KEYS = ["product", "meter_event_name"];

// biome-ignore lint/suspicious/noExplicitAny: raw YAML — callers validate via validateCatalog
export const readCatalogSource = (): any => {
  const pricing = parse(readFileSync(PRICING_YAML_PATH, "utf8")) ?? {};
  const brand = parse(readFileSync(BRAND_YAML_PATH, "utf8")) ?? {};

  if ("product" in pricing) {
    throw new Error(
      "catalog/pricing.yaml must not declare `product` — it belongs in catalog/brand.yaml",
    );
  }
  if (pricing.billing && "meter_event_name" in pricing.billing) {
    throw new Error(
      "catalog/pricing.yaml must not declare `billing.meter_event_name` — it belongs in catalog/brand.yaml",
    );
  }
  const foreignBrandKeys = Object.keys(brand).filter(
    (key) => !BRAND_KEYS.includes(key),
  );
  if (foreignBrandKeys.length > 0) {
    throw new Error(
      `catalog/brand.yaml only accepts ${BRAND_KEYS.join(", ")}; found: ${foreignBrandKeys.join(", ")}`,
    );
  }

  return {
    product: brand.product,
    billing: { ...pricing.billing, meter_event_name: brand.meter_event_name },
  };
};
