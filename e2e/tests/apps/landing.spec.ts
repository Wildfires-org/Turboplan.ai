import { expect, test } from "@playwright/test";

import { LandingHomePage } from "../../pages/landing-home";

/**
 * Smoke tests for the Landing Page application.
 * These tests verify basic functionality without requiring authentication.
 */
test.describe("Landing Page - Smoke Tests", () => {
  test("should load the homepage successfully", async ({ page }) => {
    const landingPage = new LandingHomePage(page);

    await landingPage.goto();

    // Verify the page loads and key elements are visible
    const isVisible = await landingPage.isVisible();
    expect(isVisible).toBe(true);

    // Verify the page title or key text
    await expect(page.locator('h1:has-text("Accelerate your")')).toBeVisible();
  });

  test("should display project description textarea", async ({ page }) => {
    const landingPage = new LandingHomePage(page);

    await landingPage.goto();

    // Verify the textarea is present and interactable
    const textarea = page.locator('textarea[placeholder*="working on"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEditable();
  });

  test("should display quick start options", async ({ page }) => {
    const landingPage = new LandingHomePage(page);

    await landingPage.goto();

    // Verify at least one quick start option is visible
    const quickStartButton =
      landingPage.getQuickStartButton("Fuels Reduction CE");
    await expect(quickStartButton).toBeVisible();
  });

  test("should populate textarea when clicking quick start option", async ({
    page,
  }) => {
    const landingPage = new LandingHomePage(page);

    await landingPage.goto();

    // Click a quick start option
    await landingPage.clickQuickStartOption("Fuels Reduction CE");

    // Verify textarea is populated
    const textarea = page.locator('textarea[placeholder*="working on"]');
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(0);
    expect(value).toContain("fuel break");
  });
});
