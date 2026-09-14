import type { Page } from "@playwright/test";

/**
 * Page Object Model for the Turboplan registration page.
 * Handles user sign-up flow with magic link authentication.
 */
export class TurboplanRegisterPage {
  constructor(private readonly page: Page) {}

  /**
   * Navigate to the registration page
   */
  async goto(): Promise<void> {
    const turboplanUrl = process.env.TURBOPLAN_URL || "http://localhost:3000";
    await this.page.goto(`${turboplanUrl}/register`);
  }

  /**
   * Wait for the registration page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.getByRole("heading", { name: "Sign Up" }).waitFor();
  }

  /**
   * Request a registration magic link for a new user.
   * This will redirect to the check-email page.
   * @param email - User email address
   */
  async requestRegistrationLink(email: string): Promise<void> {
    await this.page.getByPlaceholder("user@acme.com").fill(email);
    await this.page
      .getByRole("button", { name: "Send verification link" })
      .click();

    // Wait for redirect to check-email page
    await this.page.waitForURL(/\/check-email/);
  }

  /**
   * Get the sign in link
   */
  getSignInLink() {
    return this.page.locator('a[href="/login"]');
  }
}
