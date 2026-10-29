import assert from "node:assert";
import { describe, it } from "node:test";

import { hasToolCallAfterText } from "../lib/ai/has-tool-call-after-text";

const TOOL = "generateQuickResponses";

const stopCondition = hasToolCallAfterText(TOOL);

type Steps = Parameters<typeof stopCondition>[0]["steps"];

// Only the fields the stop condition reads; real steps carry many more.
const step = (text: string, toolNames: string[] = []) => ({
  text,
  toolCalls: toolNames.map((toolName, index) => ({
    toolCallId: `call-${index}`,
    toolName,
    input: {},
  })),
});

const shouldStop = async (steps: Array<ReturnType<typeof step>>) => {
  return await stopCondition({ steps: steps as unknown as Steps });
};

describe("hasToolCallAfterText", () => {
  it("stops when the last step calls the tool after an earlier step wrote text", async () => {
    assert.strictEqual(
      await shouldStop([step("Here is the answer."), step("", [TOOL])]),
      true,
    );
  });

  it("stops when the text and the tool call are in the same step", async () => {
    assert.strictEqual(
      await shouldStop([step("Here is the answer.", [TOOL])]),
      true,
    );
  });

  it("keeps running when the tool is called before any text was written", async () => {
    assert.strictEqual(await shouldStop([step("", [TOOL])]), false);
    assert.strictEqual(
      await shouldStop([step("", ["webSearch"]), step("  \n\t ", [TOOL])]),
      false,
    );
  });

  it("keeps running when the last step did not call the tool", async () => {
    assert.strictEqual(
      await shouldStop([step("Here is the answer.", ["webSearch"])]),
      false,
    );
    assert.strictEqual(
      await shouldStop([step("", [TOOL]), step("Here is the answer.")]),
      false,
    );
  });

  it("keeps running before any step has finished", async () => {
    assert.strictEqual(await shouldStop([]), false);
  });
});
