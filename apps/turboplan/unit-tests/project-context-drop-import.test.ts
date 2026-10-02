import assert from "node:assert";
import { describe, it } from "node:test";

import type { GisZipSaveResult } from "@wildfires-org/turboplan-map/client";

import {
  createKeyedSerialQueue,
  createSerialQueue,
  type DropImportOptions,
  type DropRow,
  failUnfinishedRows,
  getDocumentDedupeKey,
  getKnownDocumentKeys,
  importDropItems,
  planDrop,
  pruneImportedDocuments,
  type QueuedDropItem,
  withTimeout,
} from "../lib/project-context-drop";

type TestFile = { name: string; type: string; size: number };

const NOW = Date.parse("2026-10-02T12:00:00.000Z");
const PDF = "application/pdf";
const ZIP = "application/zip";

const file = (name: string, type: string, size = 1024): TestFile => ({
  name,
  type,
  size,
});

const savedOneLayer: GisZipSaveResult = {
  added: 1,
  skipped: 0,
  failed: 0,
  layerNames: ["roads"],
  errors: [],
};

const never = <T>() => new Promise<T>(() => {});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** importDropItems with in-memory rows and fake uploads / map service. */
const createHarness = (
  overrides: Partial<DropImportOptions<TestFile>> = {},
) => {
  const rows = new Map<string, DropRow>();
  const calls: string[] = [];
  const imported = new Map<string, string>();

  const getRow = (id: string): DropRow => {
    const row = rows.get(id);
    if (!row) {
      throw new Error(`No row ${id}`);
    }
    return row;
  };

  const options: DropImportOptions<TestFile> = {
    documentQueue: createSerialQueue(),
    gisQueue: createSerialQueue(),
    updateRow: (id, patch) => rows.set(id, { ...getRow(id), ...patch }),
    failRow: (id, message) => {
      const [row] = failUnfinishedRows([getRow(id)], new Set([id]), message);
      rows.set(id, row);
    },
    isRowRemoved: () => false,
    loadKnownDocumentKeys: async () => new Set(imported.values()),
    uploadDocument: async ({ name }) => {
      calls.push(`upload ${name}`);
      return { id: `doc-${calls.length}` };
    },
    onDocumentImported: (documentId, key) => imported.set(documentId, key),
    uploadGisFile: async ({ name }) => {
      calls.push(`store ${name}`);
      return { url: `https://storage.test/${name}` };
    },
    saveGisLayers: async ({ name }) => {
      calls.push(`save ${name}`);
      return savedOneLayer;
    },
    timeouts: { documentUpload: 1000, gisUpload: 1000, gisProcessing: 1000 },
    now: () => NOW,
    ...overrides,
  };

  const plan = (files: TestFile[]): QueuedDropItem<TestFile>[] =>
    planDrop(files, new Set(), {
      acceptsDocuments: true,
      acceptsGisLayers: true,
    }).map((item) => {
      const row: DropRow = {
        id: `row-${rows.size + 1}`,
        name: item.name,
        kind: item.kind,
        phase: item.phase,
        message: item.message,
      };
      rows.set(row.id, row);
      return { ...item, row };
    });

  return { rows, calls, options, plan, getRow };
};

describe("createSerialQueue", () => {
  it("runs tasks in order and keeps going after a failure", async () => {
    const queue = createSerialQueue();
    const order: string[] = [];
    const first = queue.run(async () => {
      await wait(10);
      order.push("first");
    });
    const second = queue.run(async () => {
      order.push("second");
      throw new Error("boom");
    });
    const third = queue.run(async () => {
      order.push("third");
      return 3;
    });

    await first;
    await assert.rejects(second, /boom/);
    assert.strictEqual(await third, 3);
    assert.deepStrictEqual(order, ["first", "second", "third"]);
  });

  it("runs different keys side by side and one key in order", async () => {
    const queue = createKeyedSerialQueue();
    const order: string[] = [];
    const slow = queue.run("project-a", async () => {
      await wait(20);
      order.push("a1");
    });
    const sameKey = queue.run("project-a", async () => {
      order.push("a2");
    });
    const otherKey = queue.run("project-b", async () => {
      order.push("b1");
    });

    await Promise.all([slow, sameKey, otherKey]);
    assert.deepStrictEqual(order, ["b1", "a1", "a2"]);
  });
});

