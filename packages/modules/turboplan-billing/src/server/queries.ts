import { and, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { type AnyPgColumn, union } from "drizzle-orm/pg-core";

import {
  billingWebhookEvent,
  invitations,
  OrganizationType,
  office,
  officeUsers,
  organization,
  organizationUsers,
  profile,
  project,
  projectUsers,
  type Subscription,
  type SubscriptionPlan,
  SubscriptionStatus,
  subscription,
  user,
} from "@wildfires-org/turboplan-db";
import { type DbInstance, db } from "@wildfires-org/turboplan-db/db-client";
import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

/**
 * A deduped billable-seat member: one row per user, carrying the user's HIGHEST
 * role across every level (org/office/project) at which they hold a non-viewer
 * membership in the organization.
 */
export type BillableSeatMember = {
  userId: string;
  email: string;
  name: string | null;
  role: "owner" | "editor";
};

export type SubscriptionSyncInput = {
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  seats: number;
  stripeBaseItemId: string | null;
  stripeSeatItemId: string | null;
  stripeOverageItemId: string | null;
  trialEnd: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  discountPercentOff: number | null;
  discountEndsAt: Date | null;
};

export const getSubscriptionByOrganizationId = async (
  organizationId: string,
): Promise<Subscription | undefined> => {
  return db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
  });
};

/**
 * Looks up a subscription row by its Stripe subscription id. Webhook handlers
 * receive the Stripe id (not our org id), so this bridges back to the owning
 * organization for downstream work (e.g. dunning email recipients).
 */
export const getSubscriptionByStripeSubscriptionId = async (
  stripeSubscriptionId: string,
): Promise<Subscription | undefined> => {
  return db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, stripeSubscriptionId),
  });
};

/**
 * Returns the email addresses of every OWNER of an organization (direct
 * `organization_users` rows with role `owner`, joined to the user record).
 * Used to target billing notifications such as the payment-failed dunning email
 * at the people who can actually fix the payment method. Returns an empty array
 * when the org has no owners.
 */
export const getOrganizationOwnerEmails = async (
  organizationId: string,
): Promise<string[]> => {
  const rows = await db
    .select({ email: user.email })
    .from(organizationUsers)
    .innerJoin(user, eq(user.id, organizationUsers.userId))
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.role, "owner"),
      ),
    );

  return rows.map((row) => row.email);
};

export const setStripeCustomerId = async ({
  organizationId,
  stripeCustomerId,
}: {
  organizationId: string;
  stripeCustomerId: string;
}): Promise<void> => {
  await db
    .insert(subscription)
    .values({ organizationId, stripeCustomerId })
    .onConflictDoUpdate({
      target: subscription.organizationId,
      set: { stripeCustomerId, updatedAt: new Date() },
    });
};

/**
 * Counts the organization's active (non-deleted, non-template) projects
 * across all of its offices. Backs the per-org active-project limit on the
 * free plan (catalog `limits.active_projects`). Templates are content, not
 * active projects — but converting a template into a real project passes the
 * creation gate (isTemplate flip in the update routes).
 */
export const countActiveProjects = async (
  organizationId: string,
): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(
      and(
        eq(office.organizationId, organizationId),
        isNull(project.deletedAt),
        eq(project.isTemplate, false),
      ),
    );

  return row?.value ?? 0;
};

/**
 * Terminal Stripe statuses: the subscription is dead and can only be replaced,
 * never revived. Events carrying these statuses may only update the row while
 * it still tracks THAT subscription — otherwise a delayed/redelivered event
 * for an old subscription would clobber newer state (e.g. resurrect a dead
 * `pro/canceled` over a fresh Starter activation that already nulled the
 * Stripe linkage).
 */
const TERMINAL_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.INCOMPLETE_EXPIRED,
];

/**
 * Every metered call site guards its credit gate with `if (billingOrgId)`,
 * so a null resolution here silently skips BOTH the gate and metering —
 * unlimited free AI usage, with nothing to see it happen. Not currently
 * reachable for real data (every user gets a personal org atomically at
 * signup, and project/office FKs are non-cascading), but that invariant
 * lives in code the billing package doesn't own — if it's ever broken, this
 * is the one place that would otherwise fail silently. Logs only when
 * billing is actually enabled, so a disabled-billing dev/CI environment
 * (where every resolution is expectedly null-ish) stays quiet.
 */
