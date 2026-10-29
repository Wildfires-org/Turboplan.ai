import assert from "node:assert";
import { describe, it } from "node:test";

import { isRoutableSlugPath } from "../lib/nav/route-slugs";

describe("isRoutableSlugPath", () => {
  it("accepts a valid org, office and project path", () => {
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "usfs" }), true);
    assert.strictEqual(
      isRoutableSlugPath({ orgSlug: "usfs", officeSlug: "my-projects" }),
      true,
    );
    assert.strictEqual(
      isRoutableSlugPath({
        orgSlug: "usfs",
        officeSlug: "my-projects",
        projectSlug: "jackson-creek",
      }),
      true,
    );
  });

  it("rejects reserved organization slugs", () => {
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "organizations" }), false);
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "api" }), false);
    assert.strictEqual(
      isRoutableSlugPath({ orgSlug: "organizations", officeSlug: "usfs" }),
      false,
    );
  });

  it("rejects reserved office slugs", () => {
    assert.strictEqual(
      isRoutableSlugPath({ orgSlug: "usfs", officeSlug: "offices" }),
      false,
    );
    assert.strictEqual(
      isRoutableSlugPath({ orgSlug: "usfs", officeSlug: "members" }),
      false,
    );
  });

  it("rejects reserved project slugs", () => {
    assert.strictEqual(
      isRoutableSlugPath({
        orgSlug: "usfs",
        officeSlug: "my-projects",
        projectSlug: "projects",
      }),
      false,
    );
    assert.strictEqual(
      isRoutableSlugPath({
        orgSlug: "usfs",
        officeSlug: "my-projects",
        projectSlug: "templates",
      }),
      false,
    );
  });

  it("checks each slug against its own level only", () => {
    // `members` is reserved for offices and projects, not organizations.
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "members" }), true);
    // `offices` is only reserved at the office level.
    assert.strictEqual(
      isRoutableSlugPath({
        orgSlug: "usfs",
        officeSlug: "my-projects",
        projectSlug: "offices",
      }),
      true,
    );
  });

  it("accepts slugs that only start with a reserved word", () => {
    assert.strictEqual(
      isRoutableSlugPath({ orgSlug: "usfs", officeSlug: "members-hq" }),
      true,
    );
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "api-team" }), true);
  });

  it("rejects malformed slugs", () => {
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "wp-admin.php" }), false);
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "UPPER" }), false);
    assert.strictEqual(isRoutableSlugPath({ orgSlug: "a_b" }), false);
    assert.strictEqual(
      isRoutableSlugPath({ orgSlug: "usfs", officeSlug: "-office" }),
      false,
    );
    assert.strictEqual(
      isRoutableSlugPath({
        orgSlug: "usfs",
        officeSlug: "my-projects",
        projectSlug: "x".repeat(41),
      }),
      false,
    );
  });

  it("only format-checks the template slug", () => {
    const office = { orgSlug: "usfs", officeSlug: "my-projects" };
    assert.strictEqual(
      isRoutableSlugPath({ ...office, templateSlug: "burn-plan" }),
      true,
    );
    // Reserved words are fine: templates live under their own static segment.
    assert.strictEqual(
      isRoutableSlugPath({ ...office, templateSlug: "members" }),
      true,
    );
    assert.strictEqual(
      isRoutableSlugPath({ ...office, templateSlug: "Burn_Plan" }),
      false,
    );
  });
});
