import { expect, Page, test } from "@playwright/test";
import { getUnixTime } from "date-fns";

import { createTestUserWithMagicLink } from "../../../e2e/utils/test-auth";

test.use({ storageState: { cookies: [], origins: [] } });

const testEmail = `test-${getUnixTime(new Date())}@playwright.com`;

class AuthPage {
  constructor(private page: Page) {}

  async gotoLogin() {
    await this.page.goto("/login");
    await expect(this.page.getByRole("heading")).toContainText("Sign In");
  }

  async gotoRegister() {
    await this.page.goto("/register");
    await expect(this.page.getByRole("heading")).toContainText("Sign Up");
  }

  async requestRegistrationLink(email: string) {
    await this.gotoRegister();
    await this.page.getByPlaceholder("user@acme.com").click();
    await this.page.getByPlaceholder("user@acme.com").fill(email);
    await this.page
      .getByRole("button", { name: "Send verification link" })
      .click();
  }

  async requestLoginLink(email: string) {
    await this.gotoLogin();
    await this.page.getByPlaceholder("user@acme.com").click();
    await this.page.getByPlaceholder("user@acme.com").fill(email);
    await this.page.getByRole("button", { name: "Send sign-in link" }).click();
  }

  async expectToastToContain(text: string) {
    await expect(this.page.getByTestId("toast")).toContainText(text);
  }

  async expectToBeOnCheckEmailPage(email: string) {
    await expect(this.page).toHaveURL(/\/check-email/);
    await expect(this.page.getByText(email)).toBeVisible();
  }
}

test.describe
  .serial("authentication", () => {
    let authPage: AuthPage;

    test.beforeEach(async ({ page }) => {
      authPage = new AuthPage(page);
    });

    test("redirect to login page when unauthenticated", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading")).toContainText("Sign In");
    });

    test("register page shows email-only form", async ({ page }) => {
      await authPage.gotoRegister();
      // Email field should be visible
      await expect(page.getByPlaceholder("user@acme.com")).toBeVisible();
      // Password field should NOT be visible
      await expect(page.getByLabel("Password")).not.toBeVisible();
      // Descriptive text should mention magic link
      await expect(page.getByText("Enter your email")).toBeVisible();
    });

    test("login page shows email-only form", async ({ page }) => {
      await authPage.gotoLogin();
      // Email field should be visible
      await expect(page.getByPlaceholder("user@acme.com")).toBeVisible();
      // Password field should NOT be visible
      await expect(page.getByLabel("Password")).not.toBeVisible();
      // Descriptive text should mention magic link
      await expect(page.getByText("sign-in link")).toBeVisible();
    });

    test("request registration link redirects to check-email page", async ({
      page,
    }) => {
      await authPage.requestRegistrationLink(testEmail);
      await authPage.expectToBeOnCheckEmailPage(testEmail);
    });

    test("request login link always redirects to check-email (security)", async ({
      page,
    }) => {
      // For security, both existing and non-existing emails should show same response
      const nonExistentEmail = `nonexistent-${getUnixTime(new Date())}@playwright.com`;
      await authPage.requestLoginLink(nonExistentEmail);
      // Should always redirect to check-email, never reveal if account exists
      await authPage.expectToBeOnCheckEmailPage(nonExistentEmail);
    });

    test("magic link verification signs in user", async ({ page }) => {
      // Create a test user with a magic link directly in the database
      const verifyEmail = `verify-${getUnixTime(new Date())}@playwright.com`;
      const { magicLinkUrl } = await createTestUserWithMagicLink(verifyEmail);

      // Navigate to the magic link
      await page.goto(magicLinkUrl);

      // Should show success message
      await expect(page.getByText(/signed in/i)).toBeVisible({
        timeout: 10000,
      });

      // Should redirect to setup or home
      await page.waitForURL(/\/(setup|$)/, { timeout: 15000 });
    });

    test("verify page shows error for invalid token", async ({ page }) => {
      // Navigate to verify page with invalid token
      await page.goto(
        "/verify?token=invalid-token&userId=invalid-user&type=login",
      );

      // Should show error message
      await expect(page.getByText(/invalid|failed/i)).toBeVisible({
        timeout: 10000,
      });

      // Should show links to try again
      await expect(page.getByRole("link", { name: /sign/i })).toBeVisible();
    });
  });
