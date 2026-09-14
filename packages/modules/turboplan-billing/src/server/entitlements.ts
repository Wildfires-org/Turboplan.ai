import { and, eq, isNull, ne } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";

import {
  OrganizationType,
  office,
  officeUsers,
  organization,
  organizationUsers,
  project,
  projectUsers,
  SubscriptionPlan,
  SubscriptionStatus,
  subscription,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import {
  allowancePlanKey,
  holdsLiveSubscription,
  LIVE_SUBSCRIPTION_STATUS_VALUES,
  PLANS,
  type PlanKey,
} from "../types";
import { countActiveProjects, countReservedBillableSeats } from "./queries";

/**
 * Entitlements are PER-ORGANIZATION and derive from the pricing catalog: the
 * org's plan decides its limits (e.g. Starter's `limits.active_projects`).
 * This replaced the legacy per-user lifetime free-project counter.
 */

/**
 * Subscription statuses that count as "active billing". Grandfather comps are
 * stored as ACTIVE, so they are covered here without special-casing.
 */
const ACTIVE_BILLING_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

/**
 * Statuses under which a PAID plan's catalog allowances still apply. Includes
 * the dunning states (past_due/unpaid) — Stripe is still retrying the charge
 * and access has not lapsed, so limits must not snap to Starter mid-dunning.
 */
const PAID_ALLOWANCE_STATUSES = LIVE_SUBSCRIPTION_STATUS_VALUES;

/** The two columns every entitlement decision needs from the sub row. */
export type SubscriptionPlanRow = {
  status: string;
  plan: string | null;
};

const getSubscriptionPlanRow = async (
  organizationId: string,
): Promise<SubscriptionPlanRow | undefined> => {
  return db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
    columns: { status: true, plan: true },
  });
};

/**
 * Pure: catalog plan whose limits/allowances govern an org with this
 * subscription row.
 *
 * - live paid subscription (incl. dunning) → its plan (grandfather → max);
 * - Starter row, ended/canceled paid subscription, or no row at all → starter.
 *
 * Every org therefore always has a plan; "no subscription yet" simply means
 * the free tier.
 */
export const planFromSubscriptionRow = (
  row: SubscriptionPlanRow | undefined | null,
): PlanKey => {
  if (!row?.plan || row.plan === SubscriptionPlan.STARTER) {
    return "starter";
  }
  if (!PAID_ALLOWANCE_STATUSES.includes(row.status)) {
    return "starter";
  }

  return allowancePlanKey(row.plan);
};

/**
 * Pure: whether the row represents active PAID billing. The free Starter plan
 * is stored as an ACTIVE subscription row too, but it must never count as
 * "active billing" — seat billing and upgrade prompts key off this.
 */
export const isActiveBillingRow = (
  row: SubscriptionPlanRow | undefined | null,
): boolean => {
  if (!row || row.plan === SubscriptionPlan.STARTER) {
    return false;
  }
  return ACTIVE_BILLING_STATUSES.includes(row.status as SubscriptionStatus);
};

export const resolveOrgPlan = async (
  organizationId: string,
): Promise<PlanKey> => {
  return planFromSubscriptionRow(await getSubscriptionPlanRow(organizationId));
};

export const hasActiveOrgBilling = async (
  organizationId: string,
): Promise<boolean> => {
  return isActiveBillingRow(await getSubscriptionPlanRow(organizationId));
};

export type ProjectCreationEntitlement = {
  requiresUpgrade: boolean;
  plan: PlanKey;
  activeProjects: number;
  /** Max active projects for the plan; null = unlimited. */
  projectLimit: number | null;
  hasActiveBilling: boolean;
};

/** The plan's active-project limit from the catalog; null = unlimited. */
const projectLimitForPlan = (plan: PlanKey): number | null => {
  const limits = PLANS[plan].limits;
  return "active_projects" in limits ? limits.active_projects : null;
};

/**
 * Resolves the org's project-creation entitlement: which plan governs it, how
 * many active projects it has, the plan's limit, and the derived
 * `requiresUpgrade` (limit reached). Per-org and count-based — nothing is
 * consumed and nothing needs refunding.
 *
 * Returns the open-source default (never gated) when the billing package is
 * disabled.
 */
