import { sql } from "drizzle-orm";

import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  countOrganizationMemories,
  createOrganizationMemory,
  findOrganizationMemoryByContent,
} from "@wildfires-org/turboplan-db/queries";
import type { OrganizationMemory as OrganizationMemoryRow } from "@wildfires-org/turboplan-db/types";

import {
  ORGANIZATION_MEMORIES_MAX,
  ORGANIZATION_MEMORY_MAX_CHARS,
  type OrganizationMemory,
} from "../../types";

/**
 * Outcome of {@link saveOrganizationMemory}:
 * - "created": a new memory was stored
 * - "duplicate": the organization already has this note (case-insensitive);
 *   `memory` is the existing one and nothing was written
 * - "full": the organization holds `ORGANIZATION_MEMORIES_MAX` memories
 * - "empty": nothing left after normalising the content
 * - "too_long": longer than `ORGANIZATION_MEMORY_MAX_CHARS` after normalising
 */
export type SaveOrganizationMemoryResult =
  | { status: "created"; memory: OrganizationMemory }
  | { status: "duplicate"; memory: OrganizationMemory }
  | { status: "full" }
  | { status: "empty" }
  | { status: "too_long" };

/**
 * Trim the note, strip trailing whitespace from each line and collapse runs of
 * blank lines into one. Line breaks are otherwise kept.
 */
export const normalizeOrganizationMemoryContent = (content: string): string =>
  content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const toOrganizationMemory = ({
  id,
  content,
  createdAt,
  createdBy,
}: OrganizationMemoryRow): OrganizationMemory => ({
  id,
  content,
  createdAt,
  createdBy,
});

/**
 * Save a short note to the organization's memory, for the chat tool.
 *
 * Does NOT check RBAC: the caller must already have verified that `userId`
 * may add memories to `organizationId`.
 *
 * Business outcomes (empty, too long, duplicate, full) are returned, never
 * thrown; only database errors throw. Saves for one organization are
 * serialized with a transaction-scoped advisory lock, so the duplicate check
 * and the `ORGANIZATION_MEMORIES_MAX` cap hold under parallel tool calls.
 */
export const saveOrganizationMemory = async ({
  organizationId,
  userId,
  content,
}: {
  organizationId: string;
  userId: string;
  content: string;
}): Promise<SaveOrganizationMemoryResult> => {
  const normalizedContent = normalizeOrganizationMemoryContent(content);
  if (!normalizedContent) {
    return { status: "empty" };
  }
  if (normalizedContent.length > ORGANIZATION_MEMORY_MAX_CHARS) {
    return { status: "too_long" };
  }

  return db.transaction(async (tx) => {
    // Released automatically at commit or rollback.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`organization-memory:${organizationId}`}, 0))`,
    );

    const existing = await findOrganizationMemoryByContent(
      organizationId,
      normalizedContent,
      tx,
    );
    if (existing) {
      return { status: "duplicate", memory: toOrganizationMemory(existing) };
    }

    const memoryCount = await countOrganizationMemories(organizationId, tx);
    if (memoryCount >= ORGANIZATION_MEMORIES_MAX) {
      return { status: "full" };
    }

    const created = await createOrganizationMemory(
      { organizationId, content: normalizedContent, createdBy: userId },
      tx,
    );
    return { status: "created", memory: toOrganizationMemory(created) };
  });
};
