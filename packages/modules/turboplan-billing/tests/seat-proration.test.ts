import assert from "node:assert";
import { describe, it } from "node:test";

import { prorationBehaviorForSeatChange } from "../src/server/seat-proration";

describe("prorationBehaviorForSeatChange", () => {
  it("returns 'none' when seats decrease (no immediate credit)", () => {
    assert.strictEqual(prorationBehaviorForSeatChange(5, 3), "none");
  });

  it("returns 'none' for a decrease down to one seat", () => {
    assert.strictEqual(prorationBehaviorForSeatChange(2, 1), "none");
  });

  it("returns 'create_prorations' when seats increase (charge mid-period)", () => {
    assert.strictEqual(
      prorationBehaviorForSeatChange(3, 5),
      "create_prorations",
    );
  });

  it("returns 'create_prorations' when seats are unchanged (equal falls into the increase branch)", () => {
    // Callers short-circuit before reaching this helper when the count is
    // unchanged, but the rule is `next < current ? none : create_prorations`,
    // so equality resolves to create_prorations.
    assert.strictEqual(
      prorationBehaviorForSeatChange(4, 4),
      "create_prorations",
    );
  });
});
