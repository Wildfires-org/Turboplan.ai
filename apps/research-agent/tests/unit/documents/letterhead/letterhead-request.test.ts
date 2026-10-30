import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import {
  buildLetterheadRequest,
  LETTERHEAD_MAX_TOKENS,
  parseLetterheadMessage,
} from "../../../../src/documents/letterhead/letterhead-request";
import { getLetterheadModelSettings } from "../../../../src/infra/model-provider";

/** The OpenRouter extras are not part of the SDK's type. */
type SentBody = Anthropic.MessageCreateParamsNonStreaming & {
  provider: unknown;
  plugins?: unknown;
};

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const haikuModel = (): string => {
  const settings = getLetterheadModelSettings({
    ANTHROPIC_API_KEY: "",
    OPENROUTER_API_KEY: "sk-or-key",
    CLAUDE_FAST_MODEL: "claude-haiku-4-5-20251001",
    CLAUDE_LETTERHEAD_MODEL: null,
  });
  if (!settings) {
    throw new Error("expected letterhead settings");
  }
  return settings.model;
};

describe("buildLetterheadRequest", () => {
  const request = buildLetterheadRequest(haikuModel(), {
    png,
    width: 1568,
    height: 609,
  }) as SentBody;

  it("sends the PNG as a base64 image block, before the prompt", () => {
    expect(request.messages).toHaveLength(1);
    const [message] = request.messages;
    expect(message.role).toBe("user");
    const content = message.content as Anthropic.ContentBlockParam[];
    expect(content[0]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: Buffer.from(png).toString("base64"),
      },
    });
    expect(content[1]).toMatchObject({ type: "text" });
  });

  it("asks with the layout prompt for the rendered size", () => {
    const content = request.messages[0]
      .content as Anthropic.ContentBlockParam[];
    const prompt = (content[1] as Anthropic.TextBlockParam).text;
    expect(prompt).toContain("1568x609 pixels");
    expect(prompt).toContain('"hasLetterhead"');
  });

  it("uses the OpenRouter slug and pins the provider, with no file parser", () => {
    expect(request.model).toBe("anthropic/claude-haiku-4.5");
    expect(request.max_tokens).toBe(LETTERHEAD_MAX_TOKENS);
    expect(request.provider).toEqual({
      order: ["anthropic"],
      allow_fallbacks: false,
    });
    expect(request.plugins).toBeUndefined();
    expect(request.system).toBeUndefined();
  });

  it("encodes only the view of the PNG it is given", () => {
    const backing = new Uint8Array([0, 0, ...png, 0]);
    const view = backing.subarray(2, 2 + png.length);
    const sent = buildLetterheadRequest("m", {
      png: view,
      width: 1,
      height: 1,
    });
    const content = sent.messages[0].content as Anthropic.ImageBlockParam[];
    expect((content[0].source as Anthropic.Base64ImageSource).data).toBe(
      Buffer.from(png).toString("base64"),
    );
  });
});

const message = (
  text: string,
  stopReason: Anthropic.Message["stop_reason"] = "end_turn",
): Pick<Anthropic.Message, "content" | "stop_reason" | "usage"> => ({
  content: [{ type: "text", text, citations: null }],
  stop_reason: stopReason,
  usage: { input_tokens: 1650, output_tokens: 240 } as Anthropic.Usage,
});

const answer = {
  hasLetterhead: true,
  blocks: [
    {
      role: "name",
      lines: ["Forest Service"],
      wordmark: false,
      box: { x: 500, y: 100, width: 200, height: 50 },
    },
  ],
};

describe("parseLetterheadMessage", () => {
  it("reads a bare JSON answer with its token counts", () => {
    expect(parseLetterheadMessage(message(JSON.stringify(answer)))).toEqual({
      ok: true,
      output: answer,
      inputTokens: 1650,
      outputTokens: 240,
    });
  });

  it("reads the JSON out of a code fence or surrounding prose", () => {
    const fenced = `Here is the letterhead:\n\`\`\`json\n${JSON.stringify(answer, null, 2)}\n\`\`\`\nDone.`;
    expect(parseLetterheadMessage(message(fenced))).toMatchObject({
      ok: true,
      output: { hasLetterhead: true },
    });
  });

  it("fills parts the model left out", () => {
    expect(
      parseLetterheadMessage(message('{"hasLetterhead": false}')),
    ).toMatchObject({
      ok: true,
      output: { hasLetterhead: false, blocks: [] },
    });
  });

  it("rejects an answer without JSON, never quoting it", () => {
    const result = parseLetterheadMessage(
      message("Wind River Ranger District, 1403 W. Ramshorn"),
    );
    expect(result).toMatchObject({ ok: false, reason: "invalid-output" });
    expect(JSON.stringify(result)).not.toContain("Ramshorn");
  });

  it("rejects JSON cut off by the token limit", () => {
    const cut = JSON.stringify(answer).slice(0, 80);
    expect(parseLetterheadMessage(message(cut, "max_tokens"))).toMatchObject({
      ok: false,
      reason: "invalid-output",
      detail: expect.stringContaining("max_tokens"),
    });
  });

  it("rejects JSON of the wrong shape, naming only the field", () => {
    const result = parseLetterheadMessage(
      message('{"hasLetterhead": "Shoshone National Forest"}'),
    );
    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-output",
      detail: expect.stringContaining("hasLetterhead"),
    });
    expect(JSON.stringify(result)).not.toContain("Shoshone");
  });

  it("reports a refusal", () => {
    expect(parseLetterheadMessage(message("", "refusal"))).toMatchObject({
      ok: false,
      reason: "refused",
      inputTokens: 1650,
    });
  });
});
