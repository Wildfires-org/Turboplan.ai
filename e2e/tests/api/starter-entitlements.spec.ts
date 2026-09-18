import { expect, test } from "@playwright/test";

import {
  activateStarterPlan,
  assertProjectCreationAllowed,
  assertSeatAvailable,
  BillingError,
} from "@wildfires-org/turboplan-billing/server";
import { PLANS } from "@wildfires-org/turboplan-billing/types";
import { office, project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getInvitationService } from "@wildfires-org/turboplan-workspace/server";

import {
  addOrganizationEditor,
  type BillingTestOrg,
  createBillingTestOrg,
  createTestInvitation,
  createTestUserWithMagicLink,
  getCitizenWorkspace,
} from "../../utils";

const isTruthy = (value: string | undefined): boolean =>
  value === "true" || value === "1";

const isBillingEnabled = (): boolean =>
  isTruthy(process.env.IS_BILLING_PACKAGE_ENABLED) ||
  isTruthy(process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED);

const STARTER_SEATS = PLANS.starter.included_seats;
const STARTER_PROJECT_LIMIT =
  "active_projects" in PLANS.starter.limits
    ? PLANS.starter.limits.active_projects
    : null;

const suffix = () => Math.random().toString(36).substring(2, 10);

/**
 * Starter-plan entitlement tests, exercised through the real server helpers
 * against the test DB (`api` Playwright project, no browser):
 *
 *   - active-project limit: projects allowed up to limits.active_projects, the
 *     next one blocked with UPGRADE_REQUIRED; template projects don't consume
 *     the limit
 *   - seat cap: billable members up to included_seats, the next one blocked
 *     with SEAT_LIMIT_REACHED; existing seat-holders and viewers are free
 *   - invitation accept-time gate: a billable invite into a full Starter org
 *     throws SEAT_LIMIT_REACHED; a viewer invite accepts fine
 *
 * No Stripe interaction — Starter has no Stripe objects. The upgrade-modal UI
 * that fronts UPGRADE_REQUIRED is covered by the manual Playwright MCP pass.
 */
