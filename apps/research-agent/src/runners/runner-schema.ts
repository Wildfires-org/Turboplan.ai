import { z } from "zod";

// Mirrors the SDK result message's own field names so the persisted JSON
// reads the same as the agent's `done` log line.
export const runStatsSchema = z.object({
  num_turns: z.number(),
  duration_ms: z.number(),
  total_cost_usd: z.number(),
});

const agentProgressSchema = z.object({
  type: z.literal("progress"),
  role: z.string(),
  content: z.string(),
});

const agentResultSchema = z.object({
  type: z.literal("result"),
  result: z.string(),
  stats: runStatsSchema.optional(),
});

const agentErrorSchema = z.object({
  type: z.literal("error"),
  msg: z.string(),
  status: z.number(),
  stats: runStatsSchema.optional(),
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
export type RunStats = z.infer<typeof runStatsSchema>;
