import assert from "node:assert";
import { describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { createRateLimiter, extractClientIp } from "../src/rate-limit";

/**
 * Builds a header getter over a plain record, matching the case-insensitive
 * lookup every framework adapter provides.
 */
const headerGetter = (headers: Record<string, string>) => {
  const lower = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return (name: string) => lower.get(name.toLowerCase()) ?? null;
};

const ipForHeaders = (headers: Record<string, string>): string =>
  extractClientIp(headerGetter(headers));

/**
 * `cf-connecting-ip` is only trustworthy on Cloudflare, which the code detects
 * via WORKER_RUNTIME. Runs `fn` with that flag forced on.
 */
const onCloudflare = <T>(fn: () => T): T => {
  const previous = process.env.WORKER_RUNTIME;
  process.env.WORKER_RUNTIME = "true";
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.WORKER_RUNTIME;
    } else {
      process.env.WORKER_RUNTIME = previous;
    }
  }
};

/**
 * Builds a limiter with a stubbed `Date.now`, so the inline sweep (the limiter
 * has no timer — Workers forbid global-scope setInterval) can be driven
 * deterministically instead of waited on.
 */
const createLimiterWithFakeClock = (options: {
  maxRequests: number;
  windowMs: number;
  startAt: number;
}) => {
  const realNow = Date.now;

  let now = options.startAt;
  Date.now = () => now;

  const limiter = createRateLimiter({
    maxRequests: options.maxRequests,
    windowMs: options.windowMs,
  });

  return {
    limiter,
    advanceTo: (value: number) => {
      now = value;
    },
    restore: () => {
      Date.now = realNow;
    },
  };
};

describe("createRateLimiter", () => {
  it("allows requests up to the limit and denies the next one in-window", () => {
    const isAllowed = createRateLimiter({ maxRequests: 2, windowMs: 50 });

    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), false);
    assert.strictEqual(isAllowed("1.1.1.1"), false);
  });

  it("allows requests again once the window has expired", async () => {
    const isAllowed = createRateLimiter({ maxRequests: 2, windowMs: 50 });

    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), false);

    await sleep(70);

    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), false);
  });

  it("keeps a separate bucket per identifier", () => {
    const isAllowed = createRateLimiter({ maxRequests: 1, windowMs: 1000 });

    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), false);
    assert.strictEqual(isAllowed("2.2.2.2"), true);
    assert.strictEqual(isAllowed("2.2.2.2"), false);
    assert.strictEqual(isAllowed("unknown"), true);
  });

  it("keeps a separate bucket map per limiter", () => {
    const first = createRateLimiter({ maxRequests: 1, windowMs: 1000 });
    const second = createRateLimiter({ maxRequests: 1, windowMs: 1000 });

    assert.strictEqual(first("1.1.1.1"), true);
    assert.strictEqual(first("1.1.1.1"), false);
    // Same key, different limiter — must not inherit the exhausted bucket.
    assert.strictEqual(second("1.1.1.1"), true);
  });

  it("denies every request when maxRequests is zero after the first", () => {
    const isAllowed = createRateLimiter({ maxRequests: 0, windowMs: 1000 });

    // The first call seeds the bucket before the count check, by design.
    assert.strictEqual(isAllowed("1.1.1.1"), true);
    assert.strictEqual(isAllowed("1.1.1.1"), false);
  });

  describe("inline sweep", () => {
    it("does not sweep on every call", () => {
      const { limiter, advanceTo, restore } = createLimiterWithFakeClock({
        maxRequests: 5,
        windowMs: 1_000,
        startAt: 1_000,
      });

      try {
        assert.strictEqual(limiter("1.1.1.1"), true); // expires 2_000
        assert.strictEqual(limiter("2.2.2.2"), true); // expires 2_000

        // Long past both windows, but well short of the 256-call sweep
        // threshold — the expired buckets are still resident. They are
        // behaviourally dead (see below), only memory differs.
        advanceTo(9_000);
        assert.strictEqual(limiter("3.3.3.3"), true);
        assert.strictEqual(limiter.size(), 3);

        // An expired-but-resident bucket must behave like a never-seen key.
        assert.strictEqual(limiter("1.1.1.1"), true);
      } finally {
        restore();
      }
    });

    it("drops expired buckets once the sweep threshold is reached", () => {
      const { limiter, advanceTo, restore } = createLimiterWithFakeClock({
        maxRequests: 500,
        windowMs: 1_000,
        startAt: 1_000,
      });

      try {
        // 100 distinct buckets, all expiring at 2_000.
        for (let i = 0; i < 100; i += 1) {
          assert.strictEqual(limiter(`key-${i}`), true);
        }
        assert.strictEqual(limiter.size(), 100);

        // Push past the 256-call threshold on a single live key, after the
        // other buckets have expired.
        advanceTo(2_500);
        for (let i = 0; i < 156; i += 1) {
          assert.strictEqual(limiter("live"), true);
        }

        // Sweep fired on call 256: every expired bucket is gone, only the
        // live key remains.
        assert.strictEqual(limiter.size(), 1);
      } finally {
        restore();
      }
    });

    it("keeps a bucket whose window is still open when the sweep fires", () => {
      const { limiter, advanceTo, restore } = createLimiterWithFakeClock({
        maxRequests: 500,
        windowMs: 10_000,
        startAt: 1_000,
      });

      try {
        assert.strictEqual(limiter("1.1.1.1"), true); // expires 11_000
        assert.strictEqual(limiter("2.2.2.2"), true); // expires 11_000

        // Sweep fires at 11_000, where both resetTimes are exactly 11_000 —
        // `resetTime < now` is false, so neither bucket is dropped and their
        // counts survive.
        advanceTo(11_000);
        for (let i = 0; i < 254; i += 1) {
          assert.strictEqual(limiter("live"), true);
        }

        assert.strictEqual(limiter.size(), 3);
      } finally {
        restore();
      }
    });
  });

  describe("bucket cap", () => {
    // Mirrors MAX_BUCKETS in src/rate-limit.ts (not exported).
    const MAX_BUCKETS = 10_000;

    it("stops growing once the cap is reached, without sorting the map", () => {
      const isAllowed = createRateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
      });

      // Flood with distinct, non-expiring keys. The sweep frees nothing, so
      // the over-cap eviction is the only thing bounding the map.
      let peak = 0;
      for (let i = 0; i < MAX_BUCKETS + 500; i += 1) {
        assert.strictEqual(isAllowed(`key-${i}`), true);
        peak = Math.max(peak, isAllowed.size());
      }

      // The sweep runs before the insert, so the map may sit one entry over.
      assert.ok(
        peak <= MAX_BUCKETS + 1,
        `bucket map grew to ${peak}, above the ${MAX_BUCKETS} cap`,
      );
    });

    it("evicts the oldest buckets and keeps the most recent ones", () => {
      const isAllowed = createRateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
      });

      for (let i = 0; i < MAX_BUCKETS + 500; i += 1) {
        assert.strictEqual(isAllowed(`key-${i}`), true);
      }

      // The first keys inserted were evicted: their exhausted buckets are gone,
      // so they are allowed again (the documented degradation under flood).
      assert.strictEqual(isAllowed("key-0"), true);

      // The most recent key still holds its exhausted bucket.
      assert.strictEqual(isAllowed(`key-${MAX_BUCKETS + 499}`), false);
    });

    it("prefers dropping expired buckets over evicting live ones", () => {
      const { limiter, advanceTo, restore } = createLimiterWithFakeClock({
        maxRequests: 1,
        windowMs: 1_000,
        startAt: 1_000,
      });

      try {
        // Fill under the cap with buckets that all expire at 2_000.
        for (let i = 0; i < MAX_BUCKETS - 1; i += 1) {
          assert.strictEqual(limiter(`stale-${i}`), true);
        }

        // Past their window: the next sweep should reclaim all of them, so no
        // eviction of the live keys added afterwards is ever needed.
        advanceTo(3_000);
        for (let i = 0; i < 300; i += 1) {
          assert.strictEqual(limiter(`live-${i}`), true);
        }

        assert.ok(
          limiter.size() < MAX_BUCKETS,
          `expected the sweep to reclaim expired buckets, size is ${limiter.size()}`,
        );
        // Every live key kept its bucket.
        assert.strictEqual(limiter("live-0"), false);
        assert.strictEqual(limiter("live-299"), false);
      } finally {
        restore();
      }
    });
  });
});

