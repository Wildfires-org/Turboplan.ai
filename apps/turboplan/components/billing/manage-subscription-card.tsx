"use client";

import { useState } from "react";

import { ArrowRight, CreditCard } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import {
  LIVE_SUBSCRIPTION_STATUS_VALUES,
  PAID_PLAN_KEYS,
  type PaidPlanKey,
  PLAN_ORDER,
  PLANS,
} from "@wildfires-org/turboplan-billing/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  toast,
} from "@wildfires-org/turboplan-utils";

import { formatDate } from "./format";
import type { CancelResponse, Subscription } from "./types";
import { useBillingPortal } from "./use-billing-portal";

interface ManageSubscriptionCardProps {
  organizationId: string;
  subscription: Subscription;
  /** Refetches the subscription after a cancel so the UI reflects the change. */
  mutateSubscription: () => Promise<unknown>;
}

const isPaidPlanKey = (plan: string | null): plan is PaidPlanKey =>
  plan !== null && (PAID_PLAN_KEYS as readonly string[]).includes(plan);

export function ManageSubscriptionCard({
  organizationId,
  subscription,
  mutateSubscription,
}: ManageSubscriptionCardProps) {
  const { openBillingPortal, isOpeningPortal } =
    useBillingPortal(organizationId);

  const { trigger: cancelPlan, isMutating: isCanceling } = useSWRMutation(
    "/api/billing/cancel",
    postFetcher<CancelResponse>,
  );

  const { trigger: changePlan, isMutating: isChangingPlan } = useSWRMutation(
    "/api/billing/change-plan",
    postFetcher<{ ok: boolean }>,
  );

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [pendingPlanChange, setPendingPlanChange] =
    useState<PaidPlanKey | null>(null);

  const isLive = LIVE_SUBSCRIPTION_STATUS_VALUES.includes(subscription.status);

  // Pro ↔ Max switch target: the OTHER paid plan, when the org is on one.
  // Plan switches go through our /change-plan endpoint (one Stripe call
  // swapping base/seat/overage items) — the Customer Portal cannot remap the
  // three-item structure, so portal plan switches stay disabled.
  const currentPaidPlan = isPaidPlanKey(subscription.plan)
    ? subscription.plan
    : null;
  const switchTarget =
    currentPaidPlan !== null
      ? (PAID_PLAN_KEYS.find((key) => key !== currentPaidPlan) ?? null)
      : null;
  const isUpgrade =
    currentPaidPlan !== null &&
    switchTarget !== null &&
    PLAN_ORDER.indexOf(switchTarget) > PLAN_ORDER.indexOf(currentPaidPlan);
  const canSwitchPlan =
    isLive && !subscription.cancelAtPeriodEnd && switchTarget !== null;

  const handleCancelPlan = async () => {
    try {
      await cancelPlan({ organizationId });
      await mutateSubscription();
      setIsCancelDialogOpen(false);
      toast({
        type: "success",
        description:
          "Your plan is scheduled to cancel at the end of the current period.",
      });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Could not cancel your plan. Please try again.",
      });
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!pendingPlanChange) {
      return;
    }
    try {
      await changePlan({ organizationId, plan: pendingPlanChange });
      await mutateSubscription();
      setPendingPlanChange(null);
      toast({
        type: "success",
        description: `Your workspace is now on the ${PLANS[pendingPlanChange].name} plan.`,
      });
    } catch (error) {
      setPendingPlanChange(null);
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Could not change your plan. Please try again.",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-5 text-brand-800" />
            Manage your subscription
          </CardTitle>
          <CardDescription>
            Change plan here; invoices and payment method via Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={openBillingPortal}
              disabled={isOpeningPortal}
              className="bg-brand-800 text-white hover:bg-brand-900"
            >
              {isOpeningPortal ? "Opening…" : "Go to Stripe"}
              {!isOpeningPortal && <ArrowRight className="size-4" />}
            </Button>
            {canSwitchPlan && switchTarget && (
              <Button
                variant="outline"
                onClick={() => setPendingPlanChange(switchTarget)}
                disabled={isChangingPlan}
              >
                {isUpgrade
                  ? `Upgrade to ${PLANS[switchTarget].name}`
                  : `Downgrade to ${PLANS[switchTarget].name}`}
              </Button>
            )}
            {isLive && !subscription.cancelAtPeriodEnd && (
              <Button
                variant="ghost"
                onClick={() => setIsCancelDialogOpen(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Cancel plan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan change confirmation */}
      {pendingPlanChange && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingPlanChange(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isUpgrade
                  ? `Upgrade to ${PLANS[pendingPlanChange].name}?`
                  : `Downgrade to ${PLANS[pendingPlanChange].name}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isUpgrade
                  ? `Your workspace switches to ${PLANS[pendingPlanChange].name} ($${PLANS[pendingPlanChange].price_usd}/mo) immediately. The price difference for the rest of this period is prorated on your next invoice.`
                  : `Your workspace switches to ${PLANS[pendingPlanChange].name} ($${PLANS[pendingPlanChange].price_usd}/mo) immediately, with no partial-period charges. The new price applies from your next invoice.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isChangingPlan}>
                Keep current plan
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isChangingPlan}
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirmPlanChange();
                }}
              >
                {isChangingPlan
                  ? "Switching…"
                  : isUpgrade
                    ? "Upgrade"
                    : "Downgrade"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Cancel plan confirmation (destructive) */}
      <AlertDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Your organization keeps full access until{" "}
              {formatDate(subscription.currentPeriodEnd)}, and you can resume
              any time before then. After that this organization moves to the
              free Starter plan — existing projects and members are kept, but
              Starter limits apply to new projects and invites, and credits stop
              at the free monthly allowance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>
              Keep plan
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCanceling}
              onClick={(event) => {
                event.preventDefault();
                void handleCancelPlan();
              }}
            >
              {isCanceling ? "Canceling…" : "Cancel plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
