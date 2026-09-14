import { expect, type Page } from "@playwright/test";

import { PROJECT_URL_PATTERN } from "../config/patterns";

/**
 * Page Object for the Turboplan project detail page.
 * Handles visibility toggles, application submission, status badges, and breadcrumbs.
 */
export class TurboplanProjectPage {
  constructor(private readonly page: Page) {}

  /** Click the visibility toggle (icon button, aria-label "Make project
   * public") and confirm making the project public */
  async makePublic(): Promise<void> {
    const visibilityButton = this.page.getByRole("button", {
      name: /Make project public/i,
    });
    await expect(visibilityButton).toBeVisible({ timeout: 20000 });
    await visibilityButton.click();

    await expect(
      this.page.getByRole("heading", { name: /Make Project Public/i }),
    ).toBeVisible({ timeout: 5000 });
    await this.page.getByRole("button", { name: "Make Public" }).click();

    await expect(this.page.getByText("Project is now public")).toBeVisible({
      timeout: 10000,
    });
  }

  /** Click the visibility toggle (icon button, aria-label "Make project
   * private") and confirm making the project private */
  async makePrivate(): Promise<void> {
    const visibilityButton = this.page.getByRole("button", {
      name: /Make project private/i,
    });
    await expect(visibilityButton).toBeVisible({ timeout: 20000 });
    await visibilityButton.click();

    await expect(
      this.page.getByRole("heading", { name: /Make Project Private/i }),
    ).toBeVisible({ timeout: 5000 });
    await this.page.getByRole("button", { name: "Make Private" }).click();

    await expect(this.page.getByText("Project is now private")).toBeVisible({
      timeout: 25000,
    });
  }

