"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, postFetcher } from "@wildfires-org/turboplan-api-client";
import {
  CATALOG,
  PLAN_ORDER,
  PLANS,
  type PlanKey,
} from "@wildfires-org/turboplan-billing/types";
import { Button, cn, Skeleton } from "@wildfires-org/turboplan-utils";

import { toast } from "@/components/toast";

interface BillableOrganizationsResponse {
  organizations: Array<{ id: string; type?: string }>;
}

/** Starter's active-project allowance, straight from the catalog. */
const STARTER_PROJECT_LIMIT =
  "active_projects" in PLANS.starter.limits
    ? PLANS.starter.limits.active_projects
    : 0;

/** Compact per-plan summary line for the narrow onboarding card. */
const planSummary = (plan: PlanKey): string => {
  const config = PLANS[plan];
  const credits = `${(config.limits.credits / 1000).toLocaleString("en-US")}k credits/mo`;
  const seats = `${config.included_seats} seats`;
  if (plan === "starter") {
    const activeProjects: number = STARTER_PROJECT_LIMIT;
    return `${seats} · ${credits} · ${activeProjects} active ${activeProjects === 1 ? "project" : "projects"}`;
  }
  return `${seats} · ${credits} · +$${config.additional_seat_price_usd}/extra seat`;
};

/**
 * The onboarding plan step, sized for the 456px auth card: compact selectable
 * plan rows instead of the full marketing cards.
 *
 * Picking Starter (or pressing Skip, when the catalog allows it) activates
 * the free plan on the user's personal org and stamps plan_chosen_at so this
 * step never re-prompts; picking a paid plan goes through Stripe Checkout and
 * returns to the setup completion flow.
 *
 * The Skip button renders only while the catalog declares
 * `onboarding.payment_step_skippable` — removing it later is one YAML edit.
 */
export function PlanStep() {
  const router = useRouter();
  // Pro pre-selected (user decision 2026-08-03): anchor on the paid
  // foundation plan; the free path stays one tap away (Starter row or Skip).
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("pro");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Returning from an abandoned Stripe Checkout (cancel URL carries
  // ?checkout=cancelled) — acknowledge it once so the return isn't silent.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "cancelled") {
      toast({
        type: "error",
        description: "Checkout cancelled — pick a plan when you're ready.",
      });
      window.history.replaceState(null, "", "/setup/plan");
    }
  }, []);

  // The user's personal org was created at signup; it is the billing target
  // for the onboarding plan choice.
  const { data: orgsData, isLoading: isLoadingOrgs } =
    useSWR<BillableOrganizationsResponse>(
      "/api/billing/billable-organizations",
      fetcher,
    );
  const organizations = orgsData?.organizations;
  const personalOrgId =
    organizations?.find((org) => org.type === "personal")?.id ??
    organizations?.[0]?.id ??
    null;

  const { trigger: selectStarter } = useSWRMutation(
    "/api/billing/select-starter",
    postFetcher<{ ok: boolean }>,
  );
  const { trigger: startCheckout } = useSWRMutation(
    "/api/billing/checkout",
    postFetcher<{ url: string }>,
  );

  const finishWithStarter = async () => {
    if (!personalOrgId || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await selectStarter({ organizationId: personalOrgId });
      router.push("/?setup=true");
    } catch (error) {
      setIsSubmitting(false);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to set up the plan",
      });
    }
  };

  const continueToCheckout = async (plan: PlanKey) => {
    if (!personalOrgId || isSubmitting || plan === "starter") {
      return;
    }
    setIsSubmitting(true);
    try {
      const { url } = await startCheckout({
        organizationId: personalOrgId,
        plan,
        context: "onboarding",
      });
      window.location.href = url;
    } catch (error) {
      setIsSubmitting(false);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to start checkout",
      });
    }
  };

  const handleContinue = () => {
    if (selectedPlan === "starter") {
      void finishWithStarter();
    } else {
      void continueToCheckout(selectedPlan);
    }
  };

  const isSkippable = CATALOG.billing.onboarding.payment_step_skippable;
  const isBusy = isSubmitting || isLoadingOrgs || !personalOrgId;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-medium text-foreground">
          Choose your plan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start free, or pick a paid plan for a bigger monthly credit pool. You
          can change this anytime.
        </p>
      </header>

      {isLoadingOrgs ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {PLAN_ORDER.map((planKey) => {
            const plan = PLANS[planKey];
            const isSelected = planKey === selectedPlan;
            return (
              <button
                key={planKey}
                type="button"
                onClick={() => setSelectedPlan(planKey)}
                aria-pressed={isSelected}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                  isSelected
                    ? "border-brand-800 ring-1 ring-brand-800"
                    : "border-border hover:border-brand-400",
                )}
              >
                <span className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-brand-800" : "text-foreground",
                    )}
                  >
                    {plan.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {planSummary(planKey)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {plan.price_usd === 0 ? "Free" : `$${plan.price_usd}/mo`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!isLoadingOrgs && !personalOrgId ? (
        <p className="text-sm text-destructive">
          We couldn't find a workspace for your account, so a plan can't be set
          up right now. Please contact support.
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          size="lg"
          onClick={handleContinue}
          disabled={isBusy}
          className="w-full bg-brand-800 text-white hover:bg-brand-900"
        >
          {isSubmitting
            ? "Setting up…"
            : selectedPlan === "starter"
              ? "Start for free"
              : `Continue to checkout — $${PLANS[selectedPlan].price_usd}/mo`}
        </Button>

        {isSkippable ? (
          <button
            type="button"
            onClick={() => void finishWithStarter()}
            disabled={isBusy}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Skip for now
          </button>
        ) : null}
      </div>
    </div>
  );
}
