import { describe, expect, it } from "vitest";

import type { LetterheadGridDraft } from "@wildfires-org/turboplan-document-extraction/letterhead";

import type { PendingDocument } from "../../../../src/documents/document-poll-loop";
import {
  createLetterheadAnalysisService,
  formatLetterheadLogLine,
  type LetterheadSource,
  type LetterheadUpdate,
  toStoredGrid,
} from "../../../../src/documents/letterhead/analysis-service";
import type {
  LetterheadFailureReason,
  LetterheadTaskResult,
} from "../../../../src/documents/letterhead/analysis-task";
import type { WorkerGate } from "../../../../src/documents/worker-gate";
import type { Logger } from "../../../../src/infra/logger";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const silentLogger: Logger = { log: () => {}, error: () => {} };

const doc = (
  id: string,
  overrides: Partial<PendingDocument> = {},
): PendingDocument => ({
  id,
  url: `https://files.example.com/${id}.pdf`,
  mimeType: "application/pdf",
  originalFilename: `${id}.pdf`,
  ...overrides,
});

const stats = {
  renderMs: 180,
  modelMs: 3900,
  inputTokens: 1650,
  outputTokens: 240,
  logoSource: "pdf" as const,
  logoCount: 1,
  lineCount: 3,
  printedLineCount: 3,
};

const SEAL = new Uint8Array([1]);
const RIGHT_SEAL = new Uint8Array([2]);

const textCell = (x: number, width: number, texts: string[]) => ({
  kind: "text" as const,
  x,
  width,
  align: "left" as const,
  lines: texts.map((text) => ({ text, bold: true, size: "normal" as const })),
});

const draft: LetterheadGridDraft = {
  cells: [
    { kind: "logo", x: 0, width: 0.1, height: 0.1, png: SEAL },
    textCell(0.12, 0.2, ["United States", "Department of Agriculture"]),
    textCell(0.4, 0.3, ["Forest Service"]),
    { kind: "logo", x: 0.9, width: 0.1, height: 0.1, png: RIGHT_SEAL },
  ],
  color: "#1f5f3a",
};

const found: LetterheadTaskResult = {
  ok: true,
  analysis: { hasLetterhead: true, grid: draft },
  stats: { ...stats, logoCount: 2 },
};

const notFound: LetterheadTaskResult = {
  ok: true,
  analysis: { hasLetterhead: false, grid: null },
  stats: { ...stats, logoSource: "none", logoCount: 0 },
};

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 2_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

type Persisted = { source: string; id: string; update: LetterheadUpdate };

/** A source that serves `documents` on its first fetch and nothing after. */
const oneBatchSource = (
  name: string,
  documents: PendingDocument[],
  persisted: Persisted[],
  overrides: Partial<LetterheadSource> = {},
): LetterheadSource => {
  let served = false;
  return {
    name,
    fetchPending: async () => {
      if (served) {
        return [];
      }
      served = true;
      return documents;
    },
    claim: async () => 1,
    failExhausted: async () => 0,
    persist: async (id, update) => {
      persisted.push({ source: name, id, update });
      return true;
    },
    ...overrides,
  };
};

const failure = (reason: LetterheadFailureReason): LetterheadTaskResult => ({
  ok: false,
  reason,
  detail: `${reason} detail`,
  stats,
});

