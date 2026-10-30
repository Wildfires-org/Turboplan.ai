import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

/**
 * Page Object Model for an organization's Context page (`/:org/context`):
 * the standing AI prompt and the assistant's saved notes ("Memory").
 */
export class WorkspaceOrgContextPage {
  constructor(public readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  /** Open the page and wait until the prompt section has loaded. */
  async goto(orgSlug: string): Promise<void> {
    await this.page.goto(`${appPaths.organization(orgSlug)}/context`);
    await expect(
      this.main.getByRole("heading", { name: "Organization prompt" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      this.main.getByRole("status", {
        name: "Loading the organization prompt",
      }),
    ).toHaveCount(0, { timeout: 15000 });
  }

  // ── Prompt ───────────────────────────────────────────────────────

  /** The prompt editor (owners and editors only). */
  get promptInput(): Locator {
    return this.main.getByRole("textbox", { name: "Organization prompt" });
  }

  get savePromptButton(): Locator {
    return this.main.getByRole("button", { name: "Save prompt" });
  }

  get discardChangesButton(): Locator {
    return this.main.getByRole("button", { name: "Discard changes" });
  }

  async savePrompt(): Promise<void> {
    await this.savePromptButton.click();
    await expect(this.page.getByText("Organization prompt saved")).toBeVisible({
      timeout: 15000,
    });
  }

  /** Read-only note shown to members who cannot edit the prompt. */
  get readOnlyPromptNote(): Locator {
    return this.main.getByText(
      "Only organization owners and editors can change it.",
    );
  }

  // ── Memory ───────────────────────────────────────────────────────

  get savedNotes(): Locator {
    return this.main.getByRole("list", { name: "Saved notes" });
  }

  note(content: string): Locator {
    return this.savedNotes
      .getByRole("listitem")
      .filter({ has: this.page.getByText(content, { exact: true }) });
  }

  deleteNoteButton(content: string): Locator {
    return this.note(content).getByRole("button", { name: "Delete note" });
  }
}
