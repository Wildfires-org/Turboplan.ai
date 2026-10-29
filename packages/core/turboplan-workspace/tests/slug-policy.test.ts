import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSlugNotReserved,
  generateAvailableSlug,
} from "../src/server/slug-policy";

const SUFFIXED = /^[a-z0-9-]+-[a-z0-9]{6}$/;

const takenSlugs = (...slugs: string[]) => {
  const checked: string[] = [];
  const isTaken = async (slug: string) => {
    checked.push(slug);
    return slugs.includes(slug);
  };
  return { checked, isTaken };
};

describe("generateAvailableSlug", () => {
  it("keeps the plain slug when it is free and not reserved", async () => {
    const { isTaken } = takenSlugs();
    const slug = await generateAvailableSlug(
      "project",
      "Jackson Creek",
      isTaken,
    );
    assert.equal(slug, "jackson-creek");
  });

  it("suffixes a slug that is already taken", async () => {
    const { isTaken } = takenSlugs("jackson-creek");
    const slug = await generateAvailableSlug(
      "project",
      "Jackson Creek",
      isTaken,
    );
    assert.match(slug, SUFFIXED);
    assert.ok(slug.startsWith("jackson-creek-"));
  });

  it("suffixes a reserved slug without a uniqueness lookup", async () => {
    const { checked, isTaken } = takenSlugs();

    const org = await generateAvailableSlug("organization", "Login", isTaken);
    const office = await generateAvailableSlug("office", "Members", isTaken);
    const project = await generateAvailableSlug(
      "project",
      "Templates",
      isTaken,
    );

    assert.ok(org.startsWith("login-"));
    assert.ok(office.startsWith("members-"));
    assert.ok(project.startsWith("templates-"));
    assert.deepEqual(checked, []);
  });

  it("only treats a slug as reserved at the level it collides", async () => {
    const { isTaken } = takenSlugs();
    const slug = await generateAvailableSlug(
      "organization",
      "Members",
      isTaken,
    );
    assert.equal(slug, "members");
  });
});

describe("assertSlugNotReserved", () => {
  it("rejects a reserved slug", () => {
    assert.throws(
      () => assertSlugNotReserved("office", "billing"),
      /Slug "billing" is reserved/,
    );
  });

  it("accepts a regular slug", () => {
    assert.doesNotThrow(() => assertSlugNotReserved("office", "billing-hq"));
  });
});
