import { describe, expect, it, vi } from "vitest";

import {
  createTargetApiClient,
  type TargetApiClient,
} from "../../src/infra/target-api-client";
import { createRunManager } from "../../src/runs/run-manager";
import type { RunStatus } from "../../src/runs/types";
import { createInMemoryRunRepository } from "../contracts/in-memory-run-repository";
import { createScriptedRunner } from "../contracts/scripted-runner";
import { createMemoryServiceStub } from "../helpers/test-app";

// The DNS guard is covered elsewhere; here it would only need network access.
vi.mock("../../src/http/utils/resolve-guard", () => ({
  assertPublicTarget: async () => null,
}));
vi.mock("../../src/infra/analytics", () => ({
  captureRunEvent: () => {},
}));

const TARGET_API_URL =
  "https://target.example.test/api/webhooks/research-agent";
const WEBHOOK_SECRET = "test-secret";

type ProgressCall = Parameters<TargetApiClient["sendProgress"]>[0];

const completeRun = async (status: RunStatus): Promise<ProgressCall[]> => {
  const calls: ProgressCall[] = [];
  const targetApiClient: TargetApiClient = {
    request: async () => new Response(),
    sendProgress: async (input) => {
      calls.push(input);
    },
  };
  const runManager = createRunManager(
    createMemoryServiceStub(),
    createScriptedRunner([]),
    createInMemoryRunRepository(),
    targetApiClient,
  );

  await runManager.handleRunCompleted(
    { runId: "run-1", status },
    {
      runId: "run-1",
      prompt: "Research this project",
      webhookSecret: WEBHOOK_SECRET,
      targetApiUrl: TARGET_API_URL,
    },
  );

  return calls;
};

describe("bootstrapper completion notification", () => {
  it.each([
    ["completed", "completed", "Research agent done!"],
    ["cancelled", "cancelled", "Research agent cancelled."],
    ["failed", "failed", "Something went wrong. Please try again."],
    ["timeout", "failed", "Something went wrong. Please try again."],
  ] as const)(
    "reports a %s run as %s with its final message",
    async (runStatus, expectedOutcome, expectedMessage) => {
      const calls = await completeRun(runStatus);

      expect(calls).toEqual([
        {
          targetApiUrl: TARGET_API_URL,
          webhookSecret: WEBHOOK_SECRET,
          runId: "run-1",
          message: expectedMessage,
          status: expectedOutcome,
        },
      ]);
    },
  );
});

describe("targetApiClient.sendProgress", () => {
  const captureBody = async (
    status?: "completed" | "failed" | "cancelled",
  ): Promise<unknown> => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await createTargetApiClient().sendProgress({
        targetApiUrl: TARGET_API_URL,
        webhookSecret: WEBHOOK_SECRET,
        runId: "run-1",
        message: "Searching documents",
        status,
      });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${TARGET_API_URL}/bootstrapper/project/progress`);
    return JSON.parse(init.body as string);
  };

  it("sends the run outcome with the final message", async () => {
    expect(await captureBody("completed")).toEqual({
      runId: "run-1",
      message: "Searching documents",
      status: "completed",
    });
  });

  it("keeps ordinary progress payloads free of a status", async () => {
    expect(await captureBody()).toEqual({
      runId: "run-1",
      message: "Searching documents",
    });
  });
});
