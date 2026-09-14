import { type RunRecord } from "../run-engine-store";
import { type RunRecordContext } from "../types";

export const toRunRecordContext = (run: RunRecord): RunRecordContext => ({
  runId: run.runId,
  prompt: run.prompt,
  projectId: run.projectId,
  webhookSecret: run.webhookSecret,
  targetApiUrl: run.targetApiUrl,
});
