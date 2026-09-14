import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeCreditPeriod,
  computeOverageDelta,
  shouldBlockUsage,
} from "../src/server/credits";
import { crossedThresholds } from "../src/server/usage-alerts";

describe("computeCreditPeriod", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("anchors on the Stripe billing period when now falls inside it", () => {
    const start = new Date("2026-07-15T00:00:00Z");
    const end = new Date("2026-08-15T00:00:00Z");
    const period = computeCreditPeriod(
      { currentPeriodStart: start, currentPeriodEnd: end },
      now,
    );
    assert.deepEqual(period, { start, end });
  });

  it("falls back to the UTC calendar month with no subscription row", () => {
    const period = computeCreditPeriod(undefined, now);
    assert.deepEqual(period.start, new Date("2026-07-01T00:00:00Z"));
    assert.deepEqual(period.end, new Date("2026-08-01T00:00:00Z"));
  });

  it("falls back to the calendar month when the anchor is stale", () => {
    // Stripe period ended and no webhook refreshed it yet (e.g. canceled sub).
    const period = computeCreditPeriod(
      {
        currentPeriodStart: new Date("2026-05-15T00:00:00Z"),
        currentPeriodEnd: new Date("2026-06-15T00:00:00Z"),
      },
      now,
    );
    assert.deepEqual(period.start, new Date("2026-07-01T00:00:00Z"));
    assert.deepEqual(period.end, new Date("2026-08-01T00:00:00Z"));
  });

  it("falls back when the anchor columns are null", () => {
    const period = computeCreditPeriod(
      { currentPeriodStart: null, currentPeriodEnd: null },
      now,
    );
    assert.deepEqual(period.start, new Date("2026-07-01T00:00:00Z"));
  });

  it("year rollover: December resolves to a January end", () => {
    const december = new Date("2026-12-05T00:00:00Z");
    const period = computeCreditPeriod(undefined, december);
    assert.deepEqual(period.start, new Date("2026-12-01T00:00:00Z"));
    assert.deepEqual(period.end, new Date("2027-01-01T00:00:00Z"));
  });
});

describe("computeOverageDelta", () => {
  it("is zero while under the allowance", () => {
    assert.equal(
      computeOverageDelta({
        usedAfter: 1000,
        allowance: 30000,
        amount: 50,
        hasOverage: true,
      }),
      0,
    );
  });

  it("is the whole amount once fully past the allowance", () => {
    assert.equal(
      computeOverageDelta({
        usedAfter: 30100,
        allowance: 30000,
        amount: 50,
        hasOverage: true,
      }),
      50,
    );
  });

  it("splits the amount when the call crosses the boundary", () => {
    // 29,980 before + 50 consumed = 30,030 after → 30 beyond the allowance.
    assert.equal(
      computeOverageDelta({
        usedAfter: 30030,
        allowance: 30000,
        amount: 50,
        hasOverage: true,
      }),
      30,
    );
  });

  it("is always zero for plans without metered overage", () => {
    assert.equal(
      computeOverageDelta({
        usedAfter: 6000,
        allowance: 5000,
        amount: 100,
        hasOverage: false,
      }),
      0,
    );
  });
});

describe("crossedThresholds", () => {
  const thresholds = [70, 90, 100] as const;

  it("detects a single crossing", () => {
    assert.deepEqual(
      crossedThresholds({
        usedBefore: 3400,
        usedAfter: 3600,
        allowance: 5000,
        thresholds,
      }),
      [70],
    );
  });

  it("detects a burst crossing several thresholds at once", () => {
    assert.deepEqual(
      crossedThresholds({
        usedBefore: 0,
        usedAfter: 5000,
        allowance: 5000,
        thresholds,
      }),
      [70, 90, 100],
    );
  });

  it("does not re-fire a threshold already passed", () => {
    assert.deepEqual(
      crossedThresholds({
        usedBefore: 3600,
        usedAfter: 3700,
        allowance: 5000,
        thresholds,
      }),
      [],
    );
  });

  it("fires exactly at the boundary", () => {
    assert.deepEqual(
      crossedThresholds({
        usedBefore: 3499,
        usedAfter: 3500,
        allowance: 5000,
        thresholds,
      }),
      [70],
    );
  });

  it("returns nothing for a zero allowance", () => {
    assert.deepEqual(
      crossedThresholds({
        usedBefore: 0,
        usedAfter: 10,
        allowance: 0,
        thresholds,
      }),
      [],
    );
  });
});

describe("shouldBlockUsage", () => {
  it("blocks a hard-stop plan at or past its allowance", () => {
    assert.equal(
      shouldBlockUsage({ hardStop: true, creditsUsed: 5000, allowance: 5000 }),
      true,
    );
    assert.equal(
      shouldBlockUsage({ hardStop: true, creditsUsed: 5100, allowance: 5000 }),
      true,
    );
  });

  it("never blocks under the allowance", () => {
    assert.equal(
      shouldBlockUsage({ hardStop: true, creditsUsed: 4999, allowance: 5000 }),
      false,
    );
  });

  it("never blocks overage plans regardless of usage", () => {
    assert.equal(
      shouldBlockUsage({
        hardStop: false,
        creditsUsed: 99999,
        allowance: 30000,
      }),
      false,
    );
  });

  it("reserves headroom for a known pending amount", () => {
    assert.equal(
      shouldBlockUsage(
        { hardStop: true, creditsUsed: 4999, allowance: 5000 },
        400,
      ),
      true,
    );
    assert.equal(
      shouldBlockUsage(
        { hardStop: true, creditsUsed: 4600, allowance: 5000 },
        400,
      ),
      true,
    );
    assert.equal(
      shouldBlockUsage(
        { hardStop: true, creditsUsed: 4599, allowance: 5000 },
        400,
      ),
      false,
    );
  });

  it("never blocks overage plans regardless of pending amount", () => {
    assert.equal(
      shouldBlockUsage(
        { hardStop: false, creditsUsed: 4999, allowance: 5000 },
        400,
      ),
      false,
    );
  });
});
