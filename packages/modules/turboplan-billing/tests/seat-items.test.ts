import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";

import {
  planSeatItemTransition,
  transitionChangesStripe,
} from "../src/server/seat-items";
import { PLANS } from "../src/types";

type FakeItem = { id: string; quantity?: number; lookupKey: string | null };

const item = ({ id, quantity, lookupKey }: FakeItem) =>
  ({
    id,
    quantity,
    price: { id: `price_${id}`, lookup_key: lookupKey },
  }) as unknown as Stripe.SubscriptionItem;

// catalog/brand.yaml is fork-owned, so lookup keys carry a per-deployment
// brand prefix. Derive them from the catalog so the fixtures stay in sync
// with what the runtime resolves, while still pinning the key structure.
const PRO_BASE_KEY = PLANS.pro.lookup_key;
const PRO_SEAT_KEY = `${PRO_BASE_KEY}_additional_seat`;
const PRO_OVERAGE_KEY = `${PRO_BASE_KEY}_credit_overage`;
const MAX_SEAT_KEY = `${PLANS.max.lookup_key}_additional_seat`;

const base = item({
  id: "si_base",
  quantity: 1,
  lookupKey: PRO_BASE_KEY,
});
const overage = item({
  id: "si_overage",
  lookupKey: PRO_OVERAGE_KEY,
});
const proSeat = (quantity: number) =>
  item({
    id: "si_seat_pro",
    quantity,
    lookupKey: PRO_SEAT_KEY,
  });
const maxSeat = (quantity: number) =>
  item({
    id: "si_seat_max",
    quantity,
    lookupKey: MAX_SEAT_KEY,
  });

describe("planSeatItemTransition", () => {
  it("does nothing at or below the included count with no seat item", () => {
    const transition = planSeatItemTransition({
      items: [base, overage],
      plan: "pro",
      billableSeats: 5,
    });
    assert.deepEqual(transition.action, { type: "none" });
    assert.deepEqual(transition.removeItemIds, []);
    assert.equal(transitionChangesStripe(transition), false);
  });

  it("creates the seat item when billable exceeds included", () => {
    const transition = planSeatItemTransition({
      items: [base, overage],
      plan: "pro",
      billableSeats: 7,
    });
    assert.deepEqual(transition.action, {
      type: "create",
      quantity: 2,
      priceLookupKey: PRO_SEAT_KEY,
    });
    assert.equal(transition.prorationBehavior, "create_prorations");
  });

  it("keeps a matching seat item untouched at the same quantity", () => {
    const transition = planSeatItemTransition({
      items: [base, proSeat(2), overage],
      plan: "pro",
      billableSeats: 7,
    });
    assert.deepEqual(transition.action, { type: "none" });
    assert.equal(transitionChangesStripe(transition), false);
  });

  it("increases the quantity with prorations", () => {
    const transition = planSeatItemTransition({
      items: [base, proSeat(2)],
      plan: "pro",
      billableSeats: 9,
    });
    assert.deepEqual(transition.action, {
      type: "update",
      itemId: "si_seat_pro",
      quantity: 4,
    });
    assert.equal(transition.prorationBehavior, "create_prorations");
  });

  it("decreases the quantity without prorations", () => {
    const transition = planSeatItemTransition({
      items: [base, proSeat(4)],
      plan: "pro",
      billableSeats: 7,
    });
    assert.deepEqual(transition.action, {
      type: "update",
      itemId: "si_seat_pro",
      quantity: 2,
    });
    assert.equal(transition.prorationBehavior, "none");
  });

  it("deletes the seat item when extra seats drop to zero", () => {
    const transition = planSeatItemTransition({
      items: [base, proSeat(2)],
      plan: "pro",
      billableSeats: 4,
    });
    assert.deepEqual(transition.action, {
      type: "delete",
      itemId: "si_seat_pro",
    });
    assert.equal(transition.prorationBehavior, "none");
  });

  it("reprices a cross-plan seat item onto the current plan", () => {
    // Leftover from a half-raced plan switch: pro base but max seat item.
    const transition = planSeatItemTransition({
      items: [base, maxSeat(2)],
      plan: "pro",
      billableSeats: 7,
    });
    assert.deepEqual(transition.action, {
      type: "update",
      itemId: "si_seat_max",
      quantity: 2,
      repriceLookupKey: PRO_SEAT_KEY,
    });
  });

  it("prefers the plan's own seat item and removes cross-plan duplicates", () => {
    const transition = planSeatItemTransition({
      items: [base, maxSeat(1), proSeat(2), overage],
      plan: "pro",
      billableSeats: 7,
    });
    assert.deepEqual(transition.action, { type: "none" });
    assert.deepEqual(transition.removeItemIds, ["si_seat_max"]);
    assert.equal(transitionChangesStripe(transition), true);
  });

  it("removes duplicates even when the primary is deleted too", () => {
    const transition = planSeatItemTransition({
      items: [base, proSeat(2), maxSeat(1)],
      plan: "pro",
      billableSeats: 3,
    });
    assert.deepEqual(transition.action, {
      type: "delete",
      itemId: "si_seat_pro",
    });
    assert.deepEqual(transition.removeItemIds, ["si_seat_max"]);
  });

  it("ignores base, overage and foreign items entirely", () => {
    const transition = planSeatItemTransition({
      items: [
        base,
        overage,
        item({ id: "si_foreign", quantity: 9, lookupKey: "someone_elses" }),
        item({ id: "si_nokey", quantity: 9, lookupKey: null }),
      ],
      plan: "pro",
      billableSeats: 5,
    });
    assert.deepEqual(transition.action, { type: "none" });
    assert.deepEqual(transition.removeItemIds, []);
  });

  it("reports previous and desired extra quantities", () => {
    const transition = planSeatItemTransition({
      items: [base, proSeat(3)],
      plan: "pro",
      billableSeats: 6,
    });
    assert.equal(transition.previousExtraQuantity, 3);
    assert.equal(transition.desiredExtraQuantity, 1);
  });
});
