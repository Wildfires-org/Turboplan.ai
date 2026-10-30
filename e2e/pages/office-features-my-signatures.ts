import { expect, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

/**
 * Page Object for an organization's "My Signatures" page
 * (`/[orgSlug]/my-signatures`): the member's pending signing requests.
 */
export class OfficeFeaturesMySignaturesPage {
  constructor(private readonly page: Page) {}

  /** The page's path for an organization */
  static path(orgSlug: string): string {
    return `${appPaths.organization(orgSlug)}/my-signatures`;
  }

  /**
   * Open the page and wait for its pending-requests fetch to answer, so the
   * empty state that follows is the loaded result, not a pre-fetch render.
   */
  async goto(params: {
    orgSlug: string;
    organizationId: string;
  }): Promise<void> {
    const pendingRequests = this.page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/signing-requests/my-pending?organizationId=${params.organizationId}`,
          ),
      { timeout: 15000 },
    );
    await this.page.goto(OfficeFeaturesMySignaturesPage.path(params.orgSlug));
    await pendingRequests;
  }

  /** Assert the page rendered its heading and the "no requests" empty state */
  async expectEmptyState(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "My Pending Signatures" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      this.page.getByText("No pending signatures", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      this.page.getByRole("button", { name: "Sign Now" }),
    ).toHaveCount(0);
  }
}
