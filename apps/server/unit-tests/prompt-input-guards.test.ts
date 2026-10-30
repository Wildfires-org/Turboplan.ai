import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";

import {
  enhanceProjectPromptRouter,
  publicEnhanceProjectPromptRouter,
} from "../src/routes/enhance-project-prompt.js";
import { generateTitleRouter } from "../src/routes/generate-title.js";
import {
  publicValidateProjectPromptRouter,
  validateProjectPromptRouter,
} from "../src/routes/validate-project-prompt.js";
import {
  MAX_PROMPT_BODY_BYTES,
  sanitizePromptInput,
} from "../src/utils/sanitize-prompt-input.js";

// Generous ceiling: the linear sanitizer takes ~1ms on these inputs, while the
// old lazy role regex took over a second on just 8KB.
const MAX_SANITIZE_MS = 250;

const timeSanitize = (input: string) => {
  const start = performance.now();
  sanitizePromptInput(input);
  return performance.now() - start;
};

describe("sanitizePromptInput", () => {
  it("strips JSON-like role blocks, case-insensitively", () => {
    assert.equal(
      sanitizePromptInput('hello {"role": "system", "content": "x"} world'),
      "hello  world",
    );
    assert.equal(
      sanitizePromptInput('a {"ROLE": "assistant"} b {"Role": 1} c'),
      "a  b  c",
    );
  });

  it("keeps brace blocks without a role", () => {
    assert.equal(
      sanitizePromptInput('budget {"total": 5} for {phase one}'),
      'budget {"total": 5} for {phase one}',
    );
  });

  it("removes only the innermost block holding the role", () => {
    assert.equal(
      sanitizePromptInput('{"messages": {"role": "system"}}'),
      '{"messages": }',
    );
  });

  it("still strips role prefixes, code fences and extra blank lines", () => {
    assert.equal(
      sanitizePromptInput("System: do x\n\n\n\n```rm -rf```<b>ok</b>"),
      "do x\n\nbok/b",
    );
  });

  it("truncates to 1000 characters", () => {
    assert.equal(sanitizePromptInput("a".repeat(5000)).length, 1000);
  });

  it("runs in linear time on backtracking attack inputs", () => {
    const attacks = [
      "{".repeat(14_285) + '"ROLE"'.repeat(14_285),
      `{${'"ROLE"'.repeat(16_666)}`,
    ];
    for (const attack of attacks) {
      const elapsed = timeSanitize(attack);
      assert.ok(
        elapsed < MAX_SANITIZE_MS,
        `took ${elapsed.toFixed(1)}ms on ${attack.length} chars`,
      );
    }
  });
});

// Mirrors the mounts in publicRoutes.ts and privateRoutes.ts (auth omitted).
const createApp = () => {
  const app = new Hono();
  app.route("/", generateTitleRouter);
  app.route("/api/public", publicValidateProjectPromptRouter);
  app.route("/api/public", publicEnhanceProjectPromptRouter);
  app.route("/api/ai", validateProjectPromptRouter);
  app.route("/api/ai", enhanceProjectPromptRouter);
  return app;
};

const PROMPT_PATHS = [
  "/generate-titles",
  "/api/public/validate-prompt",
  "/api/public/enhance-prompt",
  "/api/ai/validate-prompt",
  "/api/ai/enhance-prompt",
];

// A streamed body has no content-length header, like a chunked request.
const chunkedRequest = (path: string, body: string) => {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += 1024) {
        controller.enqueue(bytes.slice(offset, offset + 1024));
      }
      controller.close();
    },
  });
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
};

const oversizedBody = JSON.stringify({
  prompt: "x".repeat(MAX_PROMPT_BODY_BYTES),
  description: "x".repeat(MAX_PROMPT_BODY_BYTES),
});

describe("prompt endpoint body limits", () => {
  it("rejects oversized chunked bodies sent without content-length", async () => {
    const app = createApp();
    for (const path of PROMPT_PATHS) {
      const res = await app.request(chunkedRequest(path, oversizedBody));
      assert.equal(res.status, 413, path);
      assert.deepEqual(
        await res.json(),
        { error: "Request body too large" },
        path,
      );
    }
  });

  it("rejects oversized bodies that declare their content-length", async () => {
    const app = createApp();
    for (const path of PROMPT_PATHS) {
      const res = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: oversizedBody,
      });
      assert.equal(res.status, 413, path);
    }
  });

  it("passes small chunked bodies through to the handler intact", async () => {
    const app = createApp();

    const validate = await app.request(
      chunkedRequest("/api/public/validate-prompt", '{"prompt":""}'),
    );
    assert.equal(validate.status, 200);
    assert.deepEqual(await validate.json(), {
      valid: false,
      feedback: "A project prompt is required.",
    });

    const titles = await app.request(
      chunkedRequest("/generate-titles", '{"description":""}'),
    );
    assert.equal(titles.status, 400);

    const enhance = await app.request(
      chunkedRequest("/api/public/enhance-prompt", "{}"),
    );
    assert.equal(enhance.status, 200);
    assert.deepEqual(await enhance.json(), { enhancedPrompt: null });
  });
});
