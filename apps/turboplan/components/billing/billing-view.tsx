"use client";

import { useEffect, useState } from "react";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, postFetcher } from "@wildfires-org/turboplan-api-client";
import { CheckoutView } from "@wildfires-org/turboplan-billing/client";
import {
  CATALOG,
  LIVE_SUBSCRIPTION_STATUS_VALUES,
  PAYMENT_FAILED_STATUS_VALUES,
  PLANS,
} from "@wildfires-org/turboplan-billing/types";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
  toast,
} from "@wildfires-org/turboplan-utils";

import { AppUrls } from "@/lib/nav/urls";
import { CreditUsageCard } from "./credit-usage-card";
import { daysUntil } from "./format";
import { ManageSubscriptionCard } from "./manage-subscription-card";
import { PaidUsersCard } from "./paid-users-card";
import { PlanStatusCard } from "./plan-status-card";
import type { SubscriptionResponse } from "./types";
import { useBillingPortal } from "./use-billing-portal";

const TRIAL_DAYS = CATALOG.billing.trial_days;
const HAS_TRIAL = TRIAL_DAYS > 0;

interface BillingViewProps {
  organizationId: string;
  /**
   * The signed-in user's id. Enables a self-action warning when a seat action
   * targets the current user. Optional — the warning is simply skipped if unset.
   */
  currentUserId?: string;
  /**
   * Org slug, used to build the "Manage members" link in the "Choose a plan"
   * checkout dialog. Optional — the link is omitted when unset.
   */
  orgSlug?: string;
  /** Whether the Stripe `?checkout=success` redirect param is present. */
  checkoutSucceeded?: boolean;
}