const warnIfBillingOrgMissing = (
  source: string,
  context: Record<string, unknown>,
): void => {
  if (!isBillingPackageEnabled()) {
    return;
  }
  console.warn(
    `[billing] ${source}: expected a billing org but resolution returned null — metering for this call was skipped`,
    context,
  );
};

/** project → office → org, for metering AI work that belongs to a project. */
export const resolveBillingOrgForProject = async (
  projectId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ organizationId: office.organizationId })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(eq(project.id, projectId))
    .limit(1);
  const organizationId = row?.organizationId ?? null;
  if (!organizationId) {
    warnIfBillingOrgMissing("resolveBillingOrgForProject", { projectId });
  }
  return organizationId;
};

/**
 * The user's PERSONAL org — the billing target for AI work outside any
 * project (e.g. a personal chat or a user-scoped agent run).
 */
export const resolveBillingOrgForUser = async (
  userId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ organizationId: organization.id })
    .from(organizationUsers)
    .innerJoin(
      organization,
      eq(organization.id, organizationUsers.organizationId),
    )
    .where(
      and(
        eq(organizationUsers.userId, userId),
        eq(organization.type, OrganizationType.PERSONAL),
        // Owned-only: membership in someone ELSE'S personal org must never
        // make that org this user's billing target.
        eq(organization.createdBy, userId),
      ),
    )
    .limit(1);
  const organizationId = row?.organizationId ?? null;
  if (!organizationId) {
    warnIfBillingOrgMissing("resolveBillingOrgForUser", { userId });
  }
  return organizationId;
};

export const upsertSubscriptionFromStripe = async (
  input: SubscriptionSyncInput,
): Promise<void> => {
  // Stamp `trialUsedAt` the first time we observe a subscription carrying a
  // trial. Coalesce so it is only ever set once and never moved forward; when
  // the synced subscription has no trial we leave the existing value untouched.
  const hasTrial = input.trialEnd !== null;
  const insertTrialUsedAt = hasTrial ? new Date() : null;
  const updateTrialUsedAt = hasTrial
    ? sql`coalesce(${subscription.trialUsedAt}, now())`
    : sql`${subscription.trialUsedAt}`;

  // A live paid subscription proves the org explicitly chose a plan — stamp
  // the onboarding gate once (starter activation stamps its own path).
  const isLiveSync = !TERMINAL_SUBSCRIPTION_STATUSES.includes(input.status);

  // Params inside raw sql`` fragments bypass drizzle's column encoding, so a
  // bare Date crashes the postgres driver (Buffer.byteLength on a Date).
  // Bind the discount end as an ISO string with an explicit cast instead.
  const discountEndsAtParam = input.discountEndsAt
    ? input.discountEndsAt.toISOString()
    : null;
  const noticeStampReset = (column: AnyPgColumn) =>
    sql`CASE WHEN ${subscription.discountEndsAt} IS NOT DISTINCT FROM ${discountEndsAtParam}::timestamp THEN ${column} ELSE NULL END`;
  const insertPlanChosenAt = isLiveSync ? new Date() : null;
  const updatePlanChosenAt = isLiveSync
    ? sql`coalesce(${subscription.planChosenAt}, now())`
    : sql`${subscription.planChosenAt}`;

  await db
    .insert(subscription)
    .values({
      organizationId: input.organizationId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: input.status,
      plan: input.plan,
      seats: input.seats,
      stripeBaseItemId: input.stripeBaseItemId,
      stripeSeatItemId: input.stripeSeatItemId,
      stripeOverageItemId: input.stripeOverageItemId,
      trialEnd: input.trialEnd,
      trialUsedAt: insertTrialUsedAt,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      discountPercentOff: input.discountPercentOff,
      discountEndsAt: input.discountEndsAt,
      planChosenAt: insertPlanChosenAt,
    })
    .onConflictDoUpdate({
      target: subscription.organizationId,
      // Staleness guards against out-of-order webhook delivery (Stripe does
      // not guarantee ordering):
      // - Terminal-status events only apply while the row still references
      //   the same Stripe subscription (see TERMINAL_SUBSCRIPTION_STATUSES).
      // - Live-status events apply unless the row already tracks a DIFFERENT
      //   live subscription — a delayed live event from an old subscription
      //   must not clobber the newer checkout's linkage, plan and period.
      //   A new live subscription still lands: by the time it exists, the
      //   old row is unlinked (starter) or terminal (canceled first).
      setWhere: isLiveSync
        ? or(
            isNull(subscription.stripeSubscriptionId),
            sql`${subscription.stripeSubscriptionId} = ${input.stripeSubscriptionId}`,
            inArray(subscription.status, TERMINAL_SUBSCRIPTION_STATUSES),
          )
        : sql`${subscription.stripeSubscriptionId} = ${input.stripeSubscriptionId}`,
      set: {
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        status: input.status,
        plan: input.plan,
        seats: input.seats,
        stripeBaseItemId: input.stripeBaseItemId,
        stripeSeatItemId: input.stripeSeatItemId,
        stripeOverageItemId: input.stripeOverageItemId,
        trialEnd: input.trialEnd,
        trialUsedAt: updateTrialUsedAt,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        discountPercentOff: input.discountPercentOff,
        discountEndsAt: input.discountEndsAt,
        // A new or extended discount must re-arm the ending notices; stamps
        // survive only while discount_ends_at is unchanged.
        discountNotice30SentAt: noticeStampReset(
          subscription.discountNotice30SentAt,
        ),
        discountNotice7SentAt: noticeStampReset(
          subscription.discountNotice7SentAt,
        ),
        planChosenAt: updatePlanChosenAt,
        updatedAt: new Date(),
      },
    });
};

