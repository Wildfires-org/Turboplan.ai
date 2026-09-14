import type { Page } from "@playwright/test";

/**
 * Page Object Model for the Invitation acceptance page.
 * Provides methods for interacting with the invitation flow.
 */
export class TurboplanInvitePage {
  constructor(public readonly page: Page) {}

  /**
   * Navigate to an invitation page by token
   */
  async goto(token: string): Promise<void> {
    await this.page.goto(`/invite/${token}`);
  }

  /**
   * Navigate to an invitation page by full URL
   */
  async gotoUrl(inviteUrl: string): Promise<void> {
    await this.page.goto(inviteUrl);
  }

  /**
   * Wait for the invitation page to load (not just the loading spinner)
   */
  async waitForPageLoad(): Promise<void> {
    // Wait for loading spinner to disappear
    const loadingText = this.page.getByText("Loading invitation...");
    await loadingText.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {
      // If loading text was never visible, that's fine
    });

    // Wait for one of the final states: valid invitation, error, or accepted
    await Promise.race([
      this.page
        .getByRole("button", { name: /Accept Invitation/i })
        .waitFor({ timeout: 10000 }),
      this.page
        .getByRole("heading", { name: /Invitation Not Found/i })
        .waitFor({ timeout: 10000 }),
      this.page
        .getByRole("heading", { name: /Invitation Expired/i })
        .waitFor({ timeout: 10000 }),
      this.page
        .getByRole("heading", { name: /Invitation Already Accepted/i })
        .waitFor({ timeout: 10000 }),
      this.page
        .getByRole("heading", { name: /Something Went Wrong/i })
        .waitFor({ timeout: 10000 }),
      this.page
        .getByRole("heading", { name: /Invitation Revoked/i })
        .waitFor({ timeout: 10000 }),
    ]).catch(() => {
      // At least one should be visible, but don't fail here
    });
  }

  /**
   * Check if the page shows a valid invitation
   */
  async isValidInvitation(): Promise<boolean> {
    const acceptButton = this.page.getByRole("button", {
      name: /Accept Invitation/i,
    });
    // Use count() instead of isVisible() for more reliable check
    return (await acceptButton.count()) > 0;
  }

  /**
   * Check if the invitation has expired
   */
  async isExpired(): Promise<boolean> {
    const expiredHeading = this.page.getByRole("heading", {
      name: /Invitation Expired/i,
    });
    return (await expiredHeading.count()) > 0;
  }

  /**
   * Check if the invitation was not found
   */
  async isNotFound(): Promise<boolean> {
    const notFoundHeading = this.page.getByRole("heading", {
      name: /Invitation Not Found/i,
    });
    return (await notFoundHeading.count()) > 0;
  }

  /**
   * Check if the invitation was already accepted
   */
  async isAlreadyAccepted(): Promise<boolean> {
    const acceptedHeading = this.page.getByRole("heading", {
      name: /Invitation Already Accepted/i,
    });
    return (await acceptedHeading.count()) > 0;
  }

  /**
   * Get the entity name displayed on the invitation
   */
  async getEntityName(): Promise<string> {
    // The entity name is shown in the card
    const entityNameElement = this.page
      .locator(".bg-card")
      .locator("p.font-medium")
      .first();
    return (await entityNameElement.textContent()) || "";
  }

  /**
   * Get the inviter name displayed on the invitation
   */
  async getInviterName(): Promise<string> {
    // The inviter name is shown in the card
    const inviterElement = this.page
      .locator(".bg-card")
      .locator("p.font-medium")
      .nth(1);
    return (await inviterElement.textContent()) || "";
  }

  /**
   * Get the role displayed on the invitation
   */
  async getRole(): Promise<string> {
    // The role is shown at the bottom of the card
    const roleElement = this.page
      .locator(".bg-card")
      .locator("span.capitalize")
      .first();
    return (await roleElement.textContent()) || "";
  }

  /**
   * Get the email the invitation was sent to
   */
  async getInvitedEmail(): Promise<string> {
    // The email is shown at the bottom of the page
    const emailText = await this.page
      .getByText(/This invitation was sent to/)
      .textContent();
    const match = emailText?.match(/sent to (.+)/);
    return match?.[1] || "";
  }

  /**
   * Click the Accept Invitation button
   */
  async clickAccept(): Promise<void> {
    const acceptButton = this.page.getByRole("button", {
      name: /Accept Invitation/i,
    });
    await acceptButton.click();
  }

  /**
   * Wait for the "Creating account..." state
   */
  async waitForCreatingAccount(): Promise<void> {
    await this.page
      .getByText(/Creating account/i)
      .waitFor({ state: "visible" });
  }

  /**
   * Wait for successful acceptance and redirect
   * @param expectedUrlPattern - URL pattern to wait for after acceptance
   */
  async waitForAcceptanceRedirect(
    expectedUrlPattern: RegExp = /\/(setup|organizations|$)/,
  ): Promise<void> {
    // Wait for redirect away from the invite page
    await this.page.waitForURL((url) => !url.pathname.startsWith("/invite"), {
      timeout: 15000,
    });
    // Then check if URL matches expected pattern
    await this.page.waitForURL(expectedUrlPattern, { timeout: 15000 });
  }

  /**
   * Check if user is signed in (shows "Signed in as" text)
   */
  async isSignedIn(): Promise<boolean> {
    const signedInText = this.page.getByText(/Signed in as/i);
    return signedInText.isVisible();
  }

  /**
   * Get the signed-in user email
   */
  async getSignedInEmail(): Promise<string> {
    const signedInText = await this.page
      .getByText(/Signed in as/)
      .textContent();
    const match = signedInText?.match(/Signed in as (.+)/);
    return match?.[1] || "";
  }
}
