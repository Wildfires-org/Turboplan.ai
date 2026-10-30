import React from "react";

import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  GRID_BASE_FONT_RATIO,
  gridBaseFontRatio,
  type PublicDocumentLetterhead,
  type PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import type * as BandModule from "../components/letterhead-band";

// The preview's grid letterhead, rendered to markup. The logo proxy hook is
// stubbed: each logo index gets the state set in `logoStates`, and every call
// is recorded so the tests can tell whether the proxy was asked.

type LogoState = { src: string | null; isLoading: boolean };

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const DOCUMENT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const LOGO_0 = "data:image/png;base64,bG9nby0w";
const LOGO_1 = "data:image/png;base64,bG9nby0x";
const MARGIN_LOGO = "data:image/png;base64,bWFyZ2lu";

const logoStates = new Map<number, LogoState>();
const proxyCalls: { projectId: string | null | undefined; index: number }[] =
  [];

const useLetterheadLogoState = (
  projectId?: string | null,
  _documentId?: string | null,
  index = 0,
): LogoState => {
  proxyCalls.push({ projectId, index });
  return projectId
    ? (logoStates.get(index) ?? { src: null, isLoading: false })
    : { src: null, isLoading: false };
};

mock.module("../hooks/use-letterhead-logo", {
  namedExports: {
    useLetterheadLogoState,
    useLetterheadLogo: (
      projectId?: string | null,
      documentId?: string | null,
      index = 0,
    ) => useLetterheadLogoState(projectId, documentId, index).src,
  },
});

let LetterheadBand: typeof BandModule.LetterheadBand;

before(async () => {
  // tsx compiles JSX with the classic runtime (`React.createElement`), and
  // the component relies on Next's automatic one: give it a global React.
  Object.assign(globalThis, { React });
  ({ LetterheadBand } = await import("../components/letterhead-band"));
});

beforeEach(() => {
  logoStates.clear();
  proxyCalls.length = 0;
});

const line = (text: string, bold: boolean) => ({
  text,
  bold,
  size: "normal" as const,
});

// Two logos around the agency's text, right-aligned address last.
const AGENCY: PublicGridLetterhead = {
  color: "#1f5f3a",
  cells: [
    { kind: "logo", x: 0, width: 0.09, height: 0.09, index: 0 },
    {
      kind: "text",
      x: 0.1,
      width: 0.3,
      align: "left",
      lines: [
        line("Forest Service", true),
        line("Tahoe National Forest", true),
      ],
    },
    {
      kind: "text",
      x: 0.6,
      width: 0.28,
      align: "right",
      lines: [line("631 Coyote Street", false)],
    },
    { kind: "logo", x: 0.9, width: 0.1, height: 0.05, index: 1 },
  ],
};

const TEXT_ONLY: PublicGridLetterhead = {
  color: null,
  cells: AGENCY.cells.filter((cell) => cell.kind === "text"),
};

// A grid whose only logo cell is a sliver (same `x` as the next cell): the
// layout drops it, but the grid still HAS a logo cell, so no margin logo.
const SLIVER_LOGO: PublicGridLetterhead = {
  color: null,
  cells: [
    { kind: "logo", x: 0.1, width: 0.1, height: 0.1, index: 0 },
    ...TEXT_ONLY.cells,
  ],
};

const asLetterhead = (
  grid: PublicGridLetterhead,
): PublicDocumentLetterhead => ({
  layout: "grid",
  grid,
  nameLines: [],
  contactLines: [],
  color: grid.color,
});

const render = (
  grid: PublicGridLetterhead,
  props: Partial<BandModule.LetterheadBandProps> = {},
) =>
  renderToStaticMarkup(
    <LetterheadBand
      letterhead={asLetterhead(grid)}
      projectId={PROJECT_ID}
      documentId={DOCUMENT_ID}
      {...props}
    />,
  );

// The element (opening tag) that renders the given text.
const elementWithText = (html: string, text: string): string => {
  const match = new RegExp(`<p[^>]*>${text}</p>`).exec(html);
  assert.ok(match, `no line "${text}"`);
  return match[0];
};