/**
 * Returns the distinct user ids that occupy a billable seat in the
 * organization. A user is billable if they hold a non-viewer (owner/editor)
 * membership at ANY level of the org hierarchy:
 *  - `organization_users` directly on the org;
 *  - `office_users` on an office belonging to the org;
 *  - `project_users` on a (non-deleted) project belonging to one of the org's
 *    offices.
 *
 * The three sets are `UNION`ed (which dedupes), so a user who is, e.g., an org
 * editor AND a project owner is counted exactly once.
 */
export const getBillableSeatUserIds = async (
  organizationId: string,
): Promise<string[]> => {
  const orgSeats = db
    .select({ userId: organizationUsers.userId })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        ne(organizationUsers.role, "viewer"),
      ),
    );

  const officeSeats = db
    .select({ userId: officeUsers.userId })
    .from(officeUsers)
    .innerJoin(office, eq(office.id, officeUsers.officeId))
    .where(
      and(
        eq(office.organizationId, organizationId),
        ne(officeUsers.role, "viewer"),
      ),
    );

  const projectSeats = db
    .select({ userId: projectUsers.userId })
    .from(projectUsers)
    .innerJoin(
      project,
      and(eq(project.id, projectUsers.projectId), isNull(project.deletedAt)),
    )
    .innerJoin(office, eq(office.id, project.officeId))
    .where(
      and(
        eq(office.organizationId, organizationId),
        ne(projectUsers.role, "viewer"),
      ),
    );

  // `union` dedupes across the three levels, so each user appears once.
  const rows = await union(orgSeats, officeSeats, projectSeats);

  return rows.map((row) => row.userId);
};

/**
 * Counts billable seats for an organization: distinct non-viewer members
 * across the org/office/project hierarchy. Always returns at least 1
 * (checkout relies on a quantity >= 1). This is the Stripe-facing count — it
 * only reflects ACCEPTED memberships, since a pending invite is not yet a
 * seat anyone should be charged for. For the seat-cap ENTITLEMENT check, see
 * {@link countReservedBillableSeats}, which also reserves pending invites.
 */
export const countBillableSeats = async (
  organizationId: string,
): Promise<number> => {
  const userIds = await getBillableSeatUserIds(organizationId);
  return Math.max(1, userIds.length);
};

