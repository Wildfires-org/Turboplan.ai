/**
 * PostHog event taxonomy — single source of truth for server-side event names.
 * Naming: noun_verb, past tense, snake_case.
 */
export const ANALYTICS_EVENTS = {
  // Auth / onboarding
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  MAGIC_LINK_REQUESTED: "magic_link_requested",
  ONBOARDING_COMPLETED: "onboarding_completed",
  // Workspace
  ORGANIZATION_CREATED: "organization_created",
  PROJECT_CREATED: "project_created",
  MEMBER_JOINED: "member_joined",
  MEMBER_ROLE_CHANGED: "member_role_changed",
  // Chat / AI
  CHAT_MESSAGE_SENT: "chat_message_sent",
  AI_RESPONSE_RECEIVED: "ai_response_received",
  // Documents
  DOCUMENT_UPLOADED: "document_uploaded",
  DOCUMENT_DELETED: "document_deleted",
  // Tasks
  TASK_CREATED: "task_created",
  TASK_COMPLETED: "task_completed",
  TASK_MOVED: "task_moved",
  MILESTONE_CREATED: "milestone_created",
  MILESTONE_COMPLETED: "milestone_completed",
  // Billing
  CHECKOUT_STARTED: "checkout_started",
  SUBSCRIPTION_ACTIVATED: "subscription_activated",
  SUBSCRIPTION_CANCELED: "subscription_canceled",
  PAYMENT_FAILED: "payment_failed",
  // Emitted by sibling apps (apps/mcp-server, apps/research-agent) with their
  // own PostHog clients and literal event names. Listed here so the taxonomy
  // stays the complete picture of what the product sends.
  MCP_TOOL_CALLED: "mcp_tool_called",
  RESEARCH_RUN_STARTED: "research_run_started",
  RESEARCH_RUN_COMPLETED: "research_run_completed",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Standard properties attached to every server-side event. */
export type AnalyticsEventProperties = {
  organization_id?: string;
  office_id?: string;
  project_id?: string;
  actor_role?: string;
  source?: "web" | "mcp" | "system";
} & Record<string, unknown>;
