import assert from "node:assert";
import { describe, it } from "node:test";

import {
  EXTRACTION_POLL_INTERVAL_MS,
  EXTRACTION_POLL_TIMEOUT_MS,
  EXTRACTION_SLOW_POLL_INTERVAL_MS,
  EXTRACTION_STALE_AFTER_MS,
  getExtractionAgeMs,
  getExtractionPollIntervalForAge,
  getMsUntilExtractionStale,
  getMsUntilStale,
  getPendingExtractionPollInterval,
  isExtractionStale,
  trackPendingSince,
} from "@wildfires-org/turboplan-documents/types";

const NOW = Date.parse("2026-10-02T12:00:00.000Z");
const MINUTE = 60_000;
const FRESH = new Date(NOW - 10_000).toISOString();
const STALE = new Date(NOW - 3 * MINUTE).toISOString();

const pendingDoc = (id: string) => ({
  id,
  extractionStatus: "pending" as const,
});

describe("extraction staleness", () => {
  it("marks only pending documents older than the threshold as stale", () => {
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "pending", createdAt: FRESH }, NOW),
      false,
    );
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "pending", createdAt: STALE }, NOW),
      true,
    );
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "done", createdAt: STALE }, NOW),
      false,
    );
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "pending", createdAt: "bad" }, NOW),
      false,
    );
  });

  it("never waits longer than the threshold, whatever the clock skew", () => {
    const future = new Date(NOW + 10 * MINUTE).toISOString();
    assert.strictEqual(getExtractionAgeMs(future, NOW), 0);
    assert.strictEqual(
      getMsUntilExtractionStale(future, NOW),
      EXTRACTION_STALE_AFTER_MS,
    );
    assert.strictEqual(getExtractionAgeMs("bad", NOW), null);
    assert.strictEqual(
      getMsUntilStale(NOW + 10 * MINUTE, NOW),
      EXTRACTION_STALE_AFTER_MS,
    );
    assert.strictEqual(
      getMsUntilStale(NOW - 10_000, NOW),
      EXTRACTION_STALE_AFTER_MS - 10_000,
    );
    assert.strictEqual(getMsUntilStale(NOW - 3 * MINUTE, NOW), 0);
    assert.strictEqual(
      getMsUntilStale(Number.NaN, NOW),
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("extraction poll schedule", () => {
  it("is fast while fresh, slow once stale, off after the timeout", () => {
    assert.strictEqual(
      getExtractionPollIntervalForAge(0),
      EXTRACTION_POLL_INTERVAL_MS,
    );
    assert.strictEqual(
      getExtractionPollIntervalForAge(EXTRACTION_STALE_AFTER_MS),
      EXTRACTION_SLOW_POLL_INTERVAL_MS,
    );
    assert.strictEqual(
      getExtractionPollIntervalForAge(EXTRACTION_POLL_TIMEOUT_MS - 1),
      EXTRACTION_SLOW_POLL_INTERVAL_MS,
    );
    assert.strictEqual(
      getExtractionPollIntervalForAge(EXTRACTION_POLL_TIMEOUT_MS),
      0,
    );
  });

  it("polls for the freshest pending document, timed by the client", () => {
    const pendingSince = new Map([
      ["stale", NOW - 3 * MINUTE],
      ["fresh", NOW - 10_000],
      ["old", NOW - 20 * MINUTE],
    ]);
    assert.strictEqual(
      getPendingExtractionPollInterval(
        [
          pendingDoc("stale"),
          pendingDoc("fresh"),
          { id: "done", extractionStatus: "done" },
        ],
        pendingSince,
        NOW,
      ),
      EXTRACTION_POLL_INTERVAL_MS,
    );
    assert.strictEqual(
      getPendingExtractionPollInterval(
        [pendingDoc("stale")],
        pendingSince,
        NOW,
      ),
      EXTRACTION_SLOW_POLL_INTERVAL_MS,
    );
    // Bounded by the client clock: 20 minutes seen pending, polling stops.
    assert.strictEqual(
      getPendingExtractionPollInterval([pendingDoc("old")], pendingSince, NOW),
      0,
    );
    // Not tracked yet: counts as just seen.
    assert.strictEqual(
      getPendingExtractionPollInterval([pendingDoc("new")], pendingSince, NOW),
      EXTRACTION_POLL_INTERVAL_MS,
    );
    assert.strictEqual(
      getPendingExtractionPollInterval(
        [{ id: "failed", extractionStatus: "failed" }],
        pendingSince,
        NOW,
      ),
      0,
    );
  });
});

describe("trackPendingSince", () => {
  it("stamps newly pending documents and keeps earlier stamps", () => {
    const first = trackPendingSince(new Map(), [pendingDoc("a")], NOW);
    assert.deepStrictEqual(Array.from(first), [["a", NOW]]);

    const second = trackPendingSince(
      first,
      [pendingDoc("a"), pendingDoc("b")],
      NOW + 5000,
    );
    assert.deepStrictEqual(Array.from(second), [
      ["a", NOW],
      ["b", NOW + 5000],
    ]);
  });

  it("drops documents that are no longer pending", () => {
    const tracked = new Map([
      ["a", NOW],
      ["b", NOW],
    ]);
    const next = trackPendingSince(
      tracked,
      [pendingDoc("a"), { id: "b", extractionStatus: "done" }],
      NOW + 5000,
    );
    assert.deepStrictEqual(Array.from(next), [["a", NOW]]);
  });

  it("returns the same map when nothing changed", () => {
    const tracked = new Map([["a", NOW]]);
    assert.strictEqual(
      trackPendingSince(tracked, [pendingDoc("a")], NOW + 5000),
      tracked,
    );
    const empty = new Map<string, number>();
    assert.strictEqual(trackPendingSince(empty, undefined, NOW), empty);
    assert.strictEqual(
      trackPendingSince(empty, [{ id: "a", extractionStatus: "done" }], NOW),
      empty,
    );
  });
});
