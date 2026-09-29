import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ResearchAgentChatStatus,
  TERMINAL_RESEARCH_AGENT_CHAT_STATUSES,
} from "../src/types";

describe("TERMINAL_RESEARCH_AGENT_CHAT_STATUSES", () => {
  it("covers every finished status so their webhook secrets stop authenticating", () => {
    assert.deepEqual([...TERMINAL_RESEARCH_AGENT_CHAT_STATUSES].sort(), [
      ResearchAgentChatStatus.CANCELLED,
      ResearchAgentChatStatus.COMPLETED,
      ResearchAgentChatStatus.FAILED,
    ]);
  });

  it("leaves active statuses authenticable", () => {
    for (const status of [
      ResearchAgentChatStatus.INITIALIZING,
      ResearchAgentChatStatus.QUEUED,
      ResearchAgentChatStatus.RUNNING,
    ]) {
      assert.equal(
        TERMINAL_RESEARCH_AGENT_CHAT_STATUSES.includes(status),
        false,
      );
    }
  });
});
