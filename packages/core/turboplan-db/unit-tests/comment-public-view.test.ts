import assert from "node:assert";
import { describe, it } from "node:test";

import { toPublicComment } from "../src/queries/comment-public-view";
import type { CommentWithAuthor } from "../src/queries/comments";

const makeComment = (
  overrides: Partial<CommentWithAuthor> = {},
): CommentWithAuthor => {
  return {
    id: "c1",
    projectId: "p1",
    userId: "u1",
    parentCommentId: null,
    content: "Hello",
    isPublic: true,
    isAutoResponse: false,
    targetUserId: "u2",
    autoResponderName: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    author: {
      id: "u1",
      email: "author@example.test",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      jobTitle: "Planner",
    },
    ...overrides,
  };
};

describe("toPublicComment", () => {
  it("drops the author email and auto-response target", () => {
    const result = toPublicComment(makeComment());

    assert.strictEqual(result.author.email, null);
    assert.strictEqual(result.targetUserId, null);
  });

  it("keeps the fields the public UI renders", () => {
    const result = toPublicComment(makeComment());

    assert.strictEqual(result.userId, "u1");
    assert.strictEqual(result.content, "Hello");
    assert.deepStrictEqual(
      {
        id: result.author.id,
        firstName: result.author.firstName,
        lastName: result.author.lastName,
        jobTitle: result.author.jobTitle,
      },
      { id: "u1", firstName: "Ada", lastName: "Lovelace", jobTitle: "Planner" },
    );
  });

  it("strips the same fields from every reply", () => {
    const reply = makeComment({
      id: "r1",
      parentCommentId: "c1",
      author: { ...makeComment().author, email: "replier@example.test" },
    });
    const result = toPublicComment(makeComment({ replies: [reply] }));

    assert.strictEqual(result.replies?.length, 1);
    assert.strictEqual(result.replies?.[0].author.email, null);
    assert.strictEqual(result.replies?.[0].targetUserId, null);
  });

  it("does not mutate the input", () => {
    const input = makeComment();
    toPublicComment(input);

    assert.strictEqual(input.author.email, "author@example.test");
    assert.strictEqual(input.targetUserId, "u2");
  });
});
