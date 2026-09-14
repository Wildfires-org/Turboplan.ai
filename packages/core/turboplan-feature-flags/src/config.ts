import { isEnvValueTruthy } from "@wildfires-org/turboplan-env";

// Feature flags configuration
// Feature flags are now controlled via environment variables (remember to prefix with NEXT_PUBLIC_ for next.js client side usage):
// - IS_TASKS_PACKAGE_ENABLED
// - IS_MAPS_PACKAGE_ENABLED
// - IS_FIELDS_PACKAGE_ENABLED
// - IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED
// - IS_DOCUMENTS_PACKAGE_ENABLED
// - IS_TIMELINE_RECORDS_PACKAGE_ENABLED
// - IS_PROJECT_CONTEXT_PACKAGE_ENABLED
// - IS_BILLING_PACKAGE_ENABLED

// Define the feature flags structure
export const featureFlags = {
  packages: {
    tasks:
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.IS_TASKS_PACKAGE_ENABLED),
    map:
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.IS_MAPS_PACKAGE_ENABLED),
    documents:
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_DOCUMENTS_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.IS_DOCUMENTS_PACKAGE_ENABLED),
    fields:
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_FIELDS_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.IS_FIELDS_PACKAGE_ENABLED),
    researchAgent:
      isEnvValueTruthy(
        process.env.NEXT_PUBLIC_IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED,
      ) ||
      isEnvValueTruthy(
        process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED,
      ),
    timelineRecords:
      isEnvValueTruthy(
        process.env.NEXT_PUBLIC_IS_TIMELINE_RECORDS_PACKAGE_ENABLED,
      ) || isEnvValueTruthy(process.env.IS_TIMELINE_RECORDS_PACKAGE_ENABLED),
    projectContext:
      isEnvValueTruthy(
        process.env.NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED,
      ) || isEnvValueTruthy(process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED),
    signing:
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_SIGNING_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.IS_SIGNING_PACKAGE_ENABLED),
    billing:
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.IS_BILLING_PACKAGE_ENABLED),
  },
};

// Type definitions for the packages
export type TurboPlanPackages = typeof featureFlags.packages;
export type PackageName = keyof TurboPlanPackages;
