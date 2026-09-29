// Feature flags utility functions
import { featureFlags, type PackageName } from "./config";

// Check if a specific package is enabled
export function isPackageEnabled(packageName: PackageName): boolean {
  if (!(packageName in featureFlags.packages)) {
    throw new Error(
      `Unknown package: ${packageName}. Available packages: ${Object.keys(featureFlags.packages).join(", ")}`,
    );
  }
  return featureFlags.packages[packageName];
}

// Convenience functions for each package
export const isTasksPackageEnabled = () => isPackageEnabled("tasks");
export const isMapPackageEnabled = () => isPackageEnabled("map");
export const isDocumentsPackageEnabled = () => isPackageEnabled("documents");
export const isFieldsPackageEnabled = () => isPackageEnabled("fields");
export const isResearchAgentPackageEnabled = () =>
  isPackageEnabled("researchAgent");
export const isTimelineRecordsPackageEnabled = () =>
  isPackageEnabled("timelineRecords");
export const isProjectContextPackageEnabled = () =>
  isPackageEnabled("projectContext");
export const isSigningPackageEnabled = () => isPackageEnabled("signing");
export const isBillingPackageEnabled = () => isPackageEnabled("billing");
// Billing limits (credits, active projects, seats) are enforced only when the
// billing package is on AND enforcement has not been explicitly disabled.
export const isBillingEnforcementEnabled = () =>
  isBillingPackageEnabled() && featureFlags.billing.enforcement;

// Export types and config
export type { PackageName, TurboPlanPackages } from "./config";
export { featureFlags } from "./config";
