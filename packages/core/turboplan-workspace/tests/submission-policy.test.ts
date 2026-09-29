import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EntityType } from "@wildfires-org/turboplan-rbac";

import {
  getSubmissionReviewScope,
  SUBMITTED_PROJECT_VISIBILITY,
} from "../src/server/projects/submission-policy";

const ORG_ID = "00000000-0000-0000-0000-00000000000a";
const OFFICE_ID = "00000000-0000-0000-0000-00000000000b";

describe("getSubmissionReviewScope", () => {
  it("authorises review against the target office when one is set", () => {
    assert.deepEqual(
      getSubmissionReviewScope({
        targetOrganizationId: ORG_ID,
        targetOfficeId: OFFICE_ID,
      }),
      { entityType: EntityType.OFFICE, entityId: OFFICE_ID },
    );
  });

  it("falls back to the target organization for legacy submissions", () => {
    assert.deepEqual(
      getSubmissionReviewScope({
        targetOrganizationId: ORG_ID,
        targetOfficeId: null,
      }),
      { entityType: EntityType.ORGANIZATION, entityId: ORG_ID },
    );
  });

  it("never authorises review against the project itself", () => {
    const scope = getSubmissionReviewScope({
      targetOrganizationId: ORG_ID,
      targetOfficeId: OFFICE_ID,
    });
    assert.notEqual(scope.entityType, EntityType.PROJECT);
  });
});

describe("SUBMITTED_PROJECT_VISIBILITY", () => {
  it("forces a submitted application private and non-template", () => {
    assert.deepEqual(SUBMITTED_PROJECT_VISIBILITY, {
      isPublic: false,
      isTemplate: false,
    });
  });
});
