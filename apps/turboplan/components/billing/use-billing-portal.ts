"use client";

import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import { toast } from "@wildfires-org/turboplan-utils";

import type { PortalResponse } from "./types";

/**
 * Opens the Stripe Customer Portal for an organization: creates a portal
 * session and redirects the browser to it, surfacing a toast on failure.
 *
 * Shared by the "Manage your subscription" card and the in-page payment-failed
 * alert, both of which send the owner to Stripe to manage payment/plan.
 */
export const useBillingPortal = (organizationId: string) => {
  const { trigger, isMutating } = useSWRMutation(
    "/api/billing/portal",
    postFetcher<PortalResponse>,
  );

  const openBillingPortal = async () => {
    try {
      const result = await trigger({ organizationId });
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      toast({
        type: "error",
        description: "Could not open the billing portal. Please try again.",
      });
    }
  };

  return { openBillingPortal, isOpeningPortal: isMutating };
};