test.describe("Starter plan entitlements", () => {
  test.skip(!isBillingEnabled(), "Billing package disabled — skipping.");

  test.describe.configure({ mode: "serial" });

  let org: BillingTestOrg;
  let ownerUserId: string;
  let officeId: string;

  test.beforeAll(async () => {
    const workspace = await getCitizenWorkspace();
    ownerUserId = workspace.userId;

    org = await createBillingTestOrg({
      ownerId: ownerUserId,
      name: `Starter E2E Org ${Date.now()}`,
    });

    // Explicit Starter activation (same call the onboarding step makes) —
    // resolveOrgPlan would fall back to starter anyway, but this also stamps
    // plan_chosen_at like the real flow.
    await activateStarterPlan(org.id);

    const [createdOffice] = await db
      .insert(office)
      .values({
        name: `Starter E2E Office ${suffix()}`,
        slug: `starter-e2e-office-${suffix()}`,
        organizationId: org.id,
        createdBy: ownerUserId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    officeId = createdOffice.id;
  });

  const insertProject = async (params: { isTemplate?: boolean }) => {
    const name = `Starter E2E Project ${suffix()}`;
    const [row] = await db
      .insert(project)
      .values({
        name,
        slug: `starter-e2e-project-${suffix()}`,
        description: name,
        officeId,
        createdBy: ownerUserId,
        lastModifiedBy: ownerUserId,
        status: "active",
        isTemplate: params.isTemplate ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return row;
  };

  test("active projects allowed up to the limit, the next blocked with UPGRADE_REQUIRED", async () => {
    test.skip(STARTER_PROJECT_LIMIT === null, "Starter has no project limit.");

    const limit = STARTER_PROJECT_LIMIT as number;

    const before = await assertProjectCreationAllowed({
      organizationId: org.id,
    });
    expect(before.allowed).toBe(true);
    expect(before.projectLimit).toBe(limit);
    expect(before.activeProjects).toBe(0);

    // Fill the allowance: every project up to the limit must be permitted.
    for (let i = 0; i < limit; i++) {
      const decision = await assertProjectCreationAllowed({
        organizationId: org.id,
      });
      expect(decision.allowed).toBe(true);
      expect(decision.activeProjects).toBe(i);
      await insertProject({});
    }

    const after = await assertProjectCreationAllowed({
      organizationId: org.id,
    });
    expect(after.allowed).toBe(false);
    expect(after.code).toBe("UPGRADE_REQUIRED");
    expect(after.activeProjects).toBe(limit);
  });

  test("template projects do not consume the active-project limit", async () => {
    await insertProject({ isTemplate: true });

    const decision = await assertProjectCreationAllowed({
      organizationId: org.id,
    });
    // Still exactly `limit` counted active projects (the template is excluded);
    // the decision stays blocked from the previous test's real projects.
    expect(decision.activeProjects).toBe(STARTER_PROJECT_LIMIT);
  });

  test("seat cap blocks the first billable member beyond included_seats", async () => {
    // Fill the cap: the owner occupies 1 seat; add editors up to the limit.
    // addOrganizationEditor's Stripe sync is a no-op (no Stripe subscription).
    // Owner already holds seat 1; add editors for seats 2..included_seats.
    const editors: Array<{ userId: string; email: string }> = [];
    for (let i = 1; i < STARTER_SEATS; i++) {
      editors.push(
        await addOrganizationEditor({
          organizationId: org.id,
          email: `starter-seat-${i}-${Date.now()}@example.test`,
        }),
      );
    }

    // Cap full: the next NEW billable member is rejected.
    const blocked = await assertSeatAvailable({ organizationId: org.id });
    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("SEAT_LIMIT_REACHED");
    expect(blocked.billableSeats).toBe(STARTER_SEATS);
    expect(blocked.includedSeats).toBe(STARTER_SEATS);

    // A user who ALREADY holds a billable seat passes (role changes between
    // billable roles add no seat).
    const existingSeat = await assertSeatAvailable({
      organizationId: org.id,
      userId: editors[0].userId,
    });
    expect(existingSeat.allowed).toBe(true);
  });

  test("billable invite into a full org is blocked at accept time", async () => {
    const invitationService = getInvitationService();

    // The invite was created while a seat was still free (or by a surface
    // without the create-time gate) — the ACCEPT-time gate must still hold.
    const editorInvite = await createTestInvitation({
      email: `starter-late-editor-${Date.now()}@example.test`,
      entityType: "organization",
      entityId: org.id,
      entityName: org.name,
      role: "editor",
      invitedBy: ownerUserId,
    });
    expect(editorInvite).not.toBeNull();

    const { user: lateUser } = await createTestUserWithMagicLink(
      `starter-late-user-${Date.now()}@example.test`,
    );

    await expect(
      invitationService.acceptInvitation(editorInvite!.token, lateUser.id),
    ).rejects.toMatchObject({
      name: "BillingError",
      code: "SEAT_LIMIT_REACHED",
    });

    // Sanity: the error class is the billing domain error (403 for routes).
    try {
      await invitationService.acceptInvitation(
        editorInvite!.token,
        lateUser.id,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(BillingError);
      expect((error as BillingError).status).toBe(403);
    }
  });

  test("viewer invites are unlimited on a full org", async () => {
    const invitationService = getInvitationService();

    const viewerInvite = await createTestInvitation({
      email: `starter-viewer-${Date.now()}@example.test`,
      entityType: "organization",
      entityId: org.id,
      entityName: org.name,
      role: "viewer",
      invitedBy: ownerUserId,
    });
    expect(viewerInvite).not.toBeNull();

    const { user: viewerUser } = await createTestUserWithMagicLink(
      `starter-viewer-user-${Date.now()}@example.test`,
    );

    const result = await invitationService.acceptInvitation(
      viewerInvite!.token,
      viewerUser.id,
    );
    expect(result.entityId).toBe(org.id);
  });
});
