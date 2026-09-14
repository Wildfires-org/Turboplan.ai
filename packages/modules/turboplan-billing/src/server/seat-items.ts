import type Stripe from "stripe";

import {
  classifyLookupKey,
  extraSeats,
  type PaidPlanKey,
  seatLookupKey,
} from "../types";
import { prorationBehaviorForSeatChange } from "./seat-proration";

/**
 * Pure planner for extra-seat subscription-item transitions. Same pattern as
 * `seat-proration.ts`: the decision logic is a pure function of the live
 * items + desired state so the whole matrix is unit-testable; only the
 * Stripe/DB I/O around it stays untested.
 */

export type SeatItemAction =
  | { type: "none" }
  | { type: "create"; quantity: number; priceLookupKey: string }
  | {
      type: "update";
      itemId: string;
      quantity: number;
      /** Set when the item must also move to this plan's seat price. */
      repriceLookupKey?: string;
    }
  | { type: "delete"; itemId: string };

export type SeatTransition = {
  action: SeatItemAction;
  /**
   * Duplicate seat items to delete in the same update. Concurrent seat sync
   * and change-plan can race two retrieve-then-update sequences into TWO seat
   * items (possibly of different plans); first-per-kind classification then
   * hides the loser from every projection while it keeps billing. The planner
   * always returns the surplus so any later sync self-heals the cart.
   */
  removeItemIds: string[];
  prorationBehavior: "create_prorations" | "none";
  previousExtraQuantity: number;
  desiredExtraQuantity: number;
};

/**
 * Plans the extra-seat item transition for a subscription on `plan` with
 * `billableSeats` billable members. `items` is the subscription's full live
 * item list; non-seat items are ignored.
 *
 * The primary seat item is the first one matching the plan's own seat price;
 * with no exact match, the first seat item of ANY catalog plan is adopted and
 * repriced (cross-plan leftovers from a half-raced plan switch). All other
 * seat items are surplus.
 */
export const planSeatItemTransition = (params: {
  items: Stripe.SubscriptionItem[];
  plan: PaidPlanKey;
  billableSeats: number;
}): SeatTransition => {
  const { items, plan, billableSeats } = params;

  const seatItems = items.filter(
    (item) => classifyLookupKey(item.price.lookup_key ?? "")?.kind === "seat",
  );
  const ownLookupKey = seatLookupKey(plan);
  const primary =
    seatItems.find((item) => item.price.lookup_key === ownLookupKey) ??
    seatItems[0];
  const removeItemIds = seatItems
    .filter((item) => item !== primary)
    .map((item) => item.id);

  const desiredExtraQuantity = extraSeats(billableSeats, plan);
  const previousExtraQuantity = primary?.quantity ?? 0;
  const prorationBehavior = prorationBehaviorForSeatChange(
    previousExtraQuantity,
    desiredExtraQuantity,
  );

  if (!primary) {
    return {
      action:
        desiredExtraQuantity > 0
          ? {
              type: "create",
              quantity: desiredExtraQuantity,
              priceLookupKey: ownLookupKey,
            }
          : { type: "none" },
      removeItemIds,
      prorationBehavior,
      previousExtraQuantity,
      desiredExtraQuantity,
    };
  }

  if (desiredExtraQuantity === 0) {
    return {
      action: { type: "delete", itemId: primary.id },
      removeItemIds,
      prorationBehavior,
      previousExtraQuantity,
      desiredExtraQuantity,
    };
  }

  const needsReprice = primary.price.lookup_key !== ownLookupKey;
  if (needsReprice || previousExtraQuantity !== desiredExtraQuantity) {
    return {
      action: {
        type: "update",
        itemId: primary.id,
        quantity: desiredExtraQuantity,
        ...(needsReprice ? { repriceLookupKey: ownLookupKey } : {}),
      },
      removeItemIds,
      prorationBehavior,
      previousExtraQuantity,
      desiredExtraQuantity,
    };
  }

  return {
    action: { type: "none" },
    removeItemIds,
    prorationBehavior,
    previousExtraQuantity,
    desiredExtraQuantity,
  };
};

/** True when the transition requires any Stripe update at all. */
export const transitionChangesStripe = (transition: SeatTransition): boolean =>
  transition.action.type !== "none" || transition.removeItemIds.length > 0;