export function BillingView({
  organizationId,
  currentUserId,
  orgSlug,
  checkoutSucceeded = false,
}: BillingViewProps) {
  const {
    data: subscriptionData,
    error: subscriptionError,
    isLoading: isSubscriptionLoading,
    mutate: mutateSubscription,
  } = useSWR<SubscriptionResponse>(
    `/api/billing/subscription?organizationId=${organizationId}`,
    fetcher,
  );

  const { mutate: globalMutate } = useSWRConfig();

  // Plan changes move the credit allowance too — revalidate the usage card's
  // SWR key alongside the subscription so both update in one pass.
  const refreshBilling = async () => {
    await Promise.all([
      mutateSubscription(),
      globalMutate(`/api/billing/usage?organizationId=${organizationId}`),
    ]);
  };

  const { openBillingPortal, isOpeningPortal } =
    useBillingPortal(organizationId);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    if (checkoutSucceeded) {
      toast({
        type: "success",
        description: "Subscription started. Welcome aboard!",
      });
    }
  }, [checkoutSucceeded]);

  const subscription = subscriptionData?.subscription ?? null;
  const plan = subscriptionData?.plan ?? null;
  const isGrandfather = subscription?.plan === "grandfather";
  const isLiveStatus =
    subscription !== null &&
    LIVE_SUBSCRIPTION_STATUS_VALUES.includes(subscription.status);
  const isPaymentFailed =
    subscription !== null &&
    PAYMENT_FAILED_STATUS_VALUES.includes(subscription.status);
  // The free plan: an active starter row (picked in onboarding or via the
  // "start for free" path), OR a fully canceled paid sub with a plan stamp —
  // entitlements fall back to Starter after cancellation (resolveOrgPlan), so
  // the billing page must say the same. A subscription row can also exist for
  // an ABANDONED paid checkout (customer created, never completed) — that's
  // not a plan, so it falls through to the empty state below.
  const isStarter =
    (subscription?.plan === "starter" && isLiveStatus) ||
    (subscription?.status === "canceled" && subscription.planChosenAt !== null);
  const isPaidPlan =
    subscription !== null &&
    !isGrandfather &&
    !isStarter &&
    (isLiveStatus || isPaymentFailed);
  const hasPlan = isGrandfather || isStarter || isPaidPlan;

  const manageMembersUrl = orgSlug
    ? AppUrls.organizationMembers(orgSlug)
    : undefined;

  if (isSubscriptionLoading) {
    return <BillingSkeleton />;
  }

  if (subscriptionError) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Could not load billing information. Please try again later.
      </p>
    );
  }

  const checkoutDialog = (
    <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
      <DialogContent className="max-h-[85vh] gap-6 overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Choose your plan</DialogTitle>
          <DialogDescription>
            {HAS_TRIAL
              ? `You won't be charged until your ${TRIAL_DAYS}-day free trial ends.`
              : "A flat workspace price — seats beyond the included count bill separately."}
          </DialogDescription>
        </DialogHeader>
        <CheckoutView
          showHeader={false}
          returnToOrigin={false}
          organizationId={organizationId}
          manageMembersUrl={manageMembersUrl}
        />
      </DialogContent>
    </Dialog>
  );

  // --- Empty state: no plan chosen yet ------------------------------------
  if (!subscription || !hasPlan) {
    return (
      <div className="py-6">
        {checkoutSucceeded && <CheckoutSuccessBanner />}
        <NoPlanCard
          organizationId={organizationId}
          onChoosePlan={() => setIsCheckoutOpen(true)}
          mutateSubscription={refreshBilling}
        />
        {checkoutDialog}
      </div>
    );
  }

  // --- Free Starter plan ---------------------------------------------------
  if (isStarter) {
    return (
      <div className="space-y-6 py-6">
        {checkoutSucceeded && <CheckoutSuccessBanner />}
        <div className="grid gap-6 lg:grid-cols-2">
          <StarterPlanCard onUpgrade={() => setIsCheckoutOpen(true)} />
          <CreditUsageCard organizationId={organizationId} />
        </div>
        {checkoutDialog}
      </div>
    );
  }

  const isTrialing = subscription.status === "trialing";
  const trialDaysLeft = daysUntil(subscription.trialEnd);
  const planName = isGrandfather ? "Complimentary" : (plan?.name ?? "—");

  return (
    <div className="space-y-6 py-6">
      {checkoutSucceeded && <CheckoutSuccessBanner />}

      {isPaymentFailed && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-start">
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-amber-900">Payment failed</p>
            <p className="text-sm text-amber-800">
              {subscription.status === "unpaid"
                ? "Your subscription is unpaid and premium features may be locked. Update your payment method to restore it."
                : "Your last payment failed. We'll retry automatically — please update your payment method to keep your subscription active."}
            </p>
          </div>
          <Button
            onClick={openBillingPortal}
            disabled={isOpeningPortal}
            className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"
          >
            {isOpeningPortal ? "Opening…" : "Update payment method"}
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanStatusCard
          organizationId={organizationId}
          subscription={subscription}
          plan={plan}
          planName={planName}
          includedSeats={subscriptionData?.includedSeats ?? 0}
          extraSeatCount={subscriptionData?.extraSeats ?? 0}
          isGrandfather={isGrandfather}
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          mutateSubscription={refreshBilling}
        />

        {!isGrandfather && (
          <ManageSubscriptionCard
            organizationId={organizationId}
            subscription={subscription}
            mutateSubscription={refreshBilling}
          />
        )}
      </div>

      <CreditUsageCard organizationId={organizationId} />

      {!isGrandfather && (
        <PaidUsersCard
          organizationId={organizationId}
          currentUserId={currentUserId}
          subscription={subscription}
          includedSeats={subscriptionData?.includedSeats ?? 0}
          extraSeatCount={subscriptionData?.extraSeats ?? 0}
          extraSeatPrice={plan?.additional_seat_price_usd ?? 0}
          mutateSubscription={refreshBilling}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

const CheckoutSuccessBanner = () => (
  <div className="mb-6 flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
    <CheckCircle2 className="size-5 shrink-0 text-brand-800" />
    <span>Your subscription is now active. Thank you!</span>
  </div>
);

interface NoPlanCardProps {
  organizationId: string;
  onChoosePlan: () => void;
  mutateSubscription: () => Promise<unknown>;
}

/**
 * No plan chosen yet (no subscription row, or only the leftovers of an
 * abandoned checkout). Offers both paths: paid checkout or the free Starter
 * plan.
 */
const NoPlanCard = ({
  organizationId,
  onChoosePlan,
  mutateSubscription,
}: NoPlanCardProps) => {
  const { trigger: selectStarter, isMutating: isActivating } = useSWRMutation(
    "/api/billing/select-starter",
    postFetcher<{ ok: boolean }>,
  );

  const handleStartFree = async () => {
    try {
      await selectStarter({ organizationId });
      await mutateSubscription();
      toast({
        type: "success",
        description: "You're on the free Starter plan.",
      });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Could not activate the free plan. Please try again.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-brand-800" />
          Choose a plan
        </CardTitle>
        <CardDescription>
          This organization doesn&apos;t have a plan yet. Subscribe to unlock AI
          drafting, research agents and team collaboration — or start on the
          free Starter plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onChoosePlan}
          className="bg-brand-800 text-white hover:bg-brand-900"
        >
          Choose a plan
          <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          onClick={handleStartFree}
          disabled={isActivating}
        >
          {isActivating ? "Activating…" : "Start for free"}
        </Button>
      </CardContent>
    </Card>
  );
};

interface StarterPlanCardProps {
  onUpgrade: () => void;
}

/**
 * The free Starter plan state. Shows the catalog-derived limits and the
 * upgrade path; also states the downgrade semantics (existing projects and
 * members are kept — the limits only gate NEW projects and invites).
 */
const StarterPlanCard = ({ onUpgrade }: StarterPlanCardProps) => {
  const starter = PLANS.starter;
  const activeProjectLimit =
    "active_projects" in starter.limits ? starter.limits.active_projects : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Free Starter plan</CardTitle>
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
            {starter.name}
          </span>
        </div>
        <CardDescription>
          This organization is on the free plan — no payment method required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Included seats</dt>
            <dd className="font-medium">{starter.included_seats}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Monthly credits</dt>
            <dd className="font-medium">
              {starter.limits.credits.toLocaleString("en-US")}
            </dd>
          </div>
          {activeProjectLimit !== null && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Active projects</dt>
              <dd className="font-medium">{activeProjectLimit}</dd>
            </div>
          )}
        </dl>

        <p className="text-xs text-muted-foreground">
          If you downgraded from a paid plan, existing projects and members are
          kept — the Starter limits only apply to creating new projects and
          inviting new billable members. Credits stop at the monthly allowance
          (no overage billing).
        </p>

        <Button
          onClick={onUpgrade}
          className="bg-brand-800 text-white hover:bg-brand-900"
        >
          Upgrade plan
          <ArrowRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

const BillingSkeleton = () => (
  <div className="space-y-6 py-6">
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
    <Skeleton className="h-40 w-full" />
  </div>
);
