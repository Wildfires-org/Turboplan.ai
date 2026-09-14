import { posthog } from "posthog-js";

import { useAnalyticsContext } from "@/context/analytics";

export const useAnalytics = () => {
  const { user } = useAnalyticsContext();

  /**
   * Capture only for a known campaign user (identified from the utm_uid param).
   * Silently drops for organic visitors, so it is only appropriate where
   * identified-user semantics genuinely matter — never for plain CTA/nav
   * clicks, which should use `captureEvent`.
   */
  const captureCurrentUserEvent = (
    eventName: string,
    properties?: Record<string, string>,
  ) => {
    if (!user || !posthog.__loaded) return;
    posthog.capture(eventName, properties);
  };

  /**
   * Capture regardless of identification — posthog tracks anonymous ids
   * natively. Use for marketing-funnel events (pricing, signup CTAs) where
   * visitors are overwhelmingly anonymous.
   */
  const captureEvent = (
    eventName: string,
    properties?: Record<string, string>,
  ) => {
    if (!posthog.__loaded) return;
    posthog.capture(eventName, properties);
  };

  return {
    captureCurrentUserEvent,
    captureEvent,
  };
};