export const getProjectCreationEntitlement = async (
  organizationId: string,
): Promise<ProjectCreationEntitlement> => {
  if (!isBillingPackageEnabled()) {
    return {
      requiresUpgrade: false,
      plan: "starter",
      activeProjects: 0,
      projectLimit: null,
      hasActiveBilling: false,
    };
  }

  const [subscriptionRow, activeProjects] = await Promise.all([
    getSubscriptionPlanRow(organizationId),
    countActiveProjects(organizationId),
  ]);
  const plan = planFromSubscriptionRow(subscriptionRow);
  const hasActiveBilling = isActiveBillingRow(subscriptionRow);

  const projectLimit = projectLimitForPlan(plan);
  const requiresUpgrade =
    projectLimit !== null && activeProjects >= projectLimit;

  return {
    requiresUpgrade,
    plan,
    activeProjects,
    projectLimit,
    hasActiveBilling,
  };
};

export type CreateProjectDecision = ProjectCreationEntitlement & {
  allowed: boolean;
  code?: "UPGRADE_REQUIRED";
};

/**
 * Returns true when the user occupies a billable seat in the organization: a
 * non-viewer (owner/editor) membership at ANY level of the org hierarchy —
 * org-level, on an office in the org, or on a (non-deleted) project in one of
 * the org's offices. Mirrors the seat model used by `countBillableSeats`.
 *
 * Cheap existence check: short-circuits at the first level that matches rather
 * than fetching the whole seat set (this runs on seat-adding admin mutations).
 */
export const isUserOrgSeat = async (
  userId: string,
  organizationId: string,
): Promise<boolean> => {
  // Existence check across all three levels in ONE round-trip: a UNION of the
  // org/office/project seat queries with LIMIT 1. Postgres stops as soon as
  // any branch yields a row.
  const orgSeat = db
    .select({ userId: organizationUsers.userId })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId),
        ne(organizationUsers.role, "viewer"),
      ),
    );

  const officeSeat = db
    .select({ userId: officeUsers.userId })
    .from(officeUsers)
    .innerJoin(office, eq(office.id, officeUsers.officeId))
    .where(
      and(
        eq(officeUsers.userId, userId),
        eq(office.organizationId, organizationId),
        ne(officeUsers.role, "viewer"),
      ),
    );

  const projectSeat = db
    .select({ userId: projectUsers.userId })
    .from(projectUsers)
    .innerJoin(
      project,
      and(eq(project.id, projectUsers.projectId), isNull(project.deletedAt)),
    )
    .innerJoin(office, eq(office.id, project.officeId))
    .where(
      and(
        eq(projectUsers.userId, userId),
        eq(office.organizationId, organizationId),
        ne(projectUsers.role, "viewer"),
      ),
    );

  const rows = await union(orgSeat, officeSeat, projectSeat).limit(1);
  return rows.length > 0;
};

/**
 * Whether the user's PERSONAL org has explicitly chosen a plan — the gate for
 * the onboarding plan step. True when the org's subscription row carries a
 * `plan_chosen_at` stamp (Starter picked or Skip pressed) OR holds live paid
 * billing (checkout completed; the webhook stamps plan_chosen_at too, this is
 * the belt to that suspenders). Users without a personal org resolve false —
 * the plan step will offer them Starter, which activateStarterPlan can only
 * apply once an org exists.
 */
export const hasChosenPlan = async (userId: string): Promise<boolean> => {
  if (!isBillingPackageEnabled()) {
    return true;
  }

  const [row] = await db
    .select({
      planChosenAt: subscription.planChosenAt,
      status: subscription.status,
      plan: subscription.plan,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    })
    .from(subscription)
    .innerJoin(organization, eq(organization.id, subscription.organizationId))
    .innerJoin(
      organizationUsers,
      eq(organizationUsers.organizationId, organization.id),
    )
    .where(
      and(
        eq(organizationUsers.userId, userId),
        eq(organization.type, OrganizationType.PERSONAL),
        // Owned-only: a user invited into someone ELSE'S personal org must
        // not read that org's plan stamp as their own.
        eq(organization.createdBy, userId),
      ),
    )
    .limit(1);

  // No personal org of their own. Nothing can be applied to an org that does
  // not exist, so showing the plan step would trap the user: every option
  // resolves against a missing row and the step can never complete. Treat as
  // chosen and let them into the app.
  if (!row) {
    return true;
  }

  // INVARIANT: this must be true whenever activateStarterPlan would refuse,
  // or onboarding demands a choice the user is not allowed to make. Mirrors
  // that function's refusals exactly — live subscription, and comp plans.
  return (
    row.planChosenAt !== null ||
    holdsLiveSubscription(row) ||
    row.plan === SubscriptionPlan.GRANDFATHER
  );
};

