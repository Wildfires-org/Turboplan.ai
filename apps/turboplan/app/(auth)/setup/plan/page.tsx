import { redirect } from "next/navigation";

import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import { PlanStep } from "./plan-step";

/**
 * Onboarding plan step. Bypassed entirely when billing is disabled —
 * open-source installs go straight to the app.
 */
export default function SetupPlanPage() {
  if (!isBillingPackageEnabled()) {
    redirect("/?setup=true");
  }

  return <PlanStep />;
}
