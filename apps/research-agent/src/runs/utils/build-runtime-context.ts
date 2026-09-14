import type { AgentSkill } from "../types";

type RelevantMemory = {
  title: string;
  content: string;
  keywords: string[];
};

type RuntimeContextParams = {
  targetApiUrl: string;
  skill?: AgentSkill;
  projectId?: string;
  webhookSecret: string;
  relevantMemories?: RelevantMemory[];
};

export function buildRuntimeContext(params: RuntimeContextParams): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const folderTs = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}h`;

  const lines = [
    "",
    "---",
    "## RUNTIME CONTEXT",
    "CLARIFYING_QUESTIONS_ALLOWED: false",
    "If information is missing, make reasonable assumptions and continue.",
    "Do not ask the user follow-up or clarifying questions.",
    `Folder Format: ${folderTs}`,
    `TARGET_API_URL: available as $TARGET_API_URL environment variable — use it directly in curl commands`,
    'WEBHOOK_SECRET: available as $WEBHOOK_SECRET environment variable — use it directly in curl (e.g. -H "x-webhook-secret: $WEBHOOK_SECRET")',
    'RUN_ID: available as $RUN_ID environment variable — use it directly in curl (e.g. -H "x-run-id: $RUN_ID")',
  ];

  if (params.skill) {
    lines.push("");
    lines.push("## MANDATORY SKILL");
    lines.push(
      `You MUST accomplish the user's task using the \`${params.skill}\` skill.`,
    );
    lines.push(
      `Invoke it via Skill("${params.skill}") with the full user prompt as the argument. The skill defines the workflow — follow it to completion.`,
    );
  }

  if (params.projectId) {
    lines.push(`Project ID: ${params.projectId}`);
  }

  if (params.relevantMemories && params.relevantMemories.length > 0) {
    lines.push("");
    lines.push("## RELEVANT MEMORIES FROM PAST RUNS");
    lines.push(
      "The following insights were discovered in previous runs and may be relevant:",
    );
    lines.push("");
    params.relevantMemories.forEach((memory, idx) => {
      lines.push(`### ${idx + 1}. ${memory.title}`);
      lines.push(memory.content);
      lines.push(`Keywords: ${memory.keywords.join(", ")}`);
      lines.push("");
    });
  }

  return lines.join("\n");
}