describe("toStoredGrid", () => {
  it("stores each logo crop in reading order by its key and keeps the text cells", async () => {
    const stored: [Uint8Array, number][] = [];
    const grid = await toStoredGrid(draft, async (png, index) => {
      stored.push([png, index]);
      return `letterheads/project/doc/logo-${index}.png`;
    });

    expect(stored).toEqual([
      [SEAL, 0],
      [RIGHT_SEAL, 1],
    ]);
    expect(grid?.color).toBe("#1f5f3a");
    expect(grid?.cells).toEqual([
      {
        kind: "logo",
        x: 0,
        width: 0.1,
        height: 0.1,
        key: "letterheads/project/doc/logo-0.png",
      },
      draft.cells[1],
      draft.cells[2],
      {
        kind: "logo",
        x: 0.9,
        width: 0.1,
        height: 0.1,
        key: "letterheads/project/doc/logo-1.png",
      },
    ]);
  });

  it("keeps the vertical alignment of text and logo cells", async () => {
    const aligned: LetterheadGridDraft = {
      ...draft,
      cells: draft.cells.map((cell, index) =>
        index === 0
          ? { ...cell, valign: "bottom" as const }
          : { ...cell, valign: "middle" as const },
      ),
    };
    const grid = await toStoredGrid(
      aligned,
      async (_png, index) => `letterheads/project/doc/logo-${index}.png`,
    );
    expect(grid.cells.map((cell) => [cell.kind, cell.valign])).toEqual([
      ["logo", "bottom"],
      ["text", "middle"],
      ["text", "middle"],
      ["logo", "middle"],
    ]);
  });

  it("keeps the base text size, and leaves it out when the draft has none", async () => {
    const sized = await toStoredGrid({ ...draft, fontSize: 0.0123 }, null);
    expect(sized.fontSize).toBe(0.0123);

    const unsized = await toStoredGrid(draft, null);
    expect("fontSize" in unsized).toBe(false);
  });

  it("drops the logo cells whose crop was not stored, and all of them without a store", async () => {
    const partial = await toStoredGrid(draft, async (_png, index) =>
      index === 0 ? "letterheads/project/doc/logo-0.png" : null,
    );
    expect(partial?.cells.map((cell) => cell.kind)).toEqual([
      "logo",
      "text",
      "text",
    ]);

    const failing = await toStoredGrid(draft, async () => {
      throw new Error("upload failed");
    });
    expect(failing?.cells.map((cell) => cell.kind)).toEqual(["text", "text"]);

    const noStore = await toStoredGrid(draft, null);
    expect(noStore?.cells).toEqual([draft.cells[1], draft.cells[2]]);
  });

  it("gives up on a store that throws synchronously or takes too long", async () => {
    const throwing = await toStoredGrid(draft, () => {
      throw new Error("not async");
    });
    expect(throwing.cells.map((cell) => cell.kind)).toEqual(["text", "text"]);

    const hanging = await toStoredGrid(
      draft,
      (_png, index) =>
        index === 0
          ? new Promise<string | null>(() => {})
          : Promise.resolve("letterheads/project/doc/logo-1.png"),
      20,
    );
    expect(hanging.cells.map((cell) => cell.kind)).toEqual([
      "text",
      "text",
      "logo",
    ]);
  });
});

