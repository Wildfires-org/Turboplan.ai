import { describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@wildfires-org/turboplan-db/queries", () => {
  const record =
    <T>(name: string, value: T) =>
    async () => {
      queries.calls.push(name);
      return value;
    };
  return {
    failExhaustedProjectDocumentLetterheads: record("sweep project", 0),
    failExhaustedOrganizationDocumentLetterheads: record(
      "sweep organization",
      0,
    ),
    getProjectDocumentsPendingLetterhead: record("pending project", []),
    getOrganizationDocumentsPendingLetterhead: record(
      "pending organization",
      [],
    ),
    claimProjectDocumentLetterhead: record("claim project", 1),
    claimOrganizationDocumentLetterhead: record("claim organization", 1),
    updateProjectDocumentLetterhead: async () => true,
    updateOrganizationDocumentLetterhead: async () => true,
  };
});

import { createLetterheadAnalysis } from "../../../../src/documents/letterhead/create-letterhead-analysis";
import { createWorkerGate } from "../../../../src/documents/worker-gate";

describe("createLetterheadAnalysis", () => {
  it("creates no loop when the analysis is off", () => {
    expect(createLetterheadAnalysis(null)).toBeNull();
    expect(queries.calls).toEqual([]);
  });

  it("fails exhausted rows, then drains project then organization documents when on", async () => {
    const loop = createLetterheadAnalysis({
      baseURL: "https://openrouter.ai/api",
      authToken: "sk-or-key",
      model: "anthropic/claude-haiku-4.5",
    });
    expect(loop).not.toBeNull();

    loop?.start();
    await vi.waitFor(() => expect(queries.calls).toHaveLength(4));
    await loop?.stop();

    expect(queries.calls).toEqual([
      "sweep project",
      "sweep organization",
      "pending project",
      "pending organization",
    ]);
  });

  it("takes a logo store and a worker gate", () => {
    const loop = createLetterheadAnalysis(
      {
        baseURL: "https://openrouter.ai/api",
        authToken: "sk-or-key",
        model: "anthropic/claude-haiku-4.5",
      },
      {
        storeLogo: async () => "letterheads/project/doc/logo-0.png",
        workerGate: createWorkerGate(),
      },
    );
    expect(loop).not.toBeNull();
  });
});
