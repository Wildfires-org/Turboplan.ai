import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStatusRefreshInterval } from "../src/client/utils";
import type { ResearchAgentStatus } from "../src/types";

const POLLING_INTERVAL = 5000;

const intervalFor = (
  latestData: ResearchAgentStatus | undefined,
  awaitRunStart = false,
) =>
  getStatusRefreshInterval(latestData, {
    awaitRunStart,
    pollingInterval: POLLING_INTERVAL,
  });

describe("getStatusRefreshInterval", () => {
  it("polls before the first response so an active run is picked up", () => {
    assert.equal(intervalFor(undefined), POLLING_INTERVAL);
  });

  it("polls while a run is active", () => {
    assert.equal(
      intervalFor({ hasActiveRun: true, runId: "run-1", status: "running" }),
      POLLING_INTERVAL,
    );
  });

  it("stops once the run has finished", () => {
    assert.equal(
      intervalFor({ hasActiveRun: false, runId: "run-1", status: "completed" }),
      0,
    );
    assert.equal(
      intervalFor({ hasActiveRun: false, runId: "run-1", status: "failed" }),
      0,
    );
  });

  it("stops when no run exists and none is expected", () => {
    assert.equal(intervalFor({ hasActiveRun: false }), 0);
  });

  it("keeps polling for a run that is expected to start", () => {
    assert.equal(intervalFor({ hasActiveRun: false }, true), POLLING_INTERVAL);
    assert.equal(
      intervalFor(
        { hasActiveRun: false, runId: "run-1", status: "completed" },
        true,
      ),
      0,
    );
  });
});
