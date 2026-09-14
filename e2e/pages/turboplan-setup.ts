import { expect, type Page } from "@playwright/test";

import { OFFICE_URL_PATTERN, PROJECT_URL_PATTERN } from "../config/patterns";
import { TEST_USER, TEST_WORKSPACE, type UserRole } from "../config/test-data";
import { mockGenerateTitles } from "../utils";

/**
 * Page Object Model for the Turboplan profile setup wizard.
 * Handles personal info, professional info, office, and project creation.
 */
export class TurboplanSetupPage {
  constructor(private readonly page: Page) {}

  getCreateOfficeDialogElements() {
    const dialog = this.page
      .getByRole("dialog")
      .filter({
        has: this.page.getByRole("heading", { name: /Create New Office/i }),
      })
      .first();

    const officeNameInput = dialog
      .locator('input[name="name"]')
      .or(dialog.getByLabel(/Office Name|Office/i))
      .or(dialog.getByPlaceholder(/Office name/i))
      .first();

    return { dialog, officeNameInput };
  }

  /**
   * Navigate to the personal info setup step
   */
  async gotoPersonal(): Promise<void> {
    const turboplanUrl = process.env.TURBOPLAN_URL || "http://localhost:3000";
    await this.page.goto(`${turboplanUrl}/setup/personal`);
  }

  isOnPersonalStep(): boolean {
    return this.page.url().includes("/setup/personal");
  }

  /**
   * Complete the single-step personal info form (first + last name).
   *
   * The setup wizard is a single step now: there is no professional/role step —
   * the user's role is auto-detected from their email domain. Submitting the
   * form completes onboarding and redirects out of /setup.
   *
   * @param firstName - User's first name
   * @param lastName - User's last name
   */
  async completePersonalInfo(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await this.page.getByLabel("First name").fill(firstName);
    await this.page.getByLabel("Last name").fill(lastName);
    await this.page.getByRole("button", { name: "Complete Setup" }).click();

    // Redirect chain: /setup/personal → /setup/plan (billing flag ON; the
    // page bounces straight through when billing is disabled) → /?setup=true
    // → dashboard → personal office page. Signup auto-creates a default "My
    // Office" the user owns, so the chain SETTLES on
    // …/offices/<slug>[?create-project=true]. We must wait for that final
    // office page — NOT merely for the path to leave /setup, which resolves
    // at the intermediate "/" before the office redirect lands. A pathname
    // predicate is used so the ?create-project=true query does not break a
    // `$`-anchored URL regex.
    await this.page.waitForURL(
      (url) =>
        this.isOnOfficePath(url.pathname) ||
        url.pathname.includes("/setup/plan"),
      { timeout: 20000 },
    );

    // Billing flag ON: the plan step interposes — this wizard flow is not a
    // billing test, so take the free path (Skip stamps Starter) and continue.
    // Billing flag OFF: /setup/plan bounces straight through to the office
    // page, and the URL predicate above can catch it mid-bounce — so race the
    // Skip button against the office redirect instead of clicking blindly.
    if (this.page.url().includes("/setup/plan")) {
      const skipButton = this.page.getByRole("button", {
        name: "Skip for now",
      });
      const outcome = await Promise.race([
        skipButton
          .waitFor({ state: "visible", timeout: 15000 })
          .then(() => "skip" as const)
          .catch(() => "timeout" as const),
        this.page
          .waitForURL((url) => this.isOnOfficePath(url.pathname), {
            timeout: 15000,
          })
          .then(() => "office" as const)
          .catch(() => "timeout" as const),
      ]);
      if (outcome === "skip") {
        await skipButton.click();
      }
      // "office" → already through; "timeout" → let the office-page wait
      // below produce the real failure.
    }

    try {
      await this.page.waitForURL((url) => this.isOnOfficePath(url.pathname), {
        timeout: 20000,
      });
    } catch {
      // The client-side router.push("/") occasionally stalls before the server
      // redirect to the office page; nudge it with a hard navigation.
      await this.page.goto("/");
      await this.page.waitForURL((url) => this.isOnOfficePath(url.pathname), {
        timeout: 15000,
      });
    }
  }

  /** True when a pathname is a `/organizations/<slug>/offices/<slug>` page. */
  private isOnOfficePath(pathname: string): boolean {
    return /\/organizations\/[^/]+\/offices\/[^/]+/.test(pathname);
  }

