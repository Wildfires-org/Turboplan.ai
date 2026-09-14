"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { useSession } from "@wildfires-org/turboplan-auth/client";

/** Shape of the `GET /api/billing/access` response. */
interface BillingAccessResponse {
  /** Resolved billing org (personal preferred, else first owned); null when none. */
  organizationId: string | null;
  requiresUpgrade: boolean;
  plan: string;
  activeProjects: number;
  /** Max active projects for the plan; null = unlimited. */
  projectLimit: number | null;
  hasActiveBilling: boolean;
}

interface BillingAccess {
  isAuthenticated: boolean;
  organizationId: string | null;
  /**
   * True only when the server says the billing org has reached its plan's
   * active-project limit and must upgrade. Comes straight from the access
   * endpoint, which returns `false` when billing is disabled (open-source
   * default) — so the UI naturally no-ops without a flag check. Stays `false`
   * while loading or when unauthenticated.
   */
  requiresUpgrade: boolean;
  /** True when the billing org already has an active/trialing subscription. */
  hasActiveBilling: boolean;
  /**
   * True while access is still being resolved for an authenticated user.
   * Callers must NOT treat `requiresUpgrade === false` as final until this is
   * `false` — otherwise a click fired before the fetch resolves could route to
   * the wrong flow.
   */
  isLoading: boolean;
}

const BILLING_ACCESS_ENDPOINT = "/api/billing/access";

/**
 * Resolves whether the current user must upgrade before creating another
 * project, under the per-org plan-limit billing model.
 *
 * Anonymous users are never gated on the landing page — signup creates their
 * first (always free) project — so `requiresUpgrade` stays `false` when not
 * authenticated. For authenticated users the server resolves the billing org
 * (preferring a `"personal"` org, else the first owned org) and its entitlement
 * in a single round-trip, avoiding a client-side orgs → entitlement waterfall.
 */
export function useBillingAccess(): BillingAccess {
  const session = useSession();
  const isAuthenticated = !!session?.user;

  // Only fetch once authenticated. The api-client `fetcher` mints a Bearer
  // token from the session cookie (via /api/auth/token) and targets the Hono
  // server.
  const { data } = useSWR<BillingAccessResponse>(
    isAuthenticated ? BILLING_ACCESS_ENDPOINT : null,
    fetcher,
    // Multiple components (ProjectPromptInput, CreateProjectFromTemplateButton)
    // call this independently; a long dedup window collapses rapid re-renders
    // and remounts into a single /api/billing/access fetch.
    { dedupingInterval: 60_000 },
  );

  return {
    isAuthenticated,
    organizationId: data?.organizationId ?? null,
    requiresUpgrade: data?.requiresUpgrade ?? false,
    hasActiveBilling: data?.hasActiveBilling ?? false,
    isLoading: isAuthenticated && data === undefined,
  };
}
