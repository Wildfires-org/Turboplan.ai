import assert from "node:assert";
import { describe, it } from "node:test";

import { generateSlug, generateUniqueSlug, isValidSlug } from "../src/slug";

describe("generateSlug", () => {
  it("should convert a title to lowercase slug", () => {
    assert.strictEqual(generateSlug("Hello World"), "hello-world");
  });

  it("should replace spaces with hyphens", () => {
    assert.strictEqual(generateSlug("My Project Name"), "my-project-name");
  });

  it("should replace underscores with hyphens", () => {
    assert.strictEqual(generateSlug("my_project_name"), "my-project-name");
  });

  it("should remove special characters", () => {
    assert.strictEqual(generateSlug("Hello! World@#$%"), "hello-world");
  });

  it("should trim leading/trailing whitespace", () => {
    assert.strictEqual(generateSlug("  hello world  "), "hello-world");
  });

  it("should remove leading/trailing hyphens", () => {
    assert.strictEqual(generateSlug("-hello-world-"), "hello-world");
  });

  it("should truncate to 40 characters", () => {
    const longTitle = "a".repeat(50);
    assert.strictEqual(generateSlug(longTitle).length, 40);
  });

  it("should return empty string for empty input", () => {
    assert.strictEqual(generateSlug(""), "");
  });

  it("should return empty string for null/undefined", () => {
    assert.strictEqual(generateSlug(null as unknown as string), "");
    assert.strictEqual(generateSlug(undefined as unknown as string), "");
  });

  it("should handle multiple consecutive spaces/hyphens", () => {
    assert.strictEqual(generateSlug("hello   world"), "hello-world");
    assert.strictEqual(generateSlug("hello---world"), "hello-world");
  });

  it("should handle mixed case", () => {
    assert.strictEqual(generateSlug("HeLLo WoRLD"), "hello-world");
  });
});

describe("generateUniqueSlug", () => {
  it("should append a 6-character suffix", () => {
    const slug = generateUniqueSlug("Hello World");
    assert.match(slug, /^hello-world-[a-z0-9]{6}$/);
  });

  it("should truncate base to 32 chars to leave room for suffix", () => {
    const longTitle = "a".repeat(50);
    const slug = generateUniqueSlug(longTitle);
    // Base should be 32 chars + hyphen + 6 char suffix = 39 chars max
    assert.ok(slug.length <= 40);
    assert.match(slug, /^a{32}-[a-z0-9]{6}$/);
  });

  it("should return just ID for empty input", () => {
    const slug = generateUniqueSlug("");
    assert.match(slug, /^[a-z0-9]{6}$/);
  });

  it("should return just ID for special-chars-only input", () => {
    const slug = generateUniqueSlug("@#$%^&*");
    assert.match(slug, /^[a-z0-9]{6}$/);
  });

  it("should generate different slugs each time", () => {
    const slug1 = generateUniqueSlug("Test");
    const slug2 = generateUniqueSlug("Test");
    assert.notStrictEqual(slug1, slug2);
  });
});

describe("isValidSlug", () => {
  it("should return true for valid slugs", () => {
    assert.strictEqual(isValidSlug("hello-world"), true);
    assert.strictEqual(isValidSlug("my-project-123"), true);
    assert.strictEqual(isValidSlug("abc"), true);
    assert.strictEqual(isValidSlug("a1b2c3"), true);
  });

  it("should return false for uppercase characters", () => {
    assert.strictEqual(isValidSlug("Hello-World"), false);
  });

  it("should return false for leading hyphens", () => {
    assert.strictEqual(isValidSlug("-hello-world"), false);
  });

  it("should return false for trailing hyphens", () => {
    assert.strictEqual(isValidSlug("hello-world-"), false);
  });

  it("should return false for consecutive hyphens", () => {
    assert.strictEqual(isValidSlug("hello--world"), false);
  });

  it("should return false for special characters", () => {
    assert.strictEqual(isValidSlug("hello_world"), false);
    assert.strictEqual(isValidSlug("hello world"), false);
    assert.strictEqual(isValidSlug("hello@world"), false);
  });

  it("should return false for empty string", () => {
    assert.strictEqual(isValidSlug(""), false);
  });

  it("should return false for null/undefined", () => {
    assert.strictEqual(isValidSlug(null as unknown as string), false);
    assert.strictEqual(isValidSlug(undefined as unknown as string), false);
  });

  it("should return false for slugs over 40 characters", () => {
    const longSlug = "a".repeat(41);
    assert.strictEqual(isValidSlug(longSlug), false);
  });

  it("should return true for slugs exactly 40 characters", () => {
    const slug40 = "a".repeat(40);
    assert.strictEqual(isValidSlug(slug40), true);
  });
});