  /**
   * Create a new office from the dashboard
   * @param name - Office name
   * @param description - Office description (optional, if field exists)
   */
  async createOffice(name: string, description?: string): Promise<void> {
    // Click the "New Office" button (or "Create First Office" if empty)
    // Use .first() to handle cases where both buttons may exist in DOM
    const newOfficeButton = this.page
      .getByRole("button", {
        name: /New Office|Create First Office/,
      })
      .first();
    await newOfficeButton.click();

    // Wait for dialog to open and scope all interactions to it
    const { dialog, officeNameInput } = this.getCreateOfficeDialogElements();
    await dialog.waitFor({ state: "visible" });
    await expect(officeNameInput).toBeVisible();
    await officeNameInput.fill(name);
    if (description) {
      const descriptionInput = this.page.getByLabel(/Description/i).first();
      if ((await descriptionInput.count()) > 0) {
        await descriptionInput.fill(description);
      }
    }

    // Submit and wait for success toast
    // Set up the wait promise before clicking to avoid race conditions
    const successPromise = this.page
      .getByText(/Office created successfully/i)
      .waitFor();
    await dialog.getByRole("button", { name: /Create (New )?Office/i }).click();
    await successPromise;

    // Wait for dialog to close (hidden, not detached - Radix dialogs animate)
    await dialog.waitFor({ state: "hidden" }).catch(() => {
      // Dialog might already be closed, that's fine
    });

    console.log(`✓ Office created: ${name}`);
  }

  /**
   * Navigate to an office by clicking on its card
   * @param officeName - Name of the office to navigate to
   */
  async navigateToOffice(officeName: string): Promise<void> {
    await this.page.getByText(officeName).first().click();

    // Wait for navigation to office page (org/office UUID pattern)
    await this.page.waitForURL(OFFICE_URL_PATTERN);
  }

  /**
   * Create a new project from the office page
   * @param name - Project name
   * @param prompt - Project setup prompt (optional)
   */
  async createProject(name: string, prompt: string): Promise<void> {
    const dialogHeading = this.page.getByRole("heading", {
      name: "Add Project",
    });

    // ?create-project=true may auto-open the dialog. Wait briefly, then fall back to button click.
    try {
      await dialogHeading.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      const newProjectButton = this.page
        .getByRole("button", {
          name: /New Project|Create First Project/,
        })
        .first();
      await newProjectButton.click();
      await dialogHeading.waitFor();
    }

    // Fill the form (project name is auto-generated by AI)
    await this.page.getByLabel("Project Prompt").fill(prompt);

    // The dialog uses org/office from URL context as form defaults,
    // so the button should be enabled once the form is filled.
    const createButton = this.page.getByRole("button", {
      name: "Create Project",
    });
    await expect(createButton).toBeEnabled();

    // Mock the /generate-titles endpoint to return a deterministic name
    const unmockGenerateTitles = await mockGenerateTitles(this.page, name);

    // Submit and wait for redirect to project chat page
    await createButton.click();
    await this.page.waitForURL(PROJECT_URL_PATTERN);

    await unmockGenerateTitles();

    console.log(`✓ Project created: ${name}`);
  }

  /**
   * Complete the entire setup wizard (profile + office + project)
   * @param options - Setup wizard options
   */
  async completeWizard(options?: {
    firstName?: string;
    lastName?: string;
    /**
     * Accepted for backward compatibility only. Role is auto-detected from the
     * user's email domain — there is no manual role selection in setup anymore.
     */
    userRole?: UserRole;
    /** Accepted for backward compatibility only; no longer collected in setup. */
    jobTitle?: string;
    /** Set to false to skip office/project creation (default: true) */
    createWorkspace?: boolean;
    officeName?: string;
    officeDescription?: string;
    projectName?: string;
    projectPrompt?: string;
  }): Promise<void> {
    const {
      firstName = TEST_USER.FIRST_NAME,
      lastName = TEST_USER.LAST_NAME,
      createWorkspace = true,
      officeName = TEST_WORKSPACE.OFFICE_NAME,
      officeDescription = TEST_WORKSPACE.OFFICE_DESCRIPTION,
      projectName = TEST_WORKSPACE.PROJECT_NAME,
      projectPrompt = TEST_WORKSPACE.PROJECT_PROMPT,
    } = options ?? {};

    // Step 1: Single-step personal info form (if visible). Completing it
    // redirects out of /setup to the user's personal org page (no office yet).
    const firstNameInput = this.page.getByLabel("First name");
    if (await firstNameInput.isVisible()) {
      await this.completePersonalInfo(firstName, lastName);
      console.log("✓ Personal info completed");
    }

    // Step 2: Create the project (if requested). Signup auto-creates a personal
    // "My Projects" office, so a brand-new user lands directly on that office page and we
    // create the project there. createOffice is kept ONLY as a defensive
    // fallback for a no-office landing, which signup no longer produces.
    if (createWorkspace) {
      const onOfficePage = this.page.url().includes("/offices/");
      if (!onOfficePage) {
        await this.createOffice(officeName, officeDescription);
        await this.navigateToOffice(officeName);
      }
      await this.createProject(projectName, projectPrompt);
    }
  }
}
