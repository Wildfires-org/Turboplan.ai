import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

import { TurboplanInviteMembersDialog } from "./turboplan-invite-members-dialog";

/**
 * Page Object Model for an entity's Members tab (members table + the banner's
 * "Invite Members" action).
 */
export class TurboplanMembersPage {
  constructor(public readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  /**
   * Open an organization's Members tab and wait until the member list has
   * loaded (shown by `memberEmail`'s row). The invite dialog only knows who is
   * already a member once that list is in.
   */
  async gotoOrganization(orgSlug: string, memberEmail: string): Promise<void> {
    await this.page.goto(`${appPaths.organization(orgSlug)}/members`);
    await expect(this.main.getByText(memberEmail, { exact: true })).toBeVisible(
      { timeout: 15000 },
    );
  }

  /**
   * StickyEntityBanner renders its actions twice (full banner + compact scroll
   * header); scope to the full banner's testid.
   */
  get inviteMembersButton(): Locator {
    return this.page
      .getByTestId("entity-banner-actions")
      .getByRole("button", { name: "Invite Members" });
  }

  async openInviteDialog(): Promise<TurboplanInviteMembersDialog> {
    await this.inviteMembersButton.click();
    const dialog = new TurboplanInviteMembersDialog(this.page);
    await expect(dialog.dialog).toBeVisible();
    return dialog;
  }

  /**
   * Assert `email` is listed as a pending invitation. Invitation rows are named
   * by the email's local part and are the only rows whose actions menu offers
   * "Revoke invitation".
   */
  async expectPendingInvitation(email: string): Promise<void> {
    const name = email.split("@")[0];
    await this.main
      .getByRole("button", { name: `Actions for ${name}`, exact: true })
      .click();

    const revoke = this.page.getByRole("menuitem", {
      name: "Revoke invitation",
    });
    await expect(revoke).toBeVisible();

    await this.page.keyboard.press("Escape");
    await expect(revoke).toBeHidden();
  }
}