const imagesOf = (html: string) => html.match(/<img [^>]*>/g) ?? [];

describe("LetterheadBand with a grid letterhead", () => {
  it("sets the grid in Times, sized from the band's width once it is wide, 13px when narrow", () => {
    const html = render(AGENCY);
    const band = html.match(/<div data-testid="letterhead-band"[^>]*>/)?.[0];
    assert.ok(band);
    // The band is a size container with the 13px phone size…
    assert.match(band, /\[container-type:inline-size\]/);
    assert.match(band, /text-\[13px\]/);
    // …and the grid sets its own size once the band is wide: the shared
    // fraction of the band's width (the default, without a `fontSize`), so
    // lines wrap as in the PDF and DOCX.
    assert.equal(AGENCY.fontSize, undefined);
    const expected = `${(GRID_BASE_FONT_RATIO * 100).toFixed(4)}cqw`;
    assert.ok(html.includes(`--grid-font-size:${expected}`));
    assert.match(html, /band-wide:text-\[length:var\(--grid-font-size\)\]/);
    // (React escapes the quotes of the font stack.)
    assert.match(html, /font-\[&#x27;Times_New_Roman&#x27;,Times,serif\]/);
    assert.match(html, /leading-\[1\.15\]/);
  });

  it("sizes the text from the reference's own size when the grid has one", () => {
    const html = render({ ...AGENCY, fontSize: 0.02 });
    const expected = `${(gridBaseFontRatio({ fontSize: 0.02 }) * 100).toFixed(4)}cqw`;
    // 2% of the reference's page width is 2.4% of the content width the
    // exports (and so the band) measure against.
    assert.equal(expected, "2.4038cqw");
    assert.ok(html.includes(`--grid-font-size:${expected}`));
    assert.ok(
      !html.includes(
        `--grid-font-size:${(GRID_BASE_FONT_RATIO * 100).toFixed(4)}cqw`,
      ),
    );
  });

  it("draws regular lines in the band's ink and bold lines in the brand colour", () => {
    const html = render(AGENCY);
    assert.doesNotMatch(html, /text-muted-foreground/);
    const address = elementWithText(html, "631 Coyote Street");
    assert.doesNotMatch(address, /class=/);
    assert.doesNotMatch(address, /color:/);
    const identity = elementWithText(html, "Forest Service");
    assert.match(identity, /class="font-bold"/);
    assert.match(identity, /color:#1f5f3a/);
    // The band's ink: the theme's in light mode, dark ink on white paper in
    // dark mode (with the rule darkened to match).
    const band = html.match(/<div data-testid="letterhead-band"[^>]*>/)?.[0];
    assert.ok(band);
    for (const token of [
      "text-foreground",
      "dark:bg-white",
      "dark:text-neutral-900",
      "dark:border-neutral-900/60",
    ]) {
      assert.ok(band.includes(token), token);
    }
    assert.match(band, /border-bottom-color:#1f5f3a/);
  });

  it("stacks the cells in a narrow band and places them in one grid row in a wide one", () => {
    logoStates.set(0, { src: LOGO_0, isLoading: false });
    logoStates.set(1, { src: LOGO_1, isLoading: false });
    const html = render(AGENCY);
    assert.match(
      html,
      /class="flex flex-col gap-2 [^"]*band-wide:grid band-wide:items-start band-wide:gap-0[^"]*"/,
    );
    // The logos share a row of their own when narrow, then join the grid.
    assert.match(
      html,
      /class="flex items-start gap-3 empty:hidden band-wide:contents"/,
    );
    // Text cells: left-aligned when narrow, their own alignment when wide.
    assert.match(
      html,
      /class="min-w-0 break-words text-left band-wide:row-start-1 band-wide:text-right"/,
    );
    for (const image of imagesOf(html)) {
      assert.match(image, /h-10 w-auto/);
      assert.match(
        image,
        /band-wide:row-start-1 band-wide:h-auto band-wide:w-\[var\(--grid-logo-width\)\]/,
      );
    }
  });

  it("places each cell in the row's height by its valign, once the band is wide", () => {
    // The NFF letterhead: one wide logo (its wordmark included) and the
    // address centred beside it; a seal at the bottom, a note at the top.
    const grid: PublicGridLetterhead = {
      color: null,
      cells: [
        {
          kind: "logo",
          x: 0,
          width: 0.4,
          height: 0.1,
          valign: "middle",
          index: 0,
        },
        {
          kind: "text",
          x: 0.45,
          width: 0.2,
          align: "left",
          lines: [line("A note", false)],
        },
        {
          kind: "text",
          x: 0.65,
          width: 0.2,
          align: "right",
          valign: "middle",
          lines: [line("Washington, DC", false)],
        },
        {
          kind: "text",
          x: 0.85,
          width: 0.05,
          align: "left",
          valign: "bottom",
          lines: [line("Est. 1990", false)],
        },
        {
          kind: "logo",
          x: 0.9,
          width: 0.1,
          height: 0.1,
          valign: "bottom",
          index: 1,
        },
      ],
    };
    // The class of the text cell drawing `text`.
    const textCellClass = (html: string, text: string) => {
      const match = new RegExp(
        `<div class="([^"]*)"[^>]*><p[^>]*>${text}</p>`,
      ).exec(html);
      assert.ok(match, `no cell for "${text}"`);
      return match[1];
    };

    const html = render(grid, { logoSrcs: [LOGO_0, LOGO_1] });
    assert.doesNotMatch(textCellClass(html, "A note"), /self-/);
    assert.match(
      textCellClass(html, "Washington, DC"),
      / band-wide:self-center( |$)/,
    );
    assert.match(textCellClass(html, "Est. 1990"), / band-wide:self-end( |$)/);
    const [middleLogo, bottomLogo] = imagesOf(html);
    assert.ok(middleLogo && bottomLogo);
    assert.match(middleLogo, / band-wide:self-center /);
    assert.match(bottomLogo, / band-wide:self-end /);
    // A narrow band stacks the cells: nothing moves there.
    assert.doesNotMatch(html, /[" ]self-(center|end)/);

    // A loading logo's box sits where the logo will.
    const loading = render(grid, {
      logoSrcs: [null, LOGO_1],
      logoLoading: [true, false],
    });
    assert.match(
      loading.match(
        /<div aria-hidden="true" data-testid="letterhead-logo-placeholder"[^>]*>/,
      )?.[0] ?? "",
      / band-wide:self-center /,
    );

    // Without a valign, every cell keeps to the top.
    logoStates.set(0, { src: LOGO_0, isLoading: false });
    logoStates.set(1, { src: LOGO_1, isLoading: false });
    assert.doesNotMatch(render(AGENCY), /self-(center|end)/);
  });

  it("sizes each line by its size, up to Huge", () => {
    const html = render({
      color: null,
      cells: [
        {
          kind: "text",
          x: 0,
          width: 1,
          align: "left",
          lines: [
            { text: "Huge", bold: true, size: "xxlarge" },
            { text: "Extra large", bold: false, size: "xlarge" },
            { text: "Small", bold: false, size: "small" },
          ],
        },
      ],
    });
    assert.match(elementWithText(html, "Huge"), /font-size:2\.6em/);
    assert.match(elementWithText(html, "Extra large"), /font-size:1\.8em/);
    assert.match(elementWithText(html, "Small"), /font-size:0\.85em/);
  });

  it("switches by the band's own width, never the viewport's", () => {
    logoStates.set(0, { src: LOGO_0, isLoading: true });
    const html = render(AGENCY);
    // `band-wide:` is a container query on the band (tailwind.config.ts);
    // no viewport breakpoint is left in the grid's markup.
    assert.doesNotMatch(html, /\b(sm|md|lg):/);
  });

  it("draws the grid's logos through the proxy, by index, with an empty alt", () => {
    logoStates.set(0, { src: LOGO_0, isLoading: false });
    logoStates.set(1, { src: LOGO_1, isLoading: false });
    const images = imagesOf(render(AGENCY, { logoSrc: MARGIN_LOGO }));
    assert.strictEqual(images.length, 2);
    assert.ok(images[0].includes(`src="${LOGO_0}"`));
    assert.ok(images[1].includes(`src="${LOGO_1}"`));
    for (const image of images) {
      assert.match(image, /alt=""/);
    }
    assert.deepStrictEqual(
      proxyCalls.map(({ projectId, index }) => [projectId, index]),
      [
        [PROJECT_ID, 0],
        [PROJECT_ID, 1],
      ],
    );
  });

  it("keeps a loading logo's box and collapses a missing one", () => {
    logoStates.set(0, { src: null, isLoading: true });
    logoStates.set(1, { src: null, isLoading: false });
    const html = render(AGENCY);
    assert.strictEqual(imagesOf(html).length, 0);
    const placeholders =
      html.match(
        /<div aria-hidden="true" data-testid="letterhead-logo-placeholder"[^>]*>/g,
      ) ?? [];
    // Only the loading one (index 0, the left logo) keeps its box, with the
    // logo's aspect and width.
    assert.strictEqual(placeholders.length, 1);
    assert.match(placeholders[0], /aspect-ratio:1/);
    assert.match(placeholders[0], /--grid-logo-width:100%/);
    assert.match(placeholders[0], /h-10 w-auto/);
  });

  it("keeps the box of a given logo that is still loading", () => {
    const html = render(AGENCY, {
      logoSrcs: [null, LOGO_1],
      logoLoading: [true, false],
    });
    const placeholders =
      html.match(
        /<div aria-hidden="true" data-testid="letterhead-logo-placeholder"[^>]*>/g,
      ) ?? [];
    assert.strictEqual(placeholders.length, 1);
    assert.match(placeholders[0], /aspect-ratio:1/);
    assert.strictEqual(imagesOf(html).length, 1);
    assert.ok(proxyCalls.every(({ projectId }) => projectId == null));

    // Without `logoLoading`, a null entry is a missing logo.
    assert.doesNotMatch(
      render(AGENCY, { logoSrcs: [null, LOGO_1] }),
      /letterhead-logo-placeholder/,
    );
  });

  it("uses `logoSrcs` instead of the proxy when given", () => {
    logoStates.set(0, { src: LOGO_0, isLoading: true });
    const html = render(AGENCY, { logoSrcs: [LOGO_1, null] });
    const images = imagesOf(html);
    assert.strictEqual(images.length, 1);
    assert.ok(images[0].includes(`src="${LOGO_1}"`));
    // No placeholder: a missing entry is missing, not loading.
    assert.doesNotMatch(html, /letterhead-logo-placeholder/);
    // The proxy is never asked for a logo (the hook runs keyless).
    assert.ok(proxyCalls.length > 0);
    assert.ok(proxyCalls.every(({ projectId }) => projectId == null));
  });

  it("hangs the margin logo only for a grid without logo cells", () => {
    const textOnly = imagesOf(render(TEXT_ONLY, { logoSrc: MARGIN_LOGO }));
    assert.strictEqual(textOnly.length, 1);
    assert.ok(textOnly[0].includes(`src="${MARGIN_LOGO}"`));
    assert.match(textOnly[0], /md:absolute md:top-0 md:right-full/);

    // A logo cell the layout drops still counts: no margin logo either.
    logoStates.set(0, { src: LOGO_0, isLoading: false });
    assert.strictEqual(
      imagesOf(render(SLIVER_LOGO, { logoSrc: MARGIN_LOGO })).length,
      0,
    );
    assert.strictEqual(
      imagesOf(render(AGENCY, { logoSrc: MARGIN_LOGO, logoSrcs: [] })).length,
      0,
    );
  });

  it("leaves the other layouts' band as it was", () => {
    const html = renderToStaticMarkup(
      <LetterheadBand
        letterhead={{
          layout: "columns",
          nameLines: ["Example Inc."],
          contactLines: ["Clovis, CA 93612"],
          color: null,
        }}
      />,
    );
    assert.doesNotMatch(html, /container-type|dark:bg-white/);
    assert.match(html, /text-muted-foreground/);
  });
});
