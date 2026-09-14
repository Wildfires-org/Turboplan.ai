import { expect, type Page, test } from "@playwright/test";

import { createTestUserWithMagicLink } from "../../utils";

/**
 * Simplified setup page (/setup/personal).
 *
 * The setup wizard is a single step now: first name + last name only. The user
 * role is auto-detected from the email domain, so there is no professional/role
 * step. Submitting completes onboarding and redirects out of /setup.
 *
 * These tests run UNAUTHENTICATED and mint a fresh user per test (onboarding not
 * completed) via a magic link, so each lands on the setup form directly.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const isTruthy = (value: string | undefined): boolean =>
  value === "true" || value === "1";

/** With billing ON, completing personal info routes to /setup/plan instead of
 * leaving /setup — the plan-step chain is covered by onboarding-plan.spec.ts. */
const isBillingEnabled =
  isTruthy(process.env.IS_BILLING_PACKAGE_ENABLED) ||
  isTruthy(process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED);

/** The submit button, matched across its idle ("Complete Setup") and pending
 * ("Saving...") labels. */
const submitButton = (page: Page) =>
  page.getByRole("button", { name: /Complete Setup|Saving/ });

/**
 * Mint a brand-new (profile-less) user, authenticate via magic link, and land
 * on the single-step setup form. Returns the generated email.
 */
const gotoFreshSetup = async (page: Page): Promise<string> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const email = `setup-e2e-${suffix}@example.test`;

  const { magicLinkUrl } = await createTestUserWithMagicLink(email);
  await page.goto(magicLinkUrl);

  // New users are redirected to setup after verification.
  await page.waitForURL(/\/setup/, { timeout: 15000 });
  await expect(page.getByLabel("First name")).toBeVisible({ timeout: 10000 });

  return email;
};

test.describe("Setup page (single-step)", () => {
  test("completes setup and redirects out of /setup", async ({ page }) => {
    await gotoFreshSetup(page);

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");

    await expect(submitButton(page)).toBeEnabled();
    await submitButton(page).click();

    if (isBillingEnabled) {
      // Billing ON: the next onboarding step is the plan choice.
      await page.waitForURL(/\/setup\/plan/, { timeout: 15000 });
    } else {
      // Billing OFF: success redirects to /?setup=true → dashboard → org (or
      // office) page, with no plan step in between.
      await page.waitForURL((url) => !url.pathname.includes("/setup"), {
        timeout: 15000,
      });
      await expect(page).not.toHaveURL(/\/setup/);
    }
  });

  test("keeps submit disabled and surfaces validation for invalid input", async ({
    page,
  }) => {
    await gotoFreshSetup(page);

    const firstName = page.getByLabel("First name");
    const lastName = page.getByLabel("Last name");

    // Both empty → disabled.
    await expect(submitButton(page)).toBeDisabled();

    // Only first name → still disabled (last name required).
    await firstName.fill("Ada");
    await expect(submitButton(page)).toBeDisabled();

    // Both present → enabled.
    await lastName.fill("Lovelace");
    await expect(submitButton(page)).toBeEnabled();

    // Whitespace-only is treated as empty → disabled again.
    await firstName.fill("   ");
    await expect(submitButton(page)).toBeDisabled();

    // Clearing a filled field surfaces the required-field error.
    await firstName.fill("");
    await expect(page.getByText("First name is required")).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();
  });

  test("shows a pending state on the submit button during submission", async ({
    page,
  }) => {
    await gotoFreshSetup(page);

    // Hold the server-action POST until the pending UI has been asserted —
    // deterministic, unlike a fixed delay. Regex matches regardless of query
    // string (a glob like "**/setup/personal" fails on any ?param).
    let releaseAction = () => {};
    const actionGate = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });
    await page.route(/\/setup\/personal/, async (route) => {
      if (route.request().method() === "POST") {
        await actionGate;
      }
      await route.continue();
    });

    await page.getByLabel("First name").fill("Grace");
    await page.getByLabel("Last name").fill("Hopper");
    await submitButton(page).click();

    // While the action is in flight the button shows "Saving..." and is disabled.
    await expect(page.getByRole("button", { name: /Saving/ })).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();

    // Release the held POST; the action resolves and navigates on (to the
    // plan step with billing ON, out of /setup otherwise).
    releaseAction();
    await page.waitForURL(
      (url) =>
        url.pathname.includes("/setup/plan") ||
        !url.pathname.includes("/setup"),
      { timeout: 15000 },
    );
  });
});
