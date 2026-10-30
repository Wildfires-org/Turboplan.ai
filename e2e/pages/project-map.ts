import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object for a project's full-screen Map page (`/:org/:office/:project/map`).
 * With no layers it shows a blank map and a "Back to project" link; with layers
 * it adds map type and "Visible layers" controls.
 */
export class ProjectMapPage {
  constructor(private readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  async goto(projectPath: string): Promise<void> {
    await this.page.goto(`${projectPath}/map`);
    await expect(
      this.main.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText("Map", { timeout: 15000 });
    // Leaflet has rendered once its attribution control is in.
    await expect(this.main.getByRole("link", { name: "Leaflet" })).toBeVisible({
      timeout: 15000,
    });
  }

  get backToProjectLink(): Locator {
    return this.main.getByRole("link", {
      name: "Back to project",
      exact: true,
    });
  }

  /** Vector features Leaflet drew (points render as circle-marker paths). */
  get renderedFeatures(): Locator {
    return this.main.locator("path.leaflet-interactive");
  }

  /** Open the "Visible layers" popover and return the toggle for `layerName`. */
  async openLayerToggle(layerName: string): Promise<Locator> {
    await this.main.getByRole("button", { name: "Visible layers" }).click();
    const toggle = this.page.getByRole("menuitemcheckbox", { name: layerName });
    await expect(toggle).toBeVisible();
    return toggle;
  }
}
