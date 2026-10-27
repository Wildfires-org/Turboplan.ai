import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gridTextWidth } from "../src/letterhead-grid-text";

const near = (actual: number, expected: number, what: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${what}: ${actual} ≠ ${expected}`,
  );

describe("gridTextWidth", () => {
  it("sums Times advance widths, in ems, by weight", () => {
    // Adobe's Times-Bold and Times-Roman AFM (and Times New Roman's).
    near(
      gridTextWidth("WESTERN TRAILS CONSERVANCY", true),
      17.001,
      "bold capitals",
    );
    near(
      gridTextWidth("(406) 555-0142 | info@westerntrails.example", false),
      18.229,
      "a regular address line",
    );
    near(gridTextWidth("Agency", true), 3.166, "bold");
    near(gridTextWidth("Agency", false), 3.11, "regular");
    near(gridTextWidth("", true), 0, "nothing");
  });

  it("measures an accented letter as its base letter, composed or not", () => {
    const plain = gridTextWidth("Departement", false);
    near(gridTextWidth("D\u00e9partement", false), plain, "composed");
    near(gridTextWidth("De\u0301partement", false), plain, "decomposed");
    near(
      gridTextWidth("Se\u00f1ora", true),
      gridTextWidth("Senora", true),
      "bold",
    );
  });

  it("knows the typographic punctuation a letterhead prints", () => {
    near(gridTextWidth("\u2013", false), 0.5, "en dash");
    near(gridTextWidth("\u2014", true), 1, "em dash");
    near(gridTextWidth("\u2019", false), 0.333, "apostrophe");
    near(gridTextWidth("\u2022", true), 0.35, "bullet");
  });

  it("counts any other character as a full em, never narrower than drawn", () => {
    near(gridTextWidth("\u6f22", false), 1, "a CJK character");
    near(gridTextWidth("\u{1F332}", true), 1, "an emoji, one code point");
  });
});
