import assert from "node:assert";
import { describe, it } from "node:test";

import { getOfficeRoute } from "../lib/nav/office-route";

const ORG = "usfs";
const OFFICE = "my-projects";
const OFFICE_URL = `/${ORG}/${OFFICE}`;

const routeOf = (pathname: string) => {
  return getOfficeRoute(pathname, ORG, OFFICE);
};

describe("getOfficeRoute", () => {
  it("maps the office page itself to the projects tab", () => {
    assert.strictEqual(routeOf(OFFICE_URL), "projects");
  });

  it("maps the office tabs to themselves", () => {
    assert.strictEqual(routeOf(`${OFFICE_URL}/members`), "members");
    assert.strictEqual(
      routeOf(`${OFFICE_URL}/my-submissions`),
      "my-submissions",
    );
    assert.strictEqual(
      routeOf(`${OFFICE_URL}/citizen-submissions`),
      "citizen-submissions",
    );
  });

  it("maps the templates list to the templates tab", () => {
    assert.strictEqual(routeOf(`${OFFICE_URL}/templates`), "templates");
  });

  it("maps pages below templates to other", () => {
    assert.strictEqual(routeOf(`${OFFICE_URL}/templates/document`), "other");
    assert.strictEqual(routeOf(`${OFFICE_URL}/templates/burn-plan`), "other");
  });

  it("maps the legacy projects segment to other", () => {
    assert.strictEqual(routeOf(`${OFFICE_URL}/projects`), "other");
  });

  it("maps a project slug and its pages to project", () => {
    assert.strictEqual(routeOf(`${OFFICE_URL}/jackson-creek`), "project");
    assert.strictEqual(
      routeOf(`${OFFICE_URL}/jackson-creek/chats/new`),
      "project",
    );
    assert.strictEqual(routeOf(`${OFFICE_URL}/members-hq`), "project");
  });
});
