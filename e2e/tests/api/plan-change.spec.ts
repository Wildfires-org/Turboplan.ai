import { expect, test } from "@playwright/test";
import type Stripe from "stripe";

import { changeSubscriptionPlan } from "@wildfires-org/turboplan-billing/server";
import {
  overageLookupKey,
  type PaidPlanKey,
  PLANS,
  seatLookupKey,
} from "@wildfires-org/turboplan-billing/types";

import {
  addOrganizationEditor,
  type BillingTestOrg,
  cleanupBillingTest,
  createBillingTestOrg,
  getCitizenWorkspace,
  getDbSubscription,
  getStripeSubscription,
  isBillingE2EConfigured,
  seedProSubscription,
} from "../../utils";

const PRO_INCLUDED = PLANS.pro.included_seats;

const itemByLookupKey = (
  sub: Stripe.Subscription,
  lookupKey: string,
): Stripe.SubscriptionItem | undefined =>
  sub.items.data.find((item) => item.price.lookup_key === lookupKey);

const seatItem = (
  sub: Stripe.Subscription,
  plan: PaidPlanKey,
): Stripe.SubscriptionItem | undefined =>
  itemByLookupKey(sub, seatLookupKey(plan));

/**
 * Plan-change tests (Pro ↔ Max) against the real `changeSubscriptionPlan`
 * service, a live Stripe test-mode subscription and the DB mirror (`api`
 * Playwright project — the /change-plan route is a thin RBAC wrapper over
 * this service; its button UI is covered by the manual pass).
 *
 * The org is driven to included+1 billable members BEFORE the switch so the
 * seat-item transition is exercised in both directions:
 *   Pro (5 incl.) with 6 billable → extra item qty 1
 *   → Max (10 incl.): base+overage swapped, seat item DELETED (6 ≤ 10)
 *   → back to Pro: seat item RECREATED at qty 1 on Pro's seat price
 *
 * Proration behavior (create_prorations on upgrade, none on downgrade) is
 * pinned by unit tests; here we assert the structural item/mirror state.
 */
test.describe("Plan change (Pro ↔ Max)", () => {
  test.skip(
    !isBillingE2EConfigured(),
    "Billing package disabled or Stripe not configured — skipping.",
  );

  test.describe.configure({ mode: "serial" });

  let org: BillingTestOrg;
  let subscriptionId: string;
  let customerId: string;

  test.beforeAll(async () => {
    const workspace = await getCitizenWorkspace();

    org = await createBillingTestOrg({
      ownerId: workspace.userId,
      name: `Plan Change E2E Org ${Date.now()}`,
    });

    const seeded = await seedProSubscription({
      organizationId: org.id,
      email: `plan-change-e2e-${Date.now()}@example.test`,
      name: org.name,
    });
    subscriptionId = seeded.subscriptionId;
    customerId = seeded.customerId;

    // Drive billable membership to included+1 (owner + 5 editors = 6) so a
    // Pro extra-seat item exists before the switch.
    for (let i = 1; i <= PRO_INCLUDED; i++) {
      await addOrganizationEditor({
        organizationId: org.id,
        email: `plan-change-editor-${i}-${Date.now()}@example.test`,
      });
    }
  });

  test.afterAll(async () => {
    await cleanupBillingTest({
      subscriptionId,
      customerId,
      organizationId: org?.id,
    });
  });

  test("baseline: Pro with 6 billable carries an extra-seat item", async () => {
    const stripeSub = await getStripeSubscription(subscriptionId);

    expect(itemByLookupKey(stripeSub, PLANS.pro.lookup_key)).toBeTruthy();
    expect(itemByLookupKey(stripeSub, overageLookupKey("pro"))).toBeTruthy();
    expect(seatItem(stripeSub, "pro")?.quantity).toBe(1);

    const dbSub = await getDbSubscription(org.id);
    expect(dbSub?.plan).toBe("pro");
    expect(dbSub?.seats).toBe(PRO_INCLUDED + 1);
  });

  test("upgrade Pro → Max swaps base+overage and deletes the seat item", async () => {
    await changeSubscriptionPlan(org.id, "max");

    const stripeSub = await getStripeSubscription(subscriptionId);

    // Base and overage repriced to Max; the old Pro prices are gone.
    expect(itemByLookupKey(stripeSub, PLANS.max.lookup_key)).toBeTruthy();
    expect(itemByLookupKey(stripeSub, overageLookupKey("max"))).toBeTruthy();
    expect(itemByLookupKey(stripeSub, PLANS.pro.lookup_key)).toBeUndefined();
    expect(itemByLookupKey(stripeSub, overageLookupKey("pro"))).toBeUndefined();

    // 6 billable ≤ 10 included → NO seat item on either plan's price.
    expect(seatItem(stripeSub, "max")).toBeUndefined();
    expect(seatItem(stripeSub, "pro")).toBeUndefined();

    // Subscription metadata follows the plan.
    expect(stripeSub.metadata.plan).toBe("max");

    // DB mirror: plan, seats = included + 0, item ids re-pointed.
    const dbSub = await getDbSubscription(org.id);
    expect(dbSub?.plan).toBe("max");
    expect(dbSub?.seats).toBe(PLANS.max.included_seats);
    expect(dbSub?.stripeSeatItemId).toBeNull();
    expect(dbSub?.stripeBaseItemId).toBe(
      itemByLookupKey(stripeSub, PLANS.max.lookup_key)?.id,
    );
    expect(dbSub?.stripeOverageItemId).toBe(
      itemByLookupKey(stripeSub, overageLookupKey("max"))?.id,
    );
  });

  test("downgrade Max → Pro recreates the seat item at Pro's price", async () => {
    await changeSubscriptionPlan(org.id, "pro");

    const stripeSub = await getStripeSubscription(subscriptionId);

    expect(itemByLookupKey(stripeSub, PLANS.pro.lookup_key)).toBeTruthy();
    expect(itemByLookupKey(stripeSub, overageLookupKey("pro"))).toBeTruthy();
    expect(itemByLookupKey(stripeSub, PLANS.max.lookup_key)).toBeUndefined();

    // 6 billable > 5 included → the extra-seat item is back, on Pro's price.
    expect(seatItem(stripeSub, "pro")?.quantity).toBe(1);
    expect(seatItem(stripeSub, "max")).toBeUndefined();

    const dbSub = await getDbSubscription(org.id);
    expect(dbSub?.plan).toBe("pro");
    expect(dbSub?.seats).toBe(PRO_INCLUDED + 1);
    expect(dbSub?.stripeSeatItemId).toBe(seatItem(stripeSub, "pro")?.id);
  });

  test("switching to the current plan is rejected with SAME_PLAN", async () => {
    await expect(changeSubscriptionPlan(org.id, "pro")).rejects.toMatchObject({
      name: "BillingError",
      code: "SAME_PLAN",
    });
  });
});
