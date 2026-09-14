import { z } from "zod";

const agentProgressSchema = z.object({
  type: z.literal("progress"),
  role: z.string(),
  content: z.string(),
});

const agentResultSchema = z.object({
  type: z.literal("result"),
  result: z.string(),
});

const agentErrorSchema = z.object({
  type: z.literal("error"),
  msg: z.string(),
  status: z.number(),
});

export const agentOutputLineSchema = z.discriminatedUnion("type", [
  agentProgressSchema,
  agentResultSchema,
  agentErrorSchema,
]);

export type AgentOutputLine = z.infer<typeof agentOutputLineSchema>;
export type AgentProgressLine = z.infer<typeof agentProgressSchema>;
export type AgentResultLine = z.infer<typeof agentResultSchema>;
export type AgentErrorLine = z.infer<typeof agentErrorSchema>;
