import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectiveSelection,
  libraryLetterheadToDocumentLetterhead,
  normalizeLetterheadChoice,
  selectionFromRow,
} from "../src/letterhead";
import { libraryLetterheadSchema } from "../src/server/organizations/letterhead-validation";

const LETTERHEAD_ID = "6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8e";
const ORG_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const OTHER_ORG_ID = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";

describe("selectionFromRow", () => {
  it("reads no row as the default letterhead", () => {
    assert.equal(selectionFromRow(null), "default");
    assert.equal(selectionFromRow(undefined), "default");
  });

  it("reads a row without a letterhead as none", () => {
    assert.equal(
      selectionFromRow({ letterheadId: null, useOwn: false }),
      "none",
    );
  });

  it("reads a row with a letterhead as its id", () => {
    assert.equal(
      selectionFromRow({ letterheadId: LETTERHEAD_ID, useOwn: false }),
      LETTERHEAD_ID,
    );
  });

  it("reads a row using the document's own copy as own", () => {
    assert.equal(selectionFromRow({ letterheadId: null, useOwn: true }), "own");
  });
});

describe("effectiveSelection", () => {
  it("passes default, none and own through", () => {
    assert.equal(effectiveSelection("default", null, ORG_ID), "default");
    assert.equal(effectiveSelection("none", null, ORG_ID), "none");
    assert.equal(effectiveSelection("own", null, ORG_ID), "own");
    assert.equal(effectiveSelection("own", null, null), "own");
  });

  it("keeps a library letterhead of the project's organization", () => {
    assert.equal(
      effectiveSelection(LETTERHEAD_ID, ORG_ID, ORG_ID),
      LETTERHEAD_ID,
    );
  });

  it("falls back to the default for another organization's letterhead", () => {
    assert.equal(
      effectiveSelection(LETTERHEAD_ID, OTHER_ORG_ID, ORG_ID),
      "default",
    );
  });

  it("falls back to the default for a missing letterhead or organization", () => {
    assert.equal(effectiveSelection(LETTERHEAD_ID, null, ORG_ID), "default");
    assert.equal(effectiveSelection(LETTERHEAD_ID, ORG_ID, null), "default");
  });
});

describe("normalizeLetterheadChoice", () => {
  it("keeps none and a lowercased letterhead id", () => {
    assert.equal(normalizeLetterheadChoice(" None "), "none");
    assert.equal(
      normalizeLetterheadChoice(LETTERHEAD_ID.toUpperCase()),
      LETTERHEAD_ID,
    );
  });

  it("never yields own: the model cannot pick the document's copy", () => {
    for (const choice of ["own", "OWN", " own "]) {
      assert.equal(normalizeLetterheadChoice(choice), "default");
    }
  });

  it("reads missing, blank and unknown choices as the default", () => {
    for (const choice of [undefined, null, "", "  ", "default", "partner"]) {
      assert.equal(normalizeLetterheadChoice(choice), "default");
    }
  });
});

describe("libraryLetterheadToDocumentLetterhead", () => {
  it("parses name and contact lines and keeps the layout", () => {
    assert.deepEqual(
      libraryLetterheadToDocumentLetterhead({
        layout: "centered",
        lines: " Partner Agency \n\nRegion 5",
        contact: "123 Main St\n",
      }),
      {
        layout: "centered",
        nameLines: ["Partner Agency", "Region 5"],
        contactLines: ["123 Main St"],
        color: null,
      },
    );
  });

  it("keeps a valid accent color (lowercased) and drops a malformed one", () => {
    const base = { layout: "split" as const, lines: "Agency", contact: "" };
    assert.equal(
      libraryLetterheadToDocumentLetterhead({ ...base, color: "#1F5F3A" })
        ?.color,
      "#1f5f3a",
    );
    assert.equal(
      libraryLetterheadToDocumentLetterhead({ ...base, color: "green" })?.color,
      null,
    );
  });

  it("accepts a banner with a logo and no lines, dropping any text lines", () => {
    assert.deepEqual(
      libraryLetterheadToDocumentLetterhead({
        layout: "banner",
        lines: "Ignored",
        contact: "Ignored too",
        logoUrl: "https://cdn.example.test/banner.png",
        color: "#1f5f3a",
      }),
      { layout: "banner", nameLines: [], contactLines: [], color: "#1f5f3a" },
    );
  });

  it("returns null for a banner without a logo", () => {
    assert.equal(
      libraryLetterheadToDocumentLetterhead({
        layout: "banner",
        lines: "Agency",
        contact: "",
        logoUrl: null,
      }),
      null,
    );
  });

  it("returns null without name lines", () => {
    assert.equal(
      libraryLetterheadToDocumentLetterhead({
        layout: "split",
        lines: "  \n",
        contact: "123 Main St",
      }),
      null,
    );
  });
});

describe("libraryLetterheadSchema", () => {
  const valid = {
    name: "Partner agency",
    layout: "split",
    lines: "Partner Agency",
    contact: "",
  };

  it("accepts the banner layout and a hex or empty color", () => {
    for (const color of ["#1f5f3a", "#ABCDEF", ""]) {
      assert.equal(
        libraryLetterheadSchema.safeParse({ ...valid, layout: "banner", color })
          .success,
        true,
      );
    }
  });

  it("rejects a malformed color", () => {
    for (const color of ["1f5f3a", "#1f5f3", "#1f5f3az", "red"]) {
      assert.equal(
        libraryLetterheadSchema.safeParse({ ...valid, color }).success,
        false,
      );
    }
  });

  it("accepts a letterhead without a logo and an empty logo", () => {
    assert.equal(libraryLetterheadSchema.safeParse(valid).success, true);
    assert.equal(
      libraryLetterheadSchema.safeParse({ ...valid, logoUrl: "" }).success,
      true,
    );
  });

  it("rejects a blank or over-long name, long lines and unknown layouts", () => {
    for (const body of [
      { ...valid, name: "   " },
      { ...valid, name: "x".repeat(81) },
      { ...valid, lines: "x".repeat(401) },
      { ...valid, contact: "x".repeat(401) },
      { ...valid, layout: "diagonal" },
      { ...valid, logoUrl: "not a url" },
    ]) {
      assert.equal(libraryLetterheadSchema.safeParse(body).success, false);
    }
  });
});
