import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateCatalog } from "./catalog-schema";
import { readCatalogSource } from "./load-catalog";

/**
 * Compiles catalog/pricing.yaml + catalog/brand.yaml into
 * src/generated/catalog.ts.
 *
 * The output is a checked-in TS module because apps/server and apps/mcp-server
 * run on Cloudflare Workers with no filesystem at runtime, and the Next.js
 * apps consume the catalog client-side. `--check` regenerates in memory and
 * exits non-zero on drift so CI catches a YAML edit without a regenerate.
 *
 * The generated file is excluded from Biome (biome.jsonc) so its content is a
 * pure function of the YAML — byte-for-byte reproducible.
 */

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(packageRoot, "src", "generated", "catalog.ts");

const buildModule = (): string => {
  const catalog = validateCatalog(readCatalogSource());
  return [
    "// GENERATED FILE — DO NOT EDIT BY HAND.",
    "// Source of truth: catalog/pricing.yaml + catalog/brand.yaml.",
    "// Regenerate: pnpm --filter @wildfires-org/turboplan-billing generate:catalog",
    "",
    `export const CATALOG = ${JSON.stringify(catalog, null, 2)} as const;`,
    "",
    "export type Catalog = typeof CATALOG;",
    'export type CatalogPlan = Catalog["billing"]["plans"][number];',
    "",
  ].join("\n");
};

const main = () => {
  const isCheck = process.argv.includes("--check");
  const next = buildModule();
  const current = existsSync(outputPath)
    ? readFileSync(outputPath, "utf8")
    : null;

  if (isCheck) {
    if (current !== next) {
      console.error(
        `Catalog drift: ${outputPath} is stale.\n` +
          "Run: pnpm --filter @wildfires-org/turboplan-billing generate:catalog",
      );
      process.exit(1);
    }
    console.log("Catalog up to date.");
    return;
  }

  if (current === next) {
    console.log("Catalog unchanged.");
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, next);
  console.log(`Wrote ${outputPath}`);
};

main();
