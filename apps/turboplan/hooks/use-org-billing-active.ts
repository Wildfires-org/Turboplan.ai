"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

// Subscription statuses that mean the org is actively billed per seat, so
// inviting non-viewer (Owner/Editor) members changes the next invoice. The
// seat lives on the organization's subscription regardless of whether the
// invite targets the org, an office, or a project.
const ACTIVE_BILLING_STATUSES = ["active", "trialing", "past_due"];

interface SubscriptionResponse {
  subscription: { status: string } | null;
}

/**
 * Returns true when the organization has an active seat-based subscription.
 *
 * No request is made when the billing package is disabled (the route isn't even
 * mounted) — the hook resolves to `false`, keeping the seat-billing warning
 * silent in non-billing builds without a wasted round-trip. The org/office/
 * project member sections all call this with the same key, and the long
 * `dedupingInterval` collapses those concurrent calls (and re-renders) into a
 * single subscription fetch.
 */
export const useOrgBillingActive = (organizationId: string): boolean => {
  const { data } = useSWR<SubscriptionResponse>(
    isBillingPackageEnabled()
      ? `/api/billing/subscription?organizationId=${organizationId}`
      : null,
    fetcher,
    { dedupingInterval: 60_000 },
  );

  return ACTIVE_BILLING_STATUSES.includes(data?.subscription?.status ?? "");
};
