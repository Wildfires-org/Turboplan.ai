import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object Model for the organization billing settings page
 * (`/organizations/{slug}/billing`).
 *
 * Wraps the interactions the billing e2e suite needs: reading the trial/plan
 * state, cancelling and resuming the plan, and managing paid-seat rows.
 */
export class TurboplanBillingPage {
  constructor(public readonly page: Page) {}

  // ── Navigation ────────────────────────────────────────────────────

  async goto(orgSlug: string): Promise<void> {
    await this.page.goto(`/organizations/${orgSlug}/billing`);
    // The plan card renders once the subscription request resolves. Generous
    // timeout to absorb the first-hit route compile under `next dev`.
    await this.paidUsersHeading().waitFor({ state: "visible", timeout: 30000 });
  }

  // ── Plan / trial state ────────────────────────────────────────────

  planBadge(name: string): Locator {
    // The plan badge is a small pill next to the plan-card title.
    return this.page.getByText(name, { exact: true }).first();
  }

  activePlanHeading(): Locator {
    return this.page.getByText("Active plan", { exact: true });
  }

  cancelPlanButton(): Locator {
    return this.page.getByRole("button", { name: "Cancel plan", exact: true });
  }

  resumePlanButton(): Locator {
    return this.page.getByRole("button", { name: "Resume plan", exact: true });
  }

  cancellationNotice(): Locator {
    return this.page.getByText(/Your plan is set to cancel on/i);
  }

  // ── Cancel / resume flows ─────────────────────────────────────────

  /** Open the "Cancel your plan?" dialog and confirm cancellation. */
  async cancelPlan(): Promise<void> {
    await this.cancelPlanButton().click();

    const dialog = this.page.getByRole("alertdialog");
    await expect(
      dialog.getByRole("heading", { name: "Cancel your plan?" }),
    ).toBeVisible();

    // The confirm action shares the "Cancel plan" label — scope to the dialog.
    await dialog.getByRole("button", { name: "Cancel plan" }).click();

    // The dialog closes only after the cancel request + Stripe round-trip.
    await expect(dialog).toBeHidden({ timeout: 15000 });
  }

  /** Click "Resume plan" to clear a pending cancellation. */
  async resumePlan(): Promise<void> {
    await this.resumePlanButton().click();
  }

  // ── Paid-users roster ─────────────────────────────────────────────

  paidUsersHeading(): Locator {
    return this.page.getByText("Paid users", { exact: true });
  }

  /**
   * The "Paid users" card. Anchored as the innermost div containing both the
   * card title and the "seats used" line — this scopes roster queries to the
   * card and away from page chrome (the banner's "Manage Organization" button
   * would otherwise collide with the per-member "Manage" buttons).
   */
  paidUsersCard(): Locator {
    return this.page
      .locator("div")
      .filter({ has: this.paidUsersHeading() })
      .filter({ has: this.page.getByText(/seats? used/) })
      .last();
  }

  /**
   * The "{n} seat(s) used" summary line. The count and label render as
   * adjacent spans inside one div, so the div's combined text is e.g.
   * "2 seats used" (singular for 1).
   */
  seatsUsed(count: number): Locator {
    return this.paidUsersCard().getByText(
      `${count} seat${count === 1 ? "" : "s"} used`,
    );
  }

  /**
   * The included/extra seat breakdown line, e.g. "5 included" or
   * "5 included, 1 extra" once billable members exceed the included count.
   */
  seatBreakdown(text: string): Locator {
    return this.paidUsersCard().getByText(text);
  }

  /**
   * The roster rows, identified by their per-member "Manage {label}" button,
   * scoped to the paid-users card so page chrome does not leak in.
   */
  manageButtons(): Locator {
    return this.paidUsersCard().getByRole("button", { name: /^Manage / });
  }

  manageButton(label: string): Locator {
    return this.paidUsersCard().getByRole("button", {
      name: `Manage ${label}`,
    });
  }

  /**
   * The "owner" role badge in the roster. Exact match so it never picks up the
   * card description ("Contributors (owners and editors)…").
   */
  ownerRoleBadge(): Locator {
    return this.paidUsersCard().getByText("owner", { exact: true });
  }

  /** Open a specific member row's "Manage {label}" menu. */
  async openSeatMenu(label: string): Promise<void> {
    await this.manageButton(label).click();
  }

  /** Open the only remaining member row's menu (e.g. the sole owner). */
  async openSoleSeatMenu(): Promise<void> {
    await this.manageButtons().click();
  }

  async chooseDowngradeToViewer(): Promise<void> {
    await this.page
      .getByRole("menuitem", { name: "Downgrade to viewer" })
      .click();
  }

  async chooseRemoveFromOrganization(): Promise<void> {
    await this.page
      .getByRole("menuitem", { name: "Remove from organization" })
      .click();
  }

  seatActionDialog(): Locator {
    return this.page.getByRole("alertdialog");
  }

  /** Confirm the pending seat action (downgrade). */
  async confirmDowngrade(): Promise<void> {
    await this.seatActionDialog()
      .getByRole("button", { name: "Downgrade", exact: true })
      .click();
  }

  /** Confirm the pending seat action (remove). */
  async confirmRemove(): Promise<void> {
    await this.seatActionDialog()
      .getByRole("button", { name: "Remove", exact: true })
      .click();
  }

  /**
   * Full downgrade flow for a member: open their menu, choose downgrade, and
   * confirm. Returns the dialog locator (already actioned) for optional checks.
   */
  async downgradeMemberToViewer(label: string): Promise<void> {
    await this.openSeatMenu(label);
    await this.chooseDowngradeToViewer();
    await expect(this.seatActionDialog()).toBeVisible();
    await this.confirmDowngrade();
    // Wait for the request (membership change + Stripe sync + roster refetch) to
    // finish and the modal to close. While it is open the background is `inert`,
    // so roster assertions would race against 0 visible buttons.
    await expect(this.seatActionDialog()).toBeHidden({ timeout: 20000 });
  }

  /**
   * Full remove flow for a member: open their menu, choose "Remove from
   * organization", and confirm. Unlike downgrade, this deletes the membership
   * rows entirely.
   */
  async removeMemberFromOrganization(label: string): Promise<void> {
    await this.openSeatMenu(label);
    await this.chooseRemoveFromOrganization();
    await expect(this.seatActionDialog()).toBeVisible();
    await this.confirmRemove();
    // See downgradeMemberToViewer — wait out the request before asserting.
    await expect(this.seatActionDialog()).toBeHidden({ timeout: 20000 });
  }
}
