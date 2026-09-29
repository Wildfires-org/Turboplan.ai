import { zValidator } from "@hono/zod-validator";
import { eq, inArray } from "drizzle-orm";
import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import { organization } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import {
  Action,
  EntityType,
  MemberRole,
  roleHasPermission,
} from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
} from "@wildfires-org/turboplan-rbac/hono";
import {
  getRBACService,
  RBACService,
} from "@wildfires-org/turboplan-rbac/server";

import {
  allowancePlanKey,
  creditAllowance,
  extraSeats,
  PAID_PLAN_KEYS,
  type PaidPlanKey,
  PLANS,
  type PlanKey,
} from "../types";
import { buildCheckoutStartedEvent, emitBillingAnalytics } from "./analytics";
import { getCreditUsage } from "./credits";
import {
  getProjectCreationEntitlement,
  hasActiveOrgBilling,
} from "./entitlements";
import {
  getBillableSeatMembers,
  getNonViewerMembershipsForUser,
  getSubscriptionByOrganizationId,
  resolveOrganizationIdForEntity,
} from "./queries";
import {
  activateStarterPlan,
  BillingError,
  cancelSubscriptionAtPeriodEnd,
  changeSubscriptionPlan,
  createCheckoutSession,
  createPortalSession,
  resumeSubscription,
  syncSubscriptionSeatsSafe,
} from "./stripe-service";
import { isPlanKey } from "./webhook-helpers";

export const billingRouter = new Hono<RBACContext>();

const subscriptionQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

const seatsQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

const seatBillingQuerySchema = z.object({
  entityType: z.enum(["organization", "office", "project"]),
  entityId: z.string().uuid(),
});

const ENTITY_TYPE_MAP = {
  organization: EntityType.ORGANIZATION,
  office: EntityType.OFFICE,
  project: EntityType.PROJECT,
} as const;

const checkoutBodySchema = z.object({
  organizationId: z.string().uuid(),
  // Paid plans only — the free Starter plan activates via POST /select-starter.
  plan: z.enum(PAID_PLAN_KEYS as [PaidPlanKey, ...PaidPlanKey[]]),
  // Optional post-payment return path (where checkout was started from, e.g. a
  // landing-page create screen). Must be a SAFE relative path — it is appended
  // to a trusted base URL server-side, never used as an absolute redirect.
  returnPath: z
    .string()
    .regex(/^\/(?!\/)[^\s\\]*$/, "Must be a relative path")
    .optional(),
  // In-app flow context. "onboarding" returns the buyer to the app's setup
  // completion flow instead of billing settings. Server-built URLs only.
  context: z.enum(["onboarding"]).optional(),
});

const selectStarterBodySchema = z.object({
  organizationId: z.string().uuid(),
});

const usageQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

const changePlanBodySchema = z.object({
  organizationId: z.string().uuid(),
  plan: z.enum(PAID_PLAN_KEYS as [PaidPlanKey, ...PaidPlanKey[]]),
});

const portalBodySchema = z.object({
  organizationId: z.string().uuid(),
});

const cancelBodySchema = z.object({
  organizationId: z.string().uuid(),
});

const resumeBodySchema = z.object({
  organizationId: z.string().uuid(),
});

const seatRemovalParamSchema = z.object({
  userId: z.string().uuid(),
});

const seatRemovalQuerySchema = z.object({
  organizationId: z.string().uuid(),
  // "downgrade" (default) demotes the target to viewer everywhere — they keep
  // read access but stop consuming a seat. "remove" strips the memberships
  // entirely.
  mode: z.enum(["downgrade", "remove"]).default("downgrade"),
});

const entitlementQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Maps a BillingError onto its JSON response (any other error rethrows).
 * BillingError statuses include 400/409 and 500 (PRICE_NOT_FOUND), so the
 * status passes through as-is.
 */
const billingErrorResponse = (c: Context, error: unknown) => {
  if (error instanceof BillingError) {
    return c.json(
      { error: error.message, code: error.code },
      error.status as ContentfulStatusCode,
    );
  }
  throw error;
};

/**
 * Resolves the organization row (we need its slug + name for Stripe metadata
 * and redirect URLs). Returns null if the organization does not exist.
 */
