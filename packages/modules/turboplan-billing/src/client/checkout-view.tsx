"use client";

import { useEffect, useState } from "react";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher, postFetcher } from "@wildfires-org/turboplan-api-client";
import { useSession } from "@wildfires-org/turboplan-auth/client";
import {
  Badge,
  Button,
  Checkbox,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@wildfires-org/turboplan-utils";

import {
  CATALOG,
  extraSeats,
  monthlyBase,
  PAID_PLAN_KEYS,
  type PaidPlanKey,
  PLANS,
  type PlanKey,
} from "../types";
import { PlanCard } from "./plan-card";

const TRIAL_DAYS = CATALOG.billing.trial_days;
const HAS_TRIAL = TRIAL_DAYS > 0;

/**
 * Minimal shape of an org returned by `GET /api/billing/billable-organizations`.
 * Only orgs the user owns (has MANAGE_MEMBERS on) are returned.
 */
interface UserOrganization {
  id: string;
  name: string;
  /** Organization type; a `"personal"` org is preferred as the billing default. */
  type?: string;
  slug?: string;
}

/** Envelope returned by `GET /api/billing/billable-organizations`. */
interface BillableOrganizationsResponse {
  organizations: UserOrganization[];
}

interface CheckoutResponse {
  url: string;
}

/**
 * A billable member (owner/editor) as returned by `GET /api/billing/seats`.
 * Defined locally so this package doesn't depend on app-level wire types.
 */
interface SeatMember {
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

/** Envelope returned by `GET /api/billing/seats`. */
interface SeatsResponse {
  used: number;
  members: SeatMember[];
}

const DEFAULT_PLAN: PaidPlanKey = "pro";

const BILLABLE_ORGANIZATIONS_ENDPOINT = "/api/billing/billable-organizations";
const CHECKOUT_ENDPOINT = "/api/billing/checkout";

export interface CheckoutViewProps {
  /**
   * Render the built-in "Choose your plan" header. Defaults to `true` for the
   * standalone `/checkout` page; the modal sets `false` and supplies its own.
   */
  showHeader?: boolean;
  /** Extra classes for the outer container (e.g. page bottom padding). */
  className?: string;
  /**
   * When true (default) send the current path as `returnPath` so Stripe returns
   * the user here (landing create flow). When false, omit `returnPath` — the
   * checkout endpoint then defaults success to the turboplan billing settings
   * page (the in-app flow).
   */
  returnToOrigin?: boolean;
  /**
   * Absolute URL of the turboplan app, used only for the "Sign in / Open
   * TurboPlan" fallback link. Optional; that branch never triggers inside the
   * authenticated turboplan app.
   */
  turboplanUrl?: string;
  /**
   * Bill this organization directly. When provided (the in-app turboplan flow),
   * the component skips the owned-org fetch, the org picker, and the
   * session/sign-in gate — the caller guarantees an authenticated user with
   * access to this org. When omitted (landing flow), the user's owned orgs are
   * fetched and a default/picker is resolved from the session.
   */
  organizationId?: string;
  /**
   * Full href to the billed org's members page. When set, a "Manage members"
   * link is shown in the seat block so buyers can adjust members before
   * purchase. When omitted no link renders (e.g. the landing flow).
   */
  manageMembersUrl?: string;
  /**
   * Plan preselected on mount (e.g. from a `?plan=` link on the landing
   * pricing section). Callers must pass an already-validated paid plan key;
   * defaults to the standard default plan when omitted.
   */
  initialPlan?: PaidPlanKey;
}

/** Roster display label — name when present, otherwise the email. */
const seatLabel = (member: SeatMember): string => member.name || member.email;

export function CheckoutView({
  showHeader = true,
  className,
  returnToOrigin = true,
  turboplanUrl,
  organizationId: organizationIdProp,
  manageMembersUrl,
  initialPlan,
}: CheckoutViewProps) {
  const session = useSession();
  // An explicit org (in-app usage) means the caller already authenticated the
  // user; don't gate on the landing session, which isn't wired in that app.
  const isAuthenticated = !!organizationIdProp || !!session?.user;

  const [selectedPlan, setSelectedPlan] = useState<PaidPlanKey>(
    initialPlan ?? DEFAULT_PLAN,
  );
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  // Only fetch organizations once we know the user is authenticated. The
  // api-client `fetcher` mints a Bearer token from the session cookie (via
  // /api/auth/token) and targets the Hono server. This endpoint returns only
  // the orgs the user OWNS, so the picker never lists non-owned/government orgs.
  const {
    data: orgsData,
    isLoading: isLoadingOrgs,
    error: orgsError,
  } = useSWR<BillableOrganizationsResponse>(
    // With an explicit org we bill it directly — no need to list owned orgs.
    isAuthenticated && !organizationIdProp
      ? BILLABLE_ORGANIZATIONS_ENDPOINT
      : null,
    fetcher,
  );

  const organizations = orgsData?.organizations;

  // Pick a sensible default org to bill once the list loads: prefer the user's
  // personal org, otherwise fall back to the first. The user can override this
  // via the picker below when they belong to more than one organization.
  useEffect(() => {
    if (!organizations || organizations.length === 0) {
      return;
    }

    const isStillValid = organizations.some((org) => org.id === selectedOrgId);
    if (isStillValid) {
      return;
    }

    const personalOrg = organizations.find((org) => org.type === "personal");
    setSelectedOrgId(personalOrg?.id ?? organizations[0].id);
  }, [organizations, selectedOrgId]);

  const organization =
    organizations?.find((org) => org.id === selectedOrgId) ??
    organizations?.[0];
  // The org we will actually bill: the explicit prop wins; otherwise the
  // resolved/selected org from the fetched list.
  const billingOrgId = organizationIdProp ?? organization?.id ?? null;
  const hasOrganization = !!billingOrgId;
  const hasMultipleOrgs =
    !organizationIdProp && (organizations?.length ?? 0) > 1;

  const plan = PLANS[selectedPlan];

  // base_plus_seats: the workspace price covers the plan's included seats;
  // only billable members beyond that add extra-seat items. The SWR key
  // includes `billingOrgId`, so switching the org in the picker re-fetches
  // and re-prices automatically. This never blocks checkout — on error we
  // fall back to the base workspace price.
  const {
    data: seats,
    error: seatsError,
    isLoading: isSeatsLoading,
  } = useSWR<SeatsResponse>(
    billingOrgId ? `/api/billing/seats?organizationId=${billingOrgId}` : null,
    fetcher,
  );

  const hasSeatData = Boolean(seats) && !seatsError;
  const billableSeats = seats?.used ?? 0;
  const memberWord = billableSeats === 1 ? "member" : "members";
  const extraSeatCount = extraSeats(billableSeats, selectedPlan);
  const extraSeatPrice = plan.additional_seat_price_usd ?? 0;
  const dueMonthly =
    monthlyBase(selectedPlan) + extraSeatCount * extraSeatPrice;

  const { trigger: triggerCheckout } = useSWRMutation(
    CHECKOUT_ENDPOINT,
    postFetcher<CheckoutResponse>,
  );

  const handleCheckout = async () => {
    if (!hasAgreedToTerms || !billingOrgId || isRedirecting) {
      return;
    }

    setErrorMessage(null);
    setIsRedirecting(true);

    try {
      // Authed POST via ApiClient (attaches the Bearer token minted from the
      // session cookie). Returns the Stripe Checkout URL to redirect to.
      // `returnPath` brings the user back to the create screen they started from
      // (not the billing settings page) so they can finish creating their project
      // once billing is active. When omitted (in-app flow), the endpoint defaults
      // success to the turboplan billing settings page.
      const { url } = await triggerCheckout({
        organizationId: billingOrgId,
        plan: selectedPlan,
        returnPath: returnToOrigin ? window.location.pathname : undefined,
      });

      if (!url) {
        throw new Error("Checkout session did not return a redirect URL.");
      }

      window.location.href = url;
    } catch (error) {
      // postFetcher rethrows the server's `error` string as the Error message
      // (e.g. the ALREADY_SUBSCRIBED guidance to manage billing from the portal).
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't start your checkout. Please try again in a moment.",
      );
      setIsRedirecting(false);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {showHeader ? (
        <header className="mb-8">
          <h1 className="text-2xl font-medium text-foreground">
            Choose your plan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {HAS_TRIAL
              ? `You will not be charged until your ${TRIAL_DAYS}-day free trial ends.`
              : "A flat workspace price — seats beyond the included count bill separately."}
          </p>
        </header>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {PAID_PLAN_KEYS.map((planKey) => (
          <PlanCard
            key={planKey}
            plan={PLANS[planKey]}
            isSelected={planKey === selectedPlan}
            onSelect={(key: PlanKey) => {
              // Only paid cards are rendered, so `key` is always a paid plan.
              if (key !== "starter") {
                setSelectedPlan(key);
              }
            }}
          />
        ))}
      </div>

      {billingOrgId && !seatsError ? (
        <div className="mt-8 flex flex-col gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
          {isSeatsLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsRosterOpen((open) => !open)}
                aria-expanded={isRosterOpen}
                className="flex w-full items-center justify-between gap-2 text-left text-foreground"
              >
                <span>
                  <span className="font-medium">{billableSeats}</span> billable{" "}
                  {memberWord} on this plan
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isRosterOpen && "rotate-180",
                  )}
                />
              </button>
              {isRosterOpen && seats && seats.members.length > 0 ? (
                <ul className="divide-y divide-border rounded-md border border-border bg-background">
                  {seats.members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <span className="truncate text-foreground">
                        {seatLabel(member)}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {member.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Viewers don&apos;t use a seat.
            {manageMembersUrl ? (
              <>
                {" "}
                <Link
                  href={manageMembersUrl}
                  className="text-brand-700 underline"
                >
                  Manage members
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-start justify-between gap-4 text-sm text-foreground">
          <span>{HAS_TRIAL ? "Due after trial ends" : "Due monthly"}</span>
          {isSeatsLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : hasSeatData ? (
            <span className="flex flex-col items-end">
              <span className="font-medium">${dueMonthly}</span>
              <span className="text-xs text-muted-foreground">
                {extraSeatCount > 0
                  ? `($${monthlyBase(selectedPlan)} base + ${extraSeatCount} extra ${extraSeatCount === 1 ? "seat" : "seats"} × $${extraSeatPrice}/mo)`
                  : `(${plan.included_seats} seats included)`}
              </span>
            </span>
          ) : (
            <span className="font-medium">
              ${plan.price_usd}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                /mo
              </span>
            </span>
          )}
        </div>
        {HAS_TRIAL ? (
          <div className="flex items-center justify-between text-sm text-foreground">
            <span>
              Due today{" "}
              <span className="text-brand-700">({TRIAL_DAYS} days free)</span>
            </span>
            <span className="font-medium">$0</span>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Any applicable tax will be applied to your total.
        </p>
      </div>

      <div className="mt-6">
        <CheckoutFooter
          isAuthenticated={isAuthenticated}
          isLoadingOrgs={isAuthenticated && isLoadingOrgs}
          hasOrgsError={!!orgsError}
          hasOrganization={hasOrganization}
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onSelectOrg={setSelectedOrgId}
          showOrgPicker={hasMultipleOrgs}
          hasAgreedToTerms={hasAgreedToTerms}
          onAgreeChange={setHasAgreedToTerms}
          isRedirecting={isRedirecting}
          errorMessage={errorMessage}
          onSubmit={handleCheckout}
          turboplanUrl={turboplanUrl}
        />
      </div>
    </div>
  );
}

interface CheckoutFooterProps {
  isAuthenticated: boolean;
  isLoadingOrgs: boolean;
  hasOrgsError: boolean;
  hasOrganization: boolean;
  organizations: UserOrganization[] | undefined;
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string) => void;
  showOrgPicker: boolean;
  hasAgreedToTerms: boolean;
  onAgreeChange: (value: boolean) => void;
  isRedirecting: boolean;
  errorMessage: string | null;
  onSubmit: () => void;
  turboplanUrl?: string;
}

function CheckoutFooter({
  isAuthenticated,
  isLoadingOrgs,
  hasOrgsError,
  hasOrganization,
  organizations,
  selectedOrgId,
  onSelectOrg,
  showOrgPicker,
  hasAgreedToTerms,
  onAgreeChange,
  isRedirecting,
  errorMessage,
  onSubmit,
  turboplanUrl,
}: CheckoutFooterProps) {
  const selectedOrg =
    organizations?.find((org) => org.id === selectedOrgId) ??
    organizations?.[0];
  const selectedOrgLabel = selectedOrg?.name ?? "this organization";

  // Not signed in (or signed in with no workspace) — point them into the app
  // to sign in / create a workspace instead of letting checkout fail.
  if (
    !isAuthenticated ||
    (!isLoadingOrgs && !hasOrganization && !hasOrgsError)
  ) {
    const message = !isAuthenticated
      ? HAS_TRIAL
        ? "Sign in to start your free trial."
        : "Sign in to subscribe."
      : HAS_TRIAL
        ? "You need a workspace before you can start a trial."
        : "You need a workspace before you can subscribe.";

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        {turboplanUrl ? (
          <Button
            asChild
            size="lg"
            className="w-full bg-brand-800 text-white hover:bg-brand-900"
          >
            <Link href={turboplanUrl}>
              {!isAuthenticated ? "Sign in to continue" : "Open TurboPlan"}
              <ArrowRight className="ml-2 size-5" />
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {showOrgPicker ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="billing-account"
            className="text-sm font-medium text-foreground"
          >
            Billing account
          </label>
          <Select
            value={selectedOrgId ?? undefined}
            onValueChange={onSelectOrg}
          >
            <SelectTrigger id="billing-account" className="w-full">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations?.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        Premium applies to{" "}
        <span className="font-medium text-foreground">{selectedOrgLabel}</span>.
        Other organizations without their own subscription stay locked.
      </p>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
        <Checkbox
          checked={hasAgreedToTerms}
          onCheckedChange={(value) => onAgreeChange(value === true)}
          className="mt-0.5"
          aria-label="Agree to Terms of Service and Privacy Policy"
        />
        <span>
          I understand and agree to{" "}
          <Link href="#" className="text-brand-700 underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-brand-700 underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        onClick={onSubmit}
        disabled={!hasAgreedToTerms || isLoadingOrgs || isRedirecting}
        className={cn(
          "w-full bg-brand-800 text-white hover:bg-brand-900",
          isLoadingOrgs && "pointer-events-none",
        )}
      >
        {isRedirecting
          ? "Redirecting to checkout…"
          : HAS_TRIAL
            ? "Start Free Trial"
            : "Subscribe"}
        {!isRedirecting ? <ArrowRight className="ml-2 size-5" /> : null}
      </Button>

      {isLoadingOrgs ? <Skeleton className="h-4 w-40" /> : null}
    </div>
  );
}
