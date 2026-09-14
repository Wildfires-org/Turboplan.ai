import { expect, test } from "@playwright/test";

import { PLANS } from "@wildfires-org/turboplan-billing/types";

import { TurboplanBillingPage } from "../../pages";
import {
  addOrganizationEditor,
  type BillingTestOrg,
  cleanupBillingTest,
  createBillingTestOrg,
  getCitizenWorkspace,
  getDbSubscription,
  getOrgMembershipRole,
  getStripeExtraSeatQuantity,
  getStripeSubscription,
  isBillingE2EConfigured,
  seedProSubscription,
} from "../../utils";

const PRO_INCLUDED_SEATS = PLANS.pro.included_seats;

/**
 * E2E tests for the organization billing flows under base_plus_seats pricing:
 * plan state, cancel/resume, seat management within and beyond the included
 * count, and the last-owner guard.
 *
 * No Stripe webhooks are available in e2e, so we seed a real Stripe test-mode
 * subscription, mirror it into the DB, then drive the UI and assert against both
 * the DB (optimistic mirror) and the live Stripe API. The whole suite skips
 * cleanly when billing/Stripe is not configured (e.g. CI without Stripe keys).
 *
 * Tests are stateful and run in SERIES — each builds on the DB/Stripe state the
 * previous one left behind. The last-owner guard runs BEFORE the seat tests so
 * it can rely on the owner being the only roster row.
 */