const getOrganizationRow = async (organizationId: string) => {
  return db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
    columns: { id: true, slug: true, name: true },
  });
};

/**
 * Manually checks an RBAC permission for the acting user against the given
 * organization. The entity id arrives in the query/body (not a path param),
 * so we cannot use the `requirePermission` route middleware here.
 *
 * Returns `null` when allowed, or a 403 JSON Response when denied.
 */
const checkOrganizationPermission = async (
  c: Context<RBACContext>,
  organizationId: string,
  action: (typeof Action)[keyof typeof Action],
) => {
  const user = c.get("user");
  const permissionResult = await getRBACServiceForRequest(c).checkPermission(
    user.userId,
    organizationId,
    EntityType.ORGANIZATION,
    action,
    { email: user.email },
  );

  if (!permissionResult.allowed) {
    return permissionResult;
  }

  return null;
};

// GET /subscription?organizationId= — mirrored subscription + resolved plan (RBAC: READ)
billingRouter.get(
  "/subscription",
  zValidator("query", subscriptionQuerySchema),
  async (c) => {
    const { organizationId } = c.req.valid("query");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.READ,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    const subscriptionRow =
      await getSubscriptionByOrganizationId(organizationId);

    if (!subscriptionRow) {
      return c.json({ subscription: null, plan: null });
    }

    // The DB `plan` enum is the PlanKey union PLUS `grandfather`, which is
    // not a catalog plan — its card data is null, but allowances resolve as
    // `max` via allowancePlanKey.
    const plan = isPlanKey(subscriptionRow.plan)
      ? PLANS[subscriptionRow.plan]
      : null;

    const planForAllowances = allowancePlanKey(subscriptionRow.plan);
    const includedSeats = PLANS[planForAllowances].included_seats;
    const extraSeatCount = extraSeats(subscriptionRow.seats, planForAllowances);

    // Explicit allowlist — this endpoint is readable by upward-inherited
    // VIEWER access (any project collaborator in the org), so Stripe object
    // ids and internal bookkeeping stamps must never ship here. New schema
    // columns stay private unless added deliberately.
    const safeSubscription = {
      organizationId: subscriptionRow.organizationId,
      status: subscriptionRow.status,
      plan: subscriptionRow.plan,
      seats: subscriptionRow.seats,
      trialEnd: subscriptionRow.trialEnd,
      currentPeriodStart: subscriptionRow.currentPeriodStart,
      currentPeriodEnd: subscriptionRow.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionRow.cancelAtPeriodEnd,
      planChosenAt: subscriptionRow.planChosenAt,
      discountPercentOff: subscriptionRow.discountPercentOff,
      discountEndsAt: subscriptionRow.discountEndsAt,
    };

    return c.json({
      subscription: safeSubscription,
      plan,
      includedSeats,
      extraSeats: extraSeatCount,
      creditAllowance: creditAllowance(planForAllowances, extraSeatCount),
    });
  },
);

// GET /seats?organizationId= — billable contributors roster (RBAC:
// MANAGE_MEMBERS). Returns the name + email of every owner/editor org-wide;
// READ would expose that PII to upward-inherited project viewers, and every
// legitimate consumer (seat management, checkout) is an owner surface anyway.
billingRouter.get(
  "/seats",
  zValidator("query", seatsQuerySchema),
  async (c) => {
    const { organizationId } = c.req.valid("query");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    // Billable contributors = distinct non-viewer (owner/editor) members across
    // the org/office/project hierarchy. Viewers are read-only and never consume
    // a seat. A user with roles at multiple levels appears once, at their
    // highest role.
    const members = await getBillableSeatMembers(organizationId);

    return c.json({ used: members.length, members });
  },
);

