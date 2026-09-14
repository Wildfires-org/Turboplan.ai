import type { ModelMessage, TextStreamPart, ToolSet } from "ai";

import { TEST_PROMPTS } from "./basic";

export function compareMessages(
  firstMessage: ModelMessage,
  secondMessage: ModelMessage,
): boolean {
  if (firstMessage.role !== secondMessage.role) return false;

  if (
    !Array.isArray(firstMessage.content) ||
    !Array.isArray(secondMessage.content)
  ) {
    return false;
  }

  if (firstMessage.content.length !== secondMessage.content.length) {
    return false;
  }

  for (let i = 0; i < firstMessage.content.length; i++) {
    const item1 = firstMessage.content[i];
    const item2 = secondMessage.content[i];

    if (item1.type !== item2.type) return false;

    if (item1.type === "image" && item2.type === "image") {
      // if (item1.image.toString() !== item2.image.toString()) return false;
      // if (item1.mimeType !== item2.mimeType) return false;
    } else if (item1.type === "text" && item2.type === "text") {
      if (item1.text !== item2.text) return false;
    } else if (item1.type === "tool-result" && item2.type === "tool-result") {
      if (item1.toolCallId !== item2.toolCallId) return false;
    } else {
      return false;
    }
  }

  return true;
}

let deltaIdCounter = 0;
const nextDeltaId = () => `delta-${++deltaIdCounter}`;

const textToDeltas = (text: string): TextStreamPart<ToolSet>[] => {
  const deltas = text.split(" ").map((char) => ({
    type: "text-delta" as const,
    id: nextDeltaId(),
    text: `${char} `,
  }));

  return deltas;
};

const reasoningToDeltas = (text: string): TextStreamPart<ToolSet>[] => {
  const deltas = text.split(" ").map((char) => ({
    type: "reasoning-delta" as const,
    id: nextDeltaId(),
    text: `${char} `,
  }));

  return deltas;
};

export const getResponseChunksByPrompt = (
  prompt: ModelMessage[],
  isReasoningEnabled: boolean = false,
): Array<TextStreamPart<ToolSet>> => {
  const recentMessage = prompt.at(-1);

  if (!recentMessage) {
    throw new Error("No recent message found!");
  }

  if (isReasoningEnabled) {
    if (compareMessages(recentMessage, TEST_PROMPTS.USER_SKY)) {
      return [
        ...reasoningToDeltas("The sky is blue because of rayleigh scattering!"),
        ...textToDeltas("It's just blue duh!"),
        {
          type: "finish",
          finishReason: "stop",
          rawFinishReason: "stop",
          totalUsage: {
            inputTokens: 3,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokens: 10,
            outputTokenDetails: {
              textTokens: undefined,
              reasoningTokens: undefined,
            },
            totalTokens: 13,
          },
        },
      ];
    } else if (compareMessages(recentMessage, TEST_PROMPTS.USER_GRASS)) {
      return [
        ...reasoningToDeltas(
          "Grass is green because of chlorophyll absorption!",
        ),
        ...textToDeltas("It's just green duh!"),
        {
          type: "finish",
          finishReason: "stop",
          rawFinishReason: "stop",
          totalUsage: {
            inputTokens: 3,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokens: 10,
            outputTokenDetails: {
              textTokens: undefined,
              reasoningTokens: undefined,
            },
            totalTokens: 13,
          },
        },
      ];
    }
  }

  if (compareMessages(recentMessage, TEST_PROMPTS.USER_THANKS)) {
    return [
      ...textToDeltas("You're welcome!"),
      {
        type: "finish",
        finishReason: "stop",
        rawFinishReason: "stop",
        totalUsage: {
          inputTokens: 3,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: 10,
          outputTokenDetails: {
            textTokens: undefined,
            reasoningTokens: undefined,
          },
          totalTokens: 13,
        },
      },
    ];
  } else if (compareMessages(recentMessage, TEST_PROMPTS.USER_GRASS)) {
    return [
      ...textToDeltas("It's just green duh!"),
      {
        type: "finish",
        finishReason: "stop",
        rawFinishReason: "stop",
        totalUsage: {
          inputTokens: 3,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: 10,
          outputTokenDetails: {
            textTokens: undefined,
            reasoningTokens: undefined,
          },
          totalTokens: 13,
        },
      },
    ];
  } else if (compareMessages(recentMessage, TEST_PROMPTS.USER_SKY)) {
    return [
      ...textToDeltas("It's just blue duh!"),
      {
        type: "finish",
        finishReason: "stop",
        rawFinishReason: "stop",
        totalUsage: {
          inputTokens: 3,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: 10,
          outputTokenDetails: {
            textTokens: undefined,
            reasoningTokens: undefined,
          },
          totalTokens: 13,
        },
      },
    ];
  } else if (compareMessages(recentMessage, TEST_PROMPTS.USER_NEXTJS)) {
    return [
      ...textToDeltas("With Next.js, you can ship fast!"),

      {
        type: "finish",
        finishReason: "stop",
        rawFinishReason: "stop",
        totalUsage: {
          inputTokens: 3,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: 10,
          outputTokenDetails: {
            textTokens: undefined,
            reasoningTokens: undefined,
          },
          totalTokens: 13,
        },
      },
    ];
  } else if (
    compareMessages(recentMessage, TEST_PROMPTS.USER_IMAGE_ATTACHMENT)
  ) {
    return [
      ...textToDeltas("This painting is by Monet!"),
      {
        type: "finish",
        finishReason: "stop",
        rawFinishReason: "stop",
        totalUsage: {
          inputTokens: 3,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: 10,
          outputTokenDetails: {
            textTokens: undefined,
            reasoningTokens: undefined,
          },
          totalTokens: 13,
        },
      },
    ];
  }

  return [
    {
      type: "text-delta" as const,
      id: nextDeltaId(),
      text: "Unknown test prompt!",
    },
  ];
};
