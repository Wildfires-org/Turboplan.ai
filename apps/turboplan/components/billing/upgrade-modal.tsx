"use client";

import { useState } from "react";

import { ArrowRight, ChevronDown, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, postFetcher } from "@wildfires-org/turboplan-api-client";
import { PlanCard } from "@wildfires-org/turboplan-billing/client";
import {
  CATALOG,
  extraSeats,
  monthlyBase,
  PAID_PLAN_KEYS,
  type PaidPlanKey,
  PLANS,
  type PlanKey,
} from "@wildfires-org/turboplan-billing/types";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  Badge,
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@wildfires-org/turboplan-utils";

import { useUser } from "@/components/providers/user-provider";
import type { SeatMember, SeatsResponse } from "./types";

const TRIAL_DAYS = CATALOG.billing.trial_days;
const HAS_TRIAL = TRIAL_DAYS > 0;

const DEFAULT_PLAN: PaidPlanKey = "pro";

const CHECKOUT_ENDPOINT = "/api/billing/checkout";

interface CheckoutResponse {
  url: string;
}

/**
 * Why the modal opened — switches the headline/description copy. The purchase
 * flow itself is identical.
 */
export type UpgradeReason = "project-limit" | "credits-exhausted";

interface UpgradeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** UUID of the organization the blocked action was attempted against. */
  organizationId: string;
  /** Display name of the org the subscription will attach to (for messaging). */
  organizationName?: string;
  /** What triggered the modal; defaults to the active-project limit. */
  reason?: UpgradeReason;
  /**
   * Full href to the billed org's members page. When set, a "Manage members"
   * link is shown in the seat block so buyers can adjust members before
   * purchase. When omitted no link renders.
   */
  manageMembersHref?: string;
}

/** Roster display label — name when present, otherwise the email. */
const seatLabel = (member: SeatMember): string => member.name || member.email;

/** Starter's active-project allowance, straight from the catalog. */
const STARTER_PROJECT_LIMIT: number =
  "active_projects" in PLANS.starter.limits
    ? PLANS.starter.limits.active_projects
    : 0;

const REASON_COPY: Record<
  UpgradeReason,
  { title: string; description: string }
> = {
  "project-limit": {
    title: "You've reached the free plan's project limit",
    description: `The free Starter plan includes ${STARTER_PROJECT_LIMIT} active ${
      STARTER_PROJECT_LIMIT === 1 ? "project" : "projects"
    }. Upgrade to a paid plan for unlimited projects and a much bigger monthly credit pool.`,
  },
  "credits-exhausted": {
    title: "Monthly credits used up",
    description:
      "This organization has used its monthly AI credits. Upgrade to a paid plan for a bigger monthly pool — and usage beyond it simply bills per credit instead of stopping.",
  },
};

