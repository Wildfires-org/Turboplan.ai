import type { LanguageModel } from "ai";
import { generateObject } from "ai";

import { meterAiCall } from "@wildfires-org/turboplan-billing/server";

import { taskUpdateAnalysisPrompt } from "../prompts";
import {
  type AIAnalysisResult,
  aiAnalysisResultSchema,
} from "../schemas/ai-interface";
import type { MilestoneWithTasks, User } from "../types";

/**
 * AI Task Analyzer
 *
 * Responsible for analyzing user requests and determining what operations
 * need to be performed on tasks and milestones.
 */
export class AITaskAnalyzer {
  constructor(
    private model: LanguageModel,
    /** Billing target; the invoking chat already ran the gate. */
    private billing?: { organizationId: string; userId?: string } | null,
  ) {}

  async analyzeUpdateRequest(
    description: string,
    currentMilestones: MilestoneWithTasks[],
    availableUsers: User[],
    allProjectTasks?: MilestoneWithTasks[], // Optional: all tasks across project for deduplication
  ): Promise<AIAnalysisResult> {
    const result = await generateObject({
      model: this.model,
      prompt: taskUpdateAnalysisPrompt(
        description,
        currentMilestones,
        availableUsers,
        allProjectTasks,
      ),
      schema: aiAnalysisResultSchema,
    });

    await meterAiCall({
      billing: this.billing,
      source: "tasks",
      usage: result.usage,
      providerMetadata: result.providerMetadata,
      metadata: { tool: "tasksArtifactUpdate" },
    });

    return result.object as AIAnalysisResult;
  }
}
