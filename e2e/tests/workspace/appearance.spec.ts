import { expect, test } from "@playwright/test";

import { WorkspaceProfilePage } from "../../pages/workspace-profile";

/**
 * Profile → Appearance: the interface scale. It is a per-device preference
 * stored in a cookie (no database row), so the citizen user's default auth
 * state is safe to use: the cookie lives only in this test's browser context.
 *
 * Bounds and step come from `@wildfires-org/turboplan-utils` (ui-scale.ts):
 * default 93.75%, step 1.25%.
 */
const UI_SCALE_COOKIE_NAME = "turboplan-ui-scale";
const DEFAULT_SCALE_LABEL = "93.75%";
const TWO_STEPS_UP_LABEL = "96.25%";
/** <html> carries the scale as a CSS variable (a fraction of 1). */
const SCALED_HTML_STYLE = /--ui-scale:\s*0\.9625/;

test.describe("Appearance settings", () => {
  test("keeps a changed interface scale after a reload and resets it", async ({
    page,
  }) => {
    const profile = new WorkspaceProfilePage(page);
    await profile.goto();
    await profile.openAppearance();

    const slider = profile.interfaceScaleSlider;
    await expect(slider).toHaveAttribute("aria-valuetext", DEFAULT_SCALE_LABEL);
    await expect(profile.resetScaleButton).toBeDisabled();

    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", TWO_STEPS_UP_LABEL);
    await expect(profile.resetScaleButton).toBeEnabled();

    // Applied to the whole document, and stored in the preference cookie.
    await expect(page.locator("html")).toHaveAttribute(
      "style",
      SCALED_HTML_STYLE,
    );
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((cookie) => cookie.name === UI_SCALE_COOKIE_NAME)
          ?.value;
      })
      .toBe("96.25");

    // A fresh load keeps the scale (rendered server-side from the cookie).
    await page.reload();
    await profile.expectLoaded();
    await expect(page.locator("html")).toHaveAttribute(
      "style",
      SCALED_HTML_STYLE,
    );
    await profile.openAppearance();
    await expect(slider).toHaveAttribute("aria-valuetext", TWO_STEPS_UP_LABEL);

    await profile.resetScaleButton.click();
    await expect(slider).toHaveAttribute("aria-valuetext", DEFAULT_SCALE_LABEL);
    await expect(profile.resetScaleButton).toBeDisabled();

    await page.reload();
    await profile.expectLoaded();
    await expect(page.locator("html")).not.toHaveAttribute(
      "style",
      /--ui-scale/,
    );
    await profile.openAppearance();
    await expect(slider).toHaveAttribute("aria-valuetext", DEFAULT_SCALE_LABEL);
  });
});
