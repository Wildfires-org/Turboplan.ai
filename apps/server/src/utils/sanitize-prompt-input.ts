const MAX_PROMPT_LENGTH = 1000;

// Request body cap for the prompt endpoints. The sanitizer runs on the whole
// string before truncating, so this bounds its work as well as what an
// anonymous caller can make us buffer.
export const MAX_PROMPT_BODY_BYTES = 10_000;

export const sanitizePromptInput = (input: string): string => {
  return (
    input
      .replace(/[<>]/g, "")
      // Remove JSON-like role definitions: any innermost {...} containing
      // "role". Testing "role" in a callback keeps this linear — a single
      // regex with "role" between two unbounded runs backtracks polynomially.
      .replace(/\{[^{}]*\}/g, (block) => (/"role"/i.test(block) ? "" : block))
      .replace(/(system|user|assistant):/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_PROMPT_LENGTH)
  );
};
