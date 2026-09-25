import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import { EntityType } from "@wildfires-org/turboplan-rbac";

import { buildUserSearchUrl } from "../src/hooks/use-user-search";
import { mergePublicAndAccessibleProjects } from "../src/server/projects/visibility";
import {
  isMemberOfSearchBranch,
  resolveUserSearchScope,
} from "../src/server/users/scope";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OFFICE_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

describe("resolveUserSearchScope", () => {
  it("maps each single param to its entity", () => {
    assert.deepEqual(resolveUserSearchScope({ organizationId: ORG_ID }), {
      entityType: EntityType.ORGANIZATION,
      entityId: ORG_ID,
    });
    assert.deepEqual(resolveUserSearchScope({ officeId: OFFICE_ID }), {
      entityType: EntityType.OFFICE,
      entityId: OFFICE_ID,
    });
    assert.deepEqual(resolveUserSearchScope({ projectId: PROJECT_ID }), {
      entityType: EntityType.PROJECT,
      entityId: PROJECT_ID,
    });
  });

  it("rejects a search with no scope", () => {
    assert.equal(resolveUserSearchScope({}), null);
    assert.equal(resolveUserSearchScope({ organizationId: "" }), null);
  });

  it("rejects an ambiguous scope", () => {
    assert.equal(
      resolveUserSearchScope({ organizationId: ORG_ID, projectId: PROJECT_ID }),
      null,
    );
  });
});

describe("isMemberOfSearchBranch", () => {
  const dialect = new PgDialect();
  const render = (branch: Parameters<typeof isMemberOfSearchBranch>[0]) => {
    const query = dialect.sqlToQuery(isMemberOfSearchBranch(branch));
    return { sql: query.sql.replace(/\s+/g, " ").trim(), params: query.params };
  };

  const orgMembers =
    '"user"."id" in ( select "organization_users"."user_id" from "organization_users" where "organization_users"."organization_id" = $3 )';

  it("limits a project scope to the project, its office and its organization", () => {
    const { sql, params } = render({
      organizationId: ORG_ID,
      officeId: OFFICE_ID,
      projectId: PROJECT_ID,
    });

    assert.equal(
      sql,
      `( "user"."id" in ( select "project_users"."user_id" from "project_users" where "project_users"."project_id" = $1 ) or "user"."id" in ( select "office_users"."user_id" from "office_users" where "office_users"."office_id" = $2 ) or ${orgMembers} )`,
    );
    assert.deepEqual(params, [PROJECT_ID, OFFICE_ID, ORG_ID]);
  });

  it("limits an office scope to the office, its live projects and its organization", () => {
    const { sql, params } = render({
      organizationId: ORG_ID,
      officeId: OFFICE_ID,
    });

    assert.equal(
      sql,
      `( "user"."id" in ( select "office_users"."user_id" from "office_users" where "office_users"."office_id" = $1 ) or "user"."id" in ( select "project_users"."user_id" from "project_users" inner join "project" on "project"."id" = "project_users"."project_id" where "project"."office_id" = $2 and "project"."deleted_at" is null ) or ${orgMembers} )`,
    );
    assert.deepEqual(params, [OFFICE_ID, OFFICE_ID, ORG_ID]);
  });

  it("opens an organization scope to its whole tree", () => {
    const { sql, params } = render({ organizationId: ORG_ID });

    assert.equal(
      sql,
      '( "user"."id" in ( select "organization_users"."user_id" from "organization_users" where "organization_users"."organization_id" = $1 ) or "user"."id" in ( select "office_users"."user_id" from "office_users" inner join "office" on "office"."id" = "office_users"."office_id" where "office"."organization_id" = $2 ) or "user"."id" in ( select "project_users"."user_id" from "project_users" inner join "project" on "project"."id" = "project_users"."project_id" inner join "office" on "office"."id" = "project"."office_id" where "office"."organization_id" = $3 and "project"."deleted_at" is null ) )',
    );
    assert.deepEqual(params, [ORG_ID, ORG_ID, ORG_ID]);
  });
});

describe("buildUserSearchUrl", () => {
  it("adds the entity scope param to the scoped search", () => {
    const url = new URL(
      buildUserSearchUrl(
        { entityType: EntityType.OFFICE, entityId: OFFICE_ID },
        "ada",
        10,
      ),
      "http://localhost",
    );

    assert.equal(url.pathname, "/api/users/search");
    assert.equal(url.searchParams.get("q"), "ada");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("officeId"), OFFICE_ID);
  });

  it("uses the admin route for the admin scope", () => {
    const url = new URL(
      buildUserSearchUrl("admin", "ada", 5),
      "http://localhost",
    );

    assert.equal(url.pathname, "/api/admin/users/search");
    assert.equal(url.searchParams.get("q"), "ada");
  });
});

describe("mergePublicAndAccessibleProjects", () => {
  const project = (id: string) => ({
    id,
    creatorEmail: `${id}@example.test`,
  });

  it("drops the creator email from projects known only publicly", () => {
    const merged = mergePublicAndAccessibleProjects(
      [project("public-only"), project("shared")],
      [project("shared"), project("private")],
    );

    assert.deepEqual(merged, [
      { id: "public-only", creatorEmail: null },
      project("shared"),
      project("private"),
    ]);
  });

  it("keeps accessible projects untouched when there is no public list", () => {
    assert.deepEqual(mergePublicAndAccessibleProjects([], [project("a")]), [
      project("a"),
    ]);
  });
});