// GET /seat-billing-active?entityType=&entityId= — whether adding a non-viewer
// member to this entity would change the org's seat-based bill (i.e. the owning
// org has an active/trialing subscription). Drives the invite-time billing
// notice. RBAC: READ on the entity itself, so project/office inviters who are
// not org members still get an accurate answer.
billingRouter.get(
  "/seat-billing-active",
  zValidator("query", seatBillingQuerySchema),
  async (c) => {
    const user = c.get("user");
    const { entityType, entityId } = c.req.valid("query");

    const permissionResult = await getRBACServiceForRequest(c).checkPermission(
      user.userId,
      entityId,
      ENTITY_TYPE_MAP[entityType],
      Action.READ,
      { email: user.email },
    );
    if (!permissionResult.allowed) {
      return c.json(
        { error: "Forbidden", reason: permissionResult.reason },
        403,
      );
    }

    const organizationId = await resolveOrganizationIdForEntity(
      entityType,
      entityId,
    );
    if (!organizationId) {
      return c.json({ seatBillingActive: false });
    }

    const seatBillingActive = await hasActiveOrgBilling(organizationId);
    return c.json({ seatBillingActive });
  },
);

/**
 * Orgs where the acting user is an owner (has MANAGE_MEMBERS). Shared by the
 * billing picker (`/billable-organizations`) and the landing access gate
 * (`/access`). Unlike GET /api/organizations it does NOT merge government orgs
 * the user is not actually a member of. Only ever returns orgs the user belongs
 * to with sufficient privileges, so callers need no extra RBAC check.
 */
const getOwnedBillingOrganizations = async (userId: string) => {
  const memberships = await getRBACService().getUserMemberships(userId);

  const ownedOrgIds = memberships
    .filter(
      (membership) =>
        membership.entityType === EntityType.ORGANIZATION &&
        roleHasPermission(membership.role, Action.MANAGE_MEMBERS),
    )
    .map((membership) => membership.entityId);

  if (ownedOrgIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: organization.id,
      name: organization.name,
      type: organization.type,
      slug: organization.slug,
    })
    .from(organization)
    .where(inArray(organization.id, ownedOrgIds));
};

// GET /billable-organizations — owned-org picker (auth required; the /api/*
// middleware enforces it).
billingRouter.get("/billable-organizations", async (c) => {
  const user = c.get("user");
  const organizations = await getOwnedBillingOrganizations(user.userId);
  return c.json({ organizations });
});

// GET /access — single round-trip billing gate for the landing page: resolves
// the user's default billing org (prefer personal, else first owned) AND its
// project-creation entitlement, so the client avoids a waterfall (orgs → derive
// id → entitlement). Auth required; only ever touches orgs the user owns.
billingRouter.get("/access", async (c) => {
  const user = c.get("user");

  const organizations = await getOwnedBillingOrganizations(user.userId);
  const personalOrg = organizations.find((org) => org.type === "personal");
  const organizationId = personalOrg?.id ?? organizations[0]?.id ?? null;

  if (!organizationId) {
    return c.json({
      organizationId: null,
      requiresUpgrade: false,
      plan: "starter",
      activeProjects: 0,
      projectLimit: null,
      hasActiveBilling: false,
    });
  }

  const entitlement = await getProjectCreationEntitlement(organizationId);
  return c.json({ organizationId, ...entitlement });
});

// GET /entitlement?organizationId= — the org's project-creation entitlement
// (plan, active projects, plan limit; RBAC: READ). No-op
// (requiresUpgrade:false) when billing is disabled.
billingRouter.get(
  "/entitlement",
  zValidator("query", entitlementQuerySchema),
  async (c) => {
    const { organizationId } = c.req.valid("query");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.READ,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    return c.json(await getProjectCreationEntitlement(organizationId));
  },
);

