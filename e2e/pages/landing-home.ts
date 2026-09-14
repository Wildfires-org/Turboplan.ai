import { expect, type Page } from "@playwright/test";

/**
 * Page Object Model for the Landing Page homepage.
 * Provides methods to interact with the hero section and main navigation.
 */
export class LandingHomePage {
  constructor(private readonly page: Page) {}

  /**
   * Navigate to the landing page homepage
   */
  async goto(): Promise<void> {
    const landingUrl = process.env.LANDING_PAGE_URL || "http://localhost:3002";
    await this.page.goto(landingUrl);
  }

  /**
   * Check if the page is visible by verifying key hero section elements
   */
  async isVisible(): Promise<boolean> {
    try {
      // Check for the main heading text
      const heading = this.page.locator('h1:has-text("Accelerate your")');
      await heading.waitFor({ state: "visible" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the project description textarea element
   */
  private getProjectDescriptionTextarea() {
    return this.page.locator('textarea[placeholder*="working on"]');
  }

  /**
   * Get the submit (send) button of the hero prompt input
   */
  private getSubmitButton() {
    return this.page.locator(
      '#project-prompt-input button[type="submit"][aria-label="Submit"]',
    );
  }

  /**
   * Fill in project description and click the get started button
   * @param description - Project description text to enter
   */
  async fillProjectDescription(description: string): Promise<void> {
    await this.getProjectDescriptionTextarea().fill(description);
  }

  /**
   * Click the get started (arrow) button to proceed with project creation
   */
  async clickGetStarted(): Promise<void> {
    await this.getSubmitButton().click();
  }

  /**
   * Wait for the signup modal to appear after clicking get started
   */
  async waitForModal(): Promise<void> {
    await this.page.waitForSelector('[role="dialog"]', {
      state: "visible",
    });
  }

  /**
   * Get one of the quick start option buttons.
   * @param optionText - Text of the quick start option button
   */
  getQuickStartButton(optionText: string) {
    return this.page
      .getByTestId("quick-start-pills")
      .getByRole("button", { name: optionText });
  }

  /**
   * Click a quick start option to fill the description.
   * The pills auto-scroll (Embla AutoScroll, `stopOnMouseEnter`); hovering the
   * wrapper pauses the scroll so Playwright's stability check can pass. Under
   * load the first hover can land before React hydrates the listener, so the
   * strip keeps moving — re-hover until the button's box stops changing.
   * @param optionText - Text of the quick start option
   */
  async clickQuickStartOption(optionText: string): Promise<void> {
    const pills = this.page.getByTestId("quick-start-pills");
    const button = this.getQuickStartButton(optionText);
    await expect(button).toBeVisible();

    await expect
      .poll(
        async () => {
          await pills.hover();
          const before = await button.boundingBox();
          await this.page.waitForTimeout(150);
          const after = await button.boundingBox();
          return before !== null && after !== null && before.x === after.x;
        },
        { timeout: 15_000, intervals: [200, 500, 1000] },
      )
      .toBe(true);

    await button.click();
  }
}
