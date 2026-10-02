import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getActiveStep } from "../src/client/utils";
import {
  type ResearchAgentMessage,
  ResearchAgentMessageType,
  type ResearchAgentStatus,
} from "../src/types";

const RUN_ID = "run-current";

const buildStatus = (
  overrides: Partial<ResearchAgentStatus> = {},
): ResearchAgentStatus => ({
  hasActiveRun: true,
  runId: RUN_ID,
  status: "running",
  currentStep: "Status step",
  createdAt: "2026-10-02T10:00:00.000Z",
  updatedAt: "2026-10-02T10:01:00.000Z",
  ...overrides,
});

const buildProgress = (
  step: string,
  createdAt: string,
  researchAgentChatId = RUN_ID,
): ResearchAgentMessage => ({
  id: `${researchAgentChatId}-${createdAt}`,
  chatId: "chat-1",
  researchAgentChatId,
  type: ResearchAgentMessageType.PROGRESS,
  data: { step },
  createdAt,
});

describe("getActiveStep", () => {
  it("returns undefined without a status or messages", () => {
    assert.equal(getActiveStep(undefined, []), undefined);
  });

  it("falls back to the status step when there is no progress", () => {
    assert.equal(getActiveStep(buildStatus(), []), "Status step");
  });

  it("prefers a progress message newer than the status", () => {
    const messages = [
      buildProgress("Searching permits", "2026-10-02T10:02:00.000Z"),
    ];

    assert.equal(getActiveStep(buildStatus(), messages), "Searching permits");
  });

  it("prefers the status when it was written after the latest progress", () => {
    const status = buildStatus({
      currentStep: "Connecting to research service...",
      updatedAt: "2026-10-02T10:05:00.000Z",
    });
    const messages = [
      buildProgress("Old progress", "2026-10-02T10:02:00.000Z"),
    ];

    assert.equal(
      getActiveStep(status, messages),
      "Connecting to research service...",
    );
  });

  it("uses the progress step when the status has no step or timestamp", () => {
    const messages = [
      buildProgress("Searching permits", "2026-10-02T10:00:30.000Z"),
    ];

    assert.equal(
      getActiveStep(buildStatus({ currentStep: undefined }), messages),
      "Searching permits",
    );
    assert.equal(
      getActiveStep(buildStatus({ updatedAt: undefined }), messages),
      "Searching permits",
    );
  });

  it("ignores progress from other runs", () => {
    const messages = [
      buildProgress("Previous run step", "2026-10-02T10:09:00.000Z", "run-old"),
    ];

    assert.equal(getActiveStep(buildStatus(), messages), "Status step");
  });

  it("ignores non-progress messages", () => {
    const messages: ResearchAgentMessage[] = [
      {
        ...buildProgress("unused", "2026-10-02T10:09:00.000Z"),
        type: ResearchAgentMessageType.DOCUMENTS,
        data: { documents: [] },
      },
    ];

    assert.equal(getActiveStep(buildStatus(), messages), "Status step");
  });

  it("picks the latest progress by createdAt regardless of array order", () => {
    const messages = [
      buildProgress("Third", "2026-10-02T10:04:00.000Z"),
      buildProgress("First", "2026-10-02T10:02:00.000Z"),
      buildProgress("Second", "2026-10-02T10:03:00.000Z"),
    ];

    assert.equal(getActiveStep(buildStatus(), messages), "Third");
  });
});
