"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { isBillingEnforcementEnabled } from "@wildfires-org/turboplan-feature-flags";

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
 * No request is made when billing enforcement is off — the billing package is
 * disabled (the route isn't even mounted) or
 * `NEXT_PUBLIC_IS_BILLING_ENFORCEMENT_ENABLED=false`, under which seats are
 * never billed. The hook then resolves to `false`, keeping the seat-billing
 * warning silent without a wasted round-trip. The org/office/project member
 * sections all call this with the same key, and the long `dedupingInterval`
 * collapses those concurrent calls (and re-renders) into a single subscription
 * fetch. `PaymentFailedBanner` shares the key but gates its own fetch on the
 * billing package alone, so it keeps working with enforcement off.
 */
export const useOrgBillingActive = (organizationId: string): boolean => {
  const { data } = useSWR<SubscriptionResponse>(
    isBillingEnforcementEnabled()
      ? `/api/billing/subscription?organizationId=${organizationId}`
      : null,
    fetcher,
    { dedupingInterval: 60_000 },
  );

  return ACTIVE_BILLING_STATUSES.includes(data?.subscription?.status ?? "");
};
