import type { Page } from "@playwright/test";

/**
 * Page Object Model for the Turboplan login page.
 * Handles authentication flow with magic links.
 */
export class TurboplanLoginPage {
  constructor(private readonly page: Page) {}

  /**
   * Navigate to the login page
   */
  async goto(): Promise<void> {
    const turboplanUrl = process.env.TURBOPLAN_URL || "http://localhost:3000";
    await this.page.goto(`${turboplanUrl}/login`);
  }

  /**
   * Get the email input field
   */
  private getEmailInput() {
    return this.page.getByPlaceholder("user@acme.com");
  }

  /**
   * Get the send sign-in link button
   */
  private getSendLinkButton() {
    return this.page.getByRole("button", { name: "Send sign-in link" });
  }

  /**
   * Request a login magic link.
   * This will redirect to the check-email page.
   *
   * @param email - User email address
   */
  async requestLoginLink(email: string): Promise<void> {
    await this.getEmailInput().fill(email);
    await this.getSendLinkButton().click();

    // Wait for redirect to check-email page
    await this.page.waitForURL(/\/check-email/);
  }

  /**
   * Check if user is logged in by verifying we're not on the login page
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      // Wait a bit for any redirects to complete
      await this.page.waitForTimeout(1000);

      // Check if we're no longer on the login page
      const currentUrl = this.page.url();
      return !currentUrl.includes("/login");
    } catch {
      return false;
    }
  }

  /**
   * Get the sign in heading to verify page loaded
   */
  getSignInHeading() {
    return this.page.locator('h3:has-text("Sign In")');
  }

  /**
   * Wait for the login page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.getSignInHeading().waitFor({ state: "visible" });
  }

  /**
   * Get the register link
   */
  getRegisterLink() {
    return this.page.locator('a[href="/register"]');
  }
}