  /** Assert the published-state toggle is visible (aria-label flips to
   * "Make project private" once the project is public) */
  async expectPublishedButton(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: /Make project private/i }),
    ).toBeVisible({ timeout: 10000 });
  }

  /** Assert no visibility toggle buttons are visible (for non-admin users) */
  async expectNoVisibilityControls(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: /Make project public/i }),
    ).not.toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /Make project private/i }),
    ).not.toBeVisible();
  }

  /** Click "Submit Application" button to open the submit dialog */
  async openSubmitDialog(): Promise<void> {
    await this.page
      .getByRole("button", { name: /Submit Application/i })
      .first()
      .click();
    await expect(
      this.page.getByRole("heading", { name: /Submit Project Application/i }),
    ).toBeVisible({ timeout: 5000 });
  }

  /** Assert the transfer ownership warning is visible in the dialog */
  async expectTransferWarning(): Promise<void> {
    await expect(this.page.getByText(/transfer its ownership/i)).toBeVisible();
  }

  /** Assert the office name is shown in the submit dialog */
  async expectDialogOfficeName(officeName: string): Promise<void> {
    await expect(
      this.page.getByRole("alertdialog").getByText(officeName),
    ).toBeVisible({ timeout: 5000 });
  }

  /** Check the confirmation checkbox and submit the application */
  async confirmAndSubmit(): Promise<void> {
    await this.page.locator("#confirm").check();

    const submitResponsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes("/submit") && resp.request().method() === "POST",
    );
    await this.page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Submit Application/i })
      .click();

    const response = await submitResponsePromise;
    expect(response.ok()).toBeTruthy();
  }

  /** Assert the "Submit Application" button is visible */
  async expectSubmitButton(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: /Submit Application/i }),
    ).toBeVisible({ timeout: 10000 });
  }

  /** Assert the "Submit Application" button is NOT visible */
  async expectNoSubmitButton(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: /Submit Application/i }),
    ).not.toBeVisible();
  }

  /** Assert a "Submitted" badge is visible */
  async expectSubmittedBadge(): Promise<void> {
    await expect(
      this.page.locator("span", { hasText: "Submitted" }).first(),
    ).toBeVisible({ timeout: 15000 });
  }

  /** Assert the project heading is visible */
  async expectHeading(projectName: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: projectName }),
    ).toBeVisible({ timeout: 10000 });
  }

  /** Assert the dropdown actions menu is NOT visible */
  async expectNoDropdownMenu(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: /more/i }),
    ).not.toBeVisible();
  }

  /** Get the breadcrumb navigation locator */
  getBreadcrumb() {
    return this.page.getByRole("navigation");
  }

  /** Assert a project name link is visible in the breadcrumb */
  async expectBreadcrumbLink(projectName: string): Promise<void> {
    await expect(
      this.getBreadcrumb().getByRole("link", {
        name: projectName,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10000 });
  }

  /** Click the project name in the breadcrumb to navigate to project overview */
  async clickBreadcrumbLink(projectName: string): Promise<void> {
    await this.getBreadcrumb()
      .getByRole("link", { name: projectName, exact: true })
      .click();
    await this.page.waitForURL(PROJECT_URL_PATTERN, { timeout: 10000 });
  }

  /** Navigate to the project overview page via the sidebar "Overview" link */
  async goToOverview(): Promise<void> {
    const overviewLink = this.page.getByRole("link", {
      name: "Overview",
      exact: true,
    });
    const href = await overviewLink.getAttribute("href");
    if (!href) {
      throw new Error("Overview link has no href");
    }
    // Use hard navigation to ensure the overview page fully renders
    // (client-side navigation may not re-render when sharing the project layout)
    await this.page.goto(href, { waitUntil: "domcontentloaded" });
  }

  // ── Proposal review (gov user) ────────────────────────────────────

  /** Assert the review info banner is visible for gov users */
  async expectReviewBanner(): Promise<void> {
    // During soft navigation the previous project page can linger in the DOM
    // (exit animation), briefly duplicating the banner — assert on the
    // visible instance only.
    await expect(
      this.page
        .getByText(/submitted by a citizen.*awaiting your review/i)
        .filter({ visible: true })
        .first(),
    ).toBeVisible({ timeout: 30000 });
  }

  /** Click the Approve button on the review banner to open the approve dialog */
  async openApproveDialog(): Promise<void> {
    await this.page
      .locator(".border-blue-300")
      .filter({ visible: true })
      .first()
      .getByRole("button", { name: /Approve/i })
      .click();
    await expect(
      this.page.getByRole("heading", { name: /Approve Proposal/i }),
    ).toBeVisible({ timeout: 5000 });
  }

  /** Click the Reject button on the review banner to open the reject dialog */
  async openRejectDialog(): Promise<void> {
    await this.page
      .locator(".border-blue-300")
      .filter({ visible: true })
      .first()
      .getByRole("button", { name: /Reject/i })
      .click();
    await expect(
      this.page
        .getByRole("alertdialog")
        .getByRole("heading", { name: /Reject Proposal/i }),
    ).toBeVisible({ timeout: 5000 });
  }

  /** Confirm approval in the approve dialog (clicks Approve button inside dialog) */
  async confirmApproval(): Promise<void> {
    const reviewResponsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes("/review") && resp.request().method() === "PATCH",
    );
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: /Approve/i })
      .click();
    const response = await reviewResponsePromise;
    expect(response.ok()).toBeTruthy();
  }

  /** Fill rejection reason and confirm in the reject dialog */
  async confirmRejection(reason: string): Promise<void> {
    const dialog = this.page.getByRole("alertdialog");
    await dialog.getByRole("textbox", { name: /Reason notes/i }).fill(reason);
    const reviewResponsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes("/review") && resp.request().method() === "PATCH",
    );
    await dialog.getByRole("button", { name: /Reject/i }).click();
    const response = await reviewResponsePromise;
    expect(response.ok()).toBeTruthy();
  }

  /** Assert the review banner is no longer visible (after approval/rejection) */
  async expectNoReviewBanner(): Promise<void> {
    await expect(
      this.page.getByText(/submitted by a citizen.*awaiting your review/i),
    ).not.toBeVisible({ timeout: 10000 });
  }
}
