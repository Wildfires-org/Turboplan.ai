import assert from "node:assert";
import { describe, it } from "node:test";

import {
  formatRelativeTime,
  getMemoryDeleteError,
  getSavedOrganizationMemory,
  removeMemory,
  restoreMemory,
} from "../lib/organization-memories";
import type { OrganizationMemory } from "../types/organization-context";

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(NOW - ms).toISOString();

const makeMemory = (
  id: string,
  createdAt: string,
  content = `Note ${id}`,
): OrganizationMemory => ({ id, content, createdAt, createdBy: "user-1" });

describe("removeMemory", () => {
  it("drops the memory and keeps the rest in order", () => {
    const current = {
      memories: [
        makeMemory("c", ago(MINUTE)),
        makeMemory("b", ago(HOUR)),
        makeMemory("a", ago(DAY)),
      ],
    };

    const next = removeMemory(current, "b");

    assert.deepStrictEqual(
      next?.memories.map((memory) => memory.id),
      ["c", "a"],
    );
    assert.strictEqual(current.memories.length, 3, "does not mutate");
  });

  it("leaves a list that has not loaded alone", () => {
    assert.strictEqual(removeMemory(undefined, "a"), undefined);
  });
});

describe("restoreMemory", () => {
  it("puts the memory back in its newest-first place", () => {
    const restored = makeMemory("b", ago(HOUR));
    const current = {
      memories: [makeMemory("c", ago(MINUTE)), makeMemory("a", ago(DAY))],
    };

    assert.deepStrictEqual(
      restoreMemory(current, restored)?.memories.map((memory) => memory.id),
      ["c", "b", "a"],
    );
  });

  it("orders memories saved at the same time by id, like the API", () => {
    const createdAt = ago(HOUR);
    const current = { memories: [makeMemory("b", createdAt)] };

    assert.deepStrictEqual(
      restoreMemory(current, makeMemory("c", createdAt))?.memories.map(
        (memory) => memory.id,
      ),
      ["c", "b"],
    );
  });

  it("does not add a memory that is already listed", () => {
    const memory = makeMemory("a", ago(HOUR));
    const current = { memories: [memory] };

    assert.strictEqual(restoreMemory(current, memory), current);
  });

  it("leaves a list that has not loaded alone", () => {
    assert.strictEqual(
      restoreMemory(undefined, makeMemory("a", ago(HOUR))),
      undefined,
    );
  });
});

describe("getMemoryDeleteError", () => {
  it("treats a note deleted meanwhile (404) as deleted", () => {
    assert.strictEqual(getMemoryDeleteError(404), null);
  });

  it("explains a 403, which is also the answer for an unknown note", () => {
    assert.match(getMemoryDeleteError(403) ?? "", /already be deleted/);
  });

  it("asks to retry anything else, network errors included", () => {
    assert.strictEqual(
      getMemoryDeleteError(500),
      "Could not delete the note. Try again.",
    );
    assert.strictEqual(
      getMemoryDeleteError(null),
      "Could not delete the note. Try again.",
    );
  });
});

describe("formatRelativeTime", () => {
  it("says just now under a minute, and for a date in the future", () => {
    assert.strictEqual(formatRelativeTime(ago(30_000), NOW), "just now");
    assert.strictEqual(formatRelativeTime(ago(-5 * MINUTE), NOW), "just now");
  });

  it("uses the largest whole unit", () => {
    assert.strictEqual(
      formatRelativeTime(ago(5 * MINUTE), NOW),
      "5 minutes ago",
    );
    assert.strictEqual(formatRelativeTime(ago(3 * HOUR), NOW), "3 hours ago");
    assert.strictEqual(formatRelativeTime(ago(DAY + HOUR), NOW), "yesterday");
    assert.strictEqual(formatRelativeTime(ago(3 * DAY), NOW), "3 days ago");
    assert.strictEqual(formatRelativeTime(ago(8 * DAY), NOW), "last week");
    assert.strictEqual(formatRelativeTime(ago(21 * DAY), NOW), "3 weeks ago");
    assert.strictEqual(formatRelativeTime(ago(65 * DAY), NOW), "2 months ago");
    assert.strictEqual(formatRelativeTime(ago(400 * DAY), NOW), "last year");
  });

  it("returns null for a date that does not parse", () => {
    assert.strictEqual(formatRelativeTime("not a date", NOW), null);
  });
});

describe("getSavedOrganizationMemory", () => {
  const output = {
    status: "saved",
    memory: { id: "memory-1", content: "We use CEQA" },
    organizationName: "Pine Ridge Fire District",
  };

  it("reads a saved and an already saved note", () => {
    assert.deepStrictEqual(getSavedOrganizationMemory(output), output);
    assert.deepStrictEqual(
      getSavedOrganizationMemory({ ...output, status: "already_saved" }),
      { ...output, status: "already_saved" },
    );
  });

  it("keeps only the fields the card uses", () => {
    assert.deepStrictEqual(
      getSavedOrganizationMemory({
        ...output,
        memory: { ...output.memory, createdAt: "2026-10-06" },
        extra: true,
      }),
      output,
    );
  });

  it("returns null for an error output", () => {
    assert.strictEqual(
      getSavedOrganizationMemory({ error: "Memory is full" }),
      null,
    );
  });

  it("returns null for malformed history", () => {
    assert.strictEqual(getSavedOrganizationMemory(undefined), null);
    assert.strictEqual(getSavedOrganizationMemory("saved"), null);
    assert.strictEqual(
      getSavedOrganizationMemory({ ...output, status: "created" }),
      null,
    );
    assert.strictEqual(
      getSavedOrganizationMemory({ ...output, memory: null }),
      null,
    );
    assert.strictEqual(
      getSavedOrganizationMemory({
        ...output,
        memory: { id: 1, content: "x" },
      }),
      null,
    );
    assert.strictEqual(
      getSavedOrganizationMemory({ ...output, organizationName: undefined }),
      null,
    );
  });
});