/**
 * Distinct emails with a PENDING non-viewer invitation anywhere in an org's
 * org/office/project hierarchy. Pending invites are a "seat in waiting" — see
 * {@link countReservedBillableSeats} — so this is the other half of the
 * entitlement-check seat count, not just the accepted-membership half.
 */
export const getPendingBillableSeatEmails = async (
  organizationId: string,
): Promise<string[]> => {
  const orgInvites = db
    .select({ email: invitations.email })
    .from(invitations)
    .where(
      and(
        eq(invitations.entityType, "organization"),
        eq(invitations.entityId, organizationId),
        eq(invitations.status, "pending"),
        ne(invitations.role, "viewer"),
      ),
    );

  const officeInvites = db
    .select({ email: invitations.email })
    .from(invitations)
    .innerJoin(office, eq(office.id, invitations.entityId))
    .where(
      and(
        eq(invitations.entityType, "office"),
        eq(office.organizationId, organizationId),
        eq(invitations.status, "pending"),
        ne(invitations.role, "viewer"),
      ),
    );

  const projectInvites = db
    .select({ email: invitations.email })
    .from(invitations)
    .innerJoin(
      project,
      and(eq(project.id, invitations.entityId), isNull(project.deletedAt)),
    )
    .innerJoin(office, eq(office.id, project.officeId))
    .where(
      and(
        eq(invitations.entityType, "project"),
        eq(office.organizationId, organizationId),
        eq(invitations.status, "pending"),
        ne(invitations.role, "viewer"),
      ),
    );

  const rows = await union(orgInvites, officeInvites, projectInvites);
  return [...new Set(rows.map((row) => row.email.toLowerCase()))];
};

/**
 * Counts RESERVED billable seats for the entitlement check: distinct
 * non-viewer members across the org/office/project hierarchy, PLUS distinct
 * pending non-viewer invitations not already covered by an accepted
 * membership. Always returns at least 1. Distinct from
 * {@link countBillableSeats} (the Stripe-facing, accepted-only count) —
 * nobody is billed for a pending invite, but the seat-cap check must reserve
 * it, or the cap is meaningless.
 *
 * Pending invites must count: an invite is a seat-in-waiting the moment it's
 * sent, not only once accepted. Counting only accepted members let an owner
 * send unlimited pending invites past a plan's seat cap (each individual send
 * only saw the accepted count, never the other invites in flight) — then
 * accept them concurrently, racing the accept-time recheck past the cap. This
 * closes it at the source: the cap is enforced when the reservation is made.
 */
export const countReservedBillableSeats = async (
  organizationId: string,
): Promise<number> => {
  const [userIds, pendingEmails] = await Promise.all([
    getBillableSeatUserIds(organizationId),
    getPendingBillableSeatEmails(organizationId),
  ]);

  let uncoveredInvites = pendingEmails.length;
  if (pendingEmails.length > 0 && userIds.length > 0) {
    // An accepted member with a stray pending invite for the same email
    // (e.g. re-invited to a different office) must not double-count the seat
    // they already hold.
    const existingMembers = await db
      .select({ email: user.email })
      .from(user)
      .where(inArray(user.id, userIds));
    const existingEmails = new Set(
      existingMembers.map((row) => row.email.toLowerCase()),
    );
    uncoveredInvites = pendingEmails.filter(
      (email) => !existingEmails.has(email),
    ).length;
  }

  return Math.max(1, userIds.length + uncoveredInvites);
};

/**
 * A single non-viewer membership a user holds somewhere in an org's hierarchy,
 * identified by the entity it lives on. `entityType`/`entityId` are shaped for
 * direct use with `RBACService.updateMembershipRole` / `removeMembership`.
 */
export type NonViewerMembership = {
  entityType: "organization" | "office" | "project";
  entityId: string;
  role: "owner" | "editor";
};

