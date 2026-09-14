export type PromptErrorCode =
  | "HARDCODED_VERSION"
  | "ACTIVE_VERSION"
  | "LAST_VERSION"
  | "VERSION_NOT_FOUND"
  | "PROMPT_NOT_FOUND";

export class PromptError extends Error {
  code: PromptErrorCode;

  constructor(code: PromptErrorCode, message: string) {
    super(message);
    this.name = "PromptError";
    this.code = code;
  }
}
