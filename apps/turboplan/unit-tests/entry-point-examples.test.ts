import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ENTRY_PAGE_CONTENT } from "../lib/entry-point/content";
import {
  USFS_EXAMPLES,
  USFS_PROJECT_TYPES,
} from "../lib/entry-point/usfs-examples";

const countWords = (text: string) => text.trim().split(/\s+/).length;

describe("USFS entry examples", () => {
  it("lists the 59 project types from the wildfires.org picker", () => {
    const ids = USFS_PROJECT_TYPES.map((type) => type.id);

    assert.equal(ids.length, 59);
    assert.equal(new Set(ids).size, 59);
    assert.ok(ids.every((id) => id.startsWith("ce.")));
  });

  it("draws every example from one of those types", () => {
    const typeIds = new Set<string>(USFS_PROJECT_TYPES.map((type) => type.id));

    for (const example of USFS_EXAMPLES) {
      assert.ok(typeIds.has(example.projectType), example.id);
    }
  });

  it("gives each example a unique id, label and project name", () => {
    for (const field of ["id", "label", "projectTitle"] as const) {
      const values = USFS_EXAMPLES.map((example) => example[field]);
      assert.equal(new Set(values).size, values.length, field);
    }
  });

  it("keeps labels chip-sized and project names short", () => {
    for (const example of USFS_EXAMPLES) {
      assert.ok(example.label.length <= 22, example.label);
      assert.ok(example.projectTitle.length <= 60, example.projectTitle);
    }
  });

  it("writes each prompt as one paragraph a planner would type", () => {
    for (const example of USFS_EXAMPLES) {
      const words = countWords(example.prompt);

      assert.ok(!example.prompt.includes("\n"), example.id);
      assert.ok(words >= 40 && words <= 90, `${example.id}: ${words} words`);
      assert.match(example.prompt, /\.$/, example.id);
    }
  });

  it("is the set the entry page offers", () => {
    assert.equal(ENTRY_PAGE_CONTENT.examples, USFS_EXAMPLES);
  });
});
