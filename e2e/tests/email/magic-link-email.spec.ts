import { expect, test } from "@playwright/test";

import { getAppName } from "@wildfires-org/turboplan-env";

import { TEST_CREDENTIALS } from "../../config/test-credentials";
import { TurboplanRegisterPage } from "../../pages";
import { getEtherealCredentials, waitForEmail } from "../../utils";

/**
 * E2E tests for magic link email sending.
 *
 * These tests verify that magic link emails are sent via Ethereal
 * when users register or login through the standard flows.
 *
 * Prerequisites:
 * - ETHEREAL_USER and ETHEREAL_PASS must be set in environment
 * - Ethereal provider must be configured (no RESEND_API_KEY set)
 */

// Get Ethereal credentials - tests will be skipped if not configured
const etherealCredentials = getEtherealCredentials();

test.describe("Magic Link Email", () => {
  // These tests need to run unauthenticated (testing registration flow)
  test.use({ storageState: { cookies: [], origins: [] } });

  // Skip the entire suite if Ethereal credentials aren't configured
  test.skip(
    () => !etherealCredentials,
    "ETHEREAL_USER and ETHEREAL_PASS not set - skipping email tests",
  );

  test("should receive verification email after registration request", async ({
    page,
  }) => {
    // Generate a unique email for this test
    const testEmail = TEST_CREDENTIALS.generateEmail();

    // Request registration link through the UI
    const registerPage = new TurboplanRegisterPage(page);
    await registerPage.goto();
    await registerPage.waitForPageLoad();
    await registerPage.requestRegistrationLink(testEmail);

    // Wait for the magic link email to arrive
    const email = await waitForEmail(etherealCredentials!, {
      to: testEmail,
      subject: "Verify",
      timeout: 30000,
      pollInterval: 2000,
      sinceMinutes: 5,
    });

    // Verify email was received
    expect(
      email,
      `No email received for ${testEmail}. Make sure ETHEREAL_USER and ETHEREAL_PASS are set in the server's environment (e2e/.env), not just for the tests.`,
    ).not.toBeNull();
    expect(email?.to.toLowerCase()).toBe(testEmail.toLowerCase());
    expect(email?.subject.toLowerCase()).toContain("verify");

    // Verify email content contains magic link
    if (email?.html) {
      expect(email.html).toContain(getAppName());
      expect(email.html).toContain("/verify");
    }
  });

  test("should receive login email for existing user", async ({ page }) => {
    // Generate a unique email for this test
    const testEmail = TEST_CREDENTIALS.generateEmail();

    // First, register the user
    const registerPage = new TurboplanRegisterPage(page);
    await registerPage.goto();
    await registerPage.waitForPageLoad();
    await registerPage.requestRegistrationLink(testEmail);

    // Wait for registration email
    const registrationEmail = await waitForEmail(etherealCredentials!, {
      to: testEmail,
      subject: "Verify",
      timeout: 30000,
      sinceMinutes: 5,
    });
    expect(registrationEmail).not.toBeNull();

    // Extract magic link from email and verify the user
    const regHtml = registrationEmail?.html || "";
    const verifyUrlMatch =
      regHtml.match(/href=["']([^"']*verify[^"']*)["']/i) ||
      regHtml.match(/href=["']([^"']*token=[^"']*)["']/i) ||
      regHtml.match(/(https?:\/\/[^\s"'<>]*verify[^\s"'<>]*)/i);

    if (verifyUrlMatch?.[1]) {
      // Decode HTML entities in URL (e.g., &amp; -> &)
      const verifyUrl = verifyUrlMatch[1].replace(/&amp;/g, "&");
      await page.goto(verifyUrl);
      await page.waitForURL(/\/(setup|$)/, { timeout: 15000 });
    }

    // Clear session to test login flow (user is now logged in after verification)
    await page.context().clearCookies();

    // Now test login flow - request login link
    const turboplanUrl = process.env.TURBOPLAN_URL || "http://localhost:3000";
    await page.goto(`${turboplanUrl}/login`);
    await page.getByPlaceholder("user@acme.com").fill(testEmail);
    await page.getByRole("button", { name: "Send sign-in link" }).click();
    await page.waitForURL(/\/check-email/);

    // Wait for the login email to arrive
    const loginEmail = await waitForEmail(etherealCredentials!, {
      to: testEmail,
      subject: "Sign in",
      timeout: 30000,
      pollInterval: 2000,
      sinceMinutes: 5,
    });

    // Verify email was received
    expect(loginEmail).not.toBeNull();
    expect(loginEmail?.to.toLowerCase()).toBe(testEmail.toLowerCase());
    expect(loginEmail?.subject.toLowerCase()).toContain("sign in");

    // Verify email content contains magic link
    if (loginEmail?.html) {
      expect(loginEmail.html).toContain(getAppName());
      expect(loginEmail.html).toContain("/verify");
    }
  });

  test("magic link should contain valid verification URL", async ({
    page,
  }, testInfo) => {
    // Generate a unique email for this test
    const testEmail = TEST_CREDENTIALS.generateEmail();

    // Request registration link through the UI
    const registerPage = new TurboplanRegisterPage(page);
    await registerPage.goto();
    await registerPage.waitForPageLoad();
    await registerPage.requestRegistrationLink(testEmail);

    // Wait for the magic link email to arrive
    const email = await waitForEmail(etherealCredentials!, {
      to: testEmail,
      subject: "Verify",
      timeout: 30000,
      sinceMinutes: 5,
    });

    expect(email).not.toBeNull();

    // Debug: Attach email content to test report
    const html = email?.html || "";
    const text = email?.text || "";
    const rawSource = email?.rawSource || "";

    await testInfo.attach("email-html", {
      body: html || "(empty)",
      contentType: "text/html",
    });

    await testInfo.attach("email-text", {
      body: text || "(empty)",
      contentType: "text/plain",
    });

    await testInfo.attach("email-raw-source", {
      body: rawSource || "(empty)",
      contentType: "text/plain",
    });

    // Decode HTML entities (emails often encode & as &amp;)
    const decodeHtmlEntities = (str: string) =>
      str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

    // Decode Quoted-Printable (=XX hex encoding, = at EOL is line continuation)
    const decodeQuotedPrintable = (str: string) =>
      str
        .replace(/=\r?\n/g, "") // Join soft line breaks
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );

    const decodedHtml = decodeHtmlEntities(html);
    // Also decode QP in raw source for fallback URL extraction
    const decodedSource = decodeQuotedPrintable(decodeHtmlEntities(rawSource));

    // Try to find the magic link URL from multiple sources
    // 1. From HTML href attributes (after decoding entities)
    const hrefMatch =
      decodedHtml.match(/href=["']([^"']*verify\?token=[^"']*)["']/i) ||
      decodedHtml.match(/href=["']([^"']*token=[^"']*)["']/i);

    // 2. From raw URL in HTML or text
    const rawUrlMatch =
      decodedHtml.match(/(https?:\/\/[^\s"'<>]*\/verify\?token=[^\s"'<>]+)/i) ||
      text.match(/(https?:\/\/[^\s"'<>]*\/verify\?token=[^\s"'<>]+)/i);

    // 3. From raw email source (last resort - handles base64 encoded content)
    const sourceUrlMatch = decodedSource.match(
      /(https?:\/\/[^\s"'<>]*\/verify\?token=[^\s"'<>&]+)/i,
    );

    const verifyUrl =
      hrefMatch?.[1] || rawUrlMatch?.[1] || sourceUrlMatch?.[1] || "";

    // Debug info
    const allHrefs = decodedHtml.match(/href=["'][^"']*["']/gi) || [];
    const allUrls =
      (decodedHtml + " " + text).match(/https?:\/\/[^\s"'<>]+/gi) || [];
    const sourceUrls =
      decodedSource.match(/https?:\/\/[^\s"'<>]+verify[^\s"'<>]*/gi) || [];

    // Use expect with custom message to show debug info on failure
    expect(
      verifyUrl,
      `URL should contain token=. Found URL: "${verifyUrl}". All hrefs: ${JSON.stringify(allHrefs)}. All URLs: ${JSON.stringify(allUrls)}. Source URLs: ${JSON.stringify(sourceUrls.slice(0, 3))}`,
    ).toContain("token=");

    expect(verifyUrl).toContain("verify");
    expect(verifyUrl).toContain("userId=");
  });
});
