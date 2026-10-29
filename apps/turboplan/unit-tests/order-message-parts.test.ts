import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type OrderedMessagePart,
  orderMessageParts,
} from "../lib/order-message-parts";

type Part = { type: string; label: string };

const QUICK_RESPONSES = "tool-generateQuickResponses";

// Only the field the helper reads, plus a label to tell parts apart.
const part = (type: string, label = type): Part => ({ type, label });

const labels = (entries: Array<OrderedMessagePart<Part>>) => {
  return entries.map(({ part, index }) => `${index}:${part.label}`);
};

describe("orderMessageParts", () => {
  it("keeps the order and indexes when there are no quick responses", () => {
    const parts = [
      part("step-start"),
      part("reasoning"),
      part("text"),
      part("tool-webSearch"),
    ];

    assert.deepEqual(labels(orderMessageParts(parts)), [
      "0:step-start",
      "1:reasoning",
      "2:text",
      "3:tool-webSearch",
    ]);
  });

  it("moves quick responses called mid-reply to the end, keeping their index", () => {
    const parts = [
      part("reasoning", "first-reasoning"),
      part(QUICK_RESPONSES, "chips"),
      part("step-start"),
      part("reasoning", "second-reasoning"),
      part("text", "answer"),
    ];

    assert.deepEqual(labels(orderMessageParts(parts)), [
      "0:first-reasoning",
      "2:step-start",
      "3:second-reasoning",
      "4:answer",
      "1:chips",
    ]);
  });

  it("keeps only the last of several quick-response parts, at the end", () => {
    const parts = [
      part(QUICK_RESPONSES, "early-chips"),
      part("text", "answer"),
      part(QUICK_RESPONSES, "late-chips"),
      part("text", "follow-up"),
    ];

    assert.deepEqual(labels(orderMessageParts(parts)), [
      "1:answer",
      "3:follow-up",
      "2:late-chips",
    ]);
  });

  it("leaves quick responses that are already last unchanged", () => {
    const parts = [
      part("reasoning"),
      part("text", "answer"),
      part(QUICK_RESPONSES, "chips"),
    ];

    assert.deepEqual(labels(orderMessageParts(parts)), [
      "0:reasoning",
      "1:answer",
      "2:chips",
    ]);
  });

  it("returns nothing for a message without parts", () => {
    assert.deepEqual(orderMessageParts([]), []);
  });
});
