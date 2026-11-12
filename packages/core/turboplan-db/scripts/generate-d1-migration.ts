/**
 * Writes the next D1 migration from the pg-core schema.
 *
 *   pnpm --filter @wildfires-org/turboplan-db d1:generate [name]
 *
 * With no migrations yet it writes the whole schema as `0000_init.sql`. After
 * that it adds what SQLite can change in place (new tables, columns and
 * indexes; dropped or changed indexes) as `NNNN_<name>.sql`, and fails on
 * anything else (a changed or removed column, key or check), which needs a
 * hand-written table-rebuild migration.
 */

import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  planD1Migration,
  readD1Migrations,
  renderD1Migration,
} from "../src/d1/migration-plan";
import * as schema from "../src/schemas";

const directory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/migrations-d1",
);

const main = async () => {
  const existing = await readD1Migrations(directory);
  const plan = await planD1Migration(schema, existing);

  if (plan.problems.length > 0) {
    console.error(
      "The schema changed in ways SQLite cannot apply in place. Write the\n" +
        "migration by hand (create the new table, copy, drop, rename):\n",
    );
    for (const problem of plan.problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
  if (plan.statements.length === 0) {
    console.log("D1 migrations are up to date with the schema.");
    return;
  }

  const index = String(existing.length).padStart(4, "0");
  const name =
    existing.length === 0 ? "init" : (process.argv[2] ?? "schema_update");
  const file = join(directory, `${index}_${name.replace(/[^\w-]+/g, "_")}.sql`);
  const skipped =
    existing.length === 0
      ? plan.tables.flatMap((table) =>
          table.skippedIndexes.map(
            (index) =>
              `Not on D1: ${table.name}.${index.name} (${index.reason}, no SQLite equivalent).`,
          ),
        )
      : [];
  await writeFile(file, renderD1Migration(plan.statements, skipped));
  console.log(`Wrote ${file} (${plan.statements.length} statements).`);
};

await main();