describe("withTimeout", () => {
  it("passes a fast result or error through", async () => {
    assert.strictEqual(await withTimeout(Promise.resolve(1), 50, "late"), 1);
    await assert.rejects(
      withTimeout(Promise.reject(new Error("failed")), 50, "late"),
      /failed/,
    );
  });

  it("rejects with the message when the step takes too long", async () => {
    await assert.rejects(withTimeout(never(), 10, "Too slow"), /Too slow/);
  });
});

describe("importDropItems", () => {
  it("routes documents and GIS files to their own queues", async () => {
    const ran: string[] = [];
    const recording = (label: string) => {
      const queue = createSerialQueue();
      return {
        run: <T>(task: () => Promise<T>) => {
          ran.push(label);
          return queue.run(task);
        },
      };
    };
    const harness = createHarness({
      documentQueue: recording("documents"),
      gisQueue: recording("gis"),
    });
    const items = harness.plan([
      file("plan.pdf", PDF),
      file("roads.zip", ZIP),
      file("photo.png", "image/png"),
      file("notes.pdf", PDF),
    ]);

    await importDropItems(items, harness.options);

    assert.deepStrictEqual(ran, ["documents", "gis", "documents"]);
    assert.deepStrictEqual(
      Array.from(harness.rows.values()).map((row) => [row.name, row.phase]),
      [
        ["plan.pdf", "registered"],
        ["roads.zip", "done"],
        ["photo.png", "error"],
        ["notes.pdf", "registered"],
      ],
    );
    assert.strictEqual(harness.getRow("row-1").registeredAt, NOW);
    assert.match(harness.getRow("row-2").message ?? "", /1 layer added/);
  });

  it("does not hold documents behind a hung GIS file, and times it out", async () => {
    const harness = createHarness({
      saveGisLayers: () => never(),
      timeouts: { documentUpload: 1000, gisUpload: 1000, gisProcessing: 50 },
    });
    const items = harness.plan([file("roads.zip", ZIP), file("plan.pdf", PDF)]);

    const done = importDropItems(items, harness.options);
    await wait(10);
    assert.strictEqual(harness.getRow("row-1").phase, "processing");
    assert.strictEqual(harness.getRow("row-2").phase, "registered");

    await done;
    assert.strictEqual(harness.getRow("row-1").phase, "error");
    assert.match(
      harness.getRow("row-1").message ?? "",
      /^Reading the GIS layers timed out/,
    );
  });

  it("moves on to the next GIS file once a hung one times out", async () => {
    let saves = 0;
    const harness = createHarness({
      saveGisLayers: async () => {
        saves += 1;
        return saves === 1 ? never() : savedOneLayer;
      },
      timeouts: { documentUpload: 1000, gisUpload: 1000, gisProcessing: 20 },
    });
    const items = harness.plan([file("a.zip", ZIP), file("b.zip", ZIP)]);

    await importDropItems(items, harness.options);
    assert.strictEqual(harness.getRow("row-1").phase, "error");
    assert.strictEqual(harness.getRow("row-2").phase, "done");
  });

  it("marks a document row failed when its upload times out", async () => {
    const harness = createHarness({
      uploadDocument: () => never(),
      timeouts: { documentUpload: 20, gisUpload: 1000, gisProcessing: 1000 },
    });
    await importDropItems(
      harness.plan([file("plan.pdf", PDF)]),
      harness.options,
    );
    assert.strictEqual(harness.getRow("row-1").phase, "error");
    assert.match(
      harness.getRow("row-1").message ?? "",
      /^Upload timed out after/,
    );
  });

  it("skips a row dismissed while it waited", async () => {
    const removed = new Set(["row-2"]);
    const harness = createHarness({ isRowRemoved: (id) => removed.has(id) });
    await importDropItems(
      harness.plan([file("a.pdf", PDF), file("b.pdf", PDF)]),
      harness.options,
    );
    assert.deepStrictEqual(harness.calls, ["upload a.pdf"]);
    assert.strictEqual(harness.getRow("row-2").phase, "queued");
  });

  it("skips the second copy of a document once the first is in", async () => {
    const harness = createHarness();
    await importDropItems(
      harness.plan([file("a.pdf", PDF), file("a.pdf", PDF)]),
      harness.options,
    );
    assert.deepStrictEqual(harness.calls, ["upload a.pdf"]);
    assert.strictEqual(harness.getRow("row-1").phase, "registered");
    assert.strictEqual(harness.getRow("row-2").phase, "duplicate");
  });

  it("collapses a copy dropped again while the first still uploads", async () => {
    const harness = createHarness({
      uploadDocument: async ({ name }) => {
        harness.calls.push(`upload ${name}`);
        await wait(10);
        return { id: "doc-1" };
      },
    });
    const first = importDropItems(
      harness.plan([file("big.pdf", PDF)]),
      harness.options,
    );
    const second = importDropItems(
      harness.plan([file("big.pdf", PDF)]),
      harness.options,
    );
    await Promise.all([first, second]);
    assert.deepStrictEqual(harness.calls, ["upload big.pdf"]);
    assert.strictEqual(harness.getRow("row-2").phase, "duplicate");
  });

  it("lets the second copy upload when the first failed", async () => {
    let attempts = 0;
    const harness = createHarness({
      uploadDocument: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("Network error");
        }
        return { id: "doc-2" };
      },
    });
    await importDropItems(
      harness.plan([file("a.pdf", PDF), file("a.pdf", PDF)]),
      harness.options,
    );
    assert.strictEqual(harness.getRow("row-1").phase, "error");
    assert.strictEqual(harness.getRow("row-1").message, "Network error");
    assert.strictEqual(harness.getRow("row-2").phase, "registered");
  });

  it("fails the row instead of leaving it waiting on an unexpected error", async () => {
    const harness = createHarness({
      loadKnownDocumentKeys: async () => {
        throw new Error("List exploded");
      },
    });
    await importDropItems(
      harness.plan([file("a.pdf", PDF), file("roads.zip", ZIP)]),
      harness.options,
    );
    assert.strictEqual(harness.getRow("row-1").phase, "error");
    assert.strictEqual(harness.getRow("row-1").message, "List exploded");
    assert.strictEqual(harness.getRow("row-2").phase, "done");
  });
});