/**
 * Enumerates every non-viewer membership a single user holds across the
 * org/office/project hierarchy of one organization. Unlike
 * {@link getBillableSeatUserIds} (which only needs distinct user ids), seat
 * removal needs the concrete membership ROWS — the entity each grant lives on —
 * so it can strip the user from all of them at once. The three sets are
 * disjoint by entity, so no dedup is required.
 *
 * Accepts an optional executor so seat removal can enumerate INSIDE the same
 * transaction that strips the memberships — enumerating outside would let a
 * grant added between read and commit survive the removal (TOCTOU).
 *
 * The three selects are deliberately sequential, NOT Promise.all: the executor
 * is a transaction (single Postgres connection), where "concurrent" queries are
 * pipelined onto one socket and executed serially anyway — parallel issuance
 * would add no speedup, only the false impression of one.
 */
export const getNonViewerMembershipsForUser = async (
  organizationId: string,
  userId: string,
  dbOrTx: DbInstance = db,
): Promise<NonViewerMembership[]> => {
  const orgRows = await dbOrTx
    .select({
      entityId: organizationUsers.organizationId,
      role: organizationUsers.role,
    })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId),
        ne(organizationUsers.role, "viewer"),
      ),
    );

  const officeRows = await dbOrTx
    .select({
      entityId: officeUsers.officeId,
      role: officeUsers.role,
    })
    .from(officeUsers)
    .innerJoin(office, eq(office.id, officeUsers.officeId))
    .where(
      and(
        eq(office.organizationId, organizationId),
        eq(officeUsers.userId, userId),
        ne(officeUsers.role, "viewer"),
      ),
    );

  const projectRows = await dbOrTx
    .select({
      entityId: projectUsers.projectId,
      role: projectUsers.role,
    })
    .from(projectUsers)
    .innerJoin(
      project,
      and(eq(project.id, projectUsers.projectId), isNull(project.deletedAt)),
    )
    .innerJoin(office, eq(office.id, project.officeId))
    .where(
      and(
        eq(office.organizationId, organizationId),
        eq(projectUsers.userId, userId),
        ne(projectUsers.role, "viewer"),
      ),
    );

  const memberships: NonViewerMembership[] = [];
  const push = (
    entityType: NonViewerMembership["entityType"],
    rows: { entityId: string; role: "owner" | "editor" | "viewer" }[],
  ) => {
    for (const row of rows) {
      // Defensive: the queries already exclude viewers, but narrow the type.
      if (row.role === "viewer") {
        continue;
      }
      memberships.push({ entityType, entityId: row.entityId, role: row.role });
    }
  };

  push("organization", orgRows);
  push("office", officeRows);
  push("project", projectRows);

  return memberships;
};

/**
 * Resolves the owning organization id for an org/office/project entity:
 *  - organization → itself;
 *  - office → its `organizationId`;
 *  - project → its office's `organizationId` (non-deleted projects only).
 *
 * Returns null when the entity does not exist. Used to decide whether a
 * member-add against any entity touches the org's seat-based bill.
 */
export const resolveOrganizationIdForEntity = async (
  entityType: "organization" | "office" | "project",
  entityId: string,
): Promise<string | null> => {
  if (entityType === "organization") {
    // Verify the org actually exists rather than trusting the caller's id
    // outright — matches the office/project branches below, which both
    // confirm the row exists via the join. Current callers already gate on
    // RBAC (which itself requires a real entity) before reaching here, so
    // this is defense-in-depth for future callers of this shared resolver.
    const [row] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, entityId))
      .limit(1);
    return row?.id ?? null;
  }

  if (entityType === "office") {
    const [row] = await db
      .select({ organizationId: office.organizationId })
      .from(office)
      .where(eq(office.id, entityId))
      .limit(1);
    return row?.organizationId ?? null;
  }

  // Deliberately NO deletedAt filter: billing resolution must still find the
  // org for a soft-deleted project — a null here would silently skip the
  // credit gate and metering (matches resolveBillingOrgForProject).
  const [row] = await db
    .select({ organizationId: office.organizationId })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(eq(project.id, entityId))
    .limit(1);
  return row?.organizationId ?? null;
};

// Owner outranks editor when a user holds different roles at different levels.
const ROLE_RANK: Record<"owner" | "editor", number> = {
  owner: 2,
  editor: 1,
};

