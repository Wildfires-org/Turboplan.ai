import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendDocumentProfileFact,
  documentProfileSchema,
  documentProfileToFacts,
  mergeDocumentProfiles,
  normalizeDocumentProfile,
} from "../src/document-profile";

describe("mergeDocumentProfiles", () => {
  it("prefers non-empty office values per field and falls back to the org", () => {
    assert.deepEqual(
      mergeDocumentProfiles(
        { signatoryName: "Jane Doe", signatoryTitle: "  ", fileCode: "1950" },
        {
          signatoryName: "Org Signer",
          signatoryTitle: "Forest Supervisor",
          contactEmail: "comments@example.test",
        },
      ),
      {
        signatoryName: "Jane Doe",
        signatoryTitle: "Forest Supervisor",
        contactEmail: "comments@example.test",
        fileCode: "1950",
      },
    );
  });

  it("puts office fact lines first, then org lines, de-duplicated", () => {
    assert.deepEqual(
      mergeDocumentProfiles(
        { facts: "Comments due: 30 days\n\n Region: 5 " },
        { facts: "Region: 5\nAgency: USDA" },
      ),
      { facts: "Comments due: 30 days\nRegion: 5\nAgency: USDA" },
    );
  });

  it("returns an empty profile when both are missing", () => {
    assert.deepEqual(mergeDocumentProfiles(null, undefined), {});
  });
});

describe("documentProfileToFacts", () => {
  it("renders labelled lines in a stable order and skips empty fields", () => {
    assert.deepEqual(
      documentProfileToFacts({
        fileCode: "1950",
        signatoryTitle: "District Ranger",
        signatoryName: "Jane Doe",
        contactName: "John Roe",
        contactEmail: "john@example.test",
        contactPhone: "",
        officeHours: "8:00 a.m. – 4:30 p.m., Monday–Friday",
        facts: "Comments email: comments@example.test\n\nRegion: 5",
      }),
      [
        "Signatory: Jane Doe, District Ranger",
        "Comment/contact person: John Roe",
        "Contact email: john@example.test",
        "Office hours: 8:00 a.m. – 4:30 p.m., Monday–Friday",
        "Default file code: 1950",
        "Comments email: comments@example.test",
        "Region: 5",
      ],
    );
  });

  it("renders a signatory with only a title", () => {
    assert.deepEqual(documentProfileToFacts({ signatoryTitle: "Ranger" }), [
      "Signatory: Ranger",
    ]);
  });

  it("returns no facts for an empty profile", () => {
    assert.deepEqual(documentProfileToFacts({}), []);
  });
});

describe("normalizeDocumentProfile", () => {
  it("drops empty fields and returns null when nothing is left", () => {
    assert.equal(
      normalizeDocumentProfile({ signatoryName: " ", facts: "\n" }),
      null,
    );
    assert.deepEqual(
      normalizeDocumentProfile({ signatoryName: " Jane ", contactEmail: "" }),
      { signatoryName: "Jane" },
    );
  });
});

describe("appendDocumentProfileFact", () => {
  it("appends a new line and skips an identical one", () => {
    const first = appendDocumentProfileFact(
      { signatoryName: "Jane" },
      "Region",
      "5",
    );
    assert.deepEqual(first, {
      profile: { signatoryName: "Jane", facts: "Region: 5" },
      changed: true,
    });
    assert.equal(
      appendDocumentProfileFact(first.profile, " Region ", " 5 ").changed,
      false,
    );
  });
});

describe("documentProfileSchema", () => {
  it("accepts an empty or valid email and rejects an invalid one", () => {
    assert.equal(
      documentProfileSchema.safeParse({ contactEmail: "" }).success,
      true,
    );
    assert.equal(
      documentProfileSchema.safeParse({ contactEmail: "a@example.test" })
        .success,
      true,
    );
    assert.equal(
      documentProfileSchema.safeParse({ contactEmail: "nope" }).success,
      false,
    );
  });

  it("enforces the field length limits", () => {
    assert.equal(
      documentProfileSchema.safeParse({ fileCode: "x".repeat(201) }).success,
      false,
    );
    assert.equal(
      documentProfileSchema.safeParse({ facts: "x".repeat(2000) }).success,
      true,
    );
    assert.equal(
      documentProfileSchema.safeParse({ facts: "x".repeat(2001) }).success,
      false,
    );
  });
});
