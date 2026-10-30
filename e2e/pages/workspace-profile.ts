import { expect, type Locator, type Page } from "@playwright/test";

export type ProfileFieldLabel =
  | "First Name"
  | "Last Name"
  | "Phone"
  | "Street Address"
  | "Unit Number"
  | "City or Town"
  | "State"
  | "Zip Code"
  | "Job Title";

export const PROFILE_PATH = "/profile";

/**
 * Page Object Model for the Profile page (`/profile`): the profile form, the
 * Appearance tab's interface scale, and the sidebar user menu's Sign Out.
 */
export class WorkspaceProfilePage {
  constructor(public readonly page: Page) {}

  /**
   * Sign in through a magic link that lands on `redirectTo` (a relative path),
   * skipping onboarding for a user whose profile already has a name.
   */
  async signInWithMagicLink(
    magicLinkUrl: string,
    redirectTo = PROFILE_PATH,
  ): Promise<void> {
    await this.page.goto(
      `${magicLinkUrl}&redirectTo=${encodeURIComponent(redirectTo)}`,
    );
    await this.page.waitForURL((url) => url.pathname === redirectTo, {
      timeout: 20000,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto(PROFILE_PATH);
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Profile", level: 1 }),
    ).toBeVisible({ timeout: 15000 });
  }

  // ── Profile form ─────────────────────────────────────────────────

  field(label: ProfileFieldLabel): Locator {
    return this.page.getByLabel(label, { exact: true });
  }

  get emailInput(): Locator {
    return this.page.getByLabel("Email", { exact: true });
  }

  /** Submit the form; the server action saves and re-renders /profile. */
  async save(): Promise<void> {
    await this.page.getByRole("button", { name: "Save changes" }).click();
  }

  // ── Appearance tab ───────────────────────────────────────────────

  tab(name: "Profile" | "Access Tokens" | "Appearance"): Locator {
    return this.page.getByRole("tab", { name });
  }

  async openAppearance(): Promise<void> {
    await this.tab("Appearance").click();
    await expect(this.interfaceScaleSlider).toBeVisible();
  }

  get interfaceScaleSlider(): Locator {
    return this.page.getByRole("slider", { name: "Interface scale" });
  }

  get resetScaleButton(): Locator {
    return this.page.getByRole("button", { name: "Reset to default" });
  }

  // ── Sidebar user menu ────────────────────────────────────────────

  /** The sidebar footer's user button, which opens the account menu. */
  userMenuButton(email: string): Locator {
    return this.page
      .locator('[data-sidebar="footer"]')
      .getByRole("button")
      .filter({ hasText: email });
  }

  async signOutFromUserMenu(email: string): Promise<void> {
    await this.userMenuButton(email).click();
    await this.page.getByRole("menuitem", { name: "Sign Out" }).click();
  }
}
