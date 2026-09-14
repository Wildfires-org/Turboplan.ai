"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { EntityTypeType } from "@wildfires-org/turboplan-rbac";

interface SeatBillingResponse {
  seatBillingActive: boolean;
}

/**
 * Resolves whether adding an Owner/Editor to the given entity (organization,
 * office, or project) would move the owning organization's seat-based bill.
 *
 * Backed by `GET /api/billing/seat-billing-active`, which resolves the owning
 * org from any entity server-side — so callers that only hold an entity id
 * (e.g. a project view without the org id) still get an accurate answer.
 * Returns false when billing is disabled, the org has no active/trialing
 * subscription, or `enabled` is false (pass the add-form's open state to skip
 * the request while closed).
 */
export function useSeatBillingActive(
  entityType: EntityTypeType,
  entityId: string | undefined,
  enabled = true,
): boolean {
  const { data } = useSWR<SeatBillingResponse>(
    enabled && entityId
      ? `/api/billing/seat-billing-active?entityType=${entityType}&entityId=${entityId}`
      : null,
    fetcher,
  );

  return data?.seatBillingActive ?? false;
}
