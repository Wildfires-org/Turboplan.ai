import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_LANDING_UPLOADS } from "@wildfires-org/turboplan-upload/types";

import {
  parseInitialAttachments,
  serializeInitialAttachments,
} from "../lib/initial-attachments.js";

const plan = {
  url: "https://files.example.test/uploads/user-1/1730000000000-plan.pdf",
  name: "plan.pdf",
  contentType: "application/pdf",
};
const brief = {
  url: "https://files.example.test/uploads/user-1/1730000000000-brief.docx",
  name: "brief.docx",
  contentType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

describe("initial attachments param", () => {
  it("round-trips through the URL", () => {
    const params = new URLSearchParams({
      initialAttachments: serializeInitialAttachments([plan, brief]),
    });
    const fromUrl = new URLSearchParams(params.toString());

    assert.deepEqual(
      parseInitialAttachments(fromUrl.get("initialAttachments")),
      [plan, brief],
    );
  });

  it("drops fields outside the contract", () => {
    assert.deepEqual(
      parseInitialAttachments(JSON.stringify([{ ...plan, extra: "x" }])),
      [plan],
    );
  });

  it("returns nothing for a missing or malformed param", () => {
    for (const raw of [
      undefined,
      null,
      "",
      "not json",
      "{",
      JSON.stringify(plan),
      JSON.stringify("plan.pdf"),
      JSON.stringify(null),
      // One bad entry drops them all
      JSON.stringify([plan, { ...brief, name: "" }]),
      JSON.stringify([{ url: plan.url, name: plan.name }]),
      JSON.stringify([{ ...plan, url: "not a url" }]),
      JSON.stringify([{ ...plan, url: "javascript:alert(1)" }]),
      JSON.stringify([{ ...plan, url: "data:application/pdf;base64,AAAA" }]),
      JSON.stringify([{ ...plan, url: "ftp://files.example.test/plan.pdf" }]),
      JSON.stringify(
        Array.from({ length: MAX_LANDING_UPLOADS + 1 }, () => plan),
      ),
    ]) {
      assert.deepEqual(parseInitialAttachments(raw), [], String(raw));
    }
  });

  it("accepts up to the landing upload limit", () => {
    const attachments = Array.from({ length: MAX_LANDING_UPLOADS }, () => plan);
    assert.deepEqual(
      parseInitialAttachments(serializeInitialAttachments(attachments)),
      attachments,
    );
  });
});
