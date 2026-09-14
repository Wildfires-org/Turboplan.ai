import type { Page } from "@playwright/test";

/**
 * Mock the /generate-titles endpoint to return a deterministic project name.
 * The project name field was removed from the UI — titles are now AI-generated.
 * Call this before submitting the create project form, and call the returned
 * cleanup function after navigation completes.
 */
export const mockGenerateTitles = async (
  page: Page,
  projectName: string,
): Promise<() => Promise<void>> => {
  await page.route("**/generate-titles", (route) => {
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ projectTitle: projectName }),
    });
  });

  return () => page.unroute("**/generate-titles");
};
