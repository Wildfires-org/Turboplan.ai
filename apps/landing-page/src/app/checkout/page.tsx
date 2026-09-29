import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutView } from "@wildfires-org/turboplan-billing/client";
import {
  CATALOG,
  PAID_PLAN_KEYS,
  type PaidPlanKey,
} from "@wildfires-org/turboplan-billing/types";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import {
  CATALOG_H1_CLASS,
  CATALOG_PAGE_CLASS,
  CATALOG_TOP_CLASS,
  GLASS_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/catalog/catalog-layout";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import {
  Eyebrow,
  SECTION_LEAD_CLASS,
} from "@/components/home-v2/ui/section-header";
import { StatusPanel } from "@/components/shared/status-panel";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";

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
      <StatusPanel
        icon={CreditCard}
        eyebrow="Checkout"
        title="Billing is not enabled"
        lead="Subscription checkout isn't available right now."
        actions={
          <>
            <Link
              href={routing.home()}
              className={cn(PRIMARY_BUTTON_CLASS, "h-11")}
            >
              Go to homepage
            </Link>
            <Link
              href={routing.contact()}
              className={cn(GLASS_BUTTON_CLASS, "h-11")}
            >
              Contact us
            </Link>
          </>
        }
      />
    );
  }

  const { TURBOPLAN_URL } = getLandingPageEnv();

  // Preselect from ?plan= (landing pricing CTAs); anything but a known paid
  // plan key is ignored and the default applies.
  const { plan } = await searchParams;
  const initialPlan = PAID_PLAN_KEYS.includes(plan as PaidPlanKey)
    ? (plan as PaidPlanKey)
    : undefined;

  const hasTrial = CATALOG.billing.trial_days > 0;

  return (
    <div className={CATALOG_PAGE_CLASS}>
      <section className={CATALOG_TOP_CLASS}>
        <div className={cn(PAGE_CONTAINER, "max-w-[960px]")}>
          <header className="mb-8 flex flex-col items-center gap-[18px] text-center sm:mb-10">
            <Eyebrow icon={CreditCard} label="Checkout" />
            <h1 className={CATALOG_H1_CLASS}>Choose your plan</h1>
            <p className={cn(SECTION_LEAD_CLASS, "max-w-[640px]")}>
              {hasTrial
                ? `You will not be charged until your ${CATALOG.billing.trial_days}-day free trial ends.`
                : "A flat workspace price — seats beyond the included count bill separately."}
            </p>
          </header>

          <div className="glass-card rounded-[28px] p-5 sm:p-8 lg:p-10">
            <CheckoutView
              showHeader={false}
              turboplanUrl={TURBOPLAN_URL}
              initialPlan={initialPlan}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
