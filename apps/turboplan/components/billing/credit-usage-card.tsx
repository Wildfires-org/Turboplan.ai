"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import {
  allowancePlanKey,
  PLANS,
} from "@wildfires-org/turboplan-billing/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
} from "@wildfires-org/turboplan-utils";

import { formatDate } from "./format";

/** Wire shape of `GET /api/billing/usage` (timestamps arrive as ISO strings). */
interface CreditUsageResponse {
  plan: string;
  creditsUsed: number;
  allowance: number;
  hardStop: boolean;
  periodStart: string;
  periodEnd: string;
}

interface CreditUsageCardProps {
  organizationId: string;
}

const formatCredits = (credits: number): string =>
  credits.toLocaleString("en-US");

/**
 * Overage price note derived from the catalog, e.g. $0.006/credit →
 * "then $6 per 1,000 credits". Null for hard-stop plans (no overage).
 */
const overageNote = (planKey: string): string | null => {
  const plan = PLANS[allowancePlanKey(planKey)];
  if (plan.overage_usd_per_credit === null) {
    return null;
  }
  const perThousand = plan.overage_usd_per_credit * 1000;
  const formatted = Number.isInteger(perThousand)
    ? `$${perThousand}`
    : `$${perThousand.toFixed(2)}`;
  return `${formatted} per 1,000 credits`;
};

export function CreditUsageCard({ organizationId }: CreditUsageCardProps) {
  const {
    data: usage,
    error,
    isLoading,
  } = useSWR<CreditUsageResponse>(
    `/api/billing/usage?organizationId=${organizationId}`,
    fetcher,
  );

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (error || !usage) {
    return null;
  }

  const percentUsed =
    usage.allowance > 0
      ? Math.min(100, Math.round((usage.creditsUsed / usage.allowance) * 100))
      : 100;
  const isExhausted = usage.creditsUsed >= usage.allowance;
  const overage = overageNote(usage.plan);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credit usage</CardTitle>
        <CardDescription>
          AI work (chat, documents, images, research agents) draws from your
          organization&apos;s monthly credit pool.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {formatCredits(usage.creditsUsed)}{" "}
            <span className="font-normal text-muted-foreground">
              of {formatCredits(usage.allowance)} credits used
            </span>
          </span>
          <span className="text-muted-foreground">{percentUsed}%</span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={percentUsed}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              percentUsed >= 100
                ? "bg-destructive"
                : percentUsed >= 90
                  ? "bg-amber-500"
                  : "bg-brand-800",
            )}
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Resets on {formatDate(usage.periodEnd)}.{" "}
          {usage.hardStop
            ? isExhausted
              ? "The monthly allowance is used up — AI features are paused until the reset. Upgrade for a bigger pool and no hard stop."
              : "On the free plan, AI features pause when the allowance is used up."
            : overage
              ? `Beyond the allowance, usage bills at ${overage}.`
              : ""}
        </p>
      </CardContent>
    </Card>
  );
}
