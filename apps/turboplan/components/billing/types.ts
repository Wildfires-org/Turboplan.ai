import type { CatalogPlan } from "@wildfires-org/turboplan-billing/types";

/**
 * Shared wire types for the org billing settings UI. These mirror the JSON
 * shapes returned by the `/api/billing/*` endpoints — timestamp columns are
 * serialized to ISO strings by JSON, so they arrive as `string | null` (not
 * `Date`).
 */

/**
 * Subscription shape as returned over the wire by
 * `GET /api/billing/subscription` — the endpoint ships an explicit allowlist
 * (no Stripe object ids or internal bookkeeping stamps).
 */
export interface Subscription {
  organizationId: string;
  status: string;
  plan: string | null;
  seats: number;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  planChosenAt: string | null;
  discountPercentOff: number | null;
  discountEndsAt: string | null;
}

export interface SubscriptionResponse {
  subscription: Subscription | null;
  /** Catalog card data; null for the non-catalog `grandfather` plan. */
  plan: CatalogPlan | null;
  includedSeats?: number;
  extraSeats?: number;
  creditAllowance?: number;
}

export interface SeatMember {
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

export interface SeatsResponse {
  used: number;
  members: SeatMember[];
}

/** `POST /api/billing/portal` — Stripe Customer Portal session. */
export interface PortalResponse {
  url: string;
}

/** `POST /api/billing/cancel` — schedules cancellation at period end. */
export interface CancelResponse {
  success: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

/** `POST /api/billing/resume` — clears a pending cancellation. */
export interface ResumeResponse {
  success: boolean;
  cancelAtPeriodEnd: boolean;
}

export type SeatActionMode = "downgrade" | "remove";

/** `DELETE /api/billing/seats/:userId` — downgrade or remove a paid seat. */
export interface SeatChangeResponse {
  success: boolean;
  mode: SeatActionMode;
  membershipsChanged: number;
}
