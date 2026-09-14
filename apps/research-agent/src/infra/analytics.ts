import { PostHog } from "posthog-node";

import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

/**
 * PostHog capture for run-lifecycle events. Runs are service-to-service
 * (no end-user context), so events use the "system" distinct id and carry
 * run metadata as properties. No-ops when POSTHOG_API_KEY is unset.
 */
let client: PostHog | null = null;

const getClient = (): PostHog | null => {
  const env = getResearchAgentEnv();
  if (!env.POSTHOG_API_KEY) {
    return null;
  }
  if (!client) {
    client = new PostHog(env.POSTHOG_API_KEY, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
};

export const captureRunEvent = (
  event: "research_run_started" | "research_run_completed",
  properties?: Record<string, unknown>,
) => {
  try {
    // getClient() reads the app env, which throws when required vars are
    // absent (e.g. bare test checkouts). Analytics must never take down a
    // run, so the env read is inside the try as well.
    const posthog = getClient();
    if (!posthog) {
      return;
    }
    posthog.capture({
      distinctId: "system",
      event,
      properties: { service: "research-agent", ...properties },
    });
  } catch (error) {
    console.error("PostHog captureRunEvent failed:", error);
  }
};

export const shutdownAnalytics = async () => {
  if (client) {
    await client.shutdown();
  }
};