test.describe("Billing", () => {
  test.skip(
    !isBillingE2EConfigured(),
    "Billing package disabled or Stripe not configured — skipping billing suite.",
  );

  test.describe.configure({ mode: "serial" });

  // The suite runs as the citizen user (default chromium auth state), so the
  // billing org is owned by that user — giving them MANAGE_MEMBERS, the
  // permission every billing mutation gates on.
  let org: BillingTestOrg;
  let ownerUserId: string;
  let subscriptionId: string;
  let customerId: string;

  test.beforeAll(async () => {
    const workspace = await getCitizenWorkspace();
    ownerUserId = workspace.userId;

    org = await createBillingTestOrg({
      ownerId: ownerUserId,
      name: `Billing E2E Org ${Date.now()}`,
    });

    const seeded = await seedProSubscription({
      organizationId: org.id,
      email: `billing-e2e-${Date.now()}@example.test`,
      name: org.name,
    });
    subscriptionId = seeded.subscriptionId;
    customerId = seeded.customerId;
  });

  test.afterAll(async () => {
    await cleanupBillingTest({
      subscriptionId,
      customerId,
      organizationId: org?.id,
    });
  });

  test("shows active plan state with workspace price, cancel button, and owner roster", async ({
    page,
  }) => {
    const billing = new TurboplanBillingPage(page);
    await billing.goto(org.slug);

    // Plan status card: no trial under the catalog (trial_days: 0).
    await expect(billing.activePlanHeading()).toBeVisible();
    await expect(billing.planBadge("Pro")).toBeVisible();
    await expect(billing.cancelPlanButton()).toBeVisible();

    // Paid-users roster: exactly the owner — 1 billable seat used, all within
    // the included count (no extra-seat charges shown).
    await expect(billing.paidUsersHeading()).toBeVisible();
    await expect(billing.seatsUsed(1)).toBeVisible();
    await expect(
      billing.seatBreakdown(`${PRO_INCLUDED_SEATS} included`),
    ).toBeVisible();
    await expect(billing.manageButtons()).toHaveCount(1);
    await expect(billing.ownerRoleBadge()).toBeVisible();

    // Stripe: no extra-seat item exists while within the included count.
    expect(await getStripeExtraSeatQuantity(subscriptionId)).toBe(0);
  });

  test("cancel flow schedules cancellation in DB and Stripe", async ({
    page,
  }) => {
    const billing = new TurboplanBillingPage(page);
    await billing.goto(org.slug);

    await billing.cancelPlan();

    // UI reflects the pending cancellation.
    await expect(billing.cancellationNotice()).toBeVisible();
    await expect(billing.resumePlanButton()).toBeVisible();
    await expect(billing.cancelPlanButton()).toHaveCount(0);

    // DB mirror flipped optimistically.
    const dbSub = await getDbSubscription(org.id);
    expect(dbSub?.cancelAtPeriodEnd).toBe(true);

    // Stripe is the source of truth — assert it directly.
    const stripeSub = await getStripeSubscription(subscriptionId);
    expect(stripeSub.cancel_at_period_end).toBe(true);
  });

  test("resume flow clears cancellation in DB and Stripe", async ({ page }) => {
    const billing = new TurboplanBillingPage(page);
    await billing.goto(org.slug);

    // Starts from the canceled state left by the previous test.
    await expect(billing.resumePlanButton()).toBeVisible();
    await billing.resumePlan();

    await expect(billing.cancellationNotice()).toHaveCount(0);
    await expect(billing.cancelPlanButton()).toBeVisible();

    const dbSub = await getDbSubscription(org.id);
    expect(dbSub?.cancelAtPeriodEnd).toBe(false);

    const stripeSub = await getStripeSubscription(subscriptionId);
    expect(stripeSub.cancel_at_period_end).toBe(false);
  });

  test("last-owner guard blocks downgrading the only owner", async ({
    page,
  }) => {
    const billing = new TurboplanBillingPage(page);
    await billing.goto(org.slug);

    // The owner is still the only roster row at this point in the series.
    await expect(billing.manageButtons()).toHaveCount(1);

    await billing.openSoleSeatMenu();
    await billing.chooseDowngradeToViewer();

    // The self-action warning is shown for the current user's own row.
    const dialog = billing.seatActionDialog();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/This is you/i)).toBeVisible();

    await billing.confirmDowngrade();

    // The server rejects removing the last owner: the roster is unchanged and
    // the owner row (with its "owner" badge) is still present.
    await expect(billing.seatActionDialog()).toBeHidden();
    await expect(billing.manageButtons()).toHaveCount(1);
    await expect(billing.ownerRoleBadge()).toBeVisible();

    // DB: the owner is still an owner.
    expect(await getOrgMembershipRole(org.id, ownerUserId)).toBe("owner");
  });

  test("members within the included count add NO Stripe seat item", async ({
    page,
  }) => {
    // Add a second user as an org EDITOR — immediate, no invite acceptance.
    // 2 billable ≤ 5 included → no extra-seat item, base price unchanged.
    const editor = await addOrganizationEditor({
      organizationId: org.id,
      email: `billing-editor-${Date.now()}@example.test`,
    });
    expect(await getStripeExtraSeatQuantity(subscriptionId)).toBe(0);

    // DB seats mirror = included + extra = 5.
    let dbSub = await getDbSubscription(org.id);
    expect(dbSub?.seats).toBe(PRO_INCLUDED_SEATS);

    const billing = new TurboplanBillingPage(page);
    await billing.goto(org.slug);

    // Roster shows both members; still no extra-seat cost line.
    await expect(billing.manageButtons()).toHaveCount(2);
    await expect(billing.seatsUsed(2)).toBeVisible();
    await expect(
      billing.seatBreakdown(`${PRO_INCLUDED_SEATS} included`),
    ).toBeVisible();

    // Downgrade the editor to viewer via their row menu.
    await billing.downgradeMemberToViewer(editor.email);

    // Roster drops back to 1 (a viewer no longer consumes a seat).
    await expect(billing.manageButtons()).toHaveCount(1);
    await expect(billing.seatsUsed(1)).toBeVisible();

    // DB: the editor's org membership is now viewer; mirror unchanged at 5.
    expect(await getOrgMembershipRole(org.id, editor.userId)).toBe("viewer");
    dbSub = await getDbSubscription(org.id);
    expect(dbSub?.seats).toBe(PRO_INCLUDED_SEATS);

    // Stripe: still no extra-seat item.
    expect(await getStripeExtraSeatQuantity(subscriptionId)).toBe(0);
  });

  test("crossing the included boundary creates the extra-seat item; dropping back removes it", async ({
    page,
  }) => {
    // Drive billable membership to included + 1 (owner + 5 editors = 6).
    // The editor from the previous test is now a viewer (not billable).
    const editors: Array<{ userId: string; email: string }> = [];
    for (let i = 0; i < PRO_INCLUDED_SEATS; i++) {
      editors.push(
        await addOrganizationEditor({
          organizationId: org.id,
          email: `billing-boundary-${i}-${Date.now()}@example.test`,
        }),
      );
    }

    // 6 billable → extra-seat item created with quantity 1.
    expect(await getStripeExtraSeatQuantity(subscriptionId)).toBe(1);
    let dbSub = await getDbSubscription(org.id);
    expect(dbSub?.seats).toBe(PRO_INCLUDED_SEATS + 1);
    expect(dbSub?.stripeSeatItemId).not.toBeNull();

    const billing = new TurboplanBillingPage(page);
    await billing.goto(org.slug);

    // Roster shows all 6 billable members and the extra-seat breakdown.
    await expect(billing.manageButtons()).toHaveCount(PRO_INCLUDED_SEATS + 1);
    await expect(billing.seatsUsed(PRO_INCLUDED_SEATS + 1)).toBeVisible();
    await expect(
      billing.seatBreakdown(`${PRO_INCLUDED_SEATS} included, 1 extra`),
    ).toBeVisible();

    // REMOVE (not downgrade) the last-added editor entirely: back to 5
    // billable → the extra-seat item is deleted, not set to 0.
    const removed = editors[editors.length - 1];
    await billing.removeMemberFromOrganization(removed.email);

    await expect(billing.manageButtons()).toHaveCount(PRO_INCLUDED_SEATS);
    await expect(billing.seatsUsed(PRO_INCLUDED_SEATS)).toBeVisible();

    // DB: the membership row is DELETED entirely (null), unlike downgrade
    // which demotes the row to viewer.
    expect(await getOrgMembershipRole(org.id, removed.userId)).toBeNull();

    // Stripe: the extra-seat item is gone; DB mirror back to included.
    await expect
      .poll(async () => getStripeExtraSeatQuantity(subscriptionId))
      .toBe(0);
    dbSub = await getDbSubscription(org.id);
    expect(dbSub?.seats).toBe(PRO_INCLUDED_SEATS);
  });
});
