/**
 * Injection point for product analytics — mirrors turboplan-billing's
 * configureBillingAnalytics so this package stays free of a PostHog dependency.
 * The host app wires a handler at bootstrap; unset handler → no-op (which is
 * what the MCP worker and one-off scripts get).
 */

export type WorkspaceAnalyticsEvent = {
  distinctId: string;
  event: "organization_created";
  properties?: Record<string, unknown>;
};

let handler: ((event: WorkspaceAnalyticsEvent) => void) | undefined;

export const configureWorkspaceAnalytics = (
  onEvent: (event: WorkspaceAnalyticsEvent) => void,
) => {
  handler = onEvent;
};

/** Fire-and-forget — analytics can never break a workspace mutation. */
export const emitWorkspaceAnalytics = (event: WorkspaceAnalyticsEvent) => {
  try {
    handler?.(event);
  } catch (error) {
    console.error("[workspace-analytics] handler failed:", error);
  }
};