describe("known document keys", () => {
  const listed = (id: string, name: string, size = 1024) => ({
    id,
    originalFilename: name,
    size,
  });

  it("adds imported documents the list does not show yet", () => {
    const imported = new Map([
      ["doc-new", getDocumentDedupeKey("new.pdf", 1024)],
    ]);
    const keys = getKnownDocumentKeys([listed("doc-1", "old.pdf")], imported);
    assert.deepStrictEqual(Array.from(keys).sort(), [
      "new.pdf:1024",
      "old.pdf:1024",
    ]);
  });

  it("lets the list decide once it has caught up", () => {
    const key = getDocumentDedupeKey("new.pdf", 1024);
    let imported: ReadonlyMap<string, string> = new Map([["doc-new", key]]);

    // The list now shows the import: forget it.
    imported = pruneImportedDocuments(imported, [listed("doc-new", "new.pdf")]);
    assert.strictEqual(imported.size, 0);

    // Deleted afterwards (gone from the list): no longer known.
    assert.strictEqual(getKnownDocumentKeys([], imported).has(key), false);
  });

  it("keeps imports the list has not caught up with", () => {
    const imported = new Map([["doc-new", "new.pdf:1024"]]);
    assert.strictEqual(
      pruneImportedDocuments(imported, [listed("doc-1", "old.pdf")]),
      imported,
    );
  });
});

describe("failUnfinishedRows", () => {
  it("fails only unfinished rows among the given ids", () => {
    const rows: DropRow[] = [
      { id: "a", name: "a.pdf", kind: "document", phase: "queued" },
      { id: "b", name: "b.pdf", kind: "document", phase: "uploading" },
      { id: "c", name: "c.pdf", kind: "document", phase: "registered" },
      { id: "d", name: "d.zip", kind: "gis", phase: "processing" },
    ];
    const result = failUnfinishedRows(rows, new Set(["a", "b", "c"]), "Oops");
    assert.deepStrictEqual(
      result.map(({ id, phase, message }) => [id, phase, message]),
      [
        ["a", "error", "Oops"],
        ["b", "error", "Oops"],
        ["c", "registered", undefined],
        ["d", "processing", undefined],
      ],
    );
  });
});