export type SeatAvailabilityDecision = {
  allowed: boolean;
  code?: "SEAT_LIMIT_REACHED";
  plan: PlanKey;
  billableSeats: number;
  includedSeats: number;
};

/**
 * Gate for every mutation that ADDS billable (non-viewer) seats: invites
 * (create AND accept — seats may fill in between), direct member adds at any
 * level, and viewer→editor/owner role changes.
 *
 * Plans that sell extra seats (paid) always pass — added seats auto-bill via
 * seat sync. Plans that cannot buy seats (`additional_seat_price_usd: null`,
 * i.e. Starter) are capped at their included count. Viewers never consume a
 * seat, so viewer invites are unlimited on every plan.
 *
 * No-op (always allowed) when the billing package is disabled.
 *
 * Check-then-act by design: concurrent seat adds can briefly overshoot the
 * cap (bounded by in-flight requests; later attempts are blocked). Accepted.
 */
export const assertSeatAvailable = async ({
  organizationId,
  userId,
  addedBillableSeats = 1,
}: {
  organizationId: string;
  /**
   * The user being added/promoted, when known. A user who ALREADY occupies a
   * billable seat (e.g. a project editor being promoted to org editor) adds
   * no new seat and always passes.
   */
  userId?: string;
  addedBillableSeats?: number;
}): Promise<SeatAvailabilityDecision> => {
  if (!isBillingPackageEnabled()) {
    return {
      allowed: true,
      plan: "starter",
      billableSeats: 0,
      includedSeats: PLANS.starter.included_seats,
    };
  }

  const plan = await resolveOrgPlan(organizationId);
  const config = PLANS[plan];

  if (config.additional_seat_price_usd !== null) {
    // Paid plan: extra seats are purchasable and bill automatically.
    return {
      allowed: true,
      plan,
      billableSeats: 0,
      includedSeats: config.included_seats,
    };
  }

  if (userId && (await isUserOrgSeat(userId, organizationId))) {
    return {
      allowed: true,
      plan,
      billableSeats: 0,
      includedSeats: config.included_seats,
    };
  }

  const billableSeats = await countReservedBillableSeats(organizationId);
  return decideSeatAvailability({ plan, billableSeats, addedBillableSeats });
};

/** Pure seat-cap decision for plans without purchasable seats. */
export const decideSeatAvailability = ({
  plan,
  billableSeats,
  addedBillableSeats,
}: {
  plan: PlanKey;
  billableSeats: number;
  addedBillableSeats: number;
}): SeatAvailabilityDecision => {
  const includedSeats = PLANS[plan].included_seats;
  if (billableSeats + addedBillableSeats > includedSeats) {
    return {
      allowed: false,
      code: "SEAT_LIMIT_REACHED",
      plan,
      billableSeats,
      includedSeats,
    };
  }

  return { allowed: true, plan, billableSeats, includedSeats };
};

/**
 * Decides whether a new project may be created in the target organization —
 * the single enforcement entry point for every creation surface (app routes,
 * templates, self-service, MCP). Pure count check against the plan's
 * active-project limit: no slot bookkeeping, nothing to refund on failure.
 *
 * Keeps the `UPGRADE_REQUIRED` code so existing 403 handling and the upgrade
 * modal flow continue to work unchanged. No-op (always allowed) when the
 * billing package is disabled.
 *
 * Check-then-act by design: concurrent creations can briefly overshoot the
 * limit (bounded by in-flight requests; later attempts are blocked). Accepted
 * — the old atomic consume was bookkeeping-heavy for a soft product cap.
 */
export const assertProjectCreationAllowed = async ({
  organizationId,
}: {
  organizationId: string;
}): Promise<CreateProjectDecision> => {
  const entitlement = await getProjectCreationEntitlement(organizationId);

  if (entitlement.requiresUpgrade) {
    return { ...entitlement, allowed: false, code: "UPGRADE_REQUIRED" };
  }

  return { ...entitlement, allowed: true };
};
