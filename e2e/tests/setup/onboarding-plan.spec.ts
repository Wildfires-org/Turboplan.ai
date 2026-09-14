import { expect, type Page, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { PLANS } from "@wildfires-org/turboplan-billing/types";
import {
  organization,
  subscription,
  user as userTable,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import { createTestUserWithMagicLink } from "../../utils";

const isTruthy = (value: string | undefined): boolean =>
  value === "true" || value === "1";

const isBillingEnabled = (): boolean =>
  isTruthy(process.env.IS_BILLING_PACKAGE_ENABLED) ||
  isTruthy(process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED);

/**
 * Onboarding plan step (/setup/plan), billing flag ON.
 *
 * Fresh users complete /setup/personal and land on the plan step; picking
 * Starter or pressing Skip stamps the free plan on their personal org
 * (plan_chosen_at) so the step never re-prompts. The billing-disabled chain
 * (personal → straight out of /setup, plan page bounces) is covered by
 * setup-page.spec.ts, which runs in flag-off environments.
 */
test.use({ storageState: { cookies: [], origins: [] } });

/** Land a brand-new user on the plan step (personal info completed). */
const gotoFreshPlanStep = async (page: Page): Promise<string> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const email = `plan-step-e2e-${suffix}@example.test`;

  const { magicLinkUrl } = await createTestUserWithMagicLink(email);
  await page.goto(magicLinkUrl);
  await page.waitForURL(/\/setup/, { timeout: 15000 });

  await page.getByLabel("First name").fill("Plan");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByRole("button", { name: "Complete Setup" }).click();

  await page.waitForURL(/\/setup\/plan/, { timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "Choose your plan" }),
  ).toBeVisible();

  return email;
};

test.describe("Onboarding plan step", () => {
  test.skip(!isBillingEnabled(), "Billing package disabled — skipping.");

  test("personal step routes to the plan step with Pro preselected", async ({
    page,
  }) => {
    await gotoFreshPlanStep(page);

    // All three catalog plans render as selectable rows.
    for (const plan of Object.values(PLANS)) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${plan.name}`) }),
      ).toBeVisible();
    }

    // Pro is preselected → the primary button offers checkout at Pro's price.
    await expect(
      page.getByRole("button", {
        name: `Continue to checkout — $${PLANS.pro.price_usd}/mo`,
      }),
    ).toBeVisible();
  });

  test("Skip stamps the Starter plan and lands in the app", async ({
    page,
  }) => {
    const email = await gotoFreshPlanStep(page);

    await page.getByRole("button", { name: "Skip for now" }).click();

    // Redirect chain settles on the personal office page (never back to setup).
    await page.waitForURL(
      (url) => /\/organizations\/[^/]+\/offices\/[^/]+/.test(url.pathname),
      { timeout: 20000 },
    );

    const row = await getSubscriptionForUserPersonalOrg(email);
    expect(row?.plan).toBe("starter");
    expect(row?.status).toBe("active");
    expect(row?.planChosenAt).not.toBeNull();
    expect(row?.stripeSubscriptionId).toBeNull();
  });

  test("selecting Starter uses the free path and stamps the plan", async ({
    page,
  }) => {
    const email = await gotoFreshPlanStep(page);

    // Select the Starter row → the primary button flips to the free path.
    await page.getByRole("button", { name: /^Starter/ }).click();
    const startFree = page.getByRole("button", { name: "Start for free" });
    await expect(startFree).toBeVisible();
    await startFree.click();

    await page.waitForURL(
      (url) => /\/organizations\/[^/]+\/offices\/[^/]+/.test(url.pathname),
      { timeout: 20000 },
    );

    const row = await getSubscriptionForUserPersonalOrg(email);
    expect(row?.plan).toBe("starter");
    expect(row?.planChosenAt).not.toBeNull();
  });
});

/** Subscription row on the personal org owned by the user with `email`. */
const getSubscriptionForUserPersonalOrg = async (email: string) => {
  const [row] = await db
    .select({
      plan: subscription.plan,
      status: subscription.status,
      planChosenAt: subscription.planChosenAt,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    })
    .from(subscription)
    .innerJoin(organization, eq(organization.id, subscription.organizationId))
    .innerJoin(userTable, eq(userTable.id, organization.createdBy))
    .where(and(eq(userTable.email, email), eq(organization.type, "personal")))
    .limit(1);
  return row;
};
