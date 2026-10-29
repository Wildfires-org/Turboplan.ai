import { redirect } from "next/navigation";

import { isBillingEnforcementEnabled } from "@wildfires-org/turboplan-feature-flags";

import { PlanStep } from "./plan-step";

/**
 * Onboarding plan step. Bypassed entirely when billing enforcement is
 * disabled: with the billing package off (open-source installs) or
 * enforcement switched off, no plan unlocks anything, so users go straight to
 * the app.
 */
export default function SetupPlanPage() {
  if (!isBillingEnforcementEnabled()) {
    redirect("/?setup=true");
  }

  return <PlanStep />;
}
