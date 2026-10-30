import { expect, type Locator, type Page } from "@playwright/test";

const LANDING_URL = process.env.LANDING_PAGE_URL || "http://localhost:3002";

/**
 * Page Object for the global search (OmniSearch from `turboplan-search`) on
 * the landing page's public catalog (`/projects`). The web app itself has no
 * global search; this is the only place the package is mounted.
 */
export class OfficeFeaturesCatalogSearch {
  constructor(private readonly page: Page) {}

  /** Open the catalog, optionally with a search query in the URL (`?q=`) */
  async goto(query?: string): Promise<void> {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    await this.page.goto(`${LANDING_URL}/projects${suffix}`);
    await expect(this.getSearchInput()).toBeVisible({ timeout: 15000 });
  }

  /**
   * The catalog's search input. Scoped to <main>: on catalog routes the
   * navbar can mount a second OmniSearch with the same label.
   */
  getSearchInput(): Locator {
    return this.page
      .getByRole("main")
      .getByLabel("Search organizations, offices, and projects");
  }

  /** Type a query; results open once it has at least 2 characters */
  async search(query: string): Promise<void> {
    await this.getSearchInput().click();
    await this.getSearchInput().fill(query);
  }

  /** The results dropdown */
  getResults(): Locator {
    return this.page.getByRole("listbox");
  }

  /** A result row (a link) by the entity's public URL */
  getResultByHref(href: string): Locator {
    return this.getResults().locator(`a[href="${href}"]`);
  }
}
