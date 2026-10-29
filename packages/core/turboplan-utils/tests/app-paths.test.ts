import assert from "node:assert";
import { describe, it } from "node:test";

import { appPaths } from "../src/app-paths";

describe("appPaths", () => {
  it("builds the organization path", () => {
    assert.strictEqual(appPaths.organization("usfs"), "/usfs");
  });

  it("builds the office path", () => {
    assert.strictEqual(
      appPaths.office("usfs", "my-projects"),
      "/usfs/my-projects",
    );
  });

  it("builds the project path", () => {
    assert.strictEqual(
      appPaths.project("usfs", "my-projects", "jackson-creek"),
      "/usfs/my-projects/jackson-creek",
    );
  });
});