describe("extractClientIp", () => {
  it("prefers cf-connecting-ip over the forwarding headers on Cloudflare", () => {
    const ip = onCloudflare(() =>
      ipForHeaders({
        "cf-connecting-ip": "1.1.1.1",
        "x-forwarded-for": "2.2.2.2",
        "x-real-ip": "3.3.3.3",
      }),
    );

    assert.strictEqual(ip, "1.1.1.1");
  });

  it("ignores cf-connecting-ip off Cloudflare, where the client can forge it", () => {
    const ip = ipForHeaders({
      "cf-connecting-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2",
      "x-real-ip": "3.3.3.3",
    });

    assert.strictEqual(ip, "2.2.2.2");
  });

  it("falls back to the forwarding headers on Cloudflare when cf-connecting-ip is absent", () => {
    const ip = onCloudflare(() =>
      ipForHeaders({ "x-forwarded-for": "2.2.2.2" }),
    );

    assert.strictEqual(ip, "2.2.2.2");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const ip = ipForHeaders({
      "x-forwarded-for": "2.2.2.2, 4.4.4.4, 5.5.5.5",
      "x-real-ip": "3.3.3.3",
    });

    assert.strictEqual(ip, "2.2.2.2");
  });

  it("trims whitespace around the x-forwarded-for entry", () => {
    const ip = ipForHeaders({ "x-forwarded-for": "  2.2.2.2  , 4.4.4.4" });

    assert.strictEqual(ip, "2.2.2.2");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    assert.strictEqual(ipForHeaders({ "x-real-ip": "3.3.3.3" }), "3.3.3.3");
  });

  it("falls back to x-real-ip when the first x-forwarded-for entry is blank", () => {
    const ip = ipForHeaders({
      "x-forwarded-for": " , 4.4.4.4",
      "x-real-ip": "3.3.3.3",
    });

    assert.strictEqual(ip, "3.3.3.3");
  });

  it("returns 'unknown' when no client IP header is present", () => {
    assert.strictEqual(ipForHeaders({}), "unknown");
  });

  it("buckets all header-less callers together under 'unknown'", () => {
    const isAllowed = createRateLimiter({ maxRequests: 1, windowMs: 1000 });

    assert.strictEqual(isAllowed(ipForHeaders({})), true);
    assert.strictEqual(isAllowed(ipForHeaders({})), false);
  });
});