/**
 * Returns the deduped billable-seat roster for an organization: one row per
 * user across the org/office/project hierarchy, carrying their HIGHEST role
 * (owner > editor) and resolved email + display name.
 */
export const getBillableSeatMembers = async (
  organizationId: string,
): Promise<BillableSeatMember[]> => {
  const orgSeats = db
    .select({
      userId: organizationUsers.userId,
      role: organizationUsers.role,
    })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        ne(organizationUsers.role, "viewer"),
      ),
    );

  const officeSeats = db
    .select({
      userId: officeUsers.userId,
      role: officeUsers.role,
    })
    .from(officeUsers)
    .innerJoin(office, eq(office.id, officeUsers.officeId))
    .where(
      and(
        eq(office.organizationId, organizationId),
        ne(officeUsers.role, "viewer"),
      ),
    );

  const projectSeats = db
    .select({
      userId: projectUsers.userId,
      role: projectUsers.role,
    })
    .from(projectUsers)
    .innerJoin(
      project,
      and(eq(project.id, projectUsers.projectId), isNull(project.deletedAt)),
    )
    .innerJoin(office, eq(office.id, project.officeId))
    .where(
      and(
        eq(office.organizationId, organizationId),
        ne(projectUsers.role, "viewer"),
      ),
    );

  // Collect (userId, role) tuples across all three non-viewer sets. We cannot
  // UNION these selects: the role columns are DISTINCT Postgres enum types
  // (organization_role / office_role / project_role) and Postgres refuses to
  // unify them ("UNION could not convert type office_role to organization_role").
  // Run the three selects concurrently and merge in JS — the highest-role
  // reduction below dedupes anyway.
  const tupleSets = await Promise.all([orgSeats, officeSeats, projectSeats]);
  const tuples = tupleSets.flat();

  // Reduce to one entry per user, keeping the highest role.
  const highestRoleByUser = new Map<string, "owner" | "editor">();
  for (const { userId, role } of tuples) {
    // Defensive: the queries already exclude viewers, but narrow the type.
    if (role === "viewer") {
      continue;
    }
    const current = highestRoleByUser.get(userId);
    if (!current || ROLE_RANK[role] > ROLE_RANK[current]) {
      highestRoleByUser.set(userId, role);
    }
  }

  const userIds = [...highestRoleByUser.keys()];
  if (userIds.length === 0) {
    return [];
  }

  // Resolve email + display name for the deduped users.
  const profiles = await db
    .select({
      userId: user.id,
      email: user.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(inArray(user.id, userIds));

  return profiles.map((row) => {
    const fullName = [row.firstName, row.lastName]
      .filter((part): part is string => Boolean(part))
      .join(" ")
      .trim();

    return {
      userId: row.userId,
      email: row.email,
      name: fullName.length > 0 ? fullName : null,
      // Non-null: every resolved user id came from `highestRoleByUser`.
      role: highestRoleByUser.get(row.userId)!,
    };
  });
};

/**
 * Returns true if a Stripe webhook event id has already been processed.
 */
/**
 * Atomically claims a Stripe webhook event id BEFORE processing. Exactly one
 * concurrent delivery wins the insert; every other delivery (concurrent or
 * later redelivery) sees `false` and must acknowledge without reprocessing.
 * A check-then-record pattern would let two concurrent deliveries of the same
 * event id both run the handler.
 */
export const claimWebhookEvent = async (
  id: string,
  type: string,
): Promise<boolean> => {
  const rows = await db
    .insert(billingWebhookEvent)
    .values({ id, type })
    .onConflictDoNothing({ target: billingWebhookEvent.id })
    .returning({ id: billingWebhookEvent.id });
  return rows.length > 0;
};

/**
 * Releases a claimed webhook event after its handler FAILED, so Stripe's
 * redelivery reprocesses it instead of being deduplicated away.
 */
export const releaseWebhookEvent = async (id: string): Promise<void> => {
  await db.delete(billingWebhookEvent).where(eq(billingWebhookEvent.id, id));
};
