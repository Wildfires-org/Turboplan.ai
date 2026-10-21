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
  toPublicDocumentLetterhead,
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
      grid: null,
    });
  });

  it("prepends a table letterhead with its placement and color", () => {
    const plan = planLetterheadBranding(body, split, true);
    assert.equal(plan.content, `| **Agency** |\n| :--- |\n\n${body}`);
    assert.equal(plan.logoPlacement, "inline");
    assert.equal(plan.color, "#1f5f3a");
    assert.equal(plan.keepLogo, true);
    assert.equal(plan.grid, null);
  });

  it("does not stack a table letterhead on the content's own", () => {
    assert.deepEqual(planLetterheadBranding(tableBody, split, true), {
      content: tableBody,
      logoPlacement: undefined,
      color: null,
      keepLogo: true,
      grid: null,
    });
  });

  it("renders a banner without touching the content", () => {
    assert.deepEqual(planLetterheadBranding(body, banner, true), {
      content: body,
      logoPlacement: "banner",
      color: "#1f5f3a",
      keepLogo: true,
      grid: null,
    });
  });

  it("treats a banner without logo bytes as no letterhead", () => {
    assert.deepEqual(planLetterheadBranding(body, banner, false), {
      content: body,
      logoPlacement: undefined,
      color: null,
      keepLogo: false,
      grid: null,
    });
  });

  it("skips a banner when the content has its own letterhead table", () => {
    assert.deepEqual(planLetterheadBranding(tableBody, banner, true), {
      content: tableBody,
      logoPlacement: undefined,
      color: null,
      keepLogo: false,
      grid: null,
    });
  });
});

// Every renderer draws a grid from its structure: the exporters get the
// public grid (logo cells by index, no keys) and the content untouched.
describe("grid letterhead", () => {
  const body = "# Letter\n\nDear Applicant,";
  const tableBody = "| **Own** |\n| :--- |\n\nDear Applicant,";
  const grid: DocumentLetterhead = {
    layout: "grid",
    grid: {
      cells: [
        {
          kind: "logo",
          x: 0,
          width: 0.1,
          height: 0.1,
          key: "letterheads/project/doc/logo-0-abc.png",
        },
        {
          kind: "text",
          x: 0.12,
          width: 0.5,
          align: "left",
          lines: [
            { text: "Bureau of Land Management", bold: true, size: "large" },
            { text: "Field Office", bold: true, size: "normal" },
          ],
        },
        {
          kind: "text",
          x: 0.7,
          width: 0.3,
          align: "right",
          lines: [{ text: "1 Main St", bold: false, size: "small" }],
        },
      ],
      color: "#1f5f3a",
    },
    nameLines: ["Bureau of Land Management", "Field Office"],
    contactLines: ["1 Main St"],
    color: "#1f5f3a",
  };
  const publicGrid = toPublicDocumentLetterhead(grid);
  const withoutLogoCells = toPublicDocumentLetterhead({
    ...grid,
    grid: { ...grid.grid, cells: grid.grid.cells.slice(1) },
  } as DocumentLetterhead);

  it("leaves a legacy letterhead as it is when going public", () => {
    const split: DocumentLetterhead = {
      layout: "split",
      nameLines: ["Agency"],
      contactLines: [],
      color: null,
    };
    assert.equal(toPublicDocumentLetterhead(split), split);
  });

  it("goes public without its logo keys", () => {
    assert.equal(publicGrid.layout, "grid");
    assert.deepEqual(publicGrid.layout === "grid" && publicGrid.grid.cells[0], {
      kind: "logo",
      x: 0,
      width: 0.1,
      height: 0.1,
      index: 0,
    });
    assert.equal(JSON.stringify(publicGrid).includes("letterheads/"), false);
    assert.equal(JSON.stringify(publicGrid).includes('"key"'), false);
  });

  it("is handed to the exporters as the grid, content untouched, logo cells instead of the single logo", () => {
    assert.deepEqual(planLetterheadBranding(body, publicGrid, true), {
      content: body,
      logoPlacement: undefined,
      color: "#1f5f3a",
      keepLogo: false,
      grid: publicGrid.layout === "grid" ? publicGrid.grid : null,
    });
  });

  it("keeps the single logo in the margin when it has no logo cells", () => {
    const plan = planLetterheadBranding(body, withoutLogoCells, true);
    assert.equal(plan.content, body);
    assert.equal(plan.logoPlacement, "margin");
    assert.equal(plan.keepLogo, true);
    assert.equal(plan.grid?.cells.length, 2);
  });

  it("is not stacked on the content's own letterhead table", () => {
    assert.deepEqual(planLetterheadBranding(tableBody, publicGrid, true), {
      content: tableBody,
      logoPlacement: undefined,
      color: null,
      keepLogo: true,
      grid: null,
    });
  });
});
