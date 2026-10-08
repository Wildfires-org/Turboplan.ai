import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object for a text document opened in the artifact panel of a project
 * chat: the letterhead band above the document, the "Document letterhead"
 * picker and the "Fill placeholders" button + sheet.
 */
export class TurboplanDocumentArtifact {
  readonly panel: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.getByTestId("artifact");
  }

  /**
   * Open a document from its preview card in the chat. The card is covered by
   * an aria-hidden click layer, so click through the title with `force` — the
   * real mouse click lands on that layer.
   */
  async openFromChatPreview(title: string): Promise<void> {
    await this.page
      .getByTestId("message-assistant")
      .getByText(title, { exact: true })
      .click({ force: true, timeout: 15000 });
    await expect(this.panel).toBeVisible();
  }

  /** The structured letterhead rendered above the document. */
  get letterheadBand(): Locator {
    return this.panel.getByTestId("letterhead-band");
  }

  // ── Letterhead picker ─────────────────────────────────────────────

  get letterheadButton(): Locator {
    return this.panel.getByRole("button", { name: "Document letterhead" });
  }

  /** An option of the open letterhead menu ("Default — …", library names, "None"). */
  letterheadOption(name: string | RegExp): Locator {
    return this.page.getByRole("menuitemradio", { name });
  }

  /** Choose a letterhead and wait for the selection to be saved. */
  async chooseLetterhead(name: string | RegExp): Promise<void> {
    await this.letterheadButton.click();
    const saved = this.page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/documents\/[^/]+\/letterhead$/.test(
          new URL(response.url()).pathname,
        ),
    );
    await this.letterheadOption(name).click();
    expect((await saved).status()).toBe(200);
  }

  /**
   * Assert which letterhead the menu shows as chosen, then close the menu by
   * re-picking that option (a no-op: the picker ignores the current value).
   * Escape is avoided because it also closes the artifact panel.
   */
  async expectSelectedLetterhead(name: string | RegExp): Promise<void> {
    await this.letterheadButton.click();
    const option = this.letterheadOption(name);
    await expect(option).toHaveAttribute("aria-checked", "true");
    await option.click();
    await expect(option).toBeHidden();
  }

  // ── Placeholders ──────────────────────────────────────────────────

  /** Header button; its badge text is the number of open placeholders. */
  get fillPlaceholdersButton(): Locator {
    return this.panel.getByRole("button", { name: "Fill placeholders" });
  }

  get placeholdersSheet(): Locator {
    return this.page.getByRole("dialog", { name: "Fill in placeholders" });
  }

  /** One placeholder row of the sheet, by its (capitalized) label. */
  placeholderItem(label: string): Locator {
    return this.placeholdersSheet
      .getByRole("listitem")
      .filter({ has: this.page.getByText(label, { exact: true }) });
  }
}
