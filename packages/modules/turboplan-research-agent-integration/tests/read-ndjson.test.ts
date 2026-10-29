import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readNdjson } from "../src/client/read-ndjson";

const encoder = new TextEncoder();

const streamOf = (chunks: Array<string | Uint8Array>) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === "string" ? encoder.encode(chunk) : chunk,
        );
      }
      controller.close();
    },
  });

const collect = async <T>(stream: ReadableStream<Uint8Array>) => {
  const values: T[] = [];
  for await (const value of readNdjson<T>(stream)) {
    values.push(value);
  }
  return values;
};

describe("readNdjson", () => {
  it("yields one value per line", async () => {
    const values = await collect(streamOf(['{"a":1}\n{"a":2}\n']));
    assert.deepEqual(values, [{ a: 1 }, { a: 2 }]);
  });

  it("joins a line split across chunks", async () => {
    const values = await collect(
      streamOf(['{"type":"ch', 'ip","n":1}\n{"type"', ':"done"}\n']),
    );
    assert.deepEqual(values, [{ type: "chip", n: 1 }, { type: "done" }]);
  });

  it("reads a last line without a trailing newline", async () => {
    const values = await collect(streamOf(['{"a":1}\n', '{"a":2}']));
    assert.deepEqual(values, [{ a: 1 }, { a: 2 }]);
  });

  it("skips blank lines and tolerates CRLF", async () => {
    const values = await collect(
      streamOf(['\n{"a":1}\r\n\n   \n', '{"a":2}\r\n\n']),
    );
    assert.deepEqual(values, [{ a: 1 }, { a: 2 }]);
  });

  it("decodes a multi-byte character split across chunks", async () => {
    const bytes = encoder.encode('{"emoji":"🔥"}\n');
    const splitAt = bytes.indexOf(0xf0) + 2;
    const values = await collect(
      streamOf([bytes.slice(0, splitAt), bytes.slice(splitAt)]),
    );
    assert.deepEqual(values, [{ emoji: "🔥" }]);
  });

  it("yields nothing for an empty stream", async () => {
    assert.deepEqual(await collect(streamOf([])), []);
  });

  it("throws on a malformed line", async () => {
    await assert.rejects(
      collect(streamOf(['{"a":1}\n', "not json\n"])),
      SyntaxError,
    );
  });

  it("cancels the stream when the consumer stops early", async () => {
    let isCancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Left open: a further read would wait forever.
        controller.enqueue(encoder.encode('{"a":1}\n{"a":2}\n'));
      },
      cancel() {
        isCancelled = true;
      },
    });

    for await (const value of readNdjson(stream)) {
      assert.deepEqual(value, { a: 1 });
      break;
    }

    assert.equal(isCancelled, true);
  });
});
