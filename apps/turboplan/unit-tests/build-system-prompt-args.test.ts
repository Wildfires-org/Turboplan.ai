import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import type * as BuildSystemPromptArgsModule from "../lib/ai/build-system-prompt-args";

const PROJECT_ID = "project-1";
const LIBRARY_LETTERHEAD_ID = "ffe67935-7437-4d62-b6ef-6f4e2eb2a15e";

let isResearchPhaseCompleted = false;

// Only the map package (for document tools) and the research agent (for the
// research phase) are on, so no other context fetcher runs.
mock.module("@wildfires-org/turboplan-feature-flags", {
  namedExports: {
    isDocumentsPackageEnabled: () => false,
    isFieldsPackageEnabled: () => false,
    isMapPackageEnabled: () => true,
    isProjectContextPackageEnabled: () => false,
    isResearchAgentPackageEnabled: () => true,
    isTasksPackageEnabled: () => false,
  },
});
mock.module("@wildfires-org/turboplan-rbac/server", {
  namedExports: {
    getRBACService: () => ({
      checkPermission: async () => ({ allowed: false }),
    }),
  },
});
mock.module("@wildfires-org/turboplan-workspace/server", {
  namedExports: {
    getProjectById: async () => ({
      name: "Example Project",
      isResearchPhaseCompleted,
    }),
    getProjectDocumentProfile: async () => ({ signatoryName: "Jane Doe" }),
    listProjectLetterheadCandidates: async () => ({
      defaultLetterhead: {
        layout: "columns",
        nameLines: ["Example Ranger District"],
        contactLines: [],
        color: null,
      },
      library: [
        {
          id: LIBRARY_LETTERHEAD_ID,
          name: "Example Consulting",
          description: "Our consulting firm",
          firstLine: "Example Consulting LLC",
        },
      ],
    }),
  },
});

// The turboplan app resolves as CJS, so import after the mocks are registered.
let promptArgsModule: typeof BuildSystemPromptArgsModule;

before(async () => {
  promptArgsModule = await import("../lib/ai/build-system-prompt-args");
});

describe("buildSystemPromptArgs letterhead choice", () => {
  beforeEach(() => {
    isResearchPhaseCompleted = false;
  });

  it("omits the letterhead choice in research mode, where createDocument is not offered", async () => {
    const args = await promptArgsModule.buildSystemPromptArgs({
      projectId: PROJECT_ID,
    });

    assert.ok(!args.activeTools.includes("createDocument"));
    assert.match(args.officeDocumentContext ?? "", /# OFFICE DOCUMENT DETAILS/);
    assert.doesNotMatch(
      args.officeDocumentContext ?? "",
      /AVAILABLE LETTERHEADS/,
    );
    assert.ok(!args.officeDocumentContext?.includes(LIBRARY_LETTERHEAD_ID));
  });

  it("offers the letterhead choice alongside createDocument after the research phase", async () => {
    isResearchPhaseCompleted = true;

    const args = await promptArgsModule.buildSystemPromptArgs({
      projectId: PROJECT_ID,
    });

    assert.ok(args.activeTools.includes("createDocument"));
    assert.match(args.officeDocumentContext ?? "", /# OFFICE DOCUMENT DETAILS/);
    assert.match(args.officeDocumentContext ?? "", /# AVAILABLE LETTERHEADS/);
    assert.ok(args.officeDocumentContext?.includes(LIBRARY_LETTERHEAD_ID));
  });
});
