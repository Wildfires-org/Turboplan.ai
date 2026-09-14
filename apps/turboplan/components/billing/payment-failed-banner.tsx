"use client";

import { X } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { useSessionStorage } from "usehooks-ts";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { PAYMENT_FAILED_STATUS_VALUES } from "@wildfires-org/turboplan-billing/types";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Button } from "@wildfires-org/turboplan-utils";

import { AppUrls } from "@/lib/nav/urls";

interface SubscriptionResponse {
  subscription: { status: string } | null;
}

interface PaymentFailedBannerProps {
  organizationId: string;
  orgSlug: string;
  /** Signed-in user's id — gates the banner to members who can fix billing. */
  userId?: string;
}

export function PaymentFailedBanner({
  organizationId,
  orgSlug,
  userId,
}: PaymentFailedBannerProps) {
  const billingEnabled = isBillingPackageEnabled();

  // Only owners (MANAGE_MEMBERS) can act on billing — mirrors the gate on the
  // billing settings page. Non-owners never see the notice.
  const { hasPermission: canManageBilling } = useEntityPermission({
    userId,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId,
    action: Action.MANAGE_MEMBERS,
  });

  // Same SWR key as `useOrgBillingActive` so the subscription fetch is shared
  // from cache rather than re-requested. Keyed on the permission so members who
  // can never see the banner (viewers/editors) trigger no request at all.
  const { data } = useSWR<SubscriptionResponse>(
    billingEnabled && canManageBilling
      ? `/api/billing/subscription?organizationId=${organizationId}`
      : null,
    fetcher,
    { dedupingInterval: 60_000 },
  );

  // Session-only dismissal, keyed per org so dismissing one org's banner keeps
  // another org's visible. Resets on a new browser session.
  const [isDismissed, setIsDismissed] = useSessionStorage(
    `payment-failed-banner-dismissed:${organizationId}`,
    false,
  );

  const isPaymentFailed = PAYMENT_FAILED_STATUS_VALUES.includes(
    data?.subscription?.status ?? "",
  );

  if (!billingEnabled || !isPaymentFailed || !canManageBilling || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className="mt-4 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span className="flex-1">
        Payment for this organization failed —{" "}
        <Link
          href={AppUrls.organizationBilling(orgSlug)}
          className="font-medium underline underline-offset-2"
        >
          update your payment method
        </Link>
        .
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="size-6 shrink-0 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
