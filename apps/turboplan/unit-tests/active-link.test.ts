import assert from "node:assert";
import { describe, it } from "node:test";

import { isProjectChatRoute } from "../lib/nav/activeLink";

const ORG = "usfs";
const OFFICE = "my-projects";
const PROJECT = "jackson-creek";
const PROJECT_URL = `/${ORG}/${OFFICE}/${PROJECT}`;

const isChat = (currentPath: string) => {
  return isProjectChatRoute(currentPath, ORG, OFFICE, PROJECT);
};

describe("isProjectChatRoute", () => {
  it("is true on the project's chat pages", () => {
    assert.strictEqual(isChat(`${PROJECT_URL}/chats/new`), true);
    assert.strictEqual(isChat(`${PROJECT_URL}/chats/abc-123`), true);
    assert.strictEqual(isChat(`${PROJECT_URL}/chats`), true);
    assert.strictEqual(isChat(`${PROJECT_URL}/chats/abc-123/`), true);
  });

  it("is true on the legacy /chat page", () => {
    assert.strictEqual(isChat(`${PROJECT_URL}/chat`), true);
  });

  it("is false on other project pages", () => {
    assert.strictEqual(isChat(PROJECT_URL), false);
    assert.strictEqual(isChat(`${PROJECT_URL}/tasks`), false);
    assert.strictEqual(isChat(`${PROJECT_URL}/overview`), false);
  });

  it("matches whole segments only", () => {
    assert.strictEqual(isChat(`${PROJECT_URL}/chatsy`), false);
    assert.strictEqual(isChat(`${PROJECT_URL}/chat-history`), false);
  });

  it("is false on another project's chats", () => {
    assert.strictEqual(isChat(`/${ORG}/${OFFICE}/other/chats/new`), false);
  });

  it("ignores slugs that start with chat", () => {
    assert.strictEqual(
      isProjectChatRoute(
        "/chat-org/chats/chat/tasks",
        "chat-org",
        "chats",
        "chat",
      ),
      false,
    );
    assert.strictEqual(
      isProjectChatRoute("/chat-org/chats/chat", "chat-org", "chats", "chat"),
      false,
    );
    assert.strictEqual(
      isProjectChatRoute(
        "/chat-org/chats/chat/chats/new",
        "chat-org",
        "chats",
        "chat",
      ),
      true,
    );
  });
});