describe("letterhead analysis service", () => {
  it("stores done with the grid, none without a letterhead, failed on a permanent failure", async () => {
    const persisted: Persisted[] = [];
    const results: Record<string, LetterheadTaskResult> = {
      "https://files.example.com/agency.pdf": found,
      "https://files.example.com/report.pdf": notFound,
      "https://files.example.com/gone.pdf": {
        ok: false,
        reason: "fetch-failed",
        detail: "HTTP 404",
        stats: { ...stats, renderMs: 0, modelMs: 0, logoSource: "none" },
      },
      "https://files.example.com/garbled.pdf": {
        ok: false,
        reason: "invalid-output",
        detail: "No JSON object in the answer (stop end_turn)",
        stats,
      },
    };
    const storedLogos: { documentId: string; index: number }[] = [];

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource(
          "project",
          [doc("agency"), doc("report"), doc("gone"), doc("garbled")],
          persisted,
        ),
      ],
      analyze: async ({ url }) => results[url],
      storeLogo: async (_png, context) => {
        storedLogos.push({
          documentId: context.documentId,
          index: context.index,
        });
        return `letterheads/${context.source}/${context.documentId}/logo-${context.index}.png`;
      },
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => persisted.length === 3);
    await service.stop();

    expect(storedLogos).toEqual([
      { documentId: "agency", index: 0 },
      { documentId: "agency", index: 1 },
    ]);
    // The failed download is temporary: "gone" stays pending, nothing stored.
    expect(persisted.map(({ id, update }) => [id, update.status])).toEqual([
      ["agency", "done"],
      ["report", "none"],
      ["garbled", "failed"],
    ]);
    expect(persisted[0].update.analysis).toEqual({
      hasLetterhead: true,
      grid: {
        color: "#1f5f3a",
        cells: [
          {
            kind: "logo",
            x: 0,
            width: 0.1,
            height: 0.1,
            key: "letterheads/project/agency/logo-0.png",
          },
          draft.cells[1],
          draft.cells[2],
          {
            kind: "logo",
            x: 0.9,
            width: 0.1,
            height: 0.1,
            key: "letterheads/project/agency/logo-1.png",
          },
        ],
      },
    });
    expect(persisted[1].update.analysis).toEqual({
      hasLetterhead: false,
      grid: null,
    });
    expect(persisted[2].update.analysis).toBeNull();
    expect(service.getStatus()).toMatchObject({ processed: 2, failed: 2 });
  });

  it("stores none for a letterhead of logos alone whose logos could not be stored", async () => {
    const persisted: Persisted[] = [];
    const lockupOnly: LetterheadTaskResult = {
      ...found,
      analysis: {
        hasLetterhead: true,
        grid: {
          color: null,
          cells: [{ kind: "logo", x: 0, width: 1, height: 0.2, png: SEAL }],
        },
      },
    };

    const service = createLetterheadAnalysisService({
      sources: [oneBatchSource("project", [doc("lockup")], persisted)],
      analyze: async () => lockupOnly,
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => persisted.length === 1);
    await service.stop();

    expect(persisted[0].update).toEqual({
      status: "none",
      analysis: { hasLetterhead: false, grid: null },
    });
  });

  it("keeps the grid without its logos when no logo storage is configured", async () => {
    const persisted: Persisted[] = [];
    const warnings: string[] = [];

    const service = createLetterheadAnalysisService({
      sources: [oneBatchSource("project", [doc("agency")], persisted)],
      analyze: async () => found,
      logger: {
        log: (message, level) => {
          if (level === "warning") {
            warnings.push(message);
          }
        },
        error: () => {},
      },
    });

    service.start();
    await waitFor(() => persisted.length === 1);
    await service.stop();

    expect(persisted[0].update).toEqual({
      status: "done",
      analysis: {
        hasLetterhead: true,
        grid: { color: "#1f5f3a", cells: [draft.cells[1], draft.cells[2]] },
      },
    });
    expect(warnings).toEqual([
      "[letterhead] agency.pdf: 2 logo(s) not stored (no logo storage configured)",
    ]);
  });

  it("marks a non-PDF none without downloading or calling the model", async () => {
    const persisted: Persisted[] = [];
    const analyzed: string[] = [];

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource(
          "organization",
          [
            doc("memo", {
              url: "https://files.example.com/memo.docx",
              mimeType: DOCX_MIME,
              originalFilename: "memo.docx",
            }),
            doc("letter", { mimeType: " Application/PDF " }),
          ],
          persisted,
        ),
      ],
      analyze: async ({ url }) => {
        analyzed.push(url);
        return found;
      },
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => persisted.length === 2);
    await service.stop();

    expect(analyzed).toEqual(["https://files.example.com/letter.pdf"]);
    expect(persisted[0]).toEqual({
      source: "organization",
      id: "memo",
      update: {
        status: "none",
        analysis: { hasLetterhead: false, grid: null },
      },
    });
    expect(persisted[1].update.status).toBe("done");
  });

  it("leaves a document pending when the worker throws, and keeps going", async () => {
    const persisted: Persisted[] = [];
    const analyzed: string[] = [];

    const service = createLetterheadAnalysisService({
      sources: [oneBatchSource("project", [doc("a"), doc("b")], persisted)],
      analyze: async ({ url }) => {
        analyzed.push(url);
        if (url.endsWith("a.pdf")) {
          throw new Error("worker spawn failed");
        }
        return found;
      },
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => persisted.length === 1);
    await service.stop();

    expect(analyzed).toHaveLength(2);
    expect(persisted.map(({ id, update }) => [id, update.status])).toEqual([
      ["b", "done"],
    ]);
  });

  it("keeps processing the batch when a write fails or the row is gone", async () => {
    const attempted: string[] = [];

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource("project", [doc("a"), doc("b"), doc("c")], [], {
          persist: async (id) => {
            attempted.push(id);
            if (id === "a") {
              throw new Error("db down");
            }
            // "b" was deleted meanwhile: the update matches no row.
            return id !== "b";
          },
        }),
      ],
      analyze: async () => found,
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => attempted.length === 3);
    await service.stop();

    expect(attempted).toEqual(["a", "b", "c"]);
  });

  it("analyzes one document at a time, project documents before organization ones", async () => {
    const order: string[] = [];
    let busy = 0;
    let maxBusy = 0;

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource("project", [doc("p1"), doc("p2")], []),
        oneBatchSource("organization", [doc("o1")], []),
      ],
      analyze: async ({ url }) => {
        busy += 1;
        maxBusy = Math.max(maxBusy, busy);
        order.push(url.split("/").pop() ?? url);
        await new Promise((resolve) => setTimeout(resolve, 5));
        busy -= 1;
        return found;
      },
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => order.length === 3);
    await service.stop();

    expect(maxBusy).toBe(1);
    expect(order).toEqual(["p1.pdf", "p2.pdf", "o1.pdf"]);
  });

  it("asks each source for a batch of 5", async () => {
    const limits: number[] = [];

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource("project", [], [], {
          fetchPending: async (limit) => {
            limits.push(limit);
            return [];
          },
        }),
      ],
      analyze: async () => found,
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => limits.length === 1);
    await service.stop();

    expect(limits).toEqual([5]);
  });

  it("logs one line per document with the grid's shape, never its text", async () => {
    const lines: string[] = [];

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource(
          "project",
          [
            doc("agency", { originalFilename: "Agency letter.pdf" }),
            doc("memo", { mimeType: DOCX_MIME, originalFilename: "memo.docx" }),
          ],
          [],
        ),
      ],
      analyze: async () => found,
      storeLogo: async () => "letterheads/project/agency/logo-0.png",
      logger: {
        log: (message) => {
          if (message.startsWith("[letterhead]")) {
            lines.push(message);
          }
        },
        error: () => {},
      },
    });

    service.start();
    await waitFor(() => lines.length === 2);
    await service.stop();

    expect(lines).toEqual([
      "[letterhead] Agency letter.pdf: done, 2 text cell(s) / 3 line(s) / 2 logo(s) / colour #1f5f3a, logos pdf x2, lines printed 3/3, render 180 ms, model 3900 ms, tokens in 1650 / out 240",
      "[letterhead] memo.docx: none (not a PDF)",
    ]);
    expect(lines.join("\n")).not.toContain("Forest Service");
  });
});

