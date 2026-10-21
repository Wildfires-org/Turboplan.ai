import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { describe, it, mock } from "node:test";
import { sql } from "drizzle-orm";

import type { DbInstance } from "../src/db-client";
import type { StoredLetterheadGrid } from "../src/schemas";

// Opt-in, against a real Postgres: runs only when TEST_POSTGRES_URL is set
// (a database migrated through 0012), each case inside BEGIN … ROLLBACK on
// the test client's single connection, so nothing is left behind. What the
// mocked-SQL tests cannot show: how a jsonb grid and a `timestamp` version
// round-trip through drizzle and the driver into the compare-and-set writes.
const run = process.env.TEST_POSTGRES_URL ? it : it.skip;

// The queries' `db`, pointed at the open test transaction.
let testDb: DbInstance | null = null;
mock.module("../src/db-client", {
  namedExports: {
    db: new Proxy({} as DbInstance, {
      get: (_, prop) => {
        if (!testDb) {
          throw new Error("No test database connection");
        }
        return testDb[prop as keyof DbInstance];
      },
    }),
  },
});

const { getDefaultLetterheadGrid, setDefaultLetterheadGrid } = await import(
  "../src/queries/default-letterhead-grids"
);
const {
  getDocumentOwnLetterhead,
  updateDocumentOwnLetterhead,
  upsertDocumentOwnLetterhead,
} = await import("../src/queries/document-letterheads");
const { office, organization, user } = await import("../src/schemas");
const { createTestDB } = await import("../src/db-client/connection");

const inRolledBackTransaction = async (
  body: (db: DbInstance) => Promise<void>,
): Promise<void> => {
  const connection = createTestDB();
  testDb = connection.db;
  try {
    await connection.db.execute(sql`BEGIN`);
    await body(connection.db);
  } finally {
    await connection.db.execute(sql`ROLLBACK`).catch(() => {});
    testDb = null;
    await connection.close();
  }
};

// Written with its keys in the reverse of the type's order and a width that
// is not exactly representable: jsonb stores its own key order and the
// number's shortest round-trip digits.
const grid = {
  color: null,
  cells: [
    {
      lines: [{ size: "normal", bold: true, text: "Example Agency" }],
      align: "left",
      width: 0.1 + 0.2,
      x: 0.6,
      kind: "text",
    },
  ],
} as StoredLetterheadGrid;

const edited: StoredLetterheadGrid = { ...grid, color: "#1f4e79" };

describe("letterhead compare-and-set writes against Postgres", () => {
  run(
    "an organization's or office's grid: applies once to what was read, then never again",
    async () => {
      await inRolledBackTransaction(async (db) => {
        const now = new Date();
        const [owner] = await db
          .insert(user)
          .values({ email: "letterhead-cas@example.test" })
          .returning({ id: user.id });
        const [org] = await db
          .insert(organization)
          .values({
            slug: `letterhead-cas-${randomUUID()}`,
            name: "Letterhead CAS",
            createdBy: owner.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: organization.id });
        const [officeRow] = await db
          .insert(office)
          .values({
            slug: "letterhead-cas",
            organizationId: org.id,
            name: "Letterhead CAS",
            createdBy: owner.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: office.id });

        for (const owner of [
          { kind: "organization" as const, id: org.id },
          { kind: "office" as const, id: officeRow.id },
        ]) {
          // None set yet: the IS NULL branch.
          assert.ok(
            await setDefaultLetterheadGrid(owner, grid, {
              ifStored: { grid: null },
            }),
            `${owner.kind}: first write over none`,
          );
          assert.strictEqual(
            await setDefaultLetterheadGrid(owner, grid, {
              ifStored: { grid: null },
            }),
            null,
            `${owner.kind}: second write over none`,
          );

          const read = await getDefaultLetterheadGrid(owner);
          const cell = read?.grid?.cells[0];
          assert.strictEqual(
            cell?.kind === "text" ? cell.width : null,
            0.1 + 0.2,
          );

          assert.ok(
            await setDefaultLetterheadGrid(owner, edited, {
              ifStored: { grid: read?.grid ?? null },
            }),
            `${owner.kind}: write over what was read`,
          );
          assert.strictEqual(
            await setDefaultLetterheadGrid(owner, grid, {
              ifStored: { grid: read?.grid ?? null },
            }),
            null,
            `${owner.kind}: second write over what was read`,
          );
        }
      });
    },
  );

  run(
    "a document's copy: its version (updated_at) round-trips under a non-UTC session",
    async () => {
      await inRolledBackTransaction(async (db) => {
        await db.execute(sql`SET LOCAL TimeZone = 'America/Los_Angeles'`);
        const documentId = randomUUID();
        await upsertDocumentOwnLetterhead({
          documentId,
          letterhead: grid,
          referenceFilename: "reference.pdf",
          updatedBy: null,
        });

        const row = await getDocumentOwnLetterhead(documentId);
        assert.ok(row);
        // The version only changes when the clock does (millisecond token).
        await new Promise((resolve) => setTimeout(resolve, 5));

        const next = await updateDocumentOwnLetterhead({
          documentId,
          letterhead: edited,
          updatedBy: null,
          expectedUpdatedAt: row.updatedAt,
        });
        assert.ok(next instanceof Date);
        assert.ok(next.getTime() > row.updatedAt.getTime());

        assert.strictEqual(
          await updateDocumentOwnLetterhead({
            documentId,
            letterhead: grid,
            updatedBy: null,
            expectedUpdatedAt: row.updatedAt,
          }),
          null,
        );
      });
    },
  );
});
