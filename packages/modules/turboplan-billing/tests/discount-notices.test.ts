import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dueDiscountNotice } from "../src/server/reconciliation";

const now = new Date("2026-07-30T00:00:00Z");
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

describe("dueDiscountNotice", () => {
  it("sends nothing while more than 30 days remain", () => {
    assert.equal(
      dueDiscountNotice({
        endsAt: daysFromNow(45),
        now,
        notice30SentAt: null,
        notice7SentAt: null,
      }),
      null,
    );
  });

  it("sends the 30-day notice inside the 30-day window", () => {
    assert.deepEqual(
      dueDiscountNotice({
        endsAt: daysFromNow(20),
        now,
        notice30SentAt: null,
        notice7SentAt: null,
      }),
      { send: 30, stamp: [30] },
    );
  });

  it("sends the 7-day notice inside the 7-day window", () => {
    assert.deepEqual(
      dueDiscountNotice({
        endsAt: daysFromNow(5),
        now,
        notice30SentAt: now,
        notice7SentAt: null,
      }),
      { send: 7, stamp: [7] },
    );
  });

  it("first observed late: sends only the 7-day notice but stamps both", () => {
    assert.deepEqual(
      dueDiscountNotice({
        endsAt: daysFromNow(5),
        now,
        notice30SentAt: null,
        notice7SentAt: null,
      }),
      { send: 7, stamp: [30, 7] },
    );
  });

  it("never re-sends a stamped notice", () => {
    assert.equal(
      dueDiscountNotice({
        endsAt: daysFromNow(20),
        now,
        notice30SentAt: now,
        notice7SentAt: null,
      }),
      null,
    );
    assert.equal(
      dueDiscountNotice({
        endsAt: daysFromNow(5),
        now,
        notice30SentAt: now,
        notice7SentAt: now,
      }),
      null,
    );
  });

  it("sends nothing once the discount has already ended", () => {
    assert.equal(
      dueDiscountNotice({
        endsAt: daysFromNow(-1),
        now,
        notice30SentAt: null,
        notice7SentAt: null,
      }),
      null,
    );
  });
});