describe("letterhead analysis attempts", () => {
  it("claims each PDF right before its analysis, and skips one no longer pending", async () => {
    const events: string[] = [];

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource(
          "project",
          [
            doc("a"),
            doc("deleted"),
            doc("memo", { mimeType: DOCX_MIME, originalFilename: "memo.docx" }),
            doc("b"),
          ],
          [],
          {
            claim: async (id) => {
              events.push(`claim ${id}`);
              return id === "deleted" ? null : 1;
            },
            persist: async (id, update) => {
              events.push(`persist ${id} ${update.status}`);
              return true;
            },
          },
        ),
      ],
      analyze: async ({ url }) => {
        events.push(`analyze ${url.split("/").pop()}`);
        return notFound;
      },
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => events.includes("persist b none"));
    await service.stop();

    // A non-PDF runs no worker, so it is not claimed.
    expect(events).toEqual([
      "claim a",
      "analyze a.pdf",
      "persist a none",
      "claim deleted",
      "persist memo none",
      "claim b",
      "analyze b.pdf",
      "persist b none",
    ]);
  });

  it("stores failed for a permanent failure and leaves a temporary one pending", async () => {
    const persisted: Persisted[] = [];
    const reasons: LetterheadFailureReason[] = [
      "unreadable",
      "refused",
      "invalid-output",
      "fetch-failed",
      "timeout",
      "worker-failed",
    ];
    const warnings: string[] = [];

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource(
          "project",
          reasons.map((reason) => doc(reason)),
          persisted,
          { claim: async () => 2 },
        ),
      ],
      analyze: async ({ url }) =>
        failure(
          url.split("/").pop()?.replace(".pdf", "") as LetterheadFailureReason,
        ),
      batchSize: reasons.length,
      logger: {
        log: (message, level) => {
          if (level === "warning" && message.includes("left pending")) {
            warnings.push(message);
          }
        },
        error: () => {},
      },
    });

    service.start();
    await waitFor(() => service.getStatus().failed === reasons.length);
    await service.stop();

    expect(persisted).toEqual(
      ["unreadable", "refused", "invalid-output"].map((id) => ({
        source: "project",
        id,
        update: { status: "failed", analysis: null },
      })),
    );
    expect(warnings).toEqual([
      "[letterhead] fetch-failed.pdf: attempt 2 failed (fetch-failed), left pending",
      "[letterhead] timeout.pdf: attempt 2 failed (timeout), left pending",
      "[letterhead] worker-failed.pdf: attempt 2 failed (worker-failed), left pending",
    ]);
  });

  it("starts every pass by failing the rows out of attempts, a failing source not stopping it", async () => {
    const events: string[] = [];
    const warnings: string[] = [];

    const source = (name: string, swept: () => Promise<number>) =>
      oneBatchSource(name, [], [], {
        failExhausted: async () => {
          events.push(`sweep ${name}`);
          return swept();
        },
        fetchPending: async () => {
          events.push(`fetch ${name}`);
          return [];
        },
      });

    const service = createLetterheadAnalysisService({
      sources: [
        source("project", async () => {
          throw new Error("db down");
        }),
        source("organization", async () => 2),
      ],
      analyze: async () => found,
      logger: {
        log: (message, level) => {
          if (level === "warning") {
            warnings.push(message);
          }
        },
        error: () => {},
      },
    });

    service.start();
    await waitFor(() => events.length >= 4);
    await service.stop();

    expect(events.slice(0, 4)).toEqual([
      "sweep project",
      "sweep organization",
      "fetch project",
      "fetch organization",
    ]);
    expect(warnings).toContain(
      "[organization] 2 document(s) out of letterhead analysis attempts, marked failed",
    );
  });

  it("stops the pass on an API error and starts none until the back-off is over", async () => {
    let now = 1_000;
    const pending = new Set(["a", "b"]);
    const analyzed: string[] = [];
    const fetched: string[] = [];
    let apiDown = true;

    const service = createLetterheadAnalysisService({
      sources: [
        {
          name: "project",
          fetchPending: async () => {
            fetched.push("project");
            return [...pending].map((id) => doc(id));
          },
          claim: async () => 1,
          failExhausted: async () => 0,
          persist: async (id) => {
            pending.delete(id);
            return true;
          },
        },
        oneBatchSource("organization", [doc("o1")], [], {
          fetchPending: async () => {
            fetched.push("organization");
            return [];
          },
        }),
      ],
      analyze: async ({ url }) => {
        analyzed.push(url.split("/").pop() ?? url);
        return apiDown ? failure("api-error") : found;
      },
      apiErrorBackoffMs: 300_000,
      pollIntervalMs: 5,
      now: () => now,
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => analyzed.length === 1);
    // Many poll intervals: no pass while paused.
    await new Promise((resolve) => setTimeout(resolve, 60));

    // "b" and the organization documents waited; "a" is still pending.
    expect(analyzed).toEqual(["a.pdf"]);
    expect(fetched).toEqual(["project"]);
    expect(pending).toEqual(new Set(["a", "b"]));

    apiDown = false;
    now += 299_999;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(analyzed).toEqual(["a.pdf"]);

    now += 1;
    await waitFor(() => pending.size === 0);
    await service.stop();

    expect(analyzed).toEqual(["a.pdf", "a.pdf", "b.pdf"]);
  });

  it("claims and analyzes while holding the worker gate, and stores after it", async () => {
    const events: string[] = [];
    const workerGate: WorkerGate = async (task) => {
      events.push("gate held");
      try {
        return await task();
      } finally {
        events.push("gate released");
      }
    };

    const service = createLetterheadAnalysisService({
      sources: [
        oneBatchSource("project", [doc("a")], [], {
          claim: async () => {
            events.push("claim");
            return 1;
          },
          persist: async () => {
            events.push("persist");
            return true;
          },
        }),
      ],
      analyze: async () => {
        events.push("analyze");
        return notFound;
      },
      workerGate,
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => events.includes("persist"));
    await service.stop();

    expect(events).toEqual([
      "gate held",
      "claim",
      "analyze",
      "gate released",
      "persist",
    ]);
  });
});

describe("formatLetterheadLogLine", () => {
  it("names the failure reason and detail, and says when the worker gave no stats", () => {
    expect(
      formatLetterheadLogLine("scan.pdf", {
        ok: false,
        reason: "timeout",
        detail: "Letterhead analysis timed out after 60000ms",
      }),
    ).toBe(
      "[letterhead] scan.pdf: failed (timeout), no stats — Letterhead analysis timed out after 60000ms",
    );
  });

  it("reports a page without a letterhead as none", () => {
    expect(formatLetterheadLogLine("report.pdf", notFound)).toBe(
      "[letterhead] report.pdf: none (no letterhead), logos none, lines printed 3/3, render 180 ms, model 3900 ms, tokens in 1650 / out 240",
    );
  });
});
