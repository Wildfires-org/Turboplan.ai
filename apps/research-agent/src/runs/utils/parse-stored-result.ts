import type { RunStats } from "../../runners/runner-schema";

/**
 * Serialize a run result for `research_agent_runs.result_json`. With stats the
 * row holds `{ result, stats }` (read back by {@link parseStoredResult});
 * without, the bare JSON string it always held.
 */
export const serializeRunResult = (result: string, stats?: RunStats): string =>
  JSON.stringify(stats ? { result, stats } : result);

export function parseStoredResult(
  resultJson: string | null | undefined,
): string | undefined {
  if (!resultJson) return undefined;

  try {
    const parsed = JSON.parse(resultJson) as unknown;
    if (typeof parsed === "string") return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      "result" in parsed &&
      typeof (parsed as { result?: unknown }).result === "string"
    ) {
      return (parsed as { result: string }).result;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
