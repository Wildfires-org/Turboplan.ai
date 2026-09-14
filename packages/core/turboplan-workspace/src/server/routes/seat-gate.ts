import type { Context } from "hono";

import type { SeatAvailabilityDecision } from "@wildfires-org/turboplan-billing/server";

/**
 * Single wire contract for seat-cap rejections — every membership route
 * returns exactly this 403 so client handling cannot drift per route.
 */
export const seatLimitResponse = (
  c: Context,
  decision: SeatAvailabilityDecision,
) => {
  return c.json(
    {
      error: "Seat limit reached",
      code: "SEAT_LIMIT_REACHED",
      plan: decision.plan,
      includedSeats: decision.includedSeats,
    },
    403,
  );
};
