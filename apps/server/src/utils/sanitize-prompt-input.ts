const MAX_PROMPT_LENGTH = 1000;

export const sanitizePromptInput = (input: string): string => {
  return input
    .replace(/[<>]/g, "")
    .replace(/\{[\s\S]*?"role"[\s\S]*?\}/gi, "")
    .replace(/(system|user|assistant):/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
};
