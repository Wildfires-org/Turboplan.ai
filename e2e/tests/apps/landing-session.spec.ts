import { expect, test } from "@playwright/test";

/**
 * The marketing pages are prerendered, so the signed-in state comes from
 * /api/session after hydration instead of from the root layout. Anonymous
 * visitors must still get "Sign In", signed-in ones their avatar, and the
 * static HTML must carry the page content.
 */
const LANDING_URL = process.env.LANDING_PAGE_URL || "http://localhost:3002";

test.describe("Landing Page - session loaded in the browser", () => {
  test("the home page HTML is complete without JavaScript", async ({
    request,
  }) => {
    const response = await request.get(LANDING_URL);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<h1[^>]*>/);
    expect(html).toContain("Accelerate your");
  });

  test("anonymous visitors see Sign In once the session settles", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    const sessionResponse = await page.request.get(
      `${LANDING_URL}/api/session`,
    );
    expect(sessionResponse.headers()["cache-control"]).toContain("no-store");
    expect(await sessionResponse.json()).toBeNull();

    await page.goto(LANDING_URL);
    const navbar = page.getByRole("navigation", { name: "Main navigation" });
    await expect(navbar.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(navbar.getByRole("button", { name: "User menu" })).toHaveCount(
      0,
    );
    await context.close();
  });

  test("signed-in visitors get their avatar, never Sign In", async ({
    page,
  }) => {
    // The default storage state is the signed-in citizen; the session cookie
    // is host-scoped, so it reaches the landing page on the same host.
    const session = await (
      await page.request.get(`${LANDING_URL}/api/session`)
    ).json();
    test.skip(!session, "No signed-in session reaches the landing origin.");

    await page.goto(LANDING_URL);
    // The footer keeps its own "Sign In" link; the navbar must not show one.
    const navbar = page.getByRole("navigation", { name: "Main navigation" });
    await expect(
      navbar.getByRole("button", { name: "User menu" }),
    ).toBeVisible();
    await expect(navbar.getByRole("link", { name: "Sign In" })).toBeHidden();
  });
});
