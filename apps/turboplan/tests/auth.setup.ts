import { expect, test as setup } from "@playwright/test";
import { getUnixTime } from "date-fns";
import path from "path";

import { createTestUserWithMagicLink } from "../../../e2e/utils/test-auth";

const authFile = path.join(__dirname, "../playwright/.auth/session.json");

setup("authenticate", async ({ page }) => {
  const testEmail = `test-${getUnixTime(new Date())}@playwright.com`;

  // Create test user directly in database and get magic link URL
  // This bypasses email sending for faster, more reliable tests
  const { magicLinkUrl } = await createTestUserWithMagicLink(testEmail);

  // Navigate to magic link to authenticate
  await page.goto(magicLinkUrl);

  // Wait for successful verification and redirect
  await expect(page.getByText(/verified|signed in/i)).toBeVisible({
    timeout: 10000,
  });

  // Wait for redirect to complete (setup page or home)
  await page.waitForURL(/\/(setup|$)/, { timeout: 15000 });

  // If redirected to setup, complete basic profile
  if (page.url().includes("/setup")) {
    // Fill in required profile fields if on setup page
    const firstNameInput = page.getByLabel(/first name/i);
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill("Test");
      await page.getByLabel(/last name/i).fill("User");
      await page.getByRole("button", { name: /continue|save|next/i }).click();
      await page.waitForURL("/", { timeout: 15000 });
    }
  }

  // Save authenticated session state
  await page.context().storageState({ path: authFile });
});
