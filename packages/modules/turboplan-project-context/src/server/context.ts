import { getProjectContextByProjectId } from "./repository";

/**
 * Load project context entries and format them as a system prompt context block.
 * Returns undefined if no context entries exist for this project.
 */
export async function getProjectContextForChat(
  projectId: string,
): Promise<string | undefined> {
  const entries = await getProjectContextByProjectId(projectId);

  if (entries.length === 0) return undefined;

  const lines = entries
    .map((e) => {
      let line = `- **${e.label}**: ${e.content}`;
      if (e.url) {
        line += ` (Source: ${e.url})`;
      }
      return line;
    })
    .join("\n");

  return `# PROJECT CONTEXT\nThe following context has been confirmed and saved for this project:\n\n${lines}`;
}
