import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isExternalReconcileDue,
  RECONCILE_STALE_AFTER_MS,
} from "../src/server/bootstrapper/reconcile-throttle";

const NOW = new Date("2026-10-02T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("isExternalReconcileDue", () => {
  it("skips the external check while webhooks keep the run fresh", () => {
    assert.equal(isExternalReconcileDue(NOW, NOW), false);
    assert.equal(
      isExternalReconcileDue(ago(RECONCILE_STALE_AFTER_MS - 1), NOW),
      false,
    );
  });

  it("checks once the run has been quiet for the threshold", () => {
    assert.equal(
      isExternalReconcileDue(ago(RECONCILE_STALE_AFTER_MS), NOW),
      true,
    );
    assert.equal(isExternalReconcileDue(ago(10 * 60_000), NOW), true);
  });

  it("treats an updatedAt ahead of the server clock as fresh", () => {
    assert.equal(isExternalReconcileDue(ago(-5_000), NOW), false);
  });
});
