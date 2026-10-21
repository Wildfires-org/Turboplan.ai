/**
 * One letterhead request: the rendered header in, the model's reading of it
 * out.
 *
 * The PNG travels base64-encoded in an `image` block — never as a URL. The
 * request goes to OpenRouter's Anthropic-compatible endpoint with `provider`
 * pinned to Anthropic and no fallbacks (an OpenRouter-only body field; the SDK
 * posts the body unchanged, so a type cast is all it needs), so the image is
 * read by the model that was measured, at the size it was rendered.
 */

import type Anthropic from "@anthropic-ai/sdk";

import {
  buildLetterheadAnalysisPrompt,
  type LetterheadAnalysisOutput,
  letterheadAnalysisOutputSchema,
} from "@wildfires-org/turboplan-document-extraction/letterhead";

/** Measured: 75–450 output tokens; a cut-off answer is invalid JSON anyway. */
export const LETTERHEAD_MAX_TOKENS = 1_200;

export type LetterheadImage = {
  png: Uint8Array;
  width: number;
  height: number;
};

export const buildLetterheadRequest = (
  model: string,
  { png, width, height }: LetterheadImage,
): Anthropic.MessageCreateParamsNonStreaming => {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: LETTERHEAD_MAX_TOKENS,
    // The same page must give the same layout every time: at the default
    // temperature one header read as 4, 3 and 2 columns.
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: Buffer.from(
                png.buffer,
                png.byteOffset,
                png.byteLength,
              ).toString("base64"),
            },
          },
          {
            type: "text",
            text: buildLetterheadAnalysisPrompt({ width, height }),
          },
        ],
      },
    ],
  };

  return {
    ...params,
    provider: { order: ["anthropic"], allow_fallbacks: false },
  } as Anthropic.MessageCreateParamsNonStreaming;
};

export type LetterheadReading = {
  inputTokens: number;
  outputTokens: number;
} & (
  | { ok: true; output: LetterheadAnalysisOutput }
  | {
      ok: false;
      reason: "refused" | "invalid-output";
      /** For logs only: never the answer's text, which quotes the document. */
      detail: string;
    }
);

/** The outermost `{...}` of the answer, tolerating prose or code fences. */
const extractJsonObject = (text: string): string | null => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const parseLetterheadMessage = (
  message: Pick<Anthropic.Message, "content" | "stop_reason" | "usage">,
): LetterheadReading => {
  const usage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
  const stopReason = message.stop_reason ?? "none";
  if (message.stop_reason === "refusal") {
    return {
      ok: false,
      reason: "refused",
      detail: "The model refused",
      ...usage,
    };
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const json = extractJsonObject(text);
  // JSON.parse and zod messages can quote the answer, so neither is logged.
  const parsed = json === null ? undefined : parseJson(json);
  if (parsed === undefined) {
    return {
      ok: false,
      reason: "invalid-output",
      detail: `No JSON object in the answer (stop ${stopReason})`,
      ...usage,
    };
  }

  const result = letterheadAnalysisOutputSchema.safeParse(parsed);
  if (!result.success) {
    const paths = result.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .join(", ");
    return {
      ok: false,
      reason: "invalid-output",
      detail: `Answer does not match the schema at ${paths} (stop ${stopReason})`,
      ...usage,
    };
  }
  return { ok: true, output: result.data, ...usage };
};
