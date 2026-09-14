import type { Page } from "@playwright/test";

import { ORG_URL_PATTERN } from "../config/patterns";

/**
 * Page Object Model for Organization Dashboard page.
 * Provides methods for interacting with organization settings and navigation.
 */
export class TurboplanOrganizationPage {
  constructor(public readonly page: Page) {}

  /**
   * Navigate to an organization by slug
   */
  async goto(orgSlug: string): Promise<void> {
    await this.page.goto(`/organizations/${orgSlug}`);
    await this.page.waitForURL(ORG_URL_PATTERN);
  }

  /**
   * Get the current organization slug from the URL
   */
  getCurrentSlug(): string {
    const url = this.page.url();
    const match = url.match(/\/organizations\/([^/]+)/);
    return match?.[1] || "";
  }

  /**
   * Ensure the sidebar is expanded (not collapsed)
   */
  async ensureSidebarExpanded(): Promise<void> {
    // Check if sidebar is collapsed by looking for the toggle button
    const toggleButton = this.page.getByRole("button", {
      name: "Toggle Sidebar",
    });

    // If we can't see the organization menu button, the sidebar might be collapsed
    const menuButton = this.page.getByRole("button", {
      name: "Organization menu",
    });
    const isMenuVisible = await menuButton.isVisible().catch(() => false);

    if (!isMenuVisible) {
      // Try to expand the sidebar
      await toggleButton.click();
      // Wait for animation
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Open the edit organization dialog
   */
  async openEditDialog(): Promise<void> {
    // Ensure sidebar is expanded first
    await this.ensureSidebarExpanded();

    // Click the "..." menu button next to the organization name in sidebar
    const menuButton = this.page.getByRole("button", {
      name: "Organization menu",
    });

    // If that doesn't work, try finding the more options button by aria-label or other means
    const isMenuButtonVisible = await menuButton.isVisible().catch(() => false);

    if (isMenuButtonVisible) {
      await menuButton.click();
    } else {
      // Try clicking the three dots button near the organization name
      // Look for a button with aria-haspopup or similar
      const moreButton = this.page
        .locator('[data-sidebar="menu-action"]')
        .first();
      await moreButton.click();
    }

    // Wait for dropdown menu to appear and click "Edit Organization Details"
    const editMenuItem = this.page.getByText("Edit Organization Details");
    await editMenuItem.waitFor({ state: "visible", timeout: 5000 });
    await editMenuItem.click();

    // Wait for dialog to open
    await this.page
      .getByRole("heading", { name: "Edit Organization" })
      .waitFor({ state: "visible" });
  }

  /**
   * Update the organization title (display name)
   * @param newTitle - The new display title for the organization
   */
  async updateTitle(newTitle: string): Promise<void> {
    // Clear and fill the title field
    const titleInput = this.page.getByLabel("Display Title");
    await titleInput.clear();
    await titleInput.fill(newTitle);
  }

  /**
   * Save changes in the edit dialog
   */
  async saveChanges(): Promise<void> {
    // Click save and wait for success toast
    const saveButton = this.page.getByRole("button", { name: "Save Changes" });
    await saveButton.click();

    // Wait for success toast
    await this.page
      .getByText(/Organization updated successfully/i)
      .waitFor({ state: "visible", timeout: 10000 });

    // Wait for dialog to close
    await this.page
      .getByRole("heading", { name: "Edit Organization" })
      .waitFor({ state: "hidden", timeout: 5000 });

    // Wait for potential navigation (slug change triggers redirect)
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Close the edit dialog without saving
   */
  async cancelEdit(): Promise<void> {
    await this.page.getByRole("button", { name: "Cancel" }).click();

    // Wait for dialog to close
    await this.page
      .getByRole("heading", { name: "Edit Organization" })
      .waitFor({ state: "hidden" });
  }

  /**
   * Get the organization title displayed in the breadcrumb/header
   */
  async getDisplayedTitle(): Promise<string> {
    const breadcrumb = this.page.locator("nav").getByText(/.*/).first();
    return (await breadcrumb.textContent()) || "";
  }

  /**
   * Change organization title and verify URL updates
   * @param newTitle - The new display title
   * @returns The new organization slug
   */
  async changeTitle(newTitle: string): Promise<string> {
    await this.openEditDialog();
    await this.updateTitle(newTitle);
    await this.saveChanges();

    // Wait for URL to potentially change (slug update)
    await this.page.waitForTimeout(1000);

    // If redirected, wait for new URL
    await this.page.waitForURL(ORG_URL_PATTERN, { timeout: 5000 });

    const newSlug = this.getCurrentSlug();

    return newSlug;
  }
}
