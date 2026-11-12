import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";

import type * as ResearchPhaseModule from "../lib/research-phase";

let researchAgentEnabled = true;

mock.module("@wildfires-org/turboplan-feature-flags", {
  namedExports: {
    isResearchAgentPackageEnabled: () => researchAgentEnabled,
  },
});

// The turboplan app resolves as CJS, so import after the mock is registered.
let isResearchPhasePending: typeof ResearchPhaseModule.isResearchPhasePending;

before(async () => {
  ({ isResearchPhasePending } = await import("../lib/research-phase"));
});

describe("isResearchPhasePending", () => {
  it("waits for the research run while the agent is on", () => {
    researchAgentEnabled = true;
    assert.equal(
      isResearchPhasePending({ isResearchPhaseCompleted: false }),
      true,
    );
    assert.equal(
      isResearchPhasePending({ isResearchPhaseCompleted: true }),
      false,
    );
  });

  it("never waits when the research agent is off", () => {
    researchAgentEnabled = false;
    assert.equal(
      isResearchPhasePending({ isResearchPhaseCompleted: false }),
      false,
    );
    assert.equal(
      isResearchPhasePending({ isResearchPhaseCompleted: true }),
      false,
    );
  });
});
