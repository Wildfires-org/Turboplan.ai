/**
 * Decides the Stripe `proration_behavior` for a seat-quantity change.
 *
 * A decrease (`next < current`) resolves to `"none"` so a removed seat does NOT
 * mint an immediate prorated credit (abuse vector: add a seat, use it, remove
 * it, pocket the credit) — the reduction instead applies at the next cycle. An
 * increase resolves to `"create_prorations"` so the customer is charged for the
 * added seat mid-period. Equality is never reached in practice (callers
 * short-circuit when the count is unchanged) and falls into the increase branch.
 */
export const prorationBehaviorForSeatChange = (
  current: number,
  next: number,
): "none" | "create_prorations" => {
  return next < current ? "none" : "create_prorations";
};