export function UpgradeModal({
  isOpen,
  onOpenChange,
  organizationId,
  organizationName,
  reason = "project-limit",
  manageMembersHref,
}: UpgradeModalProps) {
  const { user } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanKey>(DEFAULT_PLAN);
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  // Checkout requires org-level MANAGE_MEMBERS (org owner). RBAC only inherits
  // downward, so an office/project member who is not an org member can't buy —
  // we gate the purchase UI on this rather than letting them hit a raw 403.
  // Passing userId only while open keeps the SWR key null (no request) when the
  // modal is closed, matching how it is conditionally mounted by the caller.
  const { hasPermission: canPurchase, isChecking } = useEntityPermission({
    userId: isOpen ? user?.id : undefined,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId,
    action: Action.MANAGE_MEMBERS,
  });

  // base_plus_seats: the flat workspace price covers the plan's included
  // seats; only billable members beyond that add extra-seat items. Fetched
  // once we know the user can purchase (org owner). This never blocks
  // checkout — on error we fall back to the base workspace price.
  const {
    data: seats,
    error: seatsError,
    isLoading: isSeatsLoading,
  } = useSWR<SeatsResponse>(
    isOpen && canPurchase
      ? `/api/billing/seats?organizationId=${organizationId}`
      : null,
    fetcher,
  );

  const plan = PLANS[selectedPlan];

  const hasSeatData = Boolean(seats) && !seatsError;
  const billableSeats = seats?.used ?? 0;
  const memberWord = billableSeats === 1 ? "member" : "members";
  const extraSeatCount = extraSeats(billableSeats, selectedPlan);
  const extraSeatPrice = plan.additional_seat_price_usd ?? 0;
  const dueMonthly =
    monthlyBase(selectedPlan) + extraSeatCount * extraSeatPrice;

  const { trigger: triggerCheckout } = useSWRMutation(
    CHECKOUT_ENDPOINT,
    postFetcher<CheckoutResponse>,
  );

  const handleCheckout = async () => {
    if (!hasAgreedToTerms || isRedirecting) {
      return;
    }

    setErrorMessage(null);
    setIsRedirecting(true);

    try {
      // Authed POST via the shared fetcher (attaches the Bearer token minted
      // from the session cookie). Returns the Stripe Checkout URL to redirect to.
      const { url } = await triggerCheckout({
        organizationId,
        plan: selectedPlan,
      });

      if (!url) {
        throw new Error("Checkout session did not return a redirect URL.");
      }

      window.location.href = url;
    } catch (error) {
      // postFetcher rethrows the server's `error` string as the Error message
      // (e.g. the ALREADY_SUBSCRIBED guidance to manage billing from the portal).
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't start your checkout. Please try again in a moment.",
      );
      setIsRedirecting(false);
    }
  };

  const orgLabel = organizationName ?? "this organization";
  const copy = REASON_COPY[reason];

  // Only the org-owner purchase flow needs the wide plan layout; the loading
  // and no-permission states are a short single-column message.
  const showPurchaseUi = !isChecking && canPurchase;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] w-[calc(100%-24px)] gap-6 overflow-y-auto",
          showPurchaseUi ? "max-w-4xl" : "max-w-md",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="size-5 text-brand-800" />
            {copy.title}
          </DialogTitle>
          {isChecking ? (
            <DialogDescription>Checking your access…</DialogDescription>
          ) : canPurchase ? (
            <DialogDescription>
              {copy.description}
              {HAS_TRIAL
                ? ` You won't be charged until your ${TRIAL_DAYS}-day free trial ends.`
                : ""}
            </DialogDescription>
          ) : (
            <DialogDescription>
              Only an organization owner can upgrade{" "}
              <span className="font-medium text-foreground">{orgLabel}</span>.
            </DialogDescription>
          )}
        </DialogHeader>

        {isChecking ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : canPurchase ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {PAID_PLAN_KEYS.map((planKey) => (
                <PlanCard
                  key={planKey}
                  plan={PLANS[planKey]}
                  isSelected={planKey === selectedPlan}
                  onSelect={(key: PlanKey) => {
                    // Only paid cards are rendered, so `key` is always paid.
                    if (key !== "starter") {
                      setSelectedPlan(key);
                    }
                  }}
                />
              ))}
            </div>

            {!seatsError ? (
              <div className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
                {isSeatsLoading ? (
                  <Skeleton className="h-5 w-48" />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRosterOpen((open) => !open)}
                      aria-expanded={isRosterOpen}
                      className="flex w-full items-center justify-between gap-2 text-left text-foreground"
                    >
                      <span>
                        <span className="font-medium">{billableSeats}</span>{" "}
                        billable {memberWord} on this plan
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          isRosterOpen && "rotate-180",
                        )}
                      />
                    </button>
                    {isRosterOpen && seats && seats.members.length > 0 ? (
                      <ul className="divide-y divide-border rounded-md border border-border bg-background">
                        {seats.members.map((member) => (
                          <li
                            key={member.userId}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                          >
                            <span className="truncate text-foreground">
                              {seatLabel(member)}
                            </span>
                            <Badge variant="secondary" className="capitalize">
                              {member.role}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Viewers don&apos;t use a seat.
                  {manageMembersHref ? (
                    <>
                      {" "}
                      <Link
                        href={manageMembersHref}
                        className="text-brand-700 underline"
                      >
                        Manage members
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-6">
              <div className="flex items-start justify-between gap-4 text-sm text-foreground">
                <span>
                  {HAS_TRIAL ? "Due after trial ends" : "Due monthly"}
                </span>
                {isSeatsLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : hasSeatData ? (
                  <span className="flex flex-col items-end">
                    <span className="font-medium">${dueMonthly}</span>
                    <span className="text-xs text-muted-foreground">
                      {extraSeatCount > 0
                        ? `($${monthlyBase(selectedPlan)} base + ${extraSeatCount} extra ${extraSeatCount === 1 ? "seat" : "seats"} × $${extraSeatPrice}/mo)`
                        : `(${plan.included_seats} seats included)`}
                    </span>
                  </span>
                ) : (
                  <span className="font-medium">
                    ${plan.price_usd}
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      /mo
                    </span>
                  </span>
                )}
              </div>
              {HAS_TRIAL ? (
                <div className="flex items-center justify-between text-sm text-foreground">
                  <span>
                    Due today{" "}
                    <span className="text-brand-800">
                      ({TRIAL_DAYS} days free)
                    </span>
                  </span>
                  <span className="font-medium">$0</span>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Any applicable tax will be applied to your total.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                Premium will apply to{" "}
                <span className="font-medium text-foreground">{orgLabel}</span>.
                You&apos;ll be able to create unlimited projects here — but
                creating in other organizations still requires their own
                subscription.
              </p>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <Checkbox
                  checked={hasAgreedToTerms}
                  onCheckedChange={(value) =>
                    setHasAgreedToTerms(value === true)
                  }
                  className="mt-0.5"
                  aria-label="Agree to Terms of Service and Privacy Policy"
                />
                <span>
                  I understand and agree to the Terms of Service and Privacy
                  Policy.
                </span>
              </label>

              {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={handleCheckout}
                disabled={!hasAgreedToTerms || isRedirecting}
                className={cn(
                  "w-full bg-brand-800 text-white hover:bg-brand-900",
                )}
              >
                {isRedirecting
                  ? "Redirecting to checkout…"
                  : HAS_TRIAL
                    ? "Start Free Trial"
                    : "Subscribe"}
                {!isRedirecting && <ArrowRight className="size-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              Your account doesn&apos;t have permission to start a subscription
              for{" "}
              <span className="font-medium text-foreground">{orgLabel}</span>.
              Please contact an organization owner to start a subscription and
              unlock unlimited projects.
            </p>

            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
