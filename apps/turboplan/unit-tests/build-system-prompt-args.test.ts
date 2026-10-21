import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import type * as BuildSystemPromptArgsModule from "../lib/ai/build-system-prompt-args";

const PROJECT_ID = "project-1";
const LIBRARY_LETTERHEAD_ID = "ffe67935-7437-4d62-b6ef-6f4e2eb2a15e";

const DISTRICT_LETTERHEAD = {
  layout: "columns",
  nameLines: ["Example Ranger District"],
  contactLines: [] as string[],
  color: null,
};

let isResearchPhaseCompleted = false;
let defaultLetterhead: Record<string, unknown> = DISTRICT_LETTERHEAD;

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
      defaultLetterhead,
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
    defaultLetterhead = DISTRICT_LETTERHEAD;
  });

  const letterheadChoiceContext = async () => {
    isResearchPhaseCompleted = true;
    const args = await promptArgsModule.buildSystemPromptArgs({
      projectId: PROJECT_ID,
    });
    return args.officeDocumentContext ?? "";
  };

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
    // The reference rule is stated once, in the header, not on `default`.
    assert.match(
      args.officeDocumentContext ?? "",
      /brings its own letterhead when one was read from it; `default` and `none` never replace it/,
    );
    assert.match(
      args.officeDocumentContext ?? "",
      /^- `default` — office\/organization default \(first line: Example Ranger District\)$/m,
    );
  });

  it("names a default letterhead without name lines by its first contact line", async () => {
    defaultLetterhead = {
      layout: "grid",
      grid: { cells: [], color: null },
      nameLines: [],
      contactLines: ["1 Main St"],
      color: null,
    };

    assert.match(await letterheadChoiceContext(), /\(first line: 1 Main St\)/);
  });

  it("names a banner default as its image", async () => {
    defaultLetterhead = { ...DISTRICT_LETTERHEAD, layout: "banner" };

    assert.match(
      await letterheadChoiceContext(),
      /\(first line: \(banner image\)\)/,
    );
  });
});