// POST /checkout — create a Stripe Checkout Session (RBAC: MANAGE_MEMBERS)
billingRouter.post(
  "/checkout",
  zValidator("json", checkoutBodySchema),
  async (c) => {
    const user = c.get("user");
    const { organizationId, plan, returnPath, context } = c.req.valid("json");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    const org = await getOrganizationRow(organizationId);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    const env = getApiEnv();

    // Build redirect URLs server-side — never accept absolute redirect targets
    // from the client (avoids open-redirect). When the checkout was started from
    // the landing create flow, `returnPath` (a validated relative path) sends the
    // user back there to finish creating; otherwise default to billing settings.
    const landingBase = env.LANDING_URL || env.TURBOPLAN_URL;
    const successUrl =
      context === "onboarding"
        ? `${env.TURBOPLAN_URL}/?setup=true`
        : returnPath
          ? `${landingBase}${returnPath}${returnPath.includes("?") ? "&" : "?"}checkout=success`
          : `${env.TURBOPLAN_URL}/organizations/${org.slug}/billing?checkout=success`;
    // Mirror the success-URL origin split: a landing-originated checkout
    // (carries `returnPath`) cancels back to the landing page; an in-app
    // checkout (no `returnPath`) cancels back to the org's billing settings so
    // the user lands where they started, not on the marketing site.
    const cancelUrl =
      context === "onboarding"
        ? `${env.TURBOPLAN_URL}/setup/plan?checkout=cancelled`
        : returnPath
          ? `${landingBase}/?checkout=cancelled`
          : `${env.TURBOPLAN_URL}/organizations/${org.slug}/billing?checkout=cancelled`;

    try {
      const url = await createCheckoutSession({
        organizationId,
        plan,
        email: user.email,
        name: org.name,
        successUrl,
        cancelUrl,
      });

      // Keyed by the user who started checkout, so it joins the person funnel
      // that leads here. organization_id rides in the properties, which is how
      // it joins the webhook-side subscription events (those are org-keyed —
      // Stripe gives them no user context).
      emitBillingAnalytics(
        buildCheckoutStartedEvent(organizationId, user.userId, plan),
      );

      return c.json({ url });
    } catch (error) {
      // Surface billing-domain errors (e.g. ALREADY_SUBSCRIBED) with their
      // machine-readable code so the client can route the user to the portal.
      return billingErrorResponse(c, error);
    }
  },
);

// POST /select-starter — activate the free Starter plan, no Stripe involved
// (RBAC: MANAGE_MEMBERS). Used by the onboarding plan step (both picking
// Starter and pressing Skip) and by "stay on the free plan" flows.
billingRouter.post(
  "/select-starter",
  zValidator("json", selectStarterBodySchema),
  async (c) => {
    const { organizationId } = c.req.valid("json");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    try {
      await activateStarterPlan(organizationId);
      return c.json({ ok: true });
    } catch (error) {
      return billingErrorResponse(c, error);
    }
  },
);

// GET /usage?organizationId= — live credit usage for the current period
// (RBAC: READ): consumed credits vs the plan+extra-seat allowance, plus the
// hard-stop flag and period bounds.
billingRouter.get(
  "/usage",
  zValidator("query", usageQuerySchema),
  async (c) => {
    const { organizationId } = c.req.valid("query");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.READ,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    return c.json(await getCreditUsage(organizationId));
  },
);

// POST /change-plan — switch a live subscription between paid plans (RBAC:
// MANAGE_MEMBERS). Swaps base/seat/overage items in one Stripe call; the
// Customer Portal cannot do this for a three-item cart, so portal plan
// switches stay disabled.
billingRouter.post(
  "/change-plan",
  zValidator("json", changePlanBodySchema),
  async (c) => {
    const { organizationId, plan } = c.req.valid("json");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    try {
      await changeSubscriptionPlan(organizationId, plan);
      return c.json({ ok: true, plan });
    } catch (error) {
      return billingErrorResponse(c, error);
    }
  },
);

// POST /portal — create a Stripe Customer Portal session (RBAC: MANAGE_MEMBERS).
// Portal configuration must allow payment-method updates, invoice history and
// cancellation ONLY — plan switching stays disabled there because the portal
// cannot remap the three-item base_plus_seats cart (use POST /change-plan).
billingRouter.post(
  "/portal",
  zValidator("json", portalBodySchema),
  async (c) => {
    const { organizationId } = c.req.valid("json");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    const subscriptionRow =
      await getSubscriptionByOrganizationId(organizationId);
    if (!subscriptionRow?.stripeCustomerId) {
      return c.json(
        { error: "No billing customer for this organization." },
        400,
      );
    }

    const org = await getOrganizationRow(organizationId);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    const env = getApiEnv();
    const returnUrl = `${env.TURBOPLAN_URL}/organizations/${org.slug}/billing`;

    const url = await createPortalSession({
      customerId: subscriptionRow.stripeCustomerId,
      returnUrl,
    });

    return c.json({ url });
  },
);

