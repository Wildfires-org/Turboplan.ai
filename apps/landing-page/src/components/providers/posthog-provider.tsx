"use client";

import type { ReactNode } from "react";

import { posthog } from "posthog-js";

import { sanitizeProperties } from "@/lib/posthog-sanitize";

// NEXT_PUBLIC_ vars must be referenced statically so Next.js inlines them at
// build time. NEXT_PUBLIC_POSTHOG_ID is the legacy variable name — kept as a
// fallback so existing deployments keep tracking. No key → PostHog stays
// uninitialized and every capture no-ops.
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_ID;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";

// Module-level init (not useEffect) so it runs at import time, before any
// effect that might identify or capture. Same pattern as the web app.

if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    // Anonymous marketing traffic stays cheap — profiles only for
    // identified users
    person_profiles: "identified_only",
    // SPA navigation pageviews
    capture_pageview: "history_change",
    // The landing site and the web app share a registrable domain, so a cookie
    // scoped to that parent domain keeps one distinct id across the hand-off.
    // The ph_did hand-off param stays as the fallback bridge for environments
    // where the two are served from different domains.
    cross_subdomain_cookie: true,
    sanitize_properties: sanitizeProperties,
  });
  // Attach to every event from this client — mirrors the other services'
  // `service` property so one project can be filtered per service.
  posthog.register({ service: "landing" });
}

export function PostHogProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
