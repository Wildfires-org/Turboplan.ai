import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OwnershipStatus } from "@wildfires-org/turboplan-db";
import { UserRole } from "@wildfires-org/turboplan-db/types";

import {
  resolveProjectCreationFlags,
  resolveTemplateIsPublic,
} from "../src/server/projects/creation-policy";

describe("resolveProjectCreationFlags", () => {
  describe("government-office fallback (no CREATE on the office)", () => {
    it("forces a private, non-template DRAFT even when the body asks for more", () => {
      const flags = resolveProjectCreationFlags({
        hasOfficeCreate: false,
        hasOfficeManageMembers: false,
        userRole: UserRole.GOVERNMENT_AGENCY,
        requestedIsPublic: true,
        requestedIsTemplate: true,
      });

      assert.deepEqual(flags, {
        ownershipStatus: OwnershipStatus.DRAFT,
        isPublic: false,
        isTemplate: false,
      });
    });

    it("is DRAFT for a user who never finished onboarding (no role)", () => {
      const flags = resolveProjectCreationFlags({
        hasOfficeCreate: false,
        hasOfficeManageMembers: false,
        userRole: undefined,
        requestedIsPublic: undefined,
        requestedIsTemplate: undefined,
      });

      assert.equal(flags.ownershipStatus, OwnershipStatus.DRAFT);
    });

    it("ignores MANAGE_MEMBERS when CREATE is missing", () => {
      const flags = resolveProjectCreationFlags({
        hasOfficeCreate: false,
        hasOfficeManageMembers: true,
        userRole: null,
        requestedIsPublic: true,
        requestedIsTemplate: true,
      });

      assert.equal(flags.isPublic, false);
      assert.equal(flags.isTemplate, false);
    });
  });

  describe("staff (CREATE on the office)", () => {
    it("starts citizens as DRAFT", () => {
      const flags = resolveProjectCreationFlags({
        hasOfficeCreate: true,
        hasOfficeManageMembers: false,
        userRole: UserRole.CITIZEN,
        requestedIsPublic: undefined,
        requestedIsTemplate: undefined,
      });

      assert.equal(flags.ownershipStatus, OwnershipStatus.DRAFT);
    });

    it("starts non-citizens (including no role) as ACCEPTED", () => {
      for (const userRole of [UserRole.GOVERNMENT_AGENCY, null, undefined]) {
        const flags = resolveProjectCreationFlags({
          hasOfficeCreate: true,
          hasOfficeManageMembers: false,
          userRole,
          requestedIsPublic: undefined,
          requestedIsTemplate: undefined,
        });

        assert.equal(flags.ownershipStatus, OwnershipStatus.ACCEPTED);
      }
    });

    it("drops isPublic / isTemplate without office MANAGE_MEMBERS", () => {
      const flags = resolveProjectCreationFlags({
        hasOfficeCreate: true,
        hasOfficeManageMembers: false,
        userRole: UserRole.GOVERNMENT_AGENCY,
        requestedIsPublic: true,
        requestedIsTemplate: true,
      });

      assert.equal(flags.isPublic, false);
      assert.equal(flags.isTemplate, false);
    });

    it("keeps isPublic / isTemplate with office MANAGE_MEMBERS", () => {
      const flags = resolveProjectCreationFlags({
        hasOfficeCreate: true,
        hasOfficeManageMembers: true,
        userRole: UserRole.GOVERNMENT_AGENCY,
        requestedIsPublic: true,
        requestedIsTemplate: true,
      });

      assert.equal(flags.isPublic, true);
      assert.equal(flags.isTemplate, true);
    });

    it("defaults both flags to false when not requested", () => {
      const flags = resolveProjectCreationFlags({
        hasOfficeCreate: true,
        hasOfficeManageMembers: true,
        userRole: UserRole.GOVERNMENT_AGENCY,
        requestedIsPublic: undefined,
        requestedIsTemplate: undefined,
      });

      assert.equal(flags.isPublic, false);
      assert.equal(flags.isTemplate, false);
    });
  });
});

describe("resolveTemplateIsPublic", () => {
  it("keeps an editor's template private even when public is requested", () => {
    assert.equal(
      resolveTemplateIsPublic({
        hasOfficeManageMembers: false,
        requestedIsPublic: true,
      }),
      false,
    );
    assert.equal(
      resolveTemplateIsPublic({
        hasOfficeManageMembers: false,
        requestedIsPublic: undefined,
      }),
      false,
    );
  });

  it("defaults to public for office MANAGE_MEMBERS holders", () => {
    assert.equal(
      resolveTemplateIsPublic({
        hasOfficeManageMembers: true,
        requestedIsPublic: undefined,
      }),
      true,
    );
  });

  it("honours an explicit private request from MANAGE_MEMBERS holders", () => {
    assert.equal(
      resolveTemplateIsPublic({
        hasOfficeManageMembers: true,
        requestedIsPublic: false,
      }),
      false,
    );
  });
});
