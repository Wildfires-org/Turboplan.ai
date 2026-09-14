"use client";

import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import type { CatalogPlan } from "@wildfires-org/turboplan-billing/types";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  toast,
} from "@wildfires-org/turboplan-utils";

import { brand } from "@/lib/brand";
import { formatDate } from "./format";
import type { ResumeResponse, Subscription } from "./types";

interface PlanStatusCardProps {
  organizationId: string;
  subscription: Subscription;
  /** Catalog card data; null for the non-catalog `grandfather` plan. */
  plan: CatalogPlan | null;
  planName: string;
  includedSeats: number;
  extraSeatCount: number;
  isGrandfather: boolean;
  isTrialing: boolean;
  trialDaysLeft: number;
  /** Refetches the subscription after a resume so the UI reflects the change. */
  mutateSubscription: () => Promise<unknown>;
}

export function PlanStatusCard({
  organizationId,
  subscription,
  plan,
  planName,
  includedSeats,
  extraSeatCount,
  isGrandfather,
  isTrialing,
  trialDaysLeft,
  mutateSubscription,
}: PlanStatusCardProps) {
  const { trigger: resumePlan, isMutating: isResuming } = useSWRMutation(
    "/api/billing/resume",
    postFetcher<ResumeResponse>,
  );

  const handleResumePlan = async () => {
    try {
      await resumePlan({ organizationId });
      await mutateSubscription();
      toast({
        type: "success",
        description: "Your plan will continue — the cancellation was removed.",
      });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Could not resume your plan. Please try again.",
      });
    }
  };

  // base_plus_seats workspace pricing: flat base covers the included seats,
  // extra billable members add per-seat items. A discount applies to the
  // BASE only (the coupon is restricted to base-plan products) — seats and
  // overage always bill at list price.
  const basePrice = plan?.price_usd ?? 0;
  const extraSeatPrice = plan?.additional_seat_price_usd ?? 0;
  const discountPercentOff = subscription.discountPercentOff;
  const effectiveBase = discountPercentOff
    ? Math.round(basePrice * (1 - discountPercentOff / 100) * 100) / 100
    : basePrice;
  const monthlyTotal = effectiveBase + extraSeatCount * extraSeatPrice;
  // "$49.50", not "$49.5" — but whole-dollar totals stay "$99".
  const monthlyTotalLabel = Number.isInteger(monthlyTotal)
    ? `${monthlyTotal}`
    : monthlyTotal.toFixed(2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {isGrandfather
              ? "Complimentary access"
              : isTrialing
                ? "You're on the Free Trial"
                : "Active plan"}
          </CardTitle>
          <PlanBadge
            label={isGrandfather ? "Complimentary" : planName}
            tone={isGrandfather ? "complimentary" : "plan"}
          />
        </div>
        <CardDescription>
          {isGrandfather
            ? "Complimentary access — granted by our team. No payment required."
            : isTrialing
              ? `Your trial of ${planName} is active.`
              : `Your ${planName} plan is active.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isGrandfather ? (
          <p className="text-sm text-muted-foreground">
            You have full access to {brand.name} at no cost. There is nothing to
            manage here.
          </p>
        ) : (
          <>
            {isTrialing && (
              <div className="flex items-baseline gap-2 rounded-md bg-brand-50 px-3 py-2">
                <span className="text-2xl font-semibold text-brand-800">
                  {trialDaysLeft}
                </span>
                <span className="text-sm text-muted-foreground">
                  day{trialDaysLeft === 1 ? "" : "s"} left in your trial
                </span>
              </div>
            )}

            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Workspace price</dt>
                <dd className="font-medium">
                  ${basePrice}{" "}
                  <span className="text-muted-foreground">/month</span>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Seats</dt>
                <dd className="font-medium">
                  {includedSeats} included
                  {extraSeatCount > 0
                    ? ` + ${extraSeatCount} extra × $${extraSeatPrice}/mo`
                    : ""}
                </dd>
              </div>
              {(extraSeatCount > 0 || discountPercentOff) && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">
                    {isTrialing ? "Due after trial ends" : "Monthly total"}
                  </dt>
                  <dd className="font-medium">
                    ${monthlyTotalLabel}{" "}
                    <span className="text-muted-foreground">/month</span>
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {isTrialing ? "Trial ends" : "Renews on"}
                </dt>
                <dd className="font-medium">
                  {formatDate(
                    isTrialing
                      ? subscription.trialEnd
                      : subscription.currentPeriodEnd,
                  )}
                </dd>
              </div>
            </dl>

            {discountPercentOff ? (
              <p className="rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-800">
                {discountPercentOff}% discount applied to the base price
                {subscription.discountEndsAt
                  ? ` until ${formatDate(subscription.discountEndsAt)}`
                  : ""}
                . Extra seats and credit overage bill at list price.
              </p>
            ) : null}

            {subscription.cancelAtPeriodEnd && (
              <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700">
                  Your plan is set to cancel on{" "}
                  {formatDate(subscription.currentPeriodEnd)}. You keep full
                  access until then; after that this organization moves to the
                  free Starter plan — existing projects and members are kept,
                  but Starter limits apply to new projects and invites.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResumePlan}
                  disabled={isResuming}
                >
                  {isResuming ? "Resuming…" : "Resume plan"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const PlanBadge = ({
  label,
  tone,
}: {
  label: string;
  tone: "plan" | "complimentary";
}) => (
  <span
    className={
      tone === "complimentary"
        ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
        : "inline-flex items-center rounded-full bg-brand-800 px-2.5 py-0.5 text-xs font-medium text-white"
    }
  >
    {label}
  </span>
);
