import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";

import type { StoredLetterheadGrid } from "../src/schemas";
import { createMockDb } from "./helpers/mock-db";

const mockDb = createMockDb();

mock.module("../src/db-client", {
  namedExports: { db: mockDb.db },
});

const { getDefaultLetterheadGrid, setDefaultLetterheadGrid } = await import(
  "../src/queries/default-letterhead-grids"
);

const ORGANIZATION_ID = "00000000-0000-4000-8000-0000000000aa";
const OFFICE_ID = "00000000-0000-4000-8000-0000000000bb";

const GRID: StoredLetterheadGrid = {
  cells: [
    {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.15,
      key: "letterheads/project/doc/logo-0-abc.png",
    },
    {
      kind: "text",
      x: 0.2,
      width: 0.6,
      align: "left",
      lines: [{ text: "Example Agency", bold: true, size: "large" }],
    },
  ],
  color: null,
};
const PREVIOUS: StoredLetterheadGrid = { ...GRID, color: "#1f4e79" };

beforeEach(() => {
  mockDb.reset();
});

describe("getDefaultLetterheadGrid", () => {
  it("reads the owner's grid column by id", async () => {
    mockDb.setRows([{ grid: GRID }]);

    assert.deepStrictEqual(
      await getDefaultLetterheadGrid({ kind: "office", id: OFFICE_ID }),
      { grid: GRID },
    );
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'select "document_letterhead_grid" from "office" where "office"."id" = $1 limit $2',
    );
    assert.deepStrictEqual(params, [OFFICE_ID, 1]);
  });

  it("is null for an owner that does not exist", async () => {
    assert.strictEqual(
      await getDefaultLetterheadGrid({
        kind: "organization",
        id: ORGANIZATION_ID,
      }),
      null,
    );
  });
});

describe("setDefaultLetterheadGrid", () => {
  const UPDATE =
    'update "organization" set "document_letterhead_grid" = $1, "updated_at" = $2 where';

  it("writes unconditionally by id and returns the stored grid", async () => {
    mockDb.setRows([{ grid: GRID }]);

    const written = await setDefaultLetterheadGrid(
      { kind: "organization", id: ORGANIZATION_ID },
      GRID,
    );

    assert.deepStrictEqual(written, { grid: GRID });
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      `${UPDATE} "organization"."id" = $3 returning "document_letterhead_grid"`,
    );
    assert.deepStrictEqual(JSON.parse(String(params[0])), GRID);
    assert.strictEqual(params[2], ORGANIZATION_ID);
  });

  it("compares and sets on the jsonb it read, in the UPDATE itself", async () => {
    mockDb.setRows([{ grid: GRID }]);

    await setDefaultLetterheadGrid(
      { kind: "organization", id: ORGANIZATION_ID },
      GRID,
      { ifStored: { grid: PREVIOUS } },
    );

    // One statement: a second writer from the same read waits for the row
    // lock, re-checks this WHERE on the updated row and matches nothing.
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      `${UPDATE} ("organization"."id" = $3 and "organization"."document_letterhead_grid" = $4::jsonb) returning "document_letterhead_grid"`,
    );
    assert.strictEqual(params[2], ORGANIZATION_ID);
    assert.deepStrictEqual(JSON.parse(String(params[3])), PREVIOUS);
    assert.strictEqual(mockDb.builtCount(), 1);
  });

  it("compares with IS NULL when no grid was set", async () => {
    await setDefaultLetterheadGrid({ kind: "office", id: OFFICE_ID }, GRID, {
      ifStored: { grid: null },
    });

    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'update "office" set "document_letterhead_grid" = $1, "updated_at" = $2 where ("office"."id" = $3 and "office"."document_letterhead_grid" is null) returning "document_letterhead_grid"',
    );
    assert.strictEqual(params.length, 3);
  });

  it("is null when no row matched: the owner is gone or the grid changed", async () => {
    mockDb.setRows([]);

    assert.strictEqual(
      await setDefaultLetterheadGrid({ kind: "office", id: OFFICE_ID }, GRID, {
        ifStored: { grid: PREVIOUS },
      }),
      null,
    );
  });

  it("removes the grid with null", async () => {
    mockDb.setRows([{ grid: null }]);

    assert.deepStrictEqual(
      await setDefaultLetterheadGrid({ kind: "office", id: OFFICE_ID }, null),
      { grid: null },
    );
    assert.strictEqual(mockDb.lastQuery().params[0], null);
  });
});
