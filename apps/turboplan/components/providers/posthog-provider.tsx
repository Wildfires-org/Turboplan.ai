"use client";

import type { ReactNode } from "react";

import { posthog } from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

import { sanitizeProperties } from "@/lib/posthog-sanitize";

// NEXT_PUBLIC_ vars must be referenced statically so Next.js inlines them at
// build time. No key → PostHog stays uninitialized and every capture no-ops.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";

// Module-level init (not useEffect): child effects run before parent effects,
// so an effect-based init would race identify/group calls in nested providers
// on a hard page load. Import time is before any effect.

if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    // Anonymous traffic stays cheap — profiles only for identified users
    person_profiles: "identified_only",
    // SPA navigation pageviews
    capture_pageview: "history_change",
    sanitize_properties: sanitizeProperties,
  });
  // Attach to every event from this client — mirrors the server-side
  // `service` property so one project can be filtered per service.
  posthog.register({ service: "web" });
}

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
