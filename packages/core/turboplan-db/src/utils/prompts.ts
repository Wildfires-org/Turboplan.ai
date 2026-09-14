import type { PromptVersion } from "../types";

/**
 * Get the active version from a prompt's versions array.
 */
export function getActivePromptVersion(
  versions: PromptVersion[] | undefined,
): PromptVersion | null {
  if (!versions || versions.length === 0) {
    return null;
  }
  return versions.find((v) => v.isActive) || null;
}
