import type { Locator } from "@playwright/test";

/** Layout cards of the letterhead editor. */
export type LetterheadLayoutLabel =
  | "Agency columns"
  | "Logo left"
  | "Centered"
  | "Banner image";

/** Brand color swatches of the letterhead editor. */
export type LetterheadColorLabel =
  | "Default"
  | "Forest green"
  | "Pine"
  | "Navy"
  | "Rust"
  | "Purple";

/**
 * Page Object for the structured letterhead editor (LetterheadEditor): layout
 * cards, organization/contact lines, brand color swatches and live preview.
 *
 * It is mounted in several places (Edit Office, the organization Branding tab,
 * the library letterhead dialog), so it is always scoped to a root locator —
 * the dialog it lives in.
 */
export class LetterheadEditorSection {
  constructor(private readonly root: Locator) {}

  /** The (visually hidden) radio behind a layout card. */
  layoutOption(label: LetterheadLayoutLabel): Locator {
    return this.root.getByRole("radio", { name: label, exact: true });
  }

  /** Pick a layout by clicking its card (the radio itself is sr-only). */
  async selectLayout(label: LetterheadLayoutLabel): Promise<void> {
    await this.root.getByText(label, { exact: true }).click();
  }

  /** The (visually hidden) radio behind a color swatch. */
  colorOption(label: LetterheadColorLabel): Locator {
    return this.root.getByRole("radio", { name: label, exact: true });
  }

  /** Pick a brand color by clicking its swatch (titled with the color name). */
  async selectColor(label: LetterheadColorLabel): Promise<void> {
    await this.root.getByTitle(label, { exact: true }).click();
  }

  get linesInput(): Locator {
    return this.root.getByLabel("Organization lines", { exact: true });
  }

  get contactInput(): Locator {
    return this.root.getByLabel("Address & contact", { exact: true });
  }

  /** The live preview sheet under the editor. */
  get preview(): Locator {
    return this.root.getByTestId("letterhead-preview");
  }
}
