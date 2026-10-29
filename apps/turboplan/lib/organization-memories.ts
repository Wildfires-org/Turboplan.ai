// Logic for organization memories (the notes the chat assistant saves to an
// organization), kept free of React so it can be unit tested: optimistic list
// updates, delete errors, relative dates and reading the chat tool's output.

import type {
  OrganizationMemoriesResponse,
  OrganizationMemory,
  SaveOrganizationMemoryToolOutput,
} from "../types/organization-context";

export type SavedOrganizationMemory = Extract<
  SaveOrganizationMemoryToolOutput,
  { status: string }
>;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Largest unit first: a note is "3 weeks ago", not "21 days ago".
const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", HOUR_MS],
  ["minute", MINUTE_MS],
];

const relativeTimeFormat = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

/** The API's order: newest first, then by id (as `listOrganizationMemories`). */
const compareMemories = (a: OrganizationMemory, b: OrganizationMemory) => {
  const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (byDate !== 0) {
    return byDate;
  }
  return b.id.localeCompare(a.id);
};

/** The list without `memoryId`; nothing to change while it has not loaded. */
export const removeMemory = (
  current: OrganizationMemoriesResponse | undefined,
  memoryId: string,
): OrganizationMemoriesResponse | undefined => {
  if (!current) {
    return current;
  }
  return {
    memories: current.memories.filter((memory) => memory.id !== memoryId),
  };
};

/** Puts a memory back in its place after a failed delete (no duplicates). */
export const restoreMemory = (
  current: OrganizationMemoriesResponse | undefined,
  memory: OrganizationMemory,
): OrganizationMemoriesResponse | undefined => {
  if (!current) {
    return current;
  }
  if (current.memories.some((item) => item.id === memory.id)) {
    return current;
  }
  return { memories: [...current.memories, memory].sort(compareMemories) };
};

/**
 * What to tell the user when `DELETE /api/organization-memories/:id` fails,
 * by HTTP status; null when the note is gone anyway (404, deleted meanwhile).
 * A 403 is also what the API answers for a note that no longer exists.
 */
export const getMemoryDeleteError = (status: number | null): string | null => {
  if (status === 404) {
    return null;
  }
  if (status === 403) {
    return "Could not delete the note. It may already be deleted, or you no longer have permission.";
  }
  return "Could not delete the note. Try again.";
};

/**
 * "just now", "5 minutes ago", "yesterday", "last week", "3 months ago"...;
 * null when the date does not parse. A date in the future (clock skew) reads
 * as "just now".
 */
export const formatRelativeTime = (isoDate: string, now: number) => {
  const time = Date.parse(isoDate);
  if (Number.isNaN(time)) {
    return null;
  }
  const elapsed = now - time;
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (elapsed >= unitMs) {
      return relativeTimeFormat.format(-Math.floor(elapsed / unitMs), unit);
    }
  }
  return "just now";
};

/**
 * The saved note from a `saveOrganizationMemory` tool output, or null for an
 * `{ error }` output or anything malformed (outputs are read back from chat
 * history, so their shape is not guaranteed).
 */
export const getSavedOrganizationMemory = (
  output: unknown,
): SavedOrganizationMemory | null => {
  if (!output || typeof output !== "object") {
    return null;
  }
  const { status, memory, organizationName } = output as Record<
    string,
    unknown
  >;
  if (status !== "saved" && status !== "already_saved") {
    return null;
  }
  if (!memory || typeof memory !== "object") {
    return null;
  }
  const { id, content } = memory as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    typeof content !== "string" ||
    typeof organizationName !== "string"
  ) {
    return null;
  }
  return { status, memory: { id, content }, organizationName };
};
