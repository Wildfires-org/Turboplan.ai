import assert from "node:assert";
import path from "node:path";
import { before, beforeEach, describe, it, mock } from "node:test";
import { pathToFileURL } from "node:url";

import type * as SignupModule from "../app/self-service/create-user-with-organization";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const stagingKey = (name: string) =>
  `landing-uploads/1730000000000-${UUID}-${name}`;

// Mocks keyed by file URL, so app-relative ("@/…") and relative imports of the
// module under test resolve to them.
const appModule = (relativePath: string) =>
  pathToFileURL(path.join(__dirname, "..", relativePath)).href;

describe("createUserWithOrganization landing uploads", () => {
  // Every step that matters for the ordering, in call order.
  let steps: string[] = [];
  let isEmailSent = true;
  let attachable: Array<{ key: string; name: string }> = [];

  const findAttachableLandingUploads = mock.fn(async () => {
    steps.push("inspect");
    return attachable;
  });
  const attachLandingUploads = mock.fn(
    async (_params: { keys: string[] | undefined }) => {
      steps.push("claim");
      return [];
    },
  );
  const buildProjectChatUrl = mock.fn(
    (
      _org: string,
      _office: string,
      _project: string,
      options: { initialMessageContent?: string },
    ) => `/chat?message=${options.initialMessageContent ?? ""}`,
  );

  const insertQuery = (values: { name?: string }) =>
    Object.assign(Promise.resolve(), {
      returning: async () => [
        { id: PROJECT_ID, name: values.name, slug: "project" },
      ],
    });
  const tx = { insert: () => ({ values: insertQuery }) };

  mock.module("@wildfires-org/turboplan-billing/server", {
    namedExports: {
      activateStarterPlan: async () => {},
      assertProjectCreationAllowed: async () => ({ allowed: true }),
    },
  });
  mock.module("@wildfires-org/turboplan-db", {
    namedExports: {
      project: {},
      projectUsers: {},
      UserRole: { CITIZEN: "citizen" },
    },
  });
  mock.module("@wildfires-org/turboplan-db/db-client", {
    namedExports: {
      db: { transaction: async (run: (t: typeof tx) => unknown) => run(tx) },
    },
  });
  mock.module("@wildfires-org/turboplan-db/queries", {
    namedExports: {
      createMagicLinkUserWithProfile: async () => [{ id: USER_ID }],
      createVerificationToken: async () => "token",
      getUserByEmail: async () => null,
      saveChat: async () => {},
    },
  });
  mock.module("@wildfires-org/turboplan-feature-flags", {
    namedExports: { isBillingPackageEnabled: () => false },
  });
  mock.module("@wildfires-org/turboplan-utils/server", {
    namedExports: { generateUniqueSlug: () => "project" },
  });
  mock.module("@wildfires-org/turboplan-workspace/server", {
    namedExports: {
      getOrCreatePersonalWorkspace: async () => ({
        organization: { id: "org", slug: "org" },
        office: { id: "office", slug: "office" },
      }),
      getOrganizationById: async () => null,
    },
  });
  mock.module("@wildfires-org/turboplan-workspace/types", {
    namedExports: {
      MemberRole: { OWNER: "owner" },
      OrganizationType: { GOVERNMENT: "government" },
    },
  });
  mock.module(appModule("lib/email/send-magic-link.ts"), {
    namedExports: {
      sendMagicLinkEmail: async () => {
        steps.push("email");
        return isEmailSent
          ? { success: true }
          : { success: false, error: "provider down" };
      },
    },
  });
  mock.module(appModule("lib/server-analytics.ts"), {
    namedExports: { aliasAnonymousId: () => {}, captureServerEvent: () => {} },
  });
  mock.module(appModule("app/(auth)/actions.ts"), {
    namedExports: { buildMagicLinkUrl: () => "https://app.test/magic" },
  });
  mock.module(appModule("app/self-service/attach-landing-uploads.ts"), {
    namedExports: {
      attachLandingUploads,
      findAttachableLandingUploads,
      withAttachedDocumentsNote: (_prompt: string, names: string[]) =>
        names.join(","),
    },
  });
  mock.module(appModule("app/self-service/helpers.ts"), {
    namedExports: {
      buildFallbackProjectDescription: (title: string) => title,
      buildProjectChatUrl,
      sanitizeName: (name: string) => name,
    },
  });

  let signup: typeof SignupModule;

  before(async () => {
    signup = await import("../app/self-service/create-user-with-organization");
  });

  beforeEach(() => {
    steps = [];
    isEmailSent = true;
    attachable = [];
    for (const fn of [
      findAttachableLandingUploads,
      attachLandingUploads,
      buildProjectChatUrl,
    ]) {
      fn.mock.resetCalls();
    }
    mock.method(console, "error", () => {});
  });

  const run = () =>
    signup.createUserWithOrganization({
      email: "new-user@example.test",
      projectTitle: "Trail repair",
      landingUploadKeys: [stagingKey("plan.pdf"), stagingKey("missing.pdf")],
    });

  it("claims after the email, only what the pre-check found", async () => {
    attachable = [{ key: stagingKey("plan.pdf"), name: "plan.pdf" }];

    const result = await run();

    assert.strictEqual(result.status, "email_sent");
    assert.deepStrictEqual(steps, ["inspect", "email", "claim"]);
    assert.deepStrictEqual(
      attachLandingUploads.mock.calls[0].arguments[0].keys,
      [stagingKey("plan.pdf")],
    );
    // The first chat message names only the document that exists.
    assert.strictEqual(
      buildProjectChatUrl.mock.calls[0].arguments[3].initialMessageContent,
      "plan.pdf",
    );
  });

  it("leaves the keys unclaimed when the email fails, for the retry", async () => {
    attachable = [{ key: stagingKey("plan.pdf"), name: "plan.pdf" }];
    isEmailSent = false;

    const result = await run();

    assert.strictEqual(result.status, "failed");
    assert.deepStrictEqual(steps, ["inspect", "email"]);
    assert.strictEqual(attachLandingUploads.mock.callCount(), 0);
  });
});
