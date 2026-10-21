import { and, eq, isNull, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db } from "../db-client";
import { office, organization, type StoredLetterheadGrid } from "../schemas";

// The office or organization whose default letterhead grid
// (`document_letterhead_grid`) is read or written.
export type DefaultLetterheadGridOwner = {
  kind: "organization" | "office";
  id: string;
};

/**
 * The owner's stored default letterhead grid (null when none is set, raw
 * jsonb — callers validate it), or null when the owner does not exist.
 */
export const getDefaultLetterheadGrid = async (
  owner: DefaultLetterheadGridOwner,
): Promise<{ grid: StoredLetterheadGrid | null } | null> => {
  const [row] =
    owner.kind === "organization"
      ? await db
          .select({ grid: organization.documentLetterheadGrid })
          .from(organization)
          .where(eq(organization.id, owner.id))
          .limit(1)
      : await db
          .select({ grid: office.documentLetterheadGrid })
          .from(office)
          .where(eq(office.id, owner.id))
          .limit(1);

  return row ?? null;
};

export type SetDefaultLetterheadGridOptions = {
  /**
   * Compare-and-set: write only while the stored grid is still this value
   * (as `getDefaultLetterheadGrid` read it; null = none set). The condition
   * is part of the UPDATE's WHERE, so of two concurrent writes made from the
   * same read only the first applies — the second waits for the first's row
   * lock, re-checks the updated row and matches nothing.
   */
  ifStored?: { grid: unknown };
};

/**
 * Set (or, with null, remove) the owner's default letterhead grid and return
 * the grid as stored (jsonb read back). Null when the owner does not exist
 * or, with `ifStored`, its grid is no longer that value. While a grid is set
 * it is the default letterhead and the legacy layout/lines/contact/color
 * fields are ignored.
 */
export const setDefaultLetterheadGrid = async (
  owner: DefaultLetterheadGridOwner,
  grid: StoredLetterheadGrid | null,
  { ifStored }: SetDefaultLetterheadGridOptions = {},
): Promise<{ grid: StoredLetterheadGrid | null } | null> => {
  const values = { documentLetterheadGrid: grid, updatedAt: new Date() };
  // jsonb equality is semantic (key order and spacing do not matter).
  // Only JS writes this column, so a read number re-serialises to its digits.
  const unchangedSince = (column: PgColumn) =>
    ifStored === undefined
      ? undefined
      : ifStored.grid === null
        ? isNull(column)
        : sql`${column} = ${JSON.stringify(ifStored.grid)}::jsonb`;

  const rows =
    owner.kind === "organization"
      ? await db
          .update(organization)
          .set(values)
          .where(
            and(
              eq(organization.id, owner.id),
              unchangedSince(organization.documentLetterheadGrid),
            ),
          )
          .returning({ grid: organization.documentLetterheadGrid })
      : await db
          .update(office)
          .set(values)
          .where(
            and(
              eq(office.id, owner.id),
              unchangedSince(office.documentLetterheadGrid),
            ),
          )
          .returning({ grid: office.documentLetterheadGrid });

  return rows[0] ?? null;
};
