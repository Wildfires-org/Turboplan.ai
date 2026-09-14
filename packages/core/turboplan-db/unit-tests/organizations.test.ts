import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { OrganizationStatus, OrganizationType } from "../src/schemas";

// --- Mutable per-test state read by the chainable db mock below ---
let rowsFixture: unknown[] = [];
let capturedWhere: SQL | undefined;
let shouldThrow: Error | null = null;

// A chainable, awaitable stand-in for the drizzle query builder. Every builder
// method returns the same object; awaiting it resolves to `rowsFixture` (or
// rejects with `shouldThrow`). `where` records its argument so the generated SQL
// can be inspected.
const select = mock.fn(() => builder);
const from = mock.fn(() => builder);
const where = mock.fn((arg: SQL) => {
  capturedWhere = arg;
  return builder;
});
const orderBy = mock.fn(() => builder);

const builder = {
  select,
  from,
  where,
  orderBy,
  then(
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) {
    if (shouldThrow) {
      return Promise.reject(shouldThrow).then(resolve, reject);
    }
    return Promise.resolve(rowsFixture).then(resolve, reject);
  },
};

mock.module("../src/db-client", {
  namedExports: { db: builder },
});

const { getActiveOrganizationsWithEmailDomains, getOrganizationById } =
  await import("../src/queries/organizations");

const dialect = new PgDialect();

beforeEach(() => {
  rowsFixture = [];
  capturedWhere = undefined;
  shouldThrow = null;
  select.mock.resetCalls();
  from.mock.resetCalls();
  where.mock.resetCalls();
  orderBy.mock.resetCalls();
});

describe("getActiveOrganizationsWithEmailDomains", () => {
  it("filters by active status and the two participating org types", async () => {
    rowsFixture = [];
    await getActiveOrganizationsWithEmailDomains();

    assert.strictEqual(select.mock.callCount(), 1);
    assert.strictEqual(from.mock.callCount(), 1);
    assert.strictEqual(where.mock.callCount(), 1);
    assert.strictEqual(orderBy.mock.callCount(), 1);

    assert.ok(capturedWhere, "expected a where clause to be captured");
    const query = dialect.sqlToQuery(capturedWhere);

    assert.deepStrictEqual(query.params, [
      OrganizationStatus.ACTIVE,
      OrganizationType.GOVERNMENT,
      OrganizationType.ENVIRONMENTAL_PLANNER,
    ]);
    assert.match(query.sql, /"status"/);
    assert.match(query.sql, /"type"/);
    assert.match(query.sql, /in \(/);
  });

  it("returns the queried rows", async () => {
    const rows = [
      {
        id: "o1",
        name: "US Forest Service",
        shortName: "USFS",
        slug: "usfs",
        type: OrganizationType.GOVERNMENT,
        emailDomains: ["usda.gov"],
      },
      {
        id: "o2",
        name: "Jacobs",
        shortName: "Jacobs",
        slug: "jacobs",
        type: OrganizationType.ENVIRONMENTAL_PLANNER,
        emailDomains: ["jacobs.com"],
      },
    ];
    rowsFixture = rows;

    const result = await getActiveOrganizationsWithEmailDomains();
    assert.deepStrictEqual(result, rows);
  });

  it("rethrows database errors", async (t) => {
    t.mock.method(console, "error", () => {});
    shouldThrow = new Error("connection refused");

    await assert.rejects(
      () => getActiveOrganizationsWithEmailDomains(),
      /connection refused/,
    );
  });
});

describe("getOrganizationById", () => {
  it("filters by the given id", async () => {
    rowsFixture = [{ id: "org-42" }];
    await getOrganizationById("org-42");

    assert.strictEqual(where.mock.callCount(), 1);
    assert.ok(capturedWhere, "expected a where clause to be captured");
    const query = dialect.sqlToQuery(capturedWhere);
    assert.deepStrictEqual(query.params, ["org-42"]);
    assert.match(query.sql, /"id"/);
  });

  it("returns the row when found", async () => {
    const org = { id: "org-42", name: "Some Org" };
    rowsFixture = [org];

    const result = await getOrganizationById("org-42");
    assert.deepStrictEqual(result, org);
  });

  it("returns null when no row matches", async () => {
    rowsFixture = [];
    const result = await getOrganizationById("missing");
    assert.strictEqual(result, null);
  });

  it("rethrows database errors", async (t) => {
    t.mock.method(console, "error", () => {});
    shouldThrow = new Error("query timeout");

    await assert.rejects(() => getOrganizationById("org-42"), /query timeout/);
  });
});
