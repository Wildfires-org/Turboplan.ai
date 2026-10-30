import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared checks for the route smoke specs: a page "renders" when its main
 * heading (or landmark) shows, no error/not-found/access page took its place,
 * and the browser logged no uncaught errors and no console errors.
 */

export const NOT_FOUND_HEADING = "Looks like you're off the trail!";

const ERROR_BOUNDARY_TEXT = /something went wrong/i;
const ACCESS_ERROR_HEADING = "Access Restricted";

/**
 * Console errors any page may log without being broken. Keep this short: every
 * entry hides a whole class of failures from every smoke test.
 */
const KNOWN_CONSOLE_NOISE: RegExp[] = [
  // Next.js logs this when a navigation cancels an in-flight RSC prefetch,
  // then falls back to a normal navigation. Nothing is lost.
  /Failed to fetch RSC payload/,
];

export type PageProblems = {
  consoleErrors: string[];
  pageErrors: string[];
};

/**
 * Logged when a `redirect()` inside the `(dashboard)` route group cancels the
 * sidebar's in-flight API calls: Next streams the layout (and its data hooks)
 * before the page decides to redirect. See the note in `app/page.tsx`. Allow
 * these only on routes that are expected to redirect.
 */
export const ABORTED_BY_DASHBOARD_REDIRECT: RegExp[] = [
  /^API request error: TypeError: Failed to fetch/,
  /^Error fetching \w+: Error: Failed to fetch/,
];

/**
 * Start recording uncaught exceptions and console errors. Call before the
 * first `page.goto` so nothing logged during hydration is missed.
 * `allowedConsoleErrors` adds route-specific noise to the known noise.
 */
export const watchPageProblems = (
  page: Page,
  allowedConsoleErrors: RegExp[] = [],
): PageProblems => {
  const allowed = [...KNOWN_CONSOLE_NOISE, ...allowedConsoleErrors];
  const problems: PageProblems = { consoleErrors: [], pageErrors: [] };

  page.on("pageerror", (error) => {
    problems.pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (allowed.some((pattern) => pattern.test(text))) {
      return;
    }
    // "Failed to load resource" alone does not say which request failed.
    const { url } = message.location();
    problems.consoleErrors.push(url ? `${text} (${url})` : text);
  });

  return problems;
};

/**
 * Wait for the client to finish its initial data fetches, so errors those
 * fetches cause are recorded before the problems are judged. SWR revalidation
 * can keep the network busy, so a busy network is not a failure here.
 */
const settle = async (page: Page): Promise<void> => {
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => undefined);
};

const expectNoErrorPages = async (page: Page): Promise<void> => {
  await expect(page.getByText(ERROR_BOUNDARY_TEXT)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: ACCESS_ERROR_HEADING }),
  ).toHaveCount(0);
};

const expectNoBrowserErrors = (problems: PageProblems): void => {
  expect(problems.pageErrors, "uncaught page errors").toEqual([]);
  expect(problems.consoleErrors, "console errors").toEqual([]);
};

/**
 * The page rendered its own content: `landmark` is visible, no error, access
 * or not-found page is shown, and nothing went wrong in the browser.
 */
export const expectHealthyPage = async (
  page: Page,
  landmark: Locator,
  problems: PageProblems,
): Promise<void> => {
  await expect(landmark).toBeVisible({ timeout: 15_000 });
  await settle(page);

  await expectNoErrorPages(page);
  await expect(
    page.getByRole("heading", { name: NOT_FOUND_HEADING }),
  ).toHaveCount(0);
  expectNoBrowserErrors(problems);
};

/**
 * The route answered with the app's not-found page (a disabled feature
 * package) rather than crashing or rendering half a page.
 */
export const expectNotFoundPage = async (
  page: Page,
  problems: PageProblems,
): Promise<void> => {
  await expect(
    page.getByRole("heading", { name: NOT_FOUND_HEADING }),
  ).toBeVisible({ timeout: 15_000 });
  await settle(page);

  await expectNoErrorPages(page);
  expectNoBrowserErrors(problems);
};

/** The page's level-1 heading, matched as a case-insensitive substring. */
export const mainHeading = (page: Page, name: string | RegExp): Locator => {
  return page.getByRole("heading", { level: 1, name }).first();
};

const isEnvTrue = (value: string | undefined): boolean => {
  return value?.toLowerCase() === "true";
};

export type FeaturePackage = "BILLING" | "PROJECT_CONTEXT" | "SIGNING";

/**
 * Mirrors `@wildfires-org/turboplan-feature-flags`: a package is on when either
 * its client or server variable is "true". The e2e `.env` is exported to all
 * three servers, so the test process sees the same values.
 */
export const isPackageEnabled = (name: FeaturePackage): boolean => {
  return (
    isEnvTrue(process.env[`NEXT_PUBLIC_IS_${name}_PACKAGE_ENABLED`]) ||
    isEnvTrue(process.env[`IS_${name}_PACKAGE_ENABLED`])
  );
};
