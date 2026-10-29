import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDraftCheckpointer } from "../lib/artifacts/draft-checkpoint.js";

const setup = ({
  save = async () => {},
}: {
  save?: (content: string) => Promise<void>;
} = {}) => {
  let clock = 0;
  const saved: string[] = [];
  const errors: unknown[] = [];
  const checkpointer = createDraftCheckpointer({
    intervalMs: 5_000,
    save: async (content) => {
      await save(content);
      saved.push(content);
    },
    onError: (error) => {
      errors.push(error);
    },
    now: () => clock,
  });

  return {
    ...checkpointer,
    saved,
    errors,
    advance: (ms: number) => {
      clock += ms;
    },
  };
};

describe("createDraftCheckpointer", () => {
  it("saves at most once per interval", async () => {
    const draft = setup();

    draft.offer("a");
    draft.advance(5_000);
    draft.offer("ab");
    await draft.settle();
    draft.advance(1_000);
    draft.offer("abc");
    await draft.settle();

    assert.deepEqual(draft.saved, ["ab"]);
  });

  it("skips content that was already saved", async () => {
    const draft = setup();

    draft.advance(5_000);
    draft.offer("ab");
    await draft.settle();
    draft.advance(5_000);
    draft.offer("ab");
    await draft.settle();

    assert.deepEqual(draft.saved, ["ab"]);
  });

  it("never overlaps saves, and settle waits for the one in flight", async () => {
    let release: () => void = () => {};
    const draft = setup({
      save: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });

    draft.advance(5_000);
    draft.offer("ab");
    draft.advance(5_000);
    draft.offer("abc");

    const settled = draft.settle();
    release();
    await settled;

    assert.deepEqual(draft.saved, ["ab"]);
  });

  it("reports a failed save and keeps checkpointing", async () => {
    let shouldFail = true;
    const draft = setup({
      save: async () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("db down");
        }
      },
    });

    draft.advance(5_000);
    draft.offer("ab");
    await draft.settle();
    draft.advance(5_000);
    draft.offer("ab");
    await draft.settle();

    assert.equal(draft.errors.length, 1);
    assert.deepEqual(draft.saved, ["ab"]);
  });
});