// POST /cancel — schedule the subscription to cancel at period end (RBAC:
// MANAGE_MEMBERS). Never cancels immediately; access runs to the period end.
billingRouter.post(
  "/cancel",
  zValidator("json", cancelBodySchema),
  async (c) => {
    const { organizationId } = c.req.valid("json");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    try {
      const result = await cancelSubscriptionAtPeriodEnd(organizationId);
      return c.json({ success: true, ...result });
    } catch (error) {
      // Map billing-domain guards (NO_ACTIVE_SUBSCRIPTION / ALREADY_CANCELING) to
      // their machine-readable code + status, like POST /checkout does.
      return billingErrorResponse(c, error);
    }
  },
);

// POST /resume — undo a pending period-end cancellation (RBAC: MANAGE_MEMBERS).
billingRouter.post(
  "/resume",
  zValidator("json", resumeBodySchema),
  async (c) => {
    const { organizationId } = c.req.valid("json");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    try {
      const result = await resumeSubscription(organizationId);
      return c.json({ success: true, ...result });
    } catch (error) {
      return billingErrorResponse(c, error);
    }
  },
);

// DELETE /seats/:userId — free the seat a user occupies by stripping every
// non-viewer membership they hold across the org's hierarchy (RBAC:
// MANAGE_MEMBERS). A user is billable if they hold ANY non-viewer grant at
// org/office/project level, so a single-level change would not free the seat —
// this strips them everywhere at once. `mode=downgrade` (default) demotes each
// grant to viewer (keeps read access); `mode=remove` deletes them.
billingRouter.delete(
  "/seats/:userId",
  zValidator("param", seatRemovalParamSchema),
  zValidator("query", seatRemovalQuerySchema),
  async (c) => {
    const { userId } = c.req.valid("param");
    const { organizationId, mode } = c.req.valid("query");

    const denied = await checkOrganizationPermission(
      c,
      organizationId,
      Action.MANAGE_MEMBERS,
    );
    if (denied) {
      return c.json({ error: "Forbidden", reason: denied.reason }, 403);
    }

    let membershipsChanged = 0;
    try {
      membershipsChanged = await db.transaction(async (transaction) => {
        // Enumerate INSIDE the transaction so the last-owner guard and the
        // strip loop act on the same snapshot the commit sees — enumerating
        // outside would let a grant added in between survive the removal.
        // An empty result doubles as the "not a paid seat" check (billable ==
        // holds at least one non-viewer membership in this org's hierarchy).
        const memberships = await getNonViewerMembershipsForUser(
          organizationId,
          userId,
          transaction,
        );
        if (memberships.length === 0) {
          return 0;
        }

        const rbacService = new RBACService(transaction);

        // If the target holds the org OWNER role, block stripping them when they
        // are the last owner (mirrors organizations.ts DELETE /:id/members).
        // Office/project last-owner is intentionally NOT guarded: org owners
        // inherit ownership downward (Organization → Office → Project), so those
        // entities remain manageable even with no direct owner left on them.
        const holdsOrgOwner = memberships.some(
          (membership) =>
            membership.entityType === "organization" &&
            membership.role === "owner",
        );
        if (holdsOrgOwner) {
          await rbacService.ensureNotLastOwner(
            userId,
            organizationId,
            EntityType.ORGANIZATION,
          );
        }

        for (const membership of memberships) {
          if (mode === "remove") {
            await rbacService.removeMembership(
              userId,
              membership.entityId,
              membership.entityType,
            );
          } else {
            await rbacService.updateMembershipRole(
              userId,
              membership.entityId,
              membership.entityType,
              MemberRole.VIEWER,
            );
          }
        }

        return memberships.length;
      });
    } catch (error) {
      // Map the last-owner guard to 400 like organizations.ts does; anything
      // else is a genuine failure.
      const message =
        error instanceof Error ? error.message : "Failed to remove seat";
      const status = message === "Cannot remove the last owner" ? 400 : 500;
      return c.json({ error: message }, status as 400 | 500);
    }

    if (membershipsChanged === 0) {
      return c.json({ error: "User does not occupy a paid seat" }, 404);
    }

    // Freeing seats changes the billable count — push it to Stripe (best-effort;
    // a Stripe outage must not fail the membership mutation that already landed).
    await syncSubscriptionSeatsSafe(organizationId);

    return c.json({
      success: true,
      mode,
      membershipsChanged,
    });
  },
);
