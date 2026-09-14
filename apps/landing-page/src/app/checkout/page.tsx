import type { Metadata } from "next";

import { CheckoutView } from "@wildfires-org/turboplan-billing/client";
import {
  PAID_PLAN_KEYS,
  type PaidPlanKey,
} from "@wildfires-org/turboplan-billing/types";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

export const metadata: Metadata = {
  title: "Checkout",
};

// `NEXT_PUBLIC_*` env vars are inlined at build time, so reading the flag
// directly mirrors how the rest of the app gates on feature flags.
const isBillingEnabled =
  process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED === "1";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  if (!isBillingEnabled) {
    return (
      <section className="flex w-full flex-col items-center py-24 text-center">
        <h1 className="text-2xl font-medium text-neutral-black">
          Billing is not enabled
        </h1>
        <p className="mt-2 text-sm text-gray-70">
          Subscription checkout isn&apos;t available right now.
        </p>
      </section>
    );
  }

  const { TURBOPLAN_URL } = getLandingPageEnv();

  // Preselect from ?plan= (landing pricing CTAs); anything but a known paid
  // plan key is ignored and the default applies.
  const { plan } = await searchParams;
  const initialPlan = PAID_PLAN_KEYS.includes(plan as PaidPlanKey)
    ? (plan as PaidPlanKey)
    : undefined;

  return (
    <CheckoutView
      className="pb-16"
      turboplanUrl={TURBOPLAN_URL}
      initialPlan={initialPlan}
    />
  );
}
