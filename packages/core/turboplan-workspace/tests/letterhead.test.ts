import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyLetterhead,
  buildLetterheadMarkdown,
  contentHasLetterheadTable,
  type DocumentLetterhead,
  isLetterheadConfigured,
  LETTERHEAD_LOGO_PLACEMENT,
  normalizeLetterheadColor,
  parseLetterheadLines,
  planLetterheadBranding,
} from "../src/letterhead";

describe("parseLetterheadLines", () => {
  it("splits on newlines, trims and drops empty lines", () => {
    assert.deepEqual(
      parseLetterheadLines("  Forest Service \n\n\r\nDistrict "),
      ["Forest Service", "District"],
    );
  });

  it("returns an empty list for null, undefined and blank text", () => {
    assert.deepEqual(parseLetterheadLines(null), []);
    assert.deepEqual(parseLetterheadLines(undefined), []);
    assert.deepEqual(parseLetterheadLines("  \n "), []);
  });
});

describe("buildLetterheadMarkdown", () => {
  it("lays out columns with one bold column per name and a contact column", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "columns",
        nameLines: ["USDA", "Forest Service"],
        contactLines: ["123 Main St", "Descanso, CA"],
      }),
      [
        "| **USDA** | **Forest Service** | 123 Main St |",
        "| :--- | :--- | ---: |",
        "|  |  | Descanso, CA |",
      ].join("\n"),
    );
  });

  it("omits the contact column in columns layout without contact lines", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "columns",
        nameLines: ["USDA", "Forest Service"],
        contactLines: [],
      }),
      ["| **USDA** | **Forest Service** |", "| :--- | :--- |"].join("\n"),
    );
  });

  it("lays out split as name/contact pairs padded to the longer side", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "split",
        nameLines: ["Trail Crew Office"],
        contactLines: ["Suite 4", "Bend, OR", "TEL 541"],
      }),
      [
        "| **Trail Crew Office** | Suite 4 |",
        "| :--- | ---: |",
        "|  | Bend, OR |",
        "|  | TEL 541 |",
      ].join("\n"),
    );
  });

  it("uses a single left column for split without contact lines", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "split",
        nameLines: ["A", "B"],
        contactLines: [],
      }),
      ["| **A** |", "| :--- |", "| **B** |"].join("\n"),
    );
  });

  it("centers name rows and joins contact lines with a middle dot", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "centered",
        nameLines: ["Mountain Planning Group"],
        contactLines: ["Bend, OR", "TEL 541"],
      }),
      [
        "| **Mountain Planning Group** |",
        "| :---: |",
        "| Bend, OR · TEL 541 |",
      ].join("\n"),
    );
  });

  it("escapes pipes in cell text", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "split",
        nameLines: ["A | B"],
        contactLines: ["x|y"],
      }),
      ["| **A \\| B** | x\\|y |", "| :--- | ---: |"].join("\n"),
    );
  });

  it("returns an empty string when there is nothing to render", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "split",
        nameLines: [],
        contactLines: [],
      }),
      "",
    );
  });
});

describe("contentHasLetterheadTable", () => {
  it("detects a leading table after blank lines", () => {
    assert.equal(contentHasLetterheadTable("\n\n  | **A** |\n| --- |"), true);
  });

  it("is false when the document opens with text", () => {
    assert.equal(contentHasLetterheadTable("# Title\n\n| a |"), false);
    assert.equal(contentHasLetterheadTable(""), false);
  });
});

describe("applyLetterhead", () => {
  const letterhead = "| **A** |\n| :--- |";

  it("prepends the letterhead to content without a leading table", () => {
    assert.equal(
      applyLetterhead("Dear reader", letterhead),
      `${letterhead}\n\nDear reader`,
    );
  });

  it("keeps a document that already opens with a letterhead table", () => {
    const content = "| **Legacy** |\n| --- |\n\nBody";
    assert.equal(applyLetterhead(content, letterhead), content);
  });

  it("leaves content untouched without a letterhead", () => {
    assert.equal(applyLetterhead("Body", null), "Body");
  });
});

describe("banner letterhead", () => {
  it("builds no markdown table", () => {
    assert.equal(
      buildLetterheadMarkdown({
        layout: "banner",
        nameLines: ["Agency"],
        contactLines: ["123 Main St"],
      }),
      "",
    );
  });

  it("places the logo as the banner", () => {
    assert.equal(LETTERHEAD_LOGO_PLACEMENT.banner, "banner");
  });
});

describe("isLetterheadConfigured", () => {
  it("needs name lines for table layouts", () => {
    assert.equal(isLetterheadConfigured("split", ["Agency"], null), true);
    assert.equal(
      isLetterheadConfigured("split", [], "https://x.test/a.png"),
      false,
    );
    assert.equal(isLetterheadConfigured(null, [], null), false);
  });

  it("needs a logo for a banner", () => {
    assert.equal(
      isLetterheadConfigured("banner", [], "https://x.test/a.png"),
      true,
    );
    assert.equal(isLetterheadConfigured("banner", ["Agency"], null), false);
  });
});

describe("normalizeLetterheadColor", () => {
  it("keeps a hex color, lowercased and trimmed", () => {
    assert.equal(normalizeLetterheadColor(" #1F5F3A "), "#1f5f3a");
  });

  it("maps empty and malformed values to null", () => {
    for (const value of [null, undefined, "", "#fff", "green", "#1f5f3a00"]) {
      assert.equal(normalizeLetterheadColor(value), null);
    }
  });
});

describe("planLetterheadBranding", () => {
  const body = "# Letter\n\nDear Applicant,";
  const tableBody = "| **Own** |\n| :--- |\n\nDear Applicant,";
  const split: DocumentLetterhead = {
    layout: "split",
    nameLines: ["Agency"],
    contactLines: [],
    color: "#1f5f3a",
  };
  const banner: DocumentLetterhead = {
    layout: "banner",
    nameLines: [],
    contactLines: [],
    color: "#1f5f3a",
  };

  it("leaves content and the legacy logo alone without a letterhead", () => {
    assert.deepEqual(planLetterheadBranding(body, null, true), {
      content: body,
      logoPlacement: undefined,
      color: null,
      keepLogo: true,
    });
  });

  it("prepends a table letterhead with its placement and color", () => {
    const plan = planLetterheadBranding(body, split, true);
    assert.equal(plan.content, `| **Agency** |\n| :--- |\n\n${body}`);
    assert.equal(plan.logoPlacement, "inline");
    assert.equal(plan.color, "#1f5f3a");
    assert.equal(plan.keepLogo, true);
  });

  it("does not stack a table letterhead on the content's own", () => {
    assert.deepEqual(planLetterheadBranding(tableBody, split, true), {
      content: tableBody,
      logoPlacement: undefined,
      color: null,
      keepLogo: true,
    });
  });

  it("renders a banner without touching the content", () => {
    assert.deepEqual(planLetterheadBranding(body, banner, true), {
      content: body,
      logoPlacement: "banner",
      color: "#1f5f3a",
      keepLogo: true,
    });
  });

  it("treats a banner without logo bytes as no letterhead", () => {
    assert.deepEqual(planLetterheadBranding(body, banner, false), {
      content: body,
      logoPlacement: undefined,
      color: null,
      keepLogo: false,
    });
  });

  it("skips a banner when the content has its own letterhead table", () => {
    assert.deepEqual(planLetterheadBranding(tableBody, banner, true), {
      content: tableBody,
      logoPlacement: undefined,
      color: null,
      keepLogo: false,
    });
  });
});
