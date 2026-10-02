import { expect, test } from "@playwright/test";

/**
 * A missing page answers with a real 404, not a 200 carrying a noindex
 * not-found page. A Suspense boundary around the page in the root layout
 * breaks this: it flushes the 200 before the page can call notFound().
 * Requested with a crawler user agent, which gets the fully rendered
 * response instead of streamed metadata.
 */
const LANDING_URL = process.env.LANDING_PAGE_URL || "http://localhost:3002";

const GOOGLEBOT_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const MISSING_PATHS = [
  "/no-such-page",
  "/docs/no-such-page",
  "/projects/no-such-organization",
  "/projects/no-such-organization/no-such-office",
];

test.describe("Landing Page - status codes", () => {
  for (const path of MISSING_PATHS) {
    test(`${path} returns a 404`, async ({ request }) => {
      const response = await request.get(`${LANDING_URL}${path}`, {
        headers: { "user-agent": GOOGLEBOT_USER_AGENT },
      });
      expect(response.status()).toBe(404);
    });
  }
});
