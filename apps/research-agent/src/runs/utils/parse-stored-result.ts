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
