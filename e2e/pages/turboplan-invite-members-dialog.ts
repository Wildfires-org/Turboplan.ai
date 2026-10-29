import { expect, type Locator, type Page } from "@playwright/test";

/** Role labels offered by the dialog's role selects. */
export type MemberRoleLabel = "Owner" | "Editor" | "Viewer";

const ROLE_LABEL_PATTERN = /^(Owner|Editor|Viewer)$/;

/**
 * Page Object Model for the "Invite Members" dialog (InviteMembersDialog).
 *
 * The "Name or email" input is a cmdk combobox (UserSelector). Picking a
 * suggestion (Enter or click) adds the person straight to the pending list
 * with the current default role; "Send Invitation" sends the list. Locators
 * are scoped to the dialog so they never collide with the members page below.
 */
export class TurboplanInviteMembersDialog {
  readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog", { name: "Invite Members" });
  }

  // ── Search input and suggestions ──────────────────────────────────

  get searchInput(): Locator {
    return this.dialog.getByPlaceholder("Name or email");
  }

  /** The cmdk suggestions list; only rendered while the dropdown is open. */
  get suggestions(): Locator {
    return this.dialog.getByRole("listbox", { name: "Suggestions" });
  }

  /** The "Create and invite <email>" suggestion for an unknown email. */
  get inviteOption(): Locator {
    return this.suggestions.getByRole("option", { name: /^Create and invite/ });
  }

  /** A user suggestion, named by display name (followed by the email). */
  userOption(displayName: string): Locator {
    return this.suggestions.getByRole("option", { name: displayName });
  }

  /** Hint shown instead of any option for an already-added/member email. */
  takenHint(typedEmail: string): Locator {
    return this.suggestions.getByText(
      `${typedEmail} is already added or a member`,
      { exact: true },
    );
  }

  /**
   * The default-role select inside the input. Role selects are unnamed
   * comboboxes (a combobox takes no name from its content) whose text is the
   * current role; this one renders before the pending rows.
   */
  get defaultRoleSelect(): Locator {
    return this.dialog
      .getByRole("combobox")
      .filter({ hasText: ROLE_LABEL_PATTERN })
      .first();
  }

  // ── Pending list ──────────────────────────────────────────────────

  /** Every pending row's Remove button (one per pending invitee). */
  get removeButtons(): Locator {
    return this.dialog.getByRole("button", { name: /^Remove / });
  }

  /** A pending row's Remove button; rows are named by display name or email. */
  removeButton(name: string): Locator {
    return this.dialog.getByRole("button", {
      name: `Remove ${name}`,
      exact: true,
    });
  }

  /** A pending row's role select (it shares a wrapper with the Remove button). */
  pendingRoleSelect(name: string): Locator {
    return this.removeButton(name).locator("..").getByRole("combobox");
  }

  get sendButton(): Locator {
    return this.dialog.getByRole("button", { name: "Send Invitation" });
  }

  // ── Actions ───────────────────────────────────────────────────────

  /** Replace the input's text (reopens the suggestions). */
  async type(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  async pressEnter(): Promise<void> {
    await this.searchInput.press("Enter");
  }

  /** Type an email nobody has, wait for its invite option, and pick it with Enter. */
  async addEmailWithEnter(email: string): Promise<void> {
    await this.type(email);
    await expect(this.inviteOption).toBeVisible();
    await this.pressEnter();
  }

  /** Change the role that the next picks are added with. */
  async chooseDefaultRole(role: MemberRoleLabel): Promise<void> {
    await this.defaultRoleSelect.click();
    await this.page.getByRole("option", { name: role, exact: true }).click();
  }

  async send(): Promise<void> {
    await this.sendButton.click();
  }
}
